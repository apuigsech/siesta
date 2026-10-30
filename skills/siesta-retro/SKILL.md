---
name: siesta-retro
description: Looks back over a Siesta roadmap's record for what made the work slower, riskier or more corrected than it needed to be, and turns it into changes the human can accept. Use when the project manager closes a roadmap whose phases are all completed, or when the human asks for a retrospective, a look back, the lessons of a roadmap, or what to change in how the agents work.
argument-hint: "[roadmap id, or what to look back on]"
---

# Siesta retro

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration, its layers and the question reference.

**Outcome:** what went wrong more than once, or once in a way that must not happen again, is in front of the human as proposals they can accept in a line. Each names the exact change and the file it lands in. Nothing changes until they say yes, and the retro's file keeps their answers for the next retro.

## When

- From `siesta-run-roadmap`, when it closes a roadmap: over the whole roadmap.
- When the human asks: over what they name, or the roadmap so far.

A retro looks at how the work went. What it delivered is the status's job.

## What to read

Only what is written down:

| Source | Look for |
|---|---|
| The project manager's log: its choices and the human's corrections | What it had to work around, and what the human corrected |
| Each worker's brief and report: hypotheses, corrections, what it told the project manager | The same obstacle, hypothesis or correction in more than one epic |
| The review rounds | The same kind of finding, the rounds each pull request took, a panel that could not start, a fault found only after its merge |
| The checkpoint's log | Questions that were tasks rather than decisions, answers that were always the same, proposals the human declined |
| The decisions, the statuses and the integration branch's history | Decisions replaced, discrepancies that came back, reverts, fixes after a merge, refused merges |
| Earlier retros' files, `paths.notes/retro-*.md` | What was proposed before, and what the human answered |
| The effective configuration and Siesta's current skills | Whether a cause is already fixed |

## What becomes a proposal

A pattern: the same thing at least twice, in different epics, rounds or sessions. One case is enough when:
- the human gave it as a rule for next time;
- it touched what `autonomy.never` forbids, or came close;
- a fault reached the integration branch past its review.

Everything else seen once goes in the retro's file, not to the human. So does what the effective configuration or the current skills already fix, with the key or the skill that fixes it.

A proposal the human declined comes back only with what happened since, and says that they declined it, in their words. When their words did not clearly answer it, say so, and ask again.

Each proposal is one change with a home the next session reads: a key and its value, a file and the words it gains, a decision. "I will check next time" or "plan better" is not a change: what no file says, the next session does not do.

## Where each change lands

| Level | When the cause is | Lands in | Through |
|---|---|---|---|
| This project | The project: its code, its plan, its checks, its documents | `.siesta/config.yaml`, `paths.perspectives`, `paths.templates`, the agent instructions, the product or architecture documents, or a decision | One pull request; a decision with `siesta-decide` |
| The person's machine | The person or the machine: their tools, hooks, harnesses, preferences | The machine layer of the configuration, or the checkout's file for what holds in one checkout only | That file, written with their yes |
| Siesta | The method: a skill that is missing, wrong or silent | The retro's file, under "For Siesta" | The human takes it to Siesta. Open nothing outside |

`autonomy` lands only in the repository's file, whatever its cause, and only a `siesta-setup` conversation writes it, with the text the human approved. When the level is not clear, offer the levels as the options.

## Write

1. The retro's file, `paths.notes/retro-<roadmap id>.md`, or `retro-<YYYYMMDD>.md` when the human asked about something else, in the shape of [assets/retro.md](assets/retro.md), in `project.language.human`.
2. Each proposal as a question of its own, in the question reference's shape:
   - what repeated, with each case and where it is recorded;
   - the exact change, and where it lands;
   - leaving it as it is, as one of the options.

   Number the questions after the last id in the checkpoint's log. With the human in the conversation, ask them there. Otherwise put them in the checkpoint with `siesta-checkpoint`, saying that no work waits for them.
3. Change nothing until the human answers.

## Their answers

- **Accepted:** make the change through its route. The project's changes go in one pull request, and a change to `autonomy` through `siesta-setup`.
- **Declined:** nothing changes.

Either way, write their words beside the proposal in the retro's file, so that the next retro knows what they said.
