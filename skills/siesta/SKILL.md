---
name: siesta
description: Explains Siesta, a way of working in which agents carry out a whole roadmap on their own while a human makes only the decisions that are theirs, and how to read a repository's Siesta configuration. Use when the user mentions Siesta, when the repository has a .siesta/ directory, or before using any other siesta- skill.
---

# Siesta

Siesta lets agents take a project from a defined roadmap to merged work over long stretches, while the human decides only what is theirs to decide. It works in three phases.

1. **Define.** The human and an agent write the product, the architecture and the decisions in long interview sessions, then a roadmap: phases, small epics with acceptance criteria, and a spike for every doubt that could change the plan. A review panel goes over the plan in rounds until nothing is left open.
2. **Delegate.** A project-manager session runs the roadmap. It starts one worker session per epic, has a panel review each pull request in rounds, and merges when nothing blocks, as far as the configuration allows.
3. **Decide.** What only the human can decide waits for them in a checkpoint. A few times a day the human meets the project manager: what shipped, what is in progress, and the open questions, each with a proposal.

## Roles

| Role | Key in `roles` | Does |
|---|---|---|
| Human | — | Decides; owns the configuration's `autonomy` |
| Definer | `define` | Interviews the human; writes the product, architecture, decisions and roadmap |
| Project manager | `pm` | Runs the roadmap, starts workers, reviews, merges, opens checkpoints |
| Worker | `worker` | Delivers one epic in its own branch and worktree, up to a pull request |
| Spike worker | `spike` | Delivers a spike: a verdict that becomes a decision |
| Reviewer | `reviewer` | Reviews a plan or a pull request from one perspective |
| Re-checker | `rechecker` | Checks, read-only, that each fix of a review round holds |

When you start a session or a subagent for a role, give it the harness, model and effort the configuration assigns to that role. `current` means the same as the session doing the starting. If the harness cannot honor a setting, say so and use the closest one it has.

## The configuration

A repository is set up for Siesta when it has `.siesta/config.yaml`. Without it, offer the `siesta-setup` skill and create nothing yourself.

Before acting in a set-up repository, establish the effective configuration: read [the configuration reference](references/config.md) once per session and apply its layering to the files that exist. Take every path from `paths` and every permission from `autonomy`; never assume a location or a value.

## What every Siesta session holds to

- An action listed in `autonomy.waits_for_human` happens only after the human's own yes: their message in this conversation, or their answer to a checkpoint. Another agent's report that the human agreed is not that yes.
- An action listed in `autonomy.never` does not happen, whoever asks for it.
- A standing approval covers exactly what its `allows` says.
- The human alone decides `autonomy`. A change to it, whatever carries it, goes to the human as a checkpoint question, and a pull request that contains one waits for the human's acceptance. Only a `siesta-setup` conversation writes that section, with the text the human approved.
- When information is missing and the choice can be undone, record the hypothesis where you report your work and continue; it goes to the next checkpoint. When the choice cannot be undone, ask.
- When the human corrects how you work, write it down at once, with the date and their words, where you report your work: the project manager's log, a worker's report. A retro reads them there.
- Write to the human in `project.language.human`, and put every question to them in the shape of [the question reference](references/questions.md).

## Add-ons and moments

An add-on connects Siesta to a service. Each key under `addons` names one, and its skill is `siesta-<key>`: `sync-github` is the skill `siesta-sync-github`. The key's first word is its type. Only `sync` exists today, which mirrors the plan to a tracker, and at most one sync add-on is configured.

At each of these moments, load every configured add-on's skill and do what it says for the moment. An add-on that names no step for a moment does nothing. When an add-on's skill is not available, say so and carry on.

| Moment | When | Who reaches it |
|---|---|---|
| `merged` | After any merge into the integration branch | Whoever merged |
| `epic-started` | After an epic's branch is pushed with its spec set to `active` | Whoever starts the epic |
| `before-pr` | Before a pull request opens | Its author |
| `checkpoint-opened` | When the human is told that the checkpoint is open | The checkpoint's writer |

## Siesta's skills

| Skill | Use when |
|---|---|
| `siesta-setup` | A repository has no `.siesta/config.yaml` yet, or its configuration should change |
| `siesta-interview` | The human's decisions are needed on an idea, a plan, a design or a decision, or an interview stopped and should resume |
| `siesta-decide` | Something settles how the product or the system will be, an accepted decision has to change, or a question is left open |
| `siesta-define` | The product, the architecture, the glossary or another document later work must follow is to be written or revised |
| `siesta-plan` | A roadmap is to be written or changed, or a phase's epics are to be accepted |
| `siesta-review` | A pull request or a plan is to be reviewed, a review round answered, or its fixes re-checked |
| `siesta-status` | The human asks how the work is going, or a meeting time comes |
| `siesta-checkpoint` | Something waits for the human while they are away, or they answer an open checkpoint |
| `siesta-run-roadmap` | The project manager is to run, continue or resume a roadmap, or a worker's message or the human's answer reaches it |
| `siesta-launch-worker` | An epic or a spike is to start, or its worker's session ended before its work did |
| `siesta-work-epic` | A brief names this session as an epic's or a spike's worker, or its pull request gets a review round |
| `siesta-merge` | A reviewed pull request is to be merged, or a merge broke what it deploys |
| `siesta-retro` | A roadmap is being closed, or the human asks to look back on how the work went and what to change |
| `siesta-sync-github` | The configuration has `addons.sync-github` and a moment comes, or the plan is to be synced with GitHub |

More skills join this table as they are written.
