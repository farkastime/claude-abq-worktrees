# 2. Claude Code Worktrees

Claude Code has built-in worktree support so you can run **parallel sessions** on
the same repo, each on its own branch.

## Create a worktree session

```bash
claude --worktree feature2
# short form:
claude -w feature2
```

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

```json
{ "worktree": { "baseRef": "head" } }
```

(`"fresh"` is the default; `"head"` uses local HEAD.)

## Opening more terminals in a worktree

The worktree is a normal directory. Open as many extra terminals as you like:

```bash
cd .claude/worktrees/feature2
# run the app, a second tool, etc.
```

This is the hook into the workflow tooling covered next: one terminal for the
Claude session, others for a dev server, an editor, and so on — all pointed at
the same worktree.
