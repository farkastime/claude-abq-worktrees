# Worktrees Workshop Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three follow-along tutorial docs (plain worktrees, Claude worktrees, hooks) and one Niri/Kitty/Neovim launcher script for the git-worktrees workshop.

**Architecture:** Markdown tutorials with copy-pasteable command blocks. A single bash launcher script (`scripts/launch-worktree.sh`) that creates-if-missing then opens a Kitty window (nvim/claude/server tabs) + browser on a Niri workspace below the active one, with a `--dry-run` mode that makes its command sequence testable.

**Tech Stack:** Markdown, bash, git worktrees, Kitty (`kitty @`/session files), Niri (`niri msg action`), `xdg-open`.

---

## File Structure

```
docs/tutorials/01-git-worktrees.md     — plain git worktrees, no Claude
docs/tutorials/02-claude-worktrees.md  — claude --worktree commands
docs/tutorials/03-worktree-hooks.md    — WorktreeCreate/WorktreeRemove hooks
scripts/launch-worktree.sh             — Niri launcher (create-if-missing + windows)
test/launch-worktree.test.sh           — dry-run assertions for the launcher
```

---

## Task 1: Tutorial — plain git worktrees

**Files:**
- Create: `docs/tutorials/01-git-worktrees.md`

- [ ] **Step 1: Write the tutorial**

Content (full markdown — copy-pasteable command blocks, the constraint, and the "why"):

```markdown
# 1. Git Worktrees (the basics)

A **worktree** lets one git repository have multiple working directories checked
out at once — each on its own branch. The repo's history is shared; only the
working files differ.

> The one rule: **a branch checked out in one worktree cannot be checked out in
> another.** Git refuses, because two directories editing the same branch would
> fight over `HEAD`.

## Add a worktree

From the main repo:

\`\`\`bash
# create a new worktree in a sibling dir, on a brand-new branch
git worktree add ../wator-feature1 -b feature1
\`\`\`

This creates `../wator-feature1/` with `feature1` checked out. Navigate in and
work normally:

\`\`\`bash
cd ../wator-feature1
# ...edit files, run the app, etc.
git add -A
git commit -m "work on feature1"
\`\`\`

## List worktrees

\`\`\`bash
git worktree list
\`\`\`

## Merge the work back

From the main worktree (on `main`):

\`\`\`bash
cd ../wator            # back to the main checkout
git merge feature1
\`\`\`

## Remove a worktree

\`\`\`bash
git worktree remove ../wator-feature1
git worktree prune     # clean up stale administrative entries
\`\`\`

If the worktree has uncommitted changes, `remove` refuses; add `--force` to
override (you lose those changes).

## A demo workflow

\`\`\`bash
# 1. on main, make a change
echo "// main edit" >> src/main.js
git commit -am "edit on main"

# 2. spin up a worktree and edit there
git worktree add ../wator-feature1 -b feature1
cd ../wator-feature1
echo "// feature1 edit" >> src/renderer.js
git commit -am "edit on feature1"

# 3. merge feature1 into main
cd ../wator
git merge feature1

# 4. clean up
git worktree remove ../wator-feature1
\`\`\`

## Why bother?

Usually you don't need this — you work one branch at a time. But worktrees shine
when you need **two branches live simultaneously**:

- Running a utility that only exists on an unmerged branch (e.g. a db tunnel you
  built on a feature branch but haven't merged to `main`) while you work on
  `main`.
- **The big one for this workshop:** running **parallel Claude sessions** on the
  same repo. Each session needs its own branch checked out at the same time —
  exactly what a single checkout can't do, and exactly what worktrees solve.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/01-git-worktrees.md
git commit -m "docs: tutorial 1 — plain git worktrees"
```

---

## Task 2: Tutorial — Claude worktree commands

**Files:**
- Create: `docs/tutorials/02-claude-worktrees.md`

- [ ] **Step 1: Write the tutorial**

```markdown
# 2. Claude Code Worktrees

Claude Code has built-in worktree support so you can run **parallel sessions** on
the same repo, each on its own branch.

## Create a worktree session

\`\`\`bash
claude --worktree feature2
# short form:
claude -w feature2
\`\`\`

This:

1. creates a worktree at `<repo-root>/.claude/worktrees/feature2`,
2. on a new branch named `worktree-feature2`,
3. and opens a Claude session there.

Auto-name it by omitting the name (`claude --worktree` → Claude picks something
like `bright-running-fox`).

## Where it branches from

By default the worktree branches from `origin/HEAD` (a clean copy of the remote
default branch). To branch from your **local** HEAD instead (carrying unpushed
work), set in `settings.json`:

\`\`\`json
{ "worktree": { "baseRef": "head" } }
\`\`\`

(`"fresh"` is the default; `"head"` uses local HEAD.)

## Opening more terminals in a worktree

The worktree is a normal directory. Open as many extra terminals as you like:

\`\`\`bash
cd .claude/worktrees/feature2
# run the app, a second tool, etc.
\`\`\`

This is the hook into the workflow tooling covered next: one terminal for the
Claude session, others for a dev server, an editor, and so on — all pointed at
the same worktree.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/02-claude-worktrees.md
git commit -m "docs: tutorial 2 — Claude worktree commands"
```

