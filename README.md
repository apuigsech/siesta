# Siesta

> You nap. They ship.

Siesta is a way of working with coding agents over long stretches without watching every step. You
define the work in depth first: the product, the architecture and a roadmap whose doubts become
spikes. Then a project-manager agent runs the roadmap: it starts one worker session per epic, has a
panel of reviewers go over every pull request until nothing blocks, and merges. You meet it a few
times a day to see what shipped and to make the decisions only you can make.

Siesta is a set of skills any coding agent can load: Claude Code, Codex, Pi, OpenCode and others.

**Status.** All fifteen skills are drafted. Each was tested with agents on scratch repositories,
first without the skill and then with it, and the delivery skills were run together end to end on a
simulated code host. They have not yet run a roadmap on GitHub.

## How it works

Siesta works in three phases.

1. **Define.** You and an agent write down what the product is, how the system is built and what is
   decided, in long interviews where the agent asks and you decide. The roadmap comes from those
   documents:
   - phases, each with completion criteria;
   - small epics, each with acceptance criteria;
   - a spike for every doubt that could change the plan.

   A panel of reviewers goes over the plan in rounds until nothing is left open.
2. **Delegate.** A project-manager session runs the roadmap.
   - It starts one worker per epic, each in a session, a branch and a worktree of its own.
   - Each worker builds its epic up to a pull request.
   - A panel of independent reviewers goes over each pull request in rounds, and a re-checker
     confirms each fix.
   - The project manager merges when nothing blocks, as far as the configuration allows.
3. **Decide.** What only you can decide waits for you in the checkpoint, each item ready to answer
   in a line: a decision, an approval, a hypothesis the agents took meanwhile. Work that does not
   depend on it goes on. When you come back, you answer, and every answer goes where it belongs.

| Role | Does |
|---|---|
| You, the human | Decide; own what the agents may do on their own |
| Definer | Interviews you; writes the product, the architecture, the decisions and the roadmap |
| Project manager | Runs the roadmap: starts workers, leads reviews, merges, keeps the checkpoint |
| Worker | Delivers one epic, or a spike's verdict, up to a pull request |
| Reviewer | Reviews a plan or a pull request from one perspective, changing nothing |
| Re-checker | Checks, read-only, that each fix of a review round holds |

Each role can run on its own harness, model and effort.

## Install

Each harness has a thin manifest at the repository's root that points to the same `skills/`
folder.

| Harness | Install |
|---|---|
| Claude Code | `claude plugin marketplace add apuigsech/siesta`, then `claude plugin install siesta@siesta` |
| Codex | `codex plugin marketplace add apuigsech/siesta`, then `codex plugin add siesta@siesta` |
| Pi | `pi install git:github.com/apuigsech/siesta` |
| OpenCode and others | Clone the repository and link each folder of `skills/` into `~/.agents/skills/` |

What the skills need:
- **Git**, and a code host with pull requests. The skills use the host's own tool: on GitHub, the
  `gh` CLI, signed in.
- **A way to open the workers' sessions:**
  - the harness's own way, when it has one;
  - a command of yours, such as one that opens a terminal tab running the harness's CLI;
  - or you start each one from the exact command the project manager gives you.
- **Node 20 or later,** only for the GitHub sync add-on.

You rarely call a skill by name. Say what you want, and the harness loads the skill whose
description matches. To call one by name:
- in Claude Code, `/siesta:siesta-setup`;
- in Codex, type `$` and pick it;
- in Pi, `/skill:siesta-setup`.

Claude Code keeps `siesta-launch-worker` and `siesta-work-epic` out of its `/` menu, since only the
agents use them. Codex and Pi have no way to hide a single skill. The agents can load every skill
on their own: the skills load each other, and a worker starts from a brief that names its skill.

## The skills

