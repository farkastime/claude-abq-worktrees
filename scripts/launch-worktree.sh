#!/usr/bin/env bash
# launch-worktree.sh — create-if-missing a git worktree, then open a Kitty
# window (nvim/claude/server tabs) + browser on a Niri workspace below the
# active one. Usable standalone (`launch-worktree.sh <name>`) or as a
# WorktreeCreate hook (reads worktree_name from stdin JSON, echoes the path).
set -euo pipefail

# ---- config knobs -----------------------------------------------------------
BASE_PORT="${BASE_PORT:-8000}"
# Open the app in its OWN new window so we can place it on the worktree's
# workspace. `xdg-open` reuses an existing browser window on another workspace,
# so it would silently land elsewhere — use a browser that takes --new-window.
BROWSER_CMD="${BROWSER_CMD:-firefox --new-window}"
SERVER_CMD="${SERVER_CMD:-python3 -m http.server}"
EDITOR_CMD="${EDITOR_CMD:-nvim}"
# -----------------------------------------------------------------------------

DRY_RUN=0
NAME=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) NAME="$arg" ;;
  esac
done

# run <cmd...> : execute, or just print in dry-run mode.
run() {
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '%s\n' "$*"
  else
    "$@"
  fi
}

# ---- niri helpers -----------------------------------------------------------
# Print the id of the workspace to place the new worktree on: the bottom-most
# EMPTY workspace on the focused output. Niri keeps a trailing empty workspace
# per monitor, and renumbers idx dynamically — so we target by stable id, not
# idx, and pick the last empty one. This way each successive worktree lands on
# its own fresh empty workspace below the previous, instead of piling onto it.
niri_target_ws_id() {
  { niri msg --json workspaces 2>/dev/null; echo "---SPLIT---"; niri msg --json windows 2>/dev/null; } \
    | python3 -c '
import sys, json
raw = sys.stdin.read()
try:
    ws_raw, win_raw = raw.split("---SPLIT---")
    ws = json.loads(ws_raw)
    wins = json.loads(win_raw)
except Exception:
    sys.exit(0)

focused = next((w for w in ws if w.get("is_focused")), None)
if not focused:
    sys.exit(0)
output = focused.get("output")

occupied = {w.get("workspace_id") for w in wins}
# Workspaces on the focused output, in display order (top to bottom).
same = [w for w in ws if w.get("output") == output]
same.sort(key=lambda w: w.get("idx", 0))
# The bottom-most empty workspace on this output is our target.
empties = [w for w in same if w.get("id") not in occupied]
if empties:
    print(empties[-1].get("id"))
'
}

# Print the set of current window ids, one per line.
niri_window_ids() {
  niri msg --json windows 2>/dev/null | python3 -c '
import sys, json
try:
    for w in json.load(sys.stdin): print(w["id"])
except Exception:
    pass
'
}

# Print the id of the first window whose pid matches $1 (empty if none).
niri_window_id_for_pid() {
  niri msg --json windows 2>/dev/null | python3 -c '
import sys, json
pid = int(sys.argv[1])
try:
    for w in json.load(sys.stdin):
        if w.get("pid") == pid:
            print(w["id"]); break
except Exception:
    pass
' "$1"
}

# Poll up to ~3s for a window matching pid $1; print its id when it appears.
wait_window_for_pid() {
  local pid="$1" id="" tries=0
  while [[ $tries -lt 30 ]]; do
    id="$(niri_window_id_for_pid "$pid")"
    [[ -n "$id" ]] && { echo "$id"; return 0; }
    sleep 0.1; tries=$((tries + 1))
  done
  return 1
}

# Move window id $1 to workspace reference $2 without stealing focus.
niri_move_window_to_ws() {
  run niri msg action move-window-to-workspace --window-id "$1" --focus false "$2"
}

ROOT="$(git rev-parse --show-toplevel)"

# Hook mode: no name on argv and stdin is not a TTY → parse worktree_name JSON.
if [[ -z "$NAME" && ! -t 0 ]]; then
  STDIN_JSON="$(cat)"
  NAME="$(sed -n 's/.*"worktree_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<<"$STDIN_JSON")"
fi
if [[ -z "$NAME" ]]; then
  echo "usage: launch-worktree.sh [--dry-run] <worktree-name>" >&2
  exit 2