---

## Task 3: Tutorial — worktree hooks

**Files:**
- Create: `docs/tutorials/03-worktree-hooks.md`

- [ ] **Step 1: Write the tutorial**

```markdown
# 3. Worktree Hooks

Claude Code fires hook events around worktree lifecycle. You can run scripts on
these to automate workflow setup and teardown.

> **Name them exactly.** The events are **`WorktreeCreate`** and
> **`WorktreeRemove`** — *not* "AddWorktree"/"RemoveWorktree". A misspelled event
> in `settings.json` silently never fires.

## When they fire

- **`WorktreeCreate`** — when a worktree is created (via `--worktree`, or a
  subagent configured with `isolation: "worktree"`). This hook **replaces** the
  default creation behavior.
- **`WorktreeRemove`** — when a worktree is removed (at session exit, or when a
  subagent finishes). Fire-and-forget: it runs for side effects and cannot block.

## What the hook receives (stdin JSON)

`WorktreeCreate`:

\`\`\`json
{
  "hook_event_name": "WorktreeCreate",
  "base_path": "/path/to/repo",
  "worktree_name": "feature2",
  "source_branch": "main"
}
\`\`\`

`WorktreeRemove`:

\`\`\`json
{
  "hook_event_name": "WorktreeRemove",
  "base_path": "/path/to/repo",
  "worktree_path": "/path/to/repo/.claude/worktrees/feature2"
}
\`\`\`

(Both also include `session_id`, `transcript_path`, and `cwd`.)

## The WorktreeCreate contract

Because `WorktreeCreate` **replaces** default creation, your hook must actually
create the worktree **and echo its path to stdout**, then exit 0. If it doesn't
output a valid path, worktree creation fails and the session aborts.

## Default removal behavior

When you have **no** `WorktreeRemove` hook, Claude decides what to do on removal.
The broad strokes (verify against your installed version — the fine print here
has shifted across releases):

- An **unnamed** session with **no changes** → worktree directory and its branch
  are removed automatically.
- A **named** session, or any session with **uncommitted/untracked/unpushed**
  changes → Claude prompts: keep or remove.
- **Non-interactive** (`-p`) runs are **not** auto-cleaned — remove them yourself
  with `git worktree remove`.

> The removal decision tree above is the part most likely to differ by version.
> Treat the event names, stdin fields, and the WorktreeCreate must-echo-path
> contract as the load-bearing facts; double-check the removal specifics live.

## Registering a hook

In `.claude/settings.json` (or `~/.claude/settings.json`):

\`\`\`json
{
  "hooks": {
    "WorktreeCreate": [
      { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/scripts/launch-worktree.sh" }
    ],
    "WorktreeRemove": [
      { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/cleanup-worktree.sh" }
    ]
  }
}
\`\`\`

Neither event takes a matcher — they fire on every occurrence.

## This repo's launcher

`scripts/launch-worktree.sh` (next section) is written so it *can* be a
`WorktreeCreate` hook: given the stdin JSON it creates the worktree, sets up your
windows, and echoes the path. It ships **unregistered** on purpose — so you can
demo the default behavior first, then wire it up.
```

- [ ] **Step 2: Commit**

```bash
git add docs/tutorials/03-worktree-hooks.md
git commit -m "docs: tutorial 3 — worktree hooks"
```

---

## Task 4: Launcher script — core (create-if-missing, port, dry-run)

**Files:**
- Create: `scripts/launch-worktree.sh`
- Test: `test/launch-worktree.test.sh`

- [ ] **Step 1: Write the failing test**

```bash
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
check "picks a port >= 8000" 'http\.server (8[0-9]{3}|9[0-9]{3})' "$out"
check "launches kitty" '\bkitty\b' "$out"
check "nvim tab" '\bnvim\b' "$out"
check "claude tab" 'claude --name demo-wt' "$out"
check "opens browser" 'xdg-open http://localhost:[0-9]+' "$out"
check "niri move down" 'niri msg action move-column-to-workspace-down' "$out"

exit $fail
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash test/launch-worktree.test.sh`
Expected: FAIL — script does not exist yet (all checks fail / script-not-found).

