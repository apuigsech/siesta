---
name: siesta-review
description: Runs a review in rounds, of a pull request or of a plan, with a panel of independent reviewers, the author's answer to each finding and an independent re-check of every fix. Use when a pull request or a roadmap is to be reviewed before it merges or is accepted, when an author must answer a review round, or when the fixes of a round are to be re-checked.
argument-hint: "[pull request number, or roadmap id]"
---

# Siesta review

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration: `review.pull_request` or `review.plan`, `roles.reviewer`, `roles.rechecker` and `paths.notes`.

**Outcome:** every finding of every round is closed, and the change merges, or the plan goes to the human for acceptance, only then. A finding is closed in one of four ways:
- a fix the re-check confirms;
- a dispute the lead accepts, with the reason;
- a deferral with a home, such as an open question or an epic. Only a finding below the blocking severities may be deferred;
- a discard by the lead, with the reason.

## Who does what

| Who | Does |
|---|---|
| The lead: the project manager for a pull request, the planner for a plan | Runs the panel, checks and gathers the findings, decides when the review ends |
| The reviewers, `roles.reviewer` | Each reviews from its perspectives and reports findings, changing nothing |
| The author: the epic's worker, or the planner | Answers every finding |
| The re-checker, `roles.rechecker` | Checks every fix without changing anything |

## The files

Every round's files live in `paths.notes`, named after what is reviewed: `pr-<number>` or the roadmap's id.

| File | Written by | Template |
|---|---|---|
| `review-<target>-r<n>.md` | The lead | [assets/round.md](assets/round.md) |
| `review-<target>-r<n>-response.md` | The author | [assets/response.md](assets/response.md) |
| `review-<target>-r<n>-recheck.md` | The re-checker | [assets/recheck.md](assets/recheck.md) |

Findings are numbered `F-<n>` across the whole review, not per round, so that a finding keeps its number from report to re-check.

## Lead: run a round

1. **Gather what the change must satisfy:** for a pull request, its epic's spec, the decisions and architecture rules it touches, and the feature it builds; for a plan, the product, the architecture, the features and the decisions.
2. **Start the panel.** Start as many reviewers as the configuration's `reviewers`, each with the harness, model and effort of `roles.reviewer`. Give each one or more of the configured perspectives, so that every perspective has a reviewer. Extra reviewers take the perspective that matters most for this change. When the repository has `paths.perspectives/<perspective>.md`, give it to that perspective's reviewer.
   - Give each reviewer the change and what it must satisfy. Never give it the author's reasoning, the other reviewers' reports or your own conclusions: an independent reviewer is the point of the panel.
   - Reviewers work read-only. Each finding names where it is, what happens (the input, what comes out, what should come out), why it matters, and what a fix must bring.
   - When the role's harness cannot be started, use this session's harness and say so in the round file. When no helper can be started at all, review each perspective in turn yourself, and say in the round file that the panel was not independent. A re-check you do yourself says the same in its file.
3. **Check every finding before you send it:** reproduce it, or read the code that shows it. Merge findings that several reviewers raised, and set each one's severity. A finding you cannot confirm is discarded, with the reason, in the round file's discarded list.
4. **Write the round file** and point the author to it.
5. **After the author's answer,** have the re-checker check the fixes, when `recheck` is on. Then decide each finding: a dispute is accepted or refused, with the reason; a refused dispute stays open. Re-check findings that are new open the next round.

The review ends when every finding is closed. Then merge, by the merge rules, or put the plan to the human. Past `max_rounds` with findings still open, put them to the human with `siesta-checkpoint`, and do not merge.

A review is not independent when the lead did any of its rounds or re-checks alone. Say so wherever its outcome reaches the human, naming those rounds: the merge, as `siesta-merge` says; the plan's acceptance question; the status.

## Author: answer a round

Answer every finding in the response file:
- **Fixed:** what changed and in which commit, and the test that fails without the fix.
- **Disputed:** why, with evidence the lead can check.
- **Deferred:** only below the blocking severities, and with where it went.

Reproduce a finding before fixing it. A finding that turns out worse than reported is answered at its real size. A fix that needs a decision or changes scope goes to the human as the `siesta` rules say. Point the lead to the response when it is done.

## Re-checker: check the fixes

Check every fixed finding in a copy of the branch, changing nothing in it:
- **Holds:** the fix does what the finding asked.
- **Partial:** it does part of it, and you say which part is missing.
- **Does not hold:** you say why.

With `mutation_check` on, undo each fix in the copy and run the tests: a fix whose test still passes without it is `Partial`. Report anything new you find as a new finding, with the next free number and its severity.

## A plan's review

The same rounds apply to a roadmap and its epics. Findings point to the passage: the phase, the epic, the criterion. A fix is an edit to the plan, and the re-checker reads the edited passages. There is no mutation check.