| Skill | Does | You might say |
|---|---|---|
| `siesta` | The method, the rules every session keeps, and how to read a repository's configuration. Every other skill builds on it | "What is Siesta?" |
| `siesta-setup` | Writes `.siesta/config.yaml` after a short conversation: who merges, what waits for you, the review panels, how sessions open | "Set up Siesta in this repository" |
| **Define** | | |
| `siesta-interview` | Interviews you in rounds until you both share one understanding, and records what each answer settles. Facts it can find, it finds; decisions it asks | "Grill me about this idea" |
| `siesta-define` | Writes or revises a document later work follows: the product, the architecture, the glossary, a feature, a module's charter | "Let's define the product" |
| `siesta-decide` | Records decisions and open questions in one shape, numbered across every open branch, each with who accepted it and their words | "Note that as a decision" |
| `siesta-plan` | Writes the roadmap: phases with completion criteria, epics with acceptance criteria, spikes for the doubts | "Write the roadmap" |
| `siesta-review` | Reviews a plan or a pull request in rounds: an independent panel, the author's answer to each finding, a re-check of each fix | "Review the plan" |
| **Delegate** | | |
| `siesta-run-roadmap` | The project manager's loop, from starting epics to closing phases and the roadmap | "Run the roadmap" |
| `siesta-launch-worker` | Starts an epic's worker in a session of its own, with its worktree, branch and brief | (the project manager uses it) |
| `siesta-work-epic` | The worker's part: plan, tests first, the code, a check that the tests catch faults, the pull request, the review rounds | (the worker uses it) |
| `siesta-merge` | Merges at exactly the reviewed head, never past what waits for you, then cleans up after the epic | (the project manager uses it) |
| **Decide** | | |
| `siesta-checkpoint` | Collects what waits for you while you are away, and takes your answers when you are back | "What do you need from me?" |
| `siesta-status` | Where the roadmap stands, with every number counted from the repository | "How is it going?" |
| `siesta-retro` | Looks back over a roadmap for what repeated, and turns it into changes you can accept in a line | "Let's look back on this roadmap" |
| **Add-ons** | | |
| `siesta-sync-github` | Mirrors the plan to GitHub issues and milestones. The repository stays the record | "Sync the plan with GitHub" |

## Examples

These examples follow one small project from start to end: `tally`, a command-line tool that splits
a bill among friends. The agent's replies are shortened.

### Set up a repository

> **You:** Set up Siesta in this repository.
>
> **Agent** (`siesta-setup`): I found Node 20, `npm test` as the only check, and `main` protected on
> GitHub. I can take the defaults plus what I found, or ask you a few questions first.
>
> **Q-1 - Who merges.** Once a pull request's review is closed and its checks pass, someone merges
> it.
>
> **a) The project manager.** (recommended) It merges when nothing blocks. Anything that waits for
> you still waits.
>
> **b) You.** Every merge is an approval in the checkpoint.
>
> **You:** a

When the questions are done, it shows you the whole `.siesta/config.yaml` and writes it after your
yes. Nothing is committed.

### Define the product

> **You:** Interview me about the product: a CLI that splits a bill among friends.
>
> **Agent** (`siesta-interview`): Round 1, three questions. Q-1 and Q-2 are facts only you know;
> Q-3 is a decision.
>
> **Q-3 - How amounts are held.** 0.1 + 0.2 is 0.30000000000000004 in floating point, and a bill
> must add up to the cent.
>
> **a) Integer cents inside the program.** (recommended) Converted only when read and when printed.
>
> **b) A decimal library.** It adds a dependency.
>
> **You:** Q-1 friends who share a dinner or a trip. Q-2 no, no currencies. Q-3 yes, integer cents,
> no decimals inside.
>
> **Agent:** D-001, "Amounts are integer cents inside the program", is Accepted with your words. On
> to round 2.

At the end, `siesta-define` writes `docs/purpose.md` and `docs/architecture.md` from what you
settled, and asks you to confirm before it closes them.

### Plan

> **You:** Write the roadmap.
>
> **Agent** (`siesta-plan`): Roadmap `20261030-split-a-bill`. Phase 1, "The bill settled in the
> terminal", has three epics: "Read a bill", "Each person's balance" and "The transfers, in the
> terminal". It closes when `node bin/tally.mjs docs/example.txt` prints `Cai → Ana: 15.00`. The
> panel's first round found four things, all fixed; round 2 left nothing open.
>
> **Q-4 - Accept phase 1.** Its three epics, and how each is accepted.
>
> **You:** Yes, go ahead with phase 1.

