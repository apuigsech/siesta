# Siesta configuration

How the files combine and how to read what they say. Every key, its default and its meaning are in [the defaults](../assets/defaults.yaml): that file is the one list of keys.

Contents: layers, how layers combine, autonomy, naming placeholders, paths, checking a file.

## Layers

From lowest to highest precedence:

1. **Defaults:** `assets/defaults.yaml` in the `siesta` skill.
2. **Preset:** the one `extends` names. No presets ship yet, so a preset name is an error to report.
3. **Machine:** `$XDG_CONFIG_HOME/siesta/config.yaml`, or `~/.config/siesta/config.yaml` when that variable is unset. It belongs to the person and the machine: the session launcher, the notes folder, the models they have.
4. **Repository:** `.siesta/config.yaml`, committed. The project's configuration.
5. **Checkout:** `.siesta/config.local.yaml`, never committed. One checkout's adjustments, such as a harness this machine lacks.

A missing file is an empty layer, except the repository's: without it the repository is not set up.

## How layers combine

- Maps merge key by key; a higher layer's value replaces the lower one's.
- Lists and single values are replaced whole. Lists are never concatenated.
- **`autonomy` comes from the repository's file and the layers below it alone.** If the machine's or the checkout's file sets any part of `autonomy`, ignore that part and tell the human: a file nobody reviews must not change what agents may do.
- Report a key the defaults do not define instead of guessing its meaning. Keys under `addons.<name>` are the exception: each add-on defines its own.
- `version` must be `1`. Report any other value and stop.
- A role's `model` and `effort` are read for the role's effective `harness`. `default` is that harness's default. `current` is the starting session's value when the role runs on the same harness, and that harness's default otherwise. A model or effort the harness does not offer falls back to its default, and you say so.

## Autonomy

Entries in `waits_for_human` and `never` are kinds of action. These kinds have fixed meanings; any other entry is read literally, as its words say.

| Kind | Means |
|---|---|
| `decision` | Accepting a new or changed decision |
| `phase-acceptance` | Accepting a phase's epics into the plan |
| `scope-change` | Changing a roadmap's scope or an epic's acceptance criteria |
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
| `{slug}` | The item's short name, lowercase with hyphens |
| `{title}` | The item's title |
| `{type}` | A Conventional Commits type, such as `feat` or `fix` |
| `{n}` | The next free number; `{n:03}` pads it to three digits |
| `{issue}` | The item's issue number, only when a sync add-on is configured: its skill says how to get it |
| `{repo}` | The repository as `owner/name` from its `origin` remote, or its folder's name |
| Any other, such as `{feature}` or `{module}` | A name the interview that writes the document settles |

## Paths

A path is relative to the repository's root unless it is absolute or starts with `~`. `paths.notes` must lie outside every worktree: each worktree has its own copy of the repository, so notes inside one would not reach the sessions working in the others. `paths.worktrees` should lie outside the checkout: tools that walk the repository, such as test runners, would otherwise pick up every worktree's copy. Inside it, it must at least be ignored.

## Checking a file

Until Siesta ships a validator, check a configuration file by reading it: `version` is `1`, every key exists in the defaults or sits under `addons`, each value is of the kind its default shows, and every placeholder is in the table above.