- [ ] **Step 3: Write the script**

```bash
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

# (windowing added in Task 5)

# ---- hook contract: echo the worktree path ----------------------------------
echo "$WT_DIR"
```

Make it executable:

```bash
chmod +x scripts/launch-worktree.sh
```

Note: in dry-run the `git worktree add` line must print even though the dir may
not exist; the `[[ "$DRY_RUN" == 1 ]] ||` guard ensures that. The kitty/niri/
browser lines come in Task 5 — this step's test checks only the worktree/port
pieces plus the kitty/nvim/claude/xdg/niri patterns, which will FAIL until Task
5. So in Step 4 we run only the subset that should pass now.

- [ ] **Step 4: Run the port/worktree checks**

Run: `bash scripts/launch-worktree.sh --dry-run demo-wt 2>&1 | grep -E 'git worktree add|http.server'`
Expected: prints a `git worktree add .../.claude/worktrees/demo-wt -b worktree-demo-wt` line. (`http.server` appears after Task 5; if absent now, that's expected.)

- [ ] **Step 5: Commit**

```bash
git add scripts/launch-worktree.sh test/launch-worktree.test.sh
git commit -m "feat: launcher script core — create-if-missing + free port + dry-run"
```

---

## Task 5: Launcher script — Kitty window, browser, Niri placement

**Files:**
- Modify: `scripts/launch-worktree.sh`

- [ ] **Step 1: Add windowing before the hook-contract echo**

Replace the `# (windowing added in Task 5)` line with:

```bash
# ---- build a Kitty session file: one window, three tabs ---------------------
SESSION_FILE="$(mktemp -t wt-kitty-XXXX.session)"
cat >"$SESSION_FILE" <<EOF
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
```

Note for dry-run: the `command -v kitty/niri` guards run in dry-run too. On the
build machine both exist, so the lines print. The test asserts those patterns.

- [ ] **Step 2: Run the full dry-run test**

Run: `bash test/launch-worktree.test.sh`
Expected: all checks print `ok:` and the script exits 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/launch-worktree.sh
git commit -m "feat: launcher windowing — kitty tabs, browser, niri placement"
```

---

## Task 6: Wire docs together + README pointer

**Files:**
- Create: `docs/tutorials/README.md`
- Modify: `README.md`

- [ ] **Step 1: Write the tutorials index**

```markdown
# Workshop Tutorials

Follow these in order during the worktrees workshop:

1. [Git Worktrees (the basics)](01-git-worktrees.md) — worktrees without Claude.
2. [Claude Code Worktrees](02-claude-worktrees.md) — `claude --worktree`.
3. [Worktree Hooks](03-worktree-hooks.md) — `WorktreeCreate` / `WorktreeRemove`.

Workflow tooling: [`scripts/launch-worktree.sh`](../../scripts/launch-worktree.sh)
opens a Kitty window (nvim/claude/server) + browser on a fresh Niri workspace for
a worktree. Run it standalone:

\`\`\`bash
scripts/launch-worktree.sh feature2          # create + launch
scripts/launch-worktree.sh --dry-run feature2  # print what it would do
\`\`\`
```

- [ ] **Step 2: Add a Workshop section to the top-level README**

Add after the intro paragraph in `README.md`:

```markdown
## Workshop

Follow-along materials live in [`docs/tutorials/`](docs/tutorials/README.md):
git worktrees → Claude worktrees → hooks, plus a Niri/Kitty/Neovim launcher in
[`scripts/launch-worktree.sh`](scripts/launch-worktree.sh).
```

- [ ] **Step 3: Commit**

```bash
git add docs/tutorials/README.md README.md
git commit -m "docs: tutorials index and README workshop pointer"
```

---

## Self-Review Notes

- **Spec coverage:** T1 → deliverable 1; T2 → deliverable 2; T3 → deliverable 3
  (real event names, stdin fields, must-echo contract, default-removal w/ hedge,
  settings.json schema, unregistered-launcher note); T4–T5 → deliverable 4
  (create-if-missing, free-port scan, hook-mode stdin parse, kitty tabs, browser,
  niri move-down, dry-run + test); T6 → discoverability.
- **Placeholder scan:** none — every doc/script body is inline and complete.
- **Consistency:** name var `NAME`, dir `WT_DIR=$ROOT/.claude/worktrees/$NAME`,
  branch `worktree-$NAME`, port `PORT`, and the `run`/dry-run convention are used
  identically across T4 and T5. Test patterns in T4 match the strings emitted in
  T4+T5.
- **Caveat carried:** default-removal hedge from the spec is reproduced verbatim
  intent in tutorial 3.
