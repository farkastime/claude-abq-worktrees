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

## Copying gitignored files into the worktree

A worktree is a **fresh checkout**, so untracked/gitignored files — `.env`,
`.env.local`, local config, etc. — are **not** present. Your app may break in the
worktree because its secrets or local settings are missing.

Claude Code can copy them in automatically. Add a **`.worktreeinclude`** file to
your project root, listing the files to copy in `.gitignore` syntax:

```gitignore
# .worktreeinclude
.env
.env.local
config/secrets.json
```

When Claude creates a worktree (`claude --worktree`, subagent worktrees, desktop
parallel sessions), any file that matches a pattern **and** is gitignored gets
copied from the main checkout into the new worktree. Tracked files are never
duplicated.

> **This is a Claude Code feature, not git.** Plain `git worktree add` (tutorial 1)
> does **not** read `.worktreeinclude` — only Claude-created worktrees do.
>
> **Heads up for hooks:** if you register a `WorktreeCreate` hook (tutorial 3),
> it *replaces* Claude's default creation, so `.worktreeinclude` is **no longer
> processed** — your hook must copy those files itself.

## Opening more terminals in a worktree

The worktree is a normal directory. Open as many extra terminals as you like:

```bash
cd .claude/worktrees/feature2
# run the app, a second tool, etc.
```

This is the hook into the workflow tooling covered next: one terminal for the
Claude session, others for a dev server, an editor, and so on — all pointed at
the same worktree.
