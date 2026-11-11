---
name: siesta-sync-github
description: Mirrors a repository's Siesta plan, its roadmaps, phases, epics, spikes and features, to GitHub issues and milestones, and keeps them in step. Use when the repository's Siesta configuration has addons.sync-github and one of Siesta's moments comes, or when the human asks to sync the plan with GitHub or to check that GitHub shows it.
argument-hint: "[check | publish]"
---

# Siesta sync: GitHub

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration and its moments.

**Outcome:** GitHub shows the plan as it stands on the integration branch, and every difference is either fixed or put to the human. The repository is the record; GitHub follows it.

## What GitHub shows

| In the repository | In GitHub |
|---|---|
| A roadmap | An issue labelled `siesta:roadmap`, titled `<title> [<id>]` |
| A phase | A milestone titled `<roadmap title>: <phase title>`, paired with the phase by `<roadmap id>/<phase slug>`, closed once the phase is completed |
| An epic or a spike | An issue labelled `siesta:epic` or `siesta:spike`, a sub-issue of its roadmap's issue, in its phase's milestone |
| A feature an epic names in its `feature` key | An issue labelled `siesta:feature`, linked from its epics and listing them, closed once they are all completed or cancelled |
| A blocker | `siesta:blocked`, plus its date and reason in the body; the lifecycle label stays |
| Delivery URLs | `Delivered by` links for completed epics; `Delivery PRs` while in progress |
| A status | A label `status:<status>`. `completed` closes the issue as completed, `cancelled` as not planned |

Each issue's body ends with `<!-- siesta-id: <id> -->`, which pairs it with its file: a title may change, the marker may not. Every issue also carries the label `siesta`.

## The script

Run the repository's copy, `.siesta/addons/sync-github.mjs`, when it exists, so that sessions and CI run the same code; otherwise run `scripts/sync-github.mjs` from this skill. It needs Node 20 or later and the GitHub CLI signed in (`gh auth status`). Never ask for, print or store a token.

| Command | Does | Exit |
|---|---|---|
| `node <script> check` | Compares GitHub with the plan; reports advisory branch observations; changes nothing | 0 in step, 1 a difference, 2 cannot run |
| `node <script> publish [--dry-run]` | Creates what is missing and fixes titles, bodies, labels, milestones and parents; leaves the statuses of existing issues alone | 0, or 2 |
| `node <script> status <id>... [--dry-run]` | Sets exactly those items' statuses from the record: one `status:` label, the state and the closing reason | 0, or 2 |
| `node <script> start <id> [--dry-run]` | Marks a planned epic active, once a branch on origin has its spec set to `active` | 0, or 2 |
| `node <script> issue <id>` | Prints the item's issue number | 0, or 2 |

The script reads the integration branch on origin, after fetching it, and never the working tree: what is not merged is not published. With `--dry-run`, `publish`, `status` and `start` print what they would change and send nothing.

**One writer at a time.** Two writers can race: two `publish` runs can each create a missing issue, and one from an older read can undo a status set since. Only the project manager writes to GitHub, one command after another, from its checkout of the integration branch; other sessions run `check` and `issue`. `publish` adds and removes labels one by one and never writes a `status:` label, so that it cannot undo a status another writer set.

`check --json` separates `differences` (exit 1) from `warnings` and `pending` branch observations (no effect on the exit code). It fetches with pruning, reports active epics with no published worker branch, and lists branch progress without publishing it. Completed or cancelled epics on integration are excluded: a merged PR may have had its branch deleted normally. An absent branch is a diagnostic to investigate, not permission to restart or a claim that code was lost. Matching uses the spec identity and changed progress, or the conventional branch slug; custom branch layouts may need the PM to resolve an advisory warning.

`status: blocked` is read for compatibility and reported as a migration warning. New specs keep their lifecycle status and use `blocked: null` or `{ since, reason }`. `publish` mirrors this field independently of lifecycle status. Numbered and unnumbered phase headings are accepted; phase identity still comes from its slug. The script reports duplicate live epic slugs and malformed metadata, and refuses writes when the integration record has these problems. Actual destination occupancy is also checked by the launcher, which has the effective naming configuration and local worktrees.

## Moments

| Moment | Do |
|---|---|
| `merged` | `publish`, then `status` for each roadmap, epic and spike whose file the merge changed |
| `epic-started` | `start <id>`, once the epic's branch is pushed with its spec set to `active` |

When a skill needs `{issue}` for a naming template, such as a session's title or a pull request's reference, `issue <id>` gives it.

## Judging a difference

- **`missing`, `title`, `labels`, `body`, `milestone`, `parent`:** `publish` fixes them.
- **`status`:** find out why before changing anything. When a merge changed the item's `status`, run `status` for it; a merge that changed the file but not its status says nothing about it. When someone changed the status in GitHub by hand, put it to the human as a checkpoint question; the record wins only once they say so. Unlike `check`, an explicit `status <id>` also undoes an `active` that GitHub shows for an epic the record still has `planned`.
- **`not in the record`:** an issue whose id left the integration branch. An epic dropped from the plan stays in it as `cancelled`, so this is usually a mistake in the plan. Leave the issue as it is and tell the human.
- **`problem`:** the record itself is wrong, such as an epic naming a phase slug its roadmap lacks, or a phase with no slug or no `**Status:**` line. Fix the record in a pull request.
- **`problem`, an id carried by two issues or two milestones:** usually two writers that raced. `publish`, `status`, `start` and `issue` refuse that id until a person decides which one stays and removes the other's marker; never delete it without their yes.
- **`labels`, an issue with two `status:` labels or a second kind label:** a person added one by hand. `publish` removes a stale kind label; for the status, find out which is right as for `status` below, then `status <id>` leaves only the record's.
- **`status`, closed for another reason:** a `completed` item closed as not planned, or the reverse. `status <id>` sets the record's reason.

## Authority and failure

The add-on writes issues, labels, milestones and sub-issue links in the repository `addons.sync-github.repo` names, by the human's choice when they set it up. It never deletes anything in GitHub, closes only what the record says is done, and touches no other repository. Mirror drift is reported through the checkpoint; it is never a delivery check on a pull request.

When GitHub or the CLI fails, the step that reached the moment still completes: say that the sync failed and why, and the next moment tries again.

## Setting it up

`siesta-setup` sets it up with the human:

1. `addons.sync-github` in `.siesta/config.yaml`, with `repo` when the origin remote is not the GitHub repository to use.
2. This skill's `scripts/sync-github.mjs` copied to `.siesta/addons/sync-github.mjs`. When the copy's `version` is older than this skill's, update it in a pull request.
3. Install no pull-request workflow. When upgrading an existing setup, remove the Siesta mirror-check job from `.github/workflows/siesta-sync.yml` and retire its required-check setting, if any, through the human-approved setup change. Preserve unrelated jobs. If the file contains only that job, remove it. Until its required-check setting is retired, report the blocker instead of bypassing it.
4. Once those are merged, `publish --dry-run`, shown to the human. The first publish creates many issues, so it waits for their yes.
