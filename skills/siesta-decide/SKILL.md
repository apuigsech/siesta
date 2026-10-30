---
name: siesta-decide
description: Records a decision in the repository's decision log, whether proposing it, accepting it with the human's yes, or replacing an earlier one, and records the questions still open. Use when an answer, a spike's verdict or a finding settles how the product or the system will be, when the human asks to note a decision, when an accepted decision has to change, or when a question is left open.
argument-hint: "[the decision, or the decision to change]"
---

# Siesta decide

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration: `paths.decisions`, `paths.open_questions`, `naming.decision_id`, `naming.open_question_id`, `project.language.docs` and `autonomy`.

**Outcome:** the decision is in the log in the one shape every Siesta skill reads, under a number no other branch uses, with its status and who settled it.

## What is a decision

A decision is an answer that settles how the product or the system will be and that later work must not reopen by accident: a choice between real alternatives, a constraint the code cannot show, a deliberate departure from the obvious path, or a spike's verdict. How something was built belongs in the epic's report, and a task belongs in the plan.

Before writing, search the log. If a decision already settles the point, cite it instead. If the new one contradicts an accepted decision, it replaces that one, as described below.

## The log

`paths.decisions` is either one file, where entries follow each other under an index, or a folder ending in `/`, with one file per decision named `{id}-{slug}.md` and no index.

A new log file starts like this:

```markdown
# Decisions

What is settled about the product and the system, and why. An accepted decision's substance never changes: a change is a new decision that replaces it.

| ID | Decision | Status |
|---|---|---|
| D-001 | Orders can be cancelled until they leave the warehouse | Accepted |
```

An existing log in another shape keeps its shape: write new entries the way its earlier ones are written, and leave the earlier ones as they are.

## An entry

```markdown
## D-007 — Orders can be cancelled until they leave the warehouse

**Status:** Accepted on 2026-10-30 by the owner: "Un pedido se puede cancelar hasta que sale del almacén; a partir de ahí, solo se puede devolver."

**Context.** The situation that made a decision necessary.

**Decision.** What is decided, stated so that someone who was not there can apply it.

**Alternatives.** Each option weighed, and why it lost. "None weighed" when the human stated the decision outright.

**Consequences.** What later work must do, what this decision replaces, and what it leaves open, linked to its open question.
```

- The title is the decision itself, as a sentence, after the id and an em dash.
- Write the entry in `project.language.docs`, and quote the human's words as they said them.
- Keep it to the decision. Detail that only explains it goes in the architecture or the epic.
- What the decision leaves open becomes an open question, and the entry links to it.
- In a log file, add the entry's row to the index, with its status's first word.

The status takes one of these forms:

| Status | When |
|---|---|
| `Proposed on <date> by <role>.` | An agent proposes it |
| `Accepted on <date> by <human>: "<their words>"` | The human said yes, in the conversation or answering a checkpoint |
| `Accepted on <date> by the project manager, under <approval id>: "<its allows>"` | A standing approval covers it |
| `Accepted on <date> by the project manager.` | The configuration leaves `decision` out of `autonomy.waits_for_human` |
| `Rejected on <date> by <human>: "<their words>"` | The human said no; the entry stays, so the path is not proposed again |
| `Replaced by D-<n> on <date>.` | A later decision replaces it whole |
| `Replaced in part by D-<n> on <date>: <which point>.` | A later decision replaces one point |

A decision becomes Accepted with the human's own yes. The project manager may accept one itself only when:
- a standing approval's `allows`, read literally, covers it;
- or the configuration leaves `decision` out of `autonomy.waits_for_human`.

A decision the project manager accepted goes to the checkpoint as a hypothesis, so that the human sees it and can correct it. Their correction is a new decision that replaces it.

## The number

Take the next number after the highest one used anywhere: the log on the integration branch, the log on your branch, and the log on every other branch that is still open. Fetch first. Where an add-on reaches the code host, include the open pull requests; otherwise, include every remote branch. Say in your report which number you took and any number you skipped.

When a branch merges and its number has been taken in the meantime, the branch renumbers its decision before the merge, references included.

## Changing a decision

A proposed decision on your own branch can be edited until it is accepted. An accepted one keeps its substance: write a new decision that replaces it, then change only the old entry's status line and its index row. Replacing an accepted decision is a decision in its own right. When the human accepted the one it replaces, it is Accepted only with their yes, whatever the approvals allow.

## Open questions

An open question is a decision not made yet. It lives in `paths.open_questions`, one file, under its own id from `naming.open_question_id`, numbered as decisions are. A new file starts with `# Open questions` and one line saying that a settled question's answer goes to the decision log.

```markdown
## OQ-03 — Which moment counts as an order leaving the warehouse

**Status:** Open since 2026-10-30, raised by D-001.

The question, with an example, and what waits for its answer.

**Proposal:** the answer you recommend, when you have one.

**Spike:** when talking cannot settle it: what to try or measure, and which result decides it.
```

When it is answered, change only its status line to `Answered on <date> by D-<n>.`, and leave the question in place so that links to it still lead somewhere.

## Report

Say what you recorded: each id, its status, what waits for the human, and any number you skipped.
