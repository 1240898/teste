# Branching and Integration Strategy

The team follows **GitHub Flow**, a lightweight, branch-based workflow built around a single
long-lived branch (`main`) and short-lived feature branches integrated through Pull Requests.

## 1. Principles

- `main` is always in a working, demonstrable state. Nothing is pushed to it directly.
- All work happens on a dedicated branch, created from `main`.
- Work is integrated back into `main` frequently, through reviewed Pull Requests, to avoid large and risky merges.
- Every piece of work is traceable to the User Story or task it implements.

## 2. Branching model

### `main`
- Protected branch. No direct pushes.
- Only updated via Pull Request merges.
- Must always build, pass CI, and be in a demonstrable state.

### Feature / task branches
Created off `main` for every User Story. Deleted after merge.

**Naming convention:**

```
<area>/<US-id>-short-description
```

| Area | Example |
|---|---|
| `eng` – engineering practices / tooling | `eng/ENG01-repo-setup` |
| `bck` – back-end | `bck/BCK02-customer-management` |
| `arc` – architecture / domain modelling | `arc/ARC03-rest-api` |
| `web` – web application (future sprints) | `web/...` |

The branches will be short-lived and scoped to a single task or User Story whenever possible.

## 3. Pull Requests

- Opened as soon as meaningful work exists, even in draft form, to allow early visibility and discussion.
- The PR description must reference the User Story / issue it addresses.
- At least **one** team member must review and approve before merge. The PR author cannot approve their own PR.
- All CI checks must pass before merge.
- Before opening/updating a PR, the branch should be **rebased** on top of the latest `main` to keep history linear and avoid unnecessary merge commits.
- Merge strategy: **rebase and merge only** — this replays the branch's commits on top of `main`, keeping a linear history and preserving individual commits.
- The source branch is deleted immediately after merge.
- Force-push is only allowed on feature branches (needed after rebasing an already-published branch), never on `main`. Use `git push --force-with-lease` rather than `--force`, since it refuses to overwrite the remote branch if someone else has pushed to it in the meantime.

## 4. Commit messages

Commits should be small, descriptive and reference the related User Story or task id:

```
#<issue-number> BCK02: add customer uniqueness validation
```

## 5. References

- [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [Best Practices for Git Branching, Medium](https://medium.com/@sambhav18/best-practices-for-git-branching-0af90c1faf37)
- [Branching Strategies in Git, GeeksForGeeks](https://www.geeksforgeeks.org/git/branching-strategies-in-git/)