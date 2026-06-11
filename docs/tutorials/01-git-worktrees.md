# 1. Git Worktrees (the basics)

A **worktree** lets one git repository have multiple working directories checked
out at once — each on its own branch. The repo's history is shared; only the
working files differ.

> The one rule: **a branch checked out in one worktree cannot be checked out in
> another.** Git refuses, because two directories editing the same branch would
> fight over `HEAD`.

## Add a worktree

From the main repo:

```bash
# create a new worktree in a sibling dir, on a brand-new branch
git worktree add ../wator-feature1 -b feature1
```

This creates `../wator-feature1/` with `feature1` checked out. Navigate in and
work normally:

```bash
cd ../wator-feature1
# ...edit files, run the app, etc.
git add -A
git commit -m "work on feature1"
```

## List worktrees

```bash
git worktree list
```

## Merge the work back

From the main worktree (on `main`):

```bash
cd ../wator            # back to the main checkout
git merge feature1
```

## Remove a worktree

```bash
git worktree remove ../wator-feature1
git worktree prune     # clean up stale administrative entries
```

If the worktree has uncommitted changes, `remove` refuses; add `--force` to
override (you lose those changes).

## A demo workflow

```bash
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
```

## Why bother?

Usually you don't need this — you work one branch at a time. But worktrees shine
when you need **two branches live simultaneously**:

- Running a utility that only exists on an unmerged branch (e.g. a db tunnel you
  built on a feature branch but haven't merged to `main`) while you work on
  `main`.
- **The big one for this workshop:** running **parallel Claude sessions** on the
  same repo. Each session needs its own branch checked out at the same time —
  exactly what a single checkout can't do, and exactly what worktrees solve.
