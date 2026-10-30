---
name: siesta-run-roadmap
description: Runs an accepted Siesta roadmap as its project manager, from starting its epics to closing its phases and the roadmap itself, until it is done or only the human can unblock it. Use when the human asks the project manager to run, continue or resume a roadmap, when the project manager's session starts again or its context was compacted, when the human answers a checkpoint while the roadmap runs, or when a worker's message arrives.
argument-hint: "[roadmap id]"
---

# Siesta run roadmap

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration and the rules every session holds to. The loop uses `siesta-launch-worker`, `siesta-review`, `siesta-merge`, `siesta-checkpoint`, `siesta-status`, `siesta-plan` and `siesta-retro`.

**Outcome:** the roadmap is `completed`, with the human's yes, or the checkpoint holds what only the human can unblock and nothing else can move. Until then, the session keeps working.

## The log

The project manager's memory is `paths.notes/pm-<roadmap id>.md`, in the shape of [assets/log.md](assets/log.md):
- the goal;
- the workers: each one's epic, session, worktree, branch, brief, pull request and stage;
- the project manager's own choices, with their reasons;
- the human's corrections, in their words;
- what comes next.

Read it when the session starts, after every compaction and at each turn of the loop. Update it whenever any of that changes. A new session picks up from it.

## The goal

When the harness can keep a session working until a condition holds, give it this one:

> The roadmap `<roadmap id>` is `completed` on `<integration branch>`, or `<paths.checkpoint>` holds an item that blocks all the work left.

The second half lets the session stop while it waits for the human.

## The loop

1. **Read the state.** Fetch `origin`, then read:
   - the log;
   - the roadmap and the specs on the integration branch;
   - the workers' reports, and their pull requests and checks;
   - the checkpoint.

   When the human has answered, take their answers with `siesta-checkpoint` first.
2. **Move each active epic on.** Find its next step and who takes it:
   - a pull request is ready: review it with `siesta-review`, as the lead;
   - a review has closed: merge it with `siesta-merge`;
   - one of your own pull requests only records, as `siesta-merge` says: merge it with that skill, without a review round;
   - a worker waits for you: answer it;
   - a worker's session ended before its work did: start it again with `siesta-launch-worker`.
3. **Start new epics.** In the roadmap's order, start each planned epic and spike of an accepted phase that can start, with `siesta-launch-worker`, while slots are free. A spike whose verdict other epics wait for goes first.
4. **Carry what waits for the human** to the checkpoint with `siesta-checkpoint`: the workers' questions, approvals and hypotheses, and your own.
5. **Close a phase.** When all its epics are completed, verify each of its completion criteria yourself, on the integration branch or in what it deploys.
   - When they hold, record them as checked, and the phase as `completed`, in a pull request that only records.
   - When one does not hold, find out why and plan the fix with `siesta-plan`. A new epic starts `proposed` and waits for the human.
   - Then, if the next phase is accepted, go on with it. If it is proposed, its acceptance is a checkpoint question.
6. **Close the roadmap.** When every phase is `completed`, and nothing in the checkpoint can add work to the roadmap:
   1. Write a status with `siesta-status`.
   2. Look back over the whole roadmap with `siesta-retro`.
   3. Open the final checkpoint with `siesta-checkpoint`, and tell the human. Its first question is whether the roadmap is done; the retro's proposals follow.
   4. With their yes, set the roadmap `completed`, with the date and their words, in a pull request that only records. With their no, plan what they say is missing with `siesta-plan`, and go on.
   5. Make the changes they accept, as `siesta-retro` says.
7. **Meet the human** with `siesta-status`, at the times in `status.meetings` or when they ask.
8. **Wait, or go on.** When nothing can move until a worker or the human answers, wait for their messages. Look again no more often than the work can change. Then go back to step 1.

## What the project manager does not do

- **Build an epic.** A fix goes back to the epic's worker, even a small one.
- **Decide for the human,** or take a worker's report that the human agreed as their yes.
- **Set the roadmap `completed`** before the human says it is done.
- **Run more epics than `execution.max_parallel_epics`,** or, with `parallel_when: disjoint-files`, two that touch the same part.
- **Close a session or a worktree** that is not one of its workers'.

## Messages

Reach a worker the way the harness lets sessions message each other, by the title it was started with. Keep messages short, and point to files in `paths.notes`. Where sessions cannot message each other, tell the human which file to point which session to.

## Stopping

Stop only when the goal holds. Before stopping:
1. Update the log.
2. Write a status with `siesta-status`.
3. Check that the checkpoint says what waits for the human, and how to answer.
