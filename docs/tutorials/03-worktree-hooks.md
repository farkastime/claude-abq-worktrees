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

```json
{
  "hook_event_name": "WorktreeCreate",
  "base_path": "/path/to/repo",
  "worktree_name": "feature2",
  "source_branch": "main"
}
```

`WorktreeRemove`:

```json
{
  "hook_event_name": "WorktreeRemove",
  "base_path": "/path/to/repo",
  "worktree_path": "/path/to/repo/.claude/worktrees/feature2"
}
```

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

Neither event takes a matcher — they fire on every occurrence.

## This repo's launcher

`scripts/launch-worktree.sh` (next section) is written so it *can* be a
`WorktreeCreate` hook: given the stdin JSON it creates the worktree, sets up your
windows, and echoes the path. It ships **unregistered** on purpose — so you can
demo the default behavior first, then wire it up.