### Run it, and leave

> **You:** Run the roadmap.
>
> **Agent** (`siesta-run-roadmap`): I'm starting "Read a bill" and "Each person's balance" together,
> since they touch different parts. "The transfers, in the terminal" waits for both. I'll review
> each pull request with a panel, merge what nothing blocks, and leave in the checkpoint what needs
> you.

You go and do something else. The workers build, the reviewers review, the project manager merges.

### Come back to a checkpoint

> **You:** What do you need from me?
>
> **Agent** (`siesta-checkpoint`): Phase 1: one of three epics merged, one waits for you, one in
> review.
>
> **Q-5 - The cents left over from an uneven share (D-003).** 10.00 among three is 3.33 each, with
> 1 cent left over. Someone has to bear it, the same way on every run. Merging "Each person's
> balance" (#2) waits for this.
>
> **a) The payer bears them.** (recommended) Everyone else owes their share rounded down.
>
> Pros:
> • No one who did not pay owes more than their exact share.
>
> Cons:
> • The payer gets back up to a cent less for each person who shares the expense.
>
> **b) One cent more each for the first names in alphabetical order.**
>
> Cons:
> • The same names bear the extra cent on every expense.
>
> **H-7 - Commits are signed.** This machine's hook refuses unsigned pushes, so the workers sign
> their own commits. Answer only to correct it.
>
> **You:** Q-5 yes. H-7 fine.
>
> **Agent:** D-003 is Accepted with your words. #2 gets a re-check of that one commit, then merges.
> Nothing else waits for you.

"Yes" takes the recommended option, and a letter picks another. Each id means the same thing in
every version of the checkpoint.

### Ask how it is going

> **You:** How is it going?
>
> **Agent** (`siesta-status`): Phase 1 is closed: `tally docs/example.txt` prints `Cai → Ana: 15.00`
> and `npm test` passes on `main`. Roadmap: 3 of 3 epics completed. Delivered since 06:58: "Each
> person's balance" (#2) and "The transfers, in the terminal" (#3). Needs you: Q-6, a fault that
> shows only with huge amounts.

### Correct how the agents work

> **You:** I'll start this one as it is, but next time workers run at high effort; xhigh is for
> spikes.
>
> **Agent:** Noted in my log under Corrections, with the date and your words.

The retro reads those corrections at the end of the roadmap.

### Close the roadmap

> **Agent** (`siesta-run-roadmap`, `siesta-retro`): Every phase is completed.
>
> **Q-8 - Is the roadmap done?** Everything it planned is on `main`.
>
> **Q-9 - A standing approval for small decisions.** A rounding decision held a merge, and you
> asked for decisions like it to be mine. With
> SA-1, "Accepting decisions on how amounts are rounded or written", I accept those myself and show
> them to you as hypotheses.
>
> **You:** Q-8 yes. Q-9 yes.
>
> **Agent:** The roadmap is `completed` with your words. SA-1 goes into `.siesta/config.yaml`
> through `siesta-setup`, in a pull request.

## Configuration

