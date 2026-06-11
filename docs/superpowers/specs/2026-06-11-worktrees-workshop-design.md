# Worktrees Workshop Materials & Niri Launcher — Design

**Date:** 2026-06-11
**Status:** Approved

## Purpose

Build the assets for a micro-workshop that teaches git worktrees for parallel
development with Claude Code. The talk flow: a short PPT on what to do during
Claude's downtime (gym / other projects / **other tasks in the same project**),
then a deep dive into worktrees. Participants clone this repo and follow along
using the Wa-Tor app as the working subject.

This spec covers four deliverables: three tutorial docs and one launcher script.
The PPT itself is built by the user outside this repo; these are the
copy-pasteable, follow-along assets.

## Deliverables

### 1. `docs/tutorials/01-git-worktrees.md` — plain git worktrees (no Claude)

Conceptual intro plus copy-pasteable command blocks:

- What a worktree is; the `git worktree add <path> -b <branch>` form.
- Listing (`git worktree list`), navigating in, doing work, committing.
- Merging a worktree branch back into `main`.
- Removing (`git worktree remove <path>`) and `git worktree prune`.
- The core constraint: a branch checked out in one worktree cannot be checked
  out in another.
- "Why bother" without Claude: running a utility that only lives on one branch
  (the unmerged db-tunnel example). Then the big motivator: **parallel Claude
  sessions on the same repo need multiple branches open at once.**

### 2. `docs/tutorials/02-claude-worktrees.md` — Claude's worktree commands

- `claude --worktree <name>` / `claude -w <name>`: creates a worktree at
  `<repo-root>/.claude/worktrees/<name>`, on a new branch named
  `worktree-<name>`, and opens a session there.
- Auto-naming (`claude --worktree` with no name).
- Branching base: `worktree.baseRef` is `fresh` (branch from `origin/HEAD`,
  default) or `head` (branch from local HEAD).
- Manually navigating into the worktree directory to open additional terminals.

### 3. `docs/tutorials/03-worktree-hooks.md` — the hooks

- The real event names are **`WorktreeCreate`** and **`WorktreeRemove`** — with
  an explicit callout that these are NOT spelled "AddWorktree"/"RemoveWorktree".
  Using the wrong name means the hook silently never fires.
- When each fires.
- The stdin JSON fields:
  - `WorktreeCreate`: `base_path`, `worktree_name`, `source_branch`
    (plus `session_id`, `transcript_path`, `cwd`, `hook_event_name`).
  - `WorktreeRemove`: `base_path`, `worktree_path` (plus the common fields).
- `WorktreeCreate` REPLACES default creation and MUST echo the worktree path to
  stdout, exit 0, or the session aborts. `WorktreeRemove` is fire-and-forget
  cleanup that cannot block.
- Default removal behavior (best-effort description): unnamed sessions with no
  changes remove the worktree + branch automatically; named sessions or sessions
  with uncommitted/untracked/unpushed changes prompt keep-or-remove; `-p`
  non-interactive runs are not auto-cleaned.
- The exact `settings.json` registration schema (see below).
- Points at `scripts/launch-worktree.sh` as something you *can* wire up as a
  `WorktreeCreate` hook, but is intentionally left unregistered.

**Accuracy caveat (carried into the doc):** the fine-grained default-removal
decision tree and the `.worktreeinclude` interaction came from a research agent
and were not fully verified against primary Anthropic docs. The doc states the
authoritative basics confidently (event names, stdin fields, the
must-echo-path contract, settings.json schema) and hedges the uncertain
default-removal specifics, pointing readers to verify with their installed
version. We verify what we can live during the build.

`settings.json` registration schema to document:

```json
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
```

### 4. `scripts/launch-worktree.sh` — Niri/Kitty/Neovim launcher

A single bash script. Create-if-missing then launch. Usable standalone
(`scripts/launch-worktree.sh feature2`) or as a `WorktreeCreate` hook body.

**Flow:**

1. Resolve repo root (`git rev-parse --show-toplevel`) and worktree name: from
   `$1`, or — when stdin is not a TTY (hook mode) — parse `worktree_name` from
   the stdin JSON.
2. Create if missing: if `.claude/worktrees/<name>` doesn't exist, run
   `git worktree add "<root>/.claude/worktrees/<name>" -b "worktree-<name>"`
   (skip `-b` if the branch already exists).
3. Pick a free port: probe upward from `BASE_PORT` (default 8000) for the first
   unbound TCP port.
4. Spawn ONE Kitty window titled `<name>` with three tabs, via a generated
   Kitty session file:
   - `nvim` — `nvim` at the worktree root
   - `claude` — `claude --name <name>` in the worktree
   - `server` — `python3 -m http.server <port>` in the worktree
5. Open the app: `xdg-open "http://localhost:<port>"` (separate browser window).
6. Niri placement: after the Kitty window appears, move it (and let the browser
   tile alongside) to the workspace below the active one via
   `niri msg action move-column-to-workspace-down` + focus, landing on the empty
   bottom workspace.
7. Hook mode: when invoked as a `WorktreeCreate` hook, echo the worktree path to
   stdout and exit 0 (required contract).

**Config knobs at the top of the script:** `BASE_PORT`, `BROWSER_CMD`,
`SERVER_CMD`, `EDITOR_CMD`.

**Robustness:** `set -euo pipefail`. A `--dry-run` flag prints every external
command (git/kitty/niri/xdg-open) instead of executing it — this is the
testable surface. Guard clauses degrade gracefully when `niri`/`kitty` are
absent (warn, continue) so the script is still useful as a hook on non-Niri
machines.

**Not linked as a hook:** ships in `scripts/`, documented as opt-in, left
unregistered so default Claude behavior is demoable first.

## Testing

- The launcher drives a live compositor and spawns GUI windows; it cannot be
  unit-tested in CI. `--dry-run` makes the command sequence assertable: a small
  test invokes the script with `--dry-run` and greps for the expected
  `git worktree add`, `kitty`, `xdg-open`, and `niri msg` invocations and the
  chosen port.
- The free-port logic is a pure shell function; the dry-run test confirms it
  selects an unused port.
- Docs are prose; verified by review.

## Out of Scope

- The PPT slides themselves (built by the user).
- Wiring the launcher as an active hook in committed settings.
- Editors/compositors other than Niri/Kitty/Neovim (config knobs make swaps
  possible but we don't ship alternates).
