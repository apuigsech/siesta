# Siesta configuration

How the files combine and how to read what they say. Every key, its default and its meaning are in [the defaults](../assets/defaults.yaml): that file is the one list of keys.

Contents: layers, how layers combine, profiles, efforts, review settings, autonomy, naming placeholders, paths, checking a file.

## Layers

From lowest to highest precedence:

1. **Defaults:** `assets/defaults.yaml` in the `siesta` skill.
2. **Preset:** the one `extends` names. No presets ship yet, so a preset name is an error to report.
3. **Machine:** `$XDG_CONFIG_HOME/siesta/config.yaml`, or `~/.config/siesta/config.yaml` when that variable is unset. It belongs to the person and the machine: the session launcher, the notes folder, the models they have.
4. **Repository:** `.siesta/config.yaml`, committed. The project's configuration.
5. **Profile:** `.siesta/profiles/<name>.yaml`, committed, for the work of an epic or a spike that names it. See [Profiles](#profiles).
6. **Checkout:** `.siesta/config.local.yaml`, never committed. One checkout's adjustments, such as a harness this machine lacks.

A missing file is an empty layer, except the repository's: without it the repository is not set up.

The profile layer applies only to an epic's or a spike's work: starting its worker, the worker's own work, and the review and merge of its pull requests. Everything else, such as the project manager's own turns, a plan's review or a pull request outside any epic, reads the other five layers.

## How layers combine

- Maps merge key by key; a higher layer's value replaces the lower one's.
- Lists and single values are replaced whole. Lists are never concatenated.
- **`autonomy` comes from the repository's file and the layers below it alone.** If the machine's or the checkout's file sets any part of `autonomy`, ignore that part and tell the human: a file nobody reviews must not change what agents may do. A profile never sets it either.
- Report a key the defaults do not define instead of guessing its meaning. Keys under `addons.<name>` are the exception: each add-on defines its own.
- `version` must be `1`. Report any other value and stop.
- A role's `model` and `effort` are read for the role's effective `harness`. `default` is that harness's default. `current` is the starting session's value when the role runs on the same harness, and that harness's default otherwise. A model or effort the harness does not offer falls back to its default, and you say so.

## Profiles

A profile sets how rigorously one item's work is done and checked, so that a sensitive epic and a routine one need not share one panel, one set of perspectives and one effort.

- **A profile is a file `.siesta/profiles/<name>.yaml`,** in the configuration's format, holding only what differs from the layers below it. Its name is lowercase letters, digits and hyphens, starting with a letter or a digit.
- **An epic or a spike chooses one** with `profile: <name>` in its spec's frontmatter. Without the field, with `null` or with `default`, it uses no profile. `default` is reserved for that: a file `.siesta/profiles/default.yaml` is ignored, and you say so.
- **Both are read from the integration branch:** the spec's `profile` field and the profile's file. A branch's own copy never counts, so a pull request that changes a profile file, or an item's `profile`, is reviewed and merged with the integration branch's. Its change applies to work that starts after it merges. A checkout whose copy of a profile differs from the integration branch's is reported.
- **An item takes one profile,** and a profile names no other: no `extends`, no profile inside a profile.
- **A profile sets only these keys:**

  | Key | What it changes for the item |
  |---|---|
  | `roles.worker`, `roles.spike` | The worker's harness, model and effort |
  | `roles.reviewer`, `roles.rechecker` | The review's harnesses, models and efforts, its pinned perspectives included |
  | `review.pull_request` | The panel, its perspectives, what blocks, the rounds, the re-checks and their mutation checks |
  | `execution.before_pr` | What the worker runs before its pull request |
  | `execution.mutation_check` | Whether the worker checks by mutation that its tests catch faults |

  Any other key in a profile is ignored, and you say so. That holds above all for `autonomy`, which comes from the repository's file alone; for `review.plan`, since the plan that chooses the profiles is reviewed by the repository's panel; and for keys that belong to the project manager's session or to the whole repository, such as `roles.pm`, `execution.max_parallel_epics`, `paths`, `naming` or `git`. A value of the wrong kind under a key it may set, such as an empty `roles.reviewer`, is ignored and reported too.
- **A security change is reviewed as if there were no profile.** A pull request of the `security` class, as `siesta-review` says which these are, reads `review.pull_request`, `roles.reviewer` and `roles.rechecker` without the profile: the same efforts, closing pass, blocking severities, rounds, re-checks and mutation checks. The profile can change only one thing there. When it gives that class more reviewers, the panel takes the larger number. The `security` perspective is always among the panel's. With two reviewers or more, it has a reviewer that takes no other.
- **Who chooses, and when.** The planner writes each item's profile in its spec, and the roadmap shows it beside the item, so that the plan's review and the phase's acceptance see it. Changing the profile of an accepted epic is `scope-change`: it waits for the human. Adding or changing a profile file is a change to the configuration, reviewed like any other.
- **A profile that cannot be read** is a fault in the plan: a `profile` that is not a name, a name that breaks the rule above, a name with no file on the integration branch, or a file that does not parse. Work that needs it does not start, and the review of a pull request that needs it does not run: tell the project manager, who fixes the plan or asks the human. Never fall back silently to the configuration without the profile.

## Efforts

A role's `effort` is one value, or, for these roles, a map with one value for each part of the work:

| Role | Keys | Each applies to |
|---|---|---|
| `pm` | `default`, and optionally `plan` and `review` | The project manager's own turns, changing the plan, and leading a review round. One left out takes `default`'s value. `siesta-run-roadmap` says how the session reaches each |
| `reviewer`, `rechecker` | `rounds`, and optionally `closing` | A review's rounds, and what gates its end. Without `closing` there is no closing pass. `siesta-review` says when each applies |

`roles.reviewer.perspectives` pins the effort of one perspective's reviewer in every round, such as `{ security: max }`.

Each value is read as a single effort is: an effort the role's harness offers, `current` or `default`.

## Review settings

`siesta-review` says what each level and each class covers.

| Key | Takes |
|---|---|
| `review.pull_request.reviewers` | A number, or a number for each class of change: `default`, `security` and `docs-only`. A class left out takes `default`'s number. `review.plan.reviewers` is a number |
| `review.plan.recheck`, `review.pull_request.recheck` | Which fixes an independent re-checker confirms: `all`, `code`, `blocking` or `off`. The lead checks the others |
| `review.pull_request.mutation_check` | Which re-checked fixes are undone to see their test fail: `all`, `blocking` or `off` |

In a file written for an earlier version, `true` for `recheck` or for `review.pull_request.mutation_check` reads as `all`, and `false` as `off`. Say so, and propose the level in the repository's file.

## Autonomy

The repository stores all three autonomy keys explicitly after setup, so later default changes cannot change approved permissions. For an older sparse configuration, report the inherited values and propose materializing them through `siesta-setup` with the human's approval. Do not silently rewrite permissions.

Entries in `waits_for_human` and `never` are kinds of action. These kinds have fixed meanings; any other entry is read literally, as its words say.

| Kind | Means |
|---|---|
| `decision` | Accepting a new or changed decision |
| `phase-acceptance` | Accepting a phase's epics into the plan |
| `scope-change` | Changing a roadmap's scope, or an accepted epic's acceptance criteria or profile, or cancelling it |
| `merge` | Merging into the integration branch; it always waits when `git.merge.by` is `human` |
| `merge-without-panel` | Merging a pull request whose review was not independent, as `siesta-review` says |
| `infra-apply` | Applying or destroying infrastructure |
| `new-cost` | Creating anything with a running cost |
| `delete` | Deleting anything outside the working tree: cloud resources, data, other people's branches or sandboxes |
| `security` | Changing credentials, permissions or security settings |
| `push-integration-branch` | Pushing straight to the integration branch |
| `force-push` | Rewriting history that others have |
| `read-customer-data` | Reading production or customer data |

A standing approval is an entry of `standing_approvals` with `id`, `allows` (what it permits, read literally), `granted` (its date) and, optionally, `said` (the human's own words).

## Naming placeholders

The templates in `naming` and the document paths in `paths` take these placeholders:

| Placeholder | Is |
|---|---|
| `{date}` | Today, as `YYYYMMDD` |
| `{slug}` | The item's short name, lowercase with hyphens; an epic's optional `slug`, or its id with the leading `YYYYMMDD-` removed |
| `{title}` | The item's title |
| `{type}` | The epic's optional Conventional Commits `type`, otherwise inferred at launch and recorded in the brief |
| `{n}` | The next free number; `{n:03}` pads it to three digits |
| `{issue}` | The item's issue number, only when a sync add-on is configured: its skill says how to get it |
| `{repo}` | The repository as `owner/name` from its `origin` remote, or its folder's name |
| Any other, such as `{feature}` or `{module}` | A name the interview that writes the document settles |

## Paths

A path is relative to the repository's root unless it is absolute or starts with `~`. `paths.notes` must lie outside every worktree: each worktree has its own copy of the repository, so notes inside one would not reach the sessions working in the others. `paths.worktrees` should lie outside the checkout: tools that walk the repository, such as test runners, would otherwise pick up every worktree's copy. Inside it, it must at least be ignored.

## Checking a file

Until Siesta ships a validator, check a configuration file by reading it: `version` is `1`, every key exists in the defaults or sits under `addons`, each value is of the kind its default shows or of another kind this reference allows for its key, and every placeholder is in the table above. A profile also holds only the keys [Profiles](#profiles) lists.
