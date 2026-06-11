#!/usr/bin/env bash
# launch-worktree.sh — create-if-missing a git worktree, then open a Kitty
# window (nvim/claude/server tabs) + browser on a Niri workspace below the
# active one. Usable standalone (`launch-worktree.sh <name>`) or as a
# WorktreeCreate hook (reads worktree_name from stdin JSON, echoes the path).
set -euo pipefail

# ---- config knobs -----------------------------------------------------------
BASE_PORT="${BASE_PORT:-8000}"
BROWSER_CMD="${BROWSER_CMD:-xdg-open}"
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

if command -v kitty >/dev/null 2>&1; then
  run kitty --title "$NAME" --session "$SESSION_FILE" &
else
  echo "warn: kitty not found; skipping terminal launch" >&2
fi

# ---- open the app in a browser window ---------------------------------------
run $BROWSER_CMD "http://localhost:$PORT"

# ---- move the Kitty window to the Niri workspace below the active one --------
if command -v niri >/dev/null 2>&1; then
  # small settle so the window exists before we move it
  [[ "$DRY_RUN" == 1 ]] || sleep 0.4
  run niri msg action move-column-to-workspace-down
  run niri msg action focus-workspace-down
else
  echo "warn: niri not found; skipping workspace placement" >&2
fi

# ---- hook contract: echo the worktree path ----------------------------------
echo "$WT_DIR"
