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
| A phase | A milestone titled `<roadmap title>: <phase title>`, closed once the phase is completed |
| An epic or a spike | An issue labelled `siesta:epic` or `siesta:spike`, a sub-issue of its roadmap's issue, in its phase's milestone |
| A feature an epic names in its `feature` key | An issue labelled `siesta:feature`, linked from its epics and listing them, closed once they are all completed or cancelled |
| A status | A label `status:<status>`. `completed` closes the issue as completed, `cancelled` as not planned |

Each issue's body ends with `<!-- siesta-id: <id> -->`, which pairs it with its file: a title may change, the marker may not. Every issue also carries the label `siesta`.

## The script

Run the repository's copy, `.siesta/addons/sync-github.mjs`, when it exists, so that sessions and CI run the same code; otherwise run `scripts/sync-github.mjs` from this skill. It needs Node 20 or later and the GitHub CLI signed in (`gh auth status`). Never ask for, print or store a token.

| Command | Does | Exit |
|---|---|---|
| `node <script> check` | Compares GitHub with the plan and changes nothing | 0 in step, 1 a difference, 2 cannot run |
| `node <script> publish [--dry-run]` | Creates what is missing and fixes titles, bodies, labels, milestones and parents; leaves the statuses of existing issues alone | 0, or 2 |
| `node <script> status <id>...` | Sets those items' statuses from the record | 0, or 2 |
| `node <script> start <id>` | Marks a planned epic active, once a branch on origin has its spec set to `active` | 0, or 2 |
| `node <script> issue <id>` | Prints the item's issue number | 0, or 2 |

The script reads the integration branch on origin, after fetching it, and never the working tree: what is not merged is not published.

## Moments

| Moment | Do |
|---|---|
| `merged` | `publish`, then `status` for each roadmap, epic and spike whose file the merge changed |
| `epic-started` | `start <id>`, once the epic's branch is pushed with its spec set to `active` |
| `before-pr` | `check`. Report a difference the pull request did not cause in the pull request; do not fix it there |

When a skill needs `{issue}` for a naming template, such as a session's title or a pull request's reference, `issue <id>` gives it.

## Judging a difference

- **`missing`, `title`, `labels`, `body`, `milestone`, `parent`:** `publish` fixes them.
- **`status`:** find out why before changing anything. When a merge changed the item's file, run `status` for it. When someone changed the status in GitHub by hand, put it to the human as a checkpoint question; the record wins only once they say so.
- **`not in the record`:** an issue whose id left the integration branch. An epic dropped from the plan stays in it as `cancelled`, so this is usually a mistake in the plan. Leave the issue as it is and tell the human.
- **`problem`:** the record itself is wrong, such as an epic naming a phase its roadmap lacks. Fix the record in a pull request.

## Authority and failure

The add-on writes issues, labels, milestones and sub-issue links in the repository `addons.sync-github.repo` names, by the human's choice when they set it up. It never deletes anything in GitHub, closes only what the record says is done, and touches no other repository. In CI it only checks.

When GitHub or the CLI fails, the step that reached the moment still completes: say that the sync failed and why, and the next moment tries again.

## Setting it up

`siesta-setup` sets it up with the human:

1. `addons.sync-github` in `.siesta/config.yaml`, with `repo` when the origin remote is not the GitHub repository to use.
2. This skill's `scripts/sync-github.mjs` copied to `.siesta/addons/sync-github.mjs`. When the copy's `version` is older than this skill's, update it in a pull request.
3. [assets/siesta-sync.yml](assets/siesta-sync.yml) copied to `.github/workflows/siesta-sync.yml`, so that every pull request checks the mirror.
4. Once those are merged, `publish --dry-run`, shown to the human. The first publish creates many issues, so it waits for their yes.