A repository is set up for Siesta when it has `.siesta/config.yaml`. The file holds only what
differs from [Siesta's defaults](skills/siesta/assets/defaults.yaml), which list every key with its
meaning.

```yaml
version: 1

project:
  language:
    human: es                 # checkpoints and meetings in Spanish; documents stay in English

git:
  integration_branch: main
  merge:
    by: pm                    # the project manager merges when nothing blocks

execution:
  before_pr: ["npm test"]

review:
  pull_request:
    reviewers: 2
    perspectives: [correctness, tests]

autonomy:
  standing_approvals:
    - id: SA-1
      allows: "Accepting decisions on how amounts are rounded or written"
      granted: 2026-10-30
      said: "Small decisions like this one, on rounding or format, take them yourself."
```

The configuration combines these files, from lowest to highest precedence:
1. Siesta's defaults.
2. Your machine's file: `~/.config/siesta/config.yaml`.
3. The repository's file: `.siesta/config.yaml`, committed.
4. The checkout's file: `.siesta/config.local.yaml`, never committed.

`autonomy` comes only from the repository's file and the layers below it, so a file nobody reviews
cannot change what the agents may do.

| Section | Sets |
|---|---|
| `roles` | Harness, model and effort for each role |
| `paths` | Where each document, the plan, the checkpoint, the notes and the worktrees live |
| `naming` | Ids, branches, session titles, commit style |
| `git` | The integration branch, signing, who merges and how |
| `autonomy` | What waits for you, what never happens, and your standing approvals |
| `execution` | How many epics run at once, what runs before a pull request, what a merge deploys |
| `review` | The panels for plans and for pull requests: how many reviewers, which perspectives, what blocks |
| `interview` | Questions in rounds, or one at a time |
| `checkpoints`, `status` | Where the checkpoint is published, whether it opens with a status, when you meet |
| `sessions` | How workers' sessions open |
| `addons` | Connections to other services, such as `sync-github` |

## Where things live

| What | Default place |
|---|---|
| The product, the architecture, the glossary | `docs/purpose.md`, `docs/architecture.md`, `docs/glossary.md` |
| Decisions and open questions | `docs/decisions.md`, `docs/open-questions.md` |
| Roadmaps | `.siesta/roadmaps/<id>.md` |
| Epics and spikes | `.siesta/epics/<id>/spec.md`, with the worker's `plan.md` beside it |
| The checkpoint | `.siesta/checkpoint.md`, in the main checkout, never committed |
| Briefs, reports, review rounds, statuses, logs and retros | `~/.local/state/siesta/<repo>/notes/`, outside every worktree |
| Workers' worktrees | `~/.local/state/siesta/<repo>/worktrees/` |

The repository is the record. GitHub, through the sync add-on, only mirrors it.

## What the agents do on their own, and what they don't

- **What waits for you.** Every kind of action listed in `autonomy.waits_for_human` happens only
  after your own yes, given in the conversation or in the checkpoint. By default:
  - decisions;
  - accepting a phase;
  - changes of scope;
  - a merge whose review was not independent;
  - infrastructure applies;
  - new running costs;
  - deletions;
  - security changes.

  Another agent's report that you agreed is not your yes.
- **What never happens.** Nothing in `autonomy.never` happens, whoever asks. By default, that is
  pushing straight to the integration branch and force-pushing.
- **Standing approvals** cover exactly what their words say, read literally. A decision the project
  manager accepts under one comes to you as a hypothesis. Replacing a decision you accepted always
  needs your yes.
- **`autonomy` is yours.** The agents never change it. A change goes to you as a question, and only
  a `siesta-setup` conversation writes the text you approved.
- **Merges** are pinned to the head that was reviewed, after every finding is closed and every
  check passes. A pull request that only records what is already settled, such as your answer to a
  question, needs no review round. Nothing works around a refusal from the host or a guard.
- **Hypotheses.** When information is missing and the choice can be undone, the agent takes a
  hypothesis, says so, and goes on. When the choice cannot be undone, it asks.

## Repository layout

```text
skills/                          the skills, one folder each, shared by every harness
tests/                           tests of the skills' scripts
.claude-plugin/                  Claude Code: the plugin and its marketplace
.codex-plugin/                   Codex: the plugin
.agents/plugins/marketplace.json Codex: the marketplace
package.json                     Pi: the package
```

Claude Code, Codex and Pi were checked on 2026-10-29 with a probe skill: each found it in `skills/`.
OpenCode was not checked.

## Contributing

Read [AGENTS.md](AGENTS.md) first: it holds the rules that keep Siesta harness-neutral, and the
checks to run before a pull request.

## Credits

`siesta-interview` builds on the technique of Matt Pocock's
[`grilling`](https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling) skill (MIT):
a design tree, asked in rounds along its frontier. The glossary's shape in `siesta-define` follows his
[`domain-modeling`](https://github.com/mattpocock/skills/tree/main/skills/engineering/domain-modeling) skill (MIT).
