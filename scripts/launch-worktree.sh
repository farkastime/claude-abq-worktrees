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
# Print the 1-based idx of the focused workspace (empty if niri/no focus).
niri_focused_ws_idx() {
  niri msg --json workspaces 2>/dev/null | python3 -c '
import sys, json
try:
    ws = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for w in ws:
    if w.get("is_focused"):
        print(w.get("idx", "")); break
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

# Move window id $1 to workspace idx $2 without stealing focus.
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

# Target workspace = the empty one just below the currently focused workspace.
TARGET_WS=""
if [[ "$DRY_RUN" == 1 ]]; then
  TARGET_WS="<below>"   # placeholder so dry-run shows the placement commands
elif [[ "$HAVE_NIRI" == 1 ]]; then
  cur_idx="$(niri_focused_ws_idx)"
  [[ -n "$cur_idx" ]] && TARGET_WS=$((cur_idx + 1))
fi

# ---- launch the Kitty window, then move it to the target workspace -----------
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

if [[ "$DRY_RUN" == 1 ]]; then
  niri_move_window_to_ws "<kitty-id>" "$TARGET_WS"
elif [[ "$HAVE_NIRI" == 1 && -n "$TARGET_WS" && -n "$KITTY_PID" ]]; then
  kid="$(wait_window_for_pid "$KITTY_PID" || true)"
  [[ -n "$kid" ]] && niri_move_window_to_ws "$kid" "$TARGET_WS"
fi

# ---- open the app in its own browser window, then move it too ---------------
# Snapshot window ids so we can find the newly-created browser window.
ids_before=""
[[ "$HAVE_NIRI" == 1 && "$DRY_RUN" != 1 ]] && ids_before="$(niri_window_ids)"

run $BROWSER_CMD "http://localhost:$PORT"

if [[ "$DRY_RUN" == 1 ]]; then
  niri_move_window_to_ws "<browser-id>" "$TARGET_WS"
elif [[ "$HAVE_NIRI" == 1 && -n "$TARGET_WS" ]]; then
  bid=""; tries=0
  while [[ $tries -lt 40 ]]; do
    bid="$(comm -13 <(printf '%s\n' "$ids_before" | sort) <(niri_window_ids | sort) | head -n1)"
    [[ -n "$bid" ]] && break
    sleep 0.1; tries=$((tries + 1))
  done
  [[ -n "$bid" ]] && niri_move_window_to_ws "$bid" "$TARGET_WS"
fi

# ---- finally, focus the target workspace so you land on the new setup --------
if [[ "$HAVE_NIRI" == 1 && -n "$TARGET_WS" ]]; then
  run niri msg action focus-workspace "$TARGET_WS"
elif [[ "$HAVE_NIRI" != 1 ]]; then
  echo "warn: niri not found; skipping workspace placement" >&2
fi

# ---- hook contract: echo the worktree path ----------------------------------
echo "$WT_DIR"
