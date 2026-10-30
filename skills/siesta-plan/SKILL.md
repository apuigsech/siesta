---
name: siesta-plan
description: Writes or changes a roadmap, with its phases, epics and spikes, from the documents that define the product, the architecture and its features. Use when the human asks for a roadmap or a plan, when a phase's epics are to be accepted, or when a decision, a spike's verdict or a change of scope means epics must be added, changed or cancelled.
argument-hint: "[the roadmap to write or change]"
---

# Siesta plan

**REQUIRED BACKGROUND:** the `siesta` skill for the effective configuration, the `siesta-interview` skill for asking the human, and the `siesta-decide` skill for decisions and open questions.

**Outcome:** a roadmap whose phases each have an outcome and completion criteria, and whose epics each have a file of their own with a status, acceptance criteria someone can check, and what they wait for. Nothing in it starts work.

## Files

| What | Where | Template |
|---|---|---|
| A roadmap | `paths.roadmaps/{id}.md`, its id from `naming.roadmap_id` | [assets/roadmap.md](assets/roadmap.md) |
| An epic | `paths.epics/{id}/spec.md`, its id from `naming.epic_id` | [assets/epic.md](assets/epic.md) |
| A spike | The same, with `kind: spike` | [assets/spike.md](assets/spike.md) |

Each epic and spike gets its file when it is first proposed, so that it has one home from proposal to completion. The roadmap lists them; it does not hold them. An epic's plan, the how, is its worker's, beside its spec.

## Statuses

Write statuses with these words, in the epic's frontmatter and in the roadmap's tables. The spec holds an epic's status. The roadmap's table catches up when the plan itself changes and when a phase closes, so that epics running at once never edit the same file; until then, the spec's status is the one that counts.

| Status | Means | Who sets it |
|---|---|---|
| `proposed` | Written, not accepted | The planner |
| `planned` | Its phase was accepted | The planner, after the human's yes |
| `active` | A worker is on it | The project manager |
| `blocked` | It waits for something outside the plan; the spec says what | Whoever finds it |
| `completed` | Its acceptance criteria are verified, in its last pull request | Its worker |
| `cancelled` | Dropped; the spec says why, and it stays | The planner, after the human's yes |

A phase is `proposed` until the human accepts it, then `accepted` with the date and their words, and `completed` when its completion criteria hold. A roadmap is `proposed` until its first phase is accepted, then `active`, and `completed` when every phase is completed and the human says it is done, with the date and their words.

## 1. Start from what exists

Read the product, the architecture, the features and their designs, the decisions, the open questions, and any roadmap and epics already in place. With a roadmap in place, this is a change to it, not a new one. Find the facts the plan depends on in the repository itself, such as whether its checks can pass today: the first epic often has to make them pass.

## 2. Draft

- **Phases** deliver something the human can see working. Each has an outcome and completion criteria anyone can check.
- **Epics** are one worker's work, reviewed in one pull request or a few, and as independent as their dependencies allow. Their acceptance criteria are checkboxes someone can verify. Carry each settled requirement exactly as its source says it, and name the source: a decision's id, the feature, the architecture.
- `touches` names the parts of the architecture an epic changes, so that epics that touch different parts can run at the same time.
- `feature` names the feature document an epic builds, by the name in `paths.feature`; `null` when it builds none.
- **A doubt that could change the plan** is a spike: its question, what to try, the result that decides it, and the fallback, which becomes a proposed decision if the result does not come.
- **A point only the human can settle** is an open question, listed by its id in the epic's `waits_for`. Write the epic with the open question's proposal, and say in the epic that the answer may change it. `waits_for` holds only open questions' ids; anything else the epic needs from the human goes in its spec's last section.
- Everything the epic waits for from the human, by the kinds in `autonomy.waits_for_human`, goes in its spec, so the project manager knows before starting it.

## 3. Ask

When the human is in the conversation, ask what the plan needs with `siesta-interview`. When they are not, put the questions in the checkpoint with `siesta-checkpoint`, record each new open question, and leave the epics that depend on them `proposed`. Never answer a question for them.

## 4. Review and accept

Have the plan reviewed with the `siesta-review` skill and the panel in `review.plan`. Where that skill is not available, say that the review is pending. Then put each phase to the human. With their yes, mark the phase accepted, with the date and their words, and its epics `planned`.

## 5. Change the plan

- A new epic or spike starts `proposed`, and its phase takes it in only with the human's yes.
- Changing an accepted epic's scope or acceptance criteria, or cancelling it, is `scope-change`: it waits for the human.
- A cancelled epic keeps its file, with why.
- When a decision answers an open question, update the epics that waited for it.

## After the merge

The plan reaches GitHub, or any other tracker, only from the integration branch: once the plan's pull request merges, the `merged` moment runs.

## Report

Say what you wrote or changed, how many phases, epics and spikes, what waits for the human and where their questions are, and whether the review has run. Commit nothing.
