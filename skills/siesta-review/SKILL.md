---
name: siesta-review
description: Runs a review in rounds, of a pull request or of a plan, with a panel of independent reviewers, the author's answer to each finding and a re-check of its fixes. Use when a pull request or a roadmap is to be reviewed before it merges or is accepted, when an author must answer a review round, or when the fixes of a round are to be re-checked.
argument-hint: "[pull request number, or roadmap id]"
---

# Siesta review

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration: `review.pull_request` or `review.plan`, `roles.reviewer`, `roles.rechecker` and `paths.notes`.

**Outcome:** every finding of every round is closed, and the change merges, or the plan goes to the human for acceptance, only then. A finding is closed in one of four ways:
- a fix that is confirmed, by the re-checker or, where `recheck` leaves it to the lead, by the lead;
- a dispute the lead accepts, with the reason;
- a deferral with a home, such as an open question or an epic. Only a finding below the blocking severities may be deferred;
- a discard by the lead, with the reason.

## Who does what

| Who | Does |
|---|---|
| The lead: the project manager for a pull request, the planner for a plan | Sizes and runs the panel, checks and gathers the findings, checks the fixes `recheck` leaves to it, decides when the review ends |
| The reviewers, `roles.reviewer` | Each reviews from its perspectives and reports findings, changing nothing |
| The author: the epic's worker, or the planner | Answers every finding |
| The re-checker, `roles.rechecker` | Checks the fixes `recheck` gives it, changing nothing |

## The files

Every round's files live in `paths.notes`, named after what is reviewed: `pr-<number>` or the roadmap's id.

| File | Written by | Template |
|---|---|---|
| `review-<target>-r<n>.md` | The lead | [assets/round.md](assets/round.md) |
| `review-<target>-r<n>-response.md` | The author | [assets/response.md](assets/response.md) |
| `review-<target>-r<n>-recheck.md` | The re-checker | [assets/recheck.md](assets/recheck.md) |

Findings are numbered `F-<n>` across the whole review, not per round, so that a finding keeps its number from report to re-check.

## What a finding is

A finding is a fault in what the change leaves on the integration branch, or in the plan. It names where it is, what happens (the input, what comes out, what should come out), why it matters, and what a fix must bring.

A pull request's body does not reach the integration branch. The merge message does, and the lead writes it. So, about the body:
- **A false claim is a finding,** at its real severity: the body says the code does something it does not, or that something was verified when it was not. So is anything wrong in what it says about security or about what was tested.
- **Anything else about its wording or its counts is a note:** a phrase broader than what the code does, a count out of date, a run's failure it does not attribute to its known cause. A note goes in the round file, opens no round and gets no re-check. The merge message says it right, as `siesta-merge` says.

## The panel's size

`reviewers` is a number. For a pull request it may instead be a number for each class of change, such as `{ default: 2, security: 3, docs-only: 1 }`. Then the lead takes the first class that fits the diff, by its paths and its kinds of change, and writes the class and the reason in the round file. A class the configuration leaves out takes `default`'s number.

| Class | The change |
|---|---|
| `security` | Touches permissions, authentication, resource policies, customer data or secrets |
| `docs-only` | Holds no code, tests or infrastructure |
| `default` | Anything else |

## Efforts

`roles.reviewer` and `roles.rechecker` each have one effort, or one for each pass: `rounds` and `closing`. With one effort, everything runs at it and there is no closing pass. With both:

- **The rounds run at the `rounds` effort:** their panel and their re-checks.
- **A closing pass gates the end of the review.** When every finding is closed, one reviewer at the `closing` effort reads the whole change once, from every perspective, against what it must satisfy.
  - It is a round: it has its round file and counts toward `max_rounds`.
  - With nothing found, the review ends.
  - Its findings are answered and checked like any other's, at the `rounds` effort. The closing pass that follows reads only what changed since the last one.
- **The last round `max_rounds` allows runs at the `closing` effort,** since no closing pass can follow it.
- **A perspective named in `roles.reviewer.perspectives` runs at the effort set there,** in every round.
- **A change that touches permissions, authentication, customer data or money may run every round at the `closing` effort,** and then needs no closing pass. The lead decides from the diff and says why in the round file.

Each round file says which pass it is and the effort it ran at.

## Lead: run a round

