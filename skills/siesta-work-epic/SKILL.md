---
name: siesta-work-epic
description: Carries out one Siesta epic or spike as its worker, from its brief to a pull request with every acceptance criterion verified, and through its review rounds. Use when a brief names this session as the worker of an epic or a spike, when such a worker resumes in a new session, or when its pull request receives a review round.
user-invocable: false
---

# Siesta work epic

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration and the rules every session holds to. `siesta-decide` records decisions, and `siesta-review` says how an author answers a round.

**Outcome:** the epic's pull request is open against the integration branch, with each acceptance criterion verified and its evidence in the report. Nothing that waits for the human was done without their yes, and the project manager knows where the work stands.

## Start, or start again

1. Read the brief, the repository's agent instructions, the spec and, when there is one, the plan beside it. When you start again, read your report first: it is where you left off.
2. Check that you are where the brief says: its worktree, its branch, and the spec `active` on it. If not, stop and tell the project manager.
3. Prepare the worktree as the repository's instructions say, such as installing its dependencies.

## Plan

Write `plan.md` beside the spec, or check the one there against the repository and rewrite it: the steps, and how each acceptance criterion will be verified. With `status.progress` set to `tasks` or `mixed`, the steps are checkboxes, checked as each is done. The plan is yours. The spec's scope and acceptance criteria are the plan's: changing them is a scope change, which you propose to the project manager.

## Build

- Write the tests first where the epic has behavior.
- Commit as `naming.commits` says. Sign as `git.signed_commits` says, every commit before it is pushed.
- Fetch before each push. When the integration branch moved, bring it in with a merge; never rewrite commits that are already pushed.
- Check a criterion in the spec only once it is verified, and write its evidence in the report at the same time.
- A lasting choice about how the product or the system will be is a decision. Record it with `siesta-decide` as Proposed, with the next free number across the integration branch and every open branch.
- A missing fact whose choice can be undone: take the hypothesis, write it in the report and go on. When the choice cannot be undone, ask the project manager and meanwhile build what does not depend on it.
- Work the epic needs that is outside its scope, or a fault in another epic's work: tell the project manager instead of building it here.

## What waits, and what never happens

An action of a kind in `autonomy.waits_for_human` goes to the project manager, with exactly what would be done, and you work on what does not depend on it. A standing approval covers exactly what its `allows` says. Nothing in `autonomy.never` happens. Never touch another session's worktree, branch, processes or resources.

## The pull request

1. **In an epic, with `execution.mutation_check` on, check that the tests catch faults.** Once they all pass, break the code the epic changed on purpose, one small change at a time: a condition reversed, a rule a criterion or a decision sets broken, a line removed. Each change is a mutation. Run the tests, then undo it. One mutation for each rule or branch that matters is enough. A mutation the tests still pass survived:
   - add the test that catches it;
   - or remove the code, when it made no difference;
   - or say in the report why it stays.
2. Run every command in `execution.before_pr` until they all pass, then reach the moment `before-pr`.
3. Set the spec to `completed` only in the epic's last pull request, and only when every acceptance criterion is checked and verified. Otherwise it stays `active`.
4. Open the pull request against the integration branch with the host's own tool, such as `gh` on GitHub:
   - titled as `naming.commits` says, with `naming.pr_reference` when it is set;
   - its body says what it brings, each criterion with its evidence, the mutations that survived, the hypotheses and the decisions it proposes.
5. Never merge it.
6. When the epic is large, propose a split into several pull requests to the project manager first, each one reviewable on its own.
7. Tell the project manager.

## Review rounds

Answer each round as the author in `siesta-review`, then tell the project manager. The project manager decides when the review ends, and merges.

## A spike

A spike's work is its verdict. Do what its "Try" says and measure what its "Decides" names. Record the verdict with `siesta-decide` as a Proposed decision, with its evidence: the data, how it was measured and where it is kept. When the result does not come, its "Otherwise" becomes the proposed decision. The spike's pull request carries the decision and sets the spike to `completed`. Accepting the decision waits for the human.

## The report and the messages

Keep `paths.notes/report-<epic id>.md` current, in the shape of [assets/report.md](assets/report.md). It is what the project manager reads, and what a new session starts from. Write it in `project.language.docs`, and its questions for the human in `project.language.human`, in the question reference's shape.

Message the project manager as the brief says, briefly and pointing to the report:
- when the pull request opens;
- when a round is answered;
- when something waits for the human;
- when you are blocked.

## When it is merged

The project manager removes the worktree after the epic's last merge. Stop when it tells you to.
