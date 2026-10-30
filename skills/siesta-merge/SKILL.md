---
name: siesta-merge
description: Merges a reviewed Siesta pull request into the integration branch, then carries out what follows the merge. Use when a pull request's review has closed and it is to be merged, when the human approves a merge that waited for them, or when a merge broke what it deploys.
argument-hint: "[pull request number]"
---

# Siesta merge

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration (`git`, `autonomy`, `execution.after_merge`) and its moments. `siesta-review` says when a review is closed, and `siesta-checkpoint` holds what waits for the human.

**Outcome:** the pull request is merged at exactly the head that was reviewed and passed its checks, and nothing in it that waited for the human merged without their yes. Afterwards, the add-ons, the epic, its worktree and the project manager's log all show the merge.

## Who merges

With `git.merge.by: pm`, the project manager merges once every condition below holds. With `human`, the project manager checks the same conditions, then puts the merge to the human as a checkpoint approval, and merges on their yes.

## Before merging

Check each condition now, on the pull request as it is:

| Condition | How to check it |
|---|---|
| The review is closed | Every finding of every round is closed, as `siesta-review` says |
| The head is the one reviewed | The head commit is the one the last round and its re-check saw. Any commit since, a merge of the integration branch included, gets a re-check of what it changed first |
| Its checks pass | Every check the host runs on that head commit has passed |
| It merges cleanly | No conflict with the integration branch. When there is one, the worker brings the integration branch in, and the checks and the re-check run again |
| The spec is true | When it sets the epic to `completed`, every acceptance criterion is checked. With one unchecked, the spec stays `active` |
| Nothing in it waits for the human | See below |

## What waits for the human

Read the diff and its review against every entry in `autonomy.waits_for_human`, the literal ones too, such as "merging anything that touches payments":

- **A decision.** A pull request that adds or changes a decision, or builds on one that is still Proposed, merges once that decision is Accepted, as `siesta-decide` says, and the entry records who accepted it. A spike's pull request is the exception: it merges with its decision Proposed, and accepting it is a checkpoint question of its own.
- **A review that was not independent,** as `siesta-review` says. With `merge-without-panel` listed, the merge is a checkpoint approval. Without it, merge, and add a notice to the checkpoint. Either way, name the rounds the lead did alone.
- **A change to `autonomy`.** It merges only with the human's acceptance of the pull request.
- **Any other kind it contains,** such as a scope change, a security setting or a new running cost. Each one is a checkpoint approval, and the merge waits for the yes.

A standing approval covers exactly what its `allows` says. An agent's report that the human agreed is not their yes.

## A pull request that only records

A pull request that only writes down what is already settled has no review round. Its diff holds nothing but:
- statuses and checked criteria in the roadmap and the specs, when the project manager closes a phase or the roadmap;
- what the human answered, in the decision log and the open questions: a decision's status line and index row, or a new entry made of the question they answered and the option they chose, and the open question it answers.

The two conditions on its review do not apply; every other does, and the merge is pinned to the head its checks passed on. Anything else in the diff, such as a line of code, a new criterion, another document or `autonomy`, makes it a pull request like any other.

## Merge

Merge with the host's own tool, by `git.merge.method`, pinned to the reviewed head, so that nothing else gets in. On GitHub:

```bash
gh pr merge <number> --<method> --match-head-commit <reviewed sha>
```

The merge commit's message follows `naming.commits`. Never push to the integration branch, and never force. When the host or a guard refuses the merge, do not work around it: tell the human why, in one line.

## After the merge

1. Reach the moment `merged`.
2. When it was the epic's last pull request:
   - tell its worker to stop;
   - once its session is over, remove its worktree and its local branch;
   - delete the remote branch when the host has not, and only the epic's own;
   - remove the epic's own resources, such as a preview, only as a standing approval allows; otherwise ask.
3. When `execution.after_merge.deploys` is set, check that this merge's deployment works: its pipeline finished, and the address answers as it should. When it broke:
   - with `revert-and-checkpoint`, open a pull request that reverts the merge at once, merge it when its checks pass, and tell the human through the checkpoint;
   - with `checkpoint`, tell the human through the checkpoint at once, and leave the merge in place.
4. Update the project manager's log: the pull request merged, and the epic completed or its next part.