1. **Gather what the change must satisfy:** for a pull request, its epic's spec, the decisions and architecture rules it touches, and the feature it builds; for a plan, the product, the architecture, the features and the decisions.
2. **Start the panel.** Start as many reviewers as the panel's size, each with the harness and model of `roles.reviewer` and the effort of its pass. Give each one or more of the configured perspectives, so that every perspective has a reviewer. With two reviewers or more, the perspective that matters most for this change has a reviewer that takes no other, and extra reviewers take it too. When the repository has `paths.perspectives/<perspective>.md`, give it to that perspective's reviewer.
   - Point each reviewer to the change and to what it must satisfy: the pull request at its reviewed commit, and each file by its path. Copy none of their text into its brief. Never give it the author's reasoning, the other reviewers' reports or your own conclusions: an independent reviewer is the point of the panel.
   - Reviewers work read-only, and report each finding as "What a finding is" says.
   - When the role's harness cannot be started, use this session's harness and say so in the round file. When no helper can be started at all, review each perspective in turn yourself, and say in the round file that the panel was not independent. A re-check you do yourself in the re-checker's place says the same in its file.
3. **Check every finding before you send it:** reproduce it, or read the code that shows it. Merge findings that several reviewers raised, keeping who raised each, and set each one's severity. A finding you cannot confirm is discarded, with the reason, in the round file's discarded list. What is only a note goes in its notes.
4. **Write the round file,** with what each reviewer cost, and point the author to it. A round that leaves only notes has nothing for the author to answer.
5. **After the author's answer,** have each fix checked as "Which fixes are re-checked" says, and add what the re-checker cost to its file. Then decide each finding: a dispute is accepted or refused, with the reason; a refused dispute stays open. Re-check findings that are new open the next round.

The review ends when every finding is closed and, where there is a `closing` effort, a closing pass has found nothing. Then merge, by the merge rules, or put the plan to the human. Past `max_rounds` with findings still open, put them to the human with `siesta-checkpoint`, and do not merge.

A review is not independent when the lead did alone a round, or a re-check that `recheck` gives the re-checker. A fix the lead checks because `recheck` leaves it to the lead does not make it so. Say that a review was not independent wherever its outcome reaches the human, naming those rounds: the merge, as `siesta-merge` says; the plan's acceptance question; the status.

## Which fixes are re-checked

`recheck` says which fixes go to the re-checker, who is independent of the lead and of the author:

| Level | Go to the re-checker |
|---|---|
| `all` | Every fix |
| `code` | A fix to a finding of a blocking severity, and any fix that changes code, tests or infrastructure |
| `blocking` | Only a fix to a finding of a blocking severity |
| `off` | None |

The lead checks every other fix itself, from the diff, and writes in the round file what it checked for each one.

## What a round cost

In the round file, record for each reviewer its harness, model and effort, and the usage the harness reports for it: its tokens, its tool calls and how long it ran. Do the same for the re-checker in the re-check file, once it has ended. Write `not reported` for a figure the harness does not give, and never estimate one.

Each finding keeps who found it: the reviewer, its perspective, its effort and the round. `siesta-retro` counts from these records which effort and which panel found what.

## Author: answer a round

Answer every finding in the response file:
- **Fixed:** what changed and in which commit, and the test that fails without the fix.
- **Disputed:** why, with evidence the lead can check.
- **Deferred:** only below the blocking severities, and with where it went.

Reproduce a finding before fixing it. A finding that turns out worse than reported is answered at its real size. A fix that needs a decision or changes scope goes to the human as the `siesta` rules say. Point the lead to the response when it is done.

## Re-checker: check the fixes

Check each fix you are given in a copy of the branch, changing nothing in it:
- **Holds:** the fix does what the finding asked.
- **Partial:** it does part of it, and you say which part is missing.
- **Does not hold:** you say why.

`mutation_check` says which of those fixes you test by mutation:

| Level | Tested by mutation |
|---|---|
| `all` | Every fix |
| `blocking` | A fix to a finding of a blocking severity |
| `off` | None |

- **A fix tested by mutation:** undo it in the copy and run the tests. A fix whose test still passes without it is `Partial`. Where a fix to a finding of a blocking severity brings new code, a branch or a rule of its own, break that too, one small change at a time.
- **Any other fix:** read the test that names its case, and check that it asserts what the finding asked.
- **Keep the tests' output out of your context.** Run the mutations through one script that keeps each run's output in a file and prints one line for each mutation: caught or survived. Read a run's output only to explain a survivor.

Report anything new you find as a new finding, with the next free number and its severity.

## A plan's review

The same rounds apply to a roadmap and its epics. Findings point to the passage: the phase, the epic, the criterion. A fix is an edit to the plan, and whoever checks it reads the edited passages. `recheck` has the same levels: in a plan, a fix that changes an epic's scope, its acceptance criteria or what it depends on stands where a change of code does. The panel's size is a number, and there is no mutation check.
