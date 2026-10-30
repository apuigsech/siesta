---
name: siesta-launch-worker
description: Starts the worker of a Siesta epic or spike in a session of its own, with its worktree, its branch pushed with the spec active, and a brief. Use when the project manager is to start a planned epic or spike, or when a worker's session ended before its work did and must be started again.
user-invocable: false
---

# Siesta launch worker

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration (`roles`, `paths`, `naming`, `git`, `execution`, `sessions`) and its moments.

**Outcome:** the worker runs in a session of its own that the human can follow, in its own worktree, on the epic's branch, pushed with the spec `active`, and with a brief that tells it everything particular to this epic. The project manager's log says where it is.

## 1. Check it can start

An epic or spike starts when all of these hold, on the integration branch:

- its phase is accepted and its status is `planned`;
- every epic in its `depends_on` is `completed`;
- every open question in its `waits_for` is answered;
- what its spec's "Waits for the human" needs before work begins, such as an account, is there;
- fewer than `execution.max_parallel_epics` epics are `active`, and with `parallel_when: disjoint-files`, its `touches` share nothing with an active epic's.

The project manager may start an epic on a dependency that is built and reviewed but not merged. Then cut the branch from that dependency's branch, and say so, with the reason, in the brief, the spec's first commit and the log.

## 2. The worktree and the branch

From the main checkout, after fetching:

```bash
git worktree add -b <branch> <paths.worktrees><slug> origin/<integration branch>
```

The branch is named by `naming.branch`. In the worktree, change the spec's status to `active`, commit it as `naming.commits` and `git.signed_commits` say, and push the branch. Then reach the moment `epic-started`.

## 3. The brief

Write `paths.notes/brief-<epic id>.md` in the shape of [assets/brief.md](assets/brief.md), in `project.language.docs`. The `siesta-work-epic` skill holds the rules every worker follows, so the brief holds only what is particular to this epic: where it is, what to read, what is already known, its own limits and how to reach the project manager. Name decisions and open questions by id, and give the numbers already taken on open branches.

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

When a worker's session ended before its work did, start a new session the same way, in the same worktree, with the same brief. The worker picks up from its report. Start a new one only once the old one is over: two sessions never work in one worktree.
