#!/usr/bin/env bash
# test/launch-worktree.test.sh — dry-run assertions for the launcher.
set -uo pipefail
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/scripts/launch-worktree.sh"
fail=0
check() { # check <description> <pattern> <output>
  if grep -qE "$2" <<<"$3"; then echo "ok: $1"; else echo "FAIL: $1 (no match: $2)"; fail=1; fi
}

out="$($SCRIPT --dry-run demo-wt 2>&1)"

check "creates worktree" 'git worktree add .*/\.claude/worktrees/demo-wt' "$out"
check "branch name" 'worktree-demo-wt' "$out"
check "picks a port >= 8000" 'http\.server .*(8[0-9]{3}|9[0-9]{3})' "$out"
check "serves the worktree dir explicitly" 'http\.server --directory .*/\.claude/worktrees/demo-wt' "$out"
check "launches kitty" '\bkitty\b' "$out"
check "nvim tab" '\bnvim\b' "$out"
check "claude tab" 'claude --name demo-wt' "$out"
check "opens browser in new window" 'firefox --new-window http://localhost:[0-9]+' "$out"
check "moves kitty to bottom-empty ws" 'move-window-to-workspace --window-id <kitty-id> --focus false <bottom-empty-ws>' "$out"
check "focuses kitty window before browser" 'niri msg action focus-window --id <kitty-id>' "$out"

exit $fail
