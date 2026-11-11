---
name: siesta-launch-worker
description: Starts the worker of a Siesta epic or spike in a session of its own, with its worktree, its branch pushed with the spec active, and a brief. Use when the project manager is to start a planned epic or spike, or when a worker's session ended before its work did and must be started again.
user-invocable: false
---

# Siesta launch worker

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration (`roles`, `paths`, `naming`, `git`, `execution`, `sessions`) and its moments.

**Outcome:** the worker runs in a session of its own that the human can follow, in its own worktree, on the epic's branch, pushed with the spec `active`, and with a brief that tells it everything particular to this epic. The project manager's log says where it is.

## 1. Check it can start

Before starting, reconcile the project manager's worker rows with the actual sessions, worktrees, branches and pull requests. Recover an existing assignment instead of launching it twice, including when a previous launch stopped before its log was written. Count assigned epics that have not had their final merge, including blocked workers and pull requests awaiting review, toward `execution.max_parallel_epics`; a spec completed on a worker's branch does not free a slot.

A new epic or spike starts when all of these hold:

- on the integration branch, its phase is accepted and its status is `planned`, and it has no existing assignment;
- every epic in its `depends_on` is `completed` on the integration branch;
- every open question in its `waits_for` is answered;
- what its spec's "Waits for the human" needs before work begins, such as an account, is there;
- the reconciled assignments leave a free slot, and with `parallel_when: disjoint-files`, its `touches` share nothing with an assigned epic's.

Always start from the integration branch. A reviewed dependency that has not merged is still a dependency to wait for.

## 2. The worktree and the branch

From the main checkout, after fetching:

```bash
git worktree add -b <branch> <paths.worktrees><slug> origin/<integration branch>
```

The branch is named by `naming.branch`. In the worktree, change the spec's status to `active`, commit it as `naming.commits` and `git.signed_commits` say, and push the branch. Then reach the moment `epic-started`.

## 3. The brief

Write `paths.notes/brief-<epic id>.md` in the shape of [assets/brief.md](assets/brief.md), in `project.language.docs`. The `siesta-work-epic` skill holds the rules every worker follows, so the brief holds only what is particular to this epic: where it is, what to read, what is already known, its own limits and how to reach the project manager. Name decisions and open questions by id, and give the numbers already taken on open branches. Point to each file by its path, and to a passage by its heading, and copy none of their text into the brief: the brief stays in the worker's context for the whole epic.

## 4. The session

Start it with the harness, model and effort of `roles.spike` for a spike and of `roles.worker` otherwise, in the worktree, titled by `naming.session_title`. The prompt only points to the brief and contains no `!`, which some shells expand:

> Use the siesta-work-epic skill: read and carry out the brief in '<brief path>'.

How it opens depends on `sessions.launcher`:

| Launcher | How |
|---|---|
| `harness` | The harness's own way of opening a session the human can see and talk to. When it has none, do as `human` |
| `command` | Run `sessions.command`, with each placeholder replaced by one shell-quoted value |
| `human` | Give the human the exact command or steps, and wait for them to start it |

Check that it started, where the launcher allows it, and write the worker in the project manager's log: the epic, the session's title, the worktree, the branch, the brief and the date.

## Starting again

When a worker's session ended before its work did, reconcile its assignment first and apply the no-progress rule in `siesta-run-roadmap`. Resume in the same worktree and branch, pointing to its report and current pull request or blocker. Do not repeat the new-epic status commit or branch creation. Start a new session only once the old one is over: two sessions never work in one worktree.
