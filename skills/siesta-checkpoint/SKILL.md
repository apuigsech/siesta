---
name: siesta-checkpoint
description: Keeps the checkpoint, the one place where what waits for the human collects while they are away, and handles their answers when they come back. Use when something needs the human's decision, approval or confirmation and they are not in the conversation, when a hypothesis was taken that they should see, or when the human answers or comes back to an open checkpoint.
argument-hint: "[your answers, such as Q-2 yes, H-3 no: …]"
---

# Siesta checkpoint

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration (`paths.checkpoint`, `paths.notes`, `autonomy`, `checkpoints`, `project.language.human`) and its question reference.

**Outcome:** while the human is away, everything that waits for them is in one file, each item ready to answer in a line. When they answer, every answer reaches its home with their words, and only what is still open stays in the checkpoint.

## Who writes it

The checkpoint is `paths.checkpoint`, in the main checkout, never committed. The session working there writes it: the project manager while the roadmap runs, or the session the human works with. A session in a worktree of its own does not see that file. It puts its items in its report, and the project manager carries them into the checkpoint.

Write an item as soon as it arises. A checkpoint does not stop the work that does not depend on it.

## What goes in it

| Item | When | Id |
|---|---|---|
| A question | A decision only the human can make | `Q-<n>` |
| An approval | An action in `autonomy.waits_for_human`: a merge the configuration holds, an apply, a running cost, a deletion, a security change | `Q-<n>` |
| A hypothesis | A choice taken in their absence because it can be undone, which they should see | `H-<n>` |
| A notice | Something they should know that asks nothing of them | none |

Number items in the order they are added, and never renumber them while the checkpoint is open. When an answer raises a new question, it takes the next free number. An answer like "Q-5 sí" must mean the same thing in every version of the file.

Questions and approvals use the question reference's shape, and each also says what waits for it and what goes on meanwhile. An approval says exactly what will happen with a yes, who does it, and what it costs. What only the human can do, such as creating an account, signing in or handing over a credential, is said as steps for them. Never ask them to paste a token into the conversation or a file. A running cost needs an answer of its own, never a wholesale yes.

Write the file in `project.language.human`, headings and labels included, in the shape of [assets/checkpoint.md](assets/checkpoint.md). When `checkpoints.status_first` is on, the file begins with a current status, written with `siesta-status`, without its "What needs you", and the message that tells the human the checkpoint is open begins with that status's headline. Refresh the status each time the checkpoint changes.

## Telling the human

Tell the human the checkpoint is open, through every place in `checkpoints.publish`, when an item blocks work that nothing else can replace, at a time in `status.meetings`, or when they ask. Smaller items wait in the file for that moment. Every configured add-on is given the moment `checkpoint-opened`.

## Their answers

Take each answer by its id. When an answer is unclear, ask about it now, while they are in the conversation.

| Answer | Goes to |
|---|---|
| A question settled | Its decision, with `siesta-decide` and their words. When their words are only a yes, such as «Q-2 sí», record them with what they accepted: «Q-2 sí», option a. A change of plan goes through `siesta-plan`, and a retro's proposal where `siesta-retro` says |
| An approval given | Do the action, within what was approved, and record their yes with their words where the action is recorded: the merge, the epic, the decision |
| An approval refused | Nothing is done. Say what stays blocked |
| "Later", or no answer yet | The item stays, with their words and the date |
| A hypothesis confirmed or corrected | Record it where the hypothesis was taken. A correction that changes how the product or the system will be is a decision, and the work follows it |

Then:

1. Append each answered item to the log, `paths.notes/checkpoint-log.md`: its id and title, the date, their words, and where it went.
2. Remove the answered items from the checkpoint and keep the rest as they were, ids included.
3. When nothing is left, delete the checkpoint.
4. Tell the human in a few lines what each answer led to, and what is still open.
