---
name: siesta-status
description: Reports how a Siesta roadmap stands, with what was delivered since the last status, what is in progress and how far, what comes next and what waits for the human, with every number counted from the repository. Use when the human asks how the work is going, at a meeting time the configuration sets, or when a checkpoint begins with a status.
---

# Siesta status

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration (`paths`, `status`, `execution`, `checkpoints`) and its question reference.

**Outcome:** in a screen or two, the human sees where the roadmap stands, what changed since the last status and what needs them, and can trust every number, because each one was counted.

## Gather

1. Fetch `origin`. The record is the integration branch, and an active epic's progress is on its own branch.
2. The last status is the newest `status-*.md` in `paths.notes`. "Since the last status" means since its date; with none, since the roadmap began.
3. Read the roadmap and the epics' specs on the integration branch, the active epics' specs on their branches, the review rounds and reports in `paths.notes`, the decision log, the open questions, and the checkpoint.

## Count

Count every number; never estimate one.

| Number | How |
|---|---|
| An epic's progress | With `status.progress: criteria`, its acceptance criteria checked, `- [x]`, over all of them, in its spec. With `tasks`, the same over the tasks in its plan. With `mixed`, both. An active epic is counted on its branch, every other on the integration branch |
| A phase's progress | Its completion criteria checked in the roadmap, over all of them, and its epics completed over its epics |
| The roadmap's progress | Its epics completed over its epics, cancelled ones left out |
| Delivered since the last status | The epics that became `completed` on the integration branch after its date, read from the history |

Next to each figure, the human should be able to tell what it counts: "3 of 4 criteria", not "75 %" alone.

## Check what the record claims

Where the record and the repository disagree, say so in a line each: an epic marked `completed` whose work is not on the integration branch, a phase marked `completed` with a criterion unchecked, a branch with no commit for days. A roadmap table behind its specs is not one: it catches up when the phase closes. Say what will be done about each, and do it through its own skill. A status reports. It never changes the plan or drops a checkpoint item the human has not answered.

## Write

Write the status in `project.language.human`, headings and labels included, in the shape of [assets/status.md](assets/status.md), and save it as `paths.notes/status-<YYYYMMDD-HHMM>.md`. Show it to the human, and keep it to one line per epic and per item. A pull request whose review was not independent, as `siesta-review` says, says so on its line.

"What needs you" names the checkpoint's open items by id and title. When the human is in the conversation, ask them now, in the question reference's shape, most consequential first. Each keeps the meaning it has in the checkpoint, so that "Q-2 sí" means the same thing in both. A new item goes to the checkpoint first, with `siesta-checkpoint`, so that it takes the next free id.

When `checkpoints.status_first` is on, `siesta-checkpoint` puts this status at the top of the checkpoint, before its questions, and leaves out "What needs you", which the checkpoint itself holds.
