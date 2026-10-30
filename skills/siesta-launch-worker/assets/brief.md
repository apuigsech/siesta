# Brief: <epic title> (<epic id>)

You are the worker of the <epic or spike> `<epic id>`. Use the `siesta-work-epic` skill; this brief adds what is particular to this one. The project manager reviews your pull requests and merges them.

## Where you are

- Worktree `<path>`, on the branch `<branch>`, pushed, cut from `<base>` at `<commit>`.
- The spec is `active` since <date>.
- <When the branch is cut from another epic's branch: which one, why, and when to bring in the integration branch instead.>

## What to read

- The spec, `<path>`, and its plan, `<path>`, when there is one.
- <The decisions, the architecture's sections, the features and the module charters this epic touches, by id or path.>

## What is known

- <Facts that would otherwise cost the worker time to find: the state of its dependencies, the decision and open question numbers taken on open branches, an environment it can use.>

## Limits

- <What this epic must not do beyond the general rules, such as a rate a shared service allows; or "None beyond the general rules".>

## Finishing

- Before the pull request: <each command of `execution.before_pr`; or "the repository's own checks">.
- The pull request goes against `<integration branch>`<, with `<naming.pr_reference>`>. Don't merge it.
- Your report: `<paths.notes>/report-<epic id>.md`.

## Reaching the project manager

The project manager is the session `<its title>`. <How sessions message each other in this harness.> Write when the pull request opens, when a review round is answered, when something waits for the human, and when you are blocked. Keep each message short and point to your report.
