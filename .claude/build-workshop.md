❯ ok this looks great. let's work on the flow of the talk and build assets accordingly. First, I'll give a short PPT presentation that
  discusses the problem: Working with a Claude session necessarily means there's downtime, sometimes A LOT of downtime, as agents think and do
  real work. What should you do with that downtime to boost / maintain productivity? There three options: 1) do something totally different
  -- i now have a gym in my living room and I will lift weights in between prompts. 2) work on other projects -- this might require spinning
  up multiple claude session in different repos. No problem here, that can increase productivity and no fancy git work is required. 3) work on
  other tasks in the same project. This can cause a conflict, since you may want to work in different git branches, but you can't have
  multiple branches loaded in the same git repository. Workspaces solve this problem, and claude has it's own utilities to deal with this.

  I will briefly mention the first two in a ppt (showing a picture of my gym, for example), but then i want to dive into worktrees. The
  participants might clone this repo and follow along with the wator model. First, I will give an introduction to worktrees generally, without
  reference to Claude -- you can add a worktree that you can navigate into, create branches, do work, merge and other git work, etc, you just
  can't checkout a branch that's active on another worktree. Typically this isn't necessary, since you can only really do work on one branch
  at a time. There are some cases (claude aside) where they are useful, for example running a utility that's only on one branch (i built a db
  tunnel that hasn't yet been merged to main). But claude gives us a really major reason to use worktrees, which is that we need to have multiple branches open at the same time while claude does work on them if we want to parallelize work on the same repo.

So let's build a tutorial md file with copiable git commands to create and remove worktrees.

Next, let's show the claude comamnds for using worktrees and how those work. `claude --worktree feature2` creates a worktree at repo-root/.claude/worktrees and opens a session there. you can manually navigate into that worktree to open additional terminals if needed.

Next, let's talk about workflow tools. For example, I'm using Niri with Kitty and Neovim, which allows me to open parallel workspaces, each dedicated to a worktree. So I want to demo that. The key thing i want to demo, apart from separate terminal windows, is spinning up parallel servers, so i can look at the app associated with each worktree. So we need commands that open the server on different ports.

Next, let's cover the claude hooks for AddWorktree and RemoveWorktree. Talk about the default behavior of these hooks, especially RemoveWorktree has some complex logic. Then let's add to this repo, but not link it as hook, a script that we can pass to AddWorktree or run standalone to create a worktree and do additional stuff that helps manage workflow tools / windows etc. Let's add a Niri / neovim specific script that opens a new Kitty terminal with the title = workspace name, a tab with neovim open to the worktree repository root (named "nvim"), one tab with a claude session started (tab name = "claude", session name = worktree-name), and another tab that runs the server on a unconflicted port (tab name = server). It should also open a browser pointed at the app. ideally these open in a new, empty niri workspace below the active workspace.