fi

WT_DIR="$ROOT/.claude/worktrees/$NAME"
BRANCH="worktree-$NAME"

# ---- create if missing ------------------------------------------------------
if [[ "$DRY_RUN" == 1 ]] || [[ ! -d "$WT_DIR" ]]; then
  if git -C "$ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    run git worktree add "$WT_DIR" "$BRANCH"
  else
    run git worktree add "$WT_DIR" -b "$BRANCH"
  fi
fi

# ---- pick first free port from BASE_PORT ------------------------------------
free_port() {
  local p="$BASE_PORT"
  while :; do
    if ! { exec 3<>"/dev/tcp/127.0.0.1/$p"; } 2>/dev/null; then
      echo "$p"; return 0
    fi
    exec 3>&- 2>/dev/null || true
    p=$((p + 1))
  done
}
PORT="$(free_port)"

echo "worktree: $WT_DIR  branch: $BRANCH  port: $PORT" >&2

# ---- build a Kitty session file: one window, three tabs ---------------------
SESSION_FILE="$(mktemp -t wt-kitty-XXXX.session)"
SESSION_CONTENT="$(cat <<EOF
new_tab nvim
cd $WT_DIR
launch --title nvim $EDITOR_CMD

new_tab claude
cd $WT_DIR
launch --title claude claude --name $NAME

new_tab server
cd $WT_DIR
launch --title server $SERVER_CMD $PORT
EOF
)"
printf '%s\n' "$SESSION_CONTENT" >"$SESSION_FILE"

# In dry-run, surface the session file so its tabs/commands are observable.
[[ "$DRY_RUN" == 1 ]] && printf 'kitty-session>\n%s\n' "$SESSION_CONTENT"

# Detect niri once; placement is best-effort and only runs when present.
HAVE_NIRI=0
if command -v niri >/dev/null 2>&1; then HAVE_NIRI=1; fi

# Placement strategy (Niri dynamic workspaces):
#   1. Launch Kitty; find its window id by pid.
#   2. Move Kitty to the bottom EMPTY workspace on the focused output (found by
#      stable id, read fresh right before the move).
#   3. Focus the Kitty window by id — this reliably switches to its workspace.
#   4. NOW launch the browser. New windows spawn on the focused workspace, so the
#      browser is born next to Kitty — no browser move needed. (Moving a window
#      to a workspace by numeric reference is unreliable under Niri's dynamic
#      workspace renumbering, so we avoid it for the browser entirely.)
# Each successive worktree lands on its own fresh empty workspace below the
# previous one, with its Kitty + browser together.

# ---- launch the Kitty window ------------------------------------------------
KITTY_PID=""
if command -v kitty >/dev/null 2>&1; then
  if [[ "$DRY_RUN" == 1 ]]; then
    run kitty --title "$NAME" --session "$SESSION_FILE"
  else
    kitty --title "$NAME" --session "$SESSION_FILE" &
    KITTY_PID=$!
  fi
else
  echo "warn: kitty not found; skipping terminal launch" >&2
fi

# ---- move Kitty to the bottom-empty workspace, then focus it ----------------
KID=""
if [[ "$DRY_RUN" == 1 ]]; then
  niri_move_window_to_ws "<kitty-id>" "<bottom-empty-ws>"
  run niri msg action focus-window --id "<kitty-id>"
elif [[ "$HAVE_NIRI" == 1 && -n "$KITTY_PID" ]]; then
  KID="$(wait_window_for_pid "$KITTY_PID" || true)"
  if [[ -n "$KID" ]]; then
    target="$(niri_target_ws_id)"
    [[ -n "$target" ]] && niri_move_window_to_ws "$KID" "$target"
    # Focus Kitty so the browser (launched next) spawns on the same workspace.
    run niri msg action focus-window --id "$KID"
  fi
fi

# ---- open the app in its own browser window (spawns on Kitty's workspace) ----
run $BROWSER_CMD "http://localhost:$PORT"

[[ "$HAVE_NIRI" != 1 ]] && echo "warn: niri not found; skipping workspace placement" >&2

# ---- hook contract: echo the worktree path ----------------------------------
echo "$WT_DIR"
