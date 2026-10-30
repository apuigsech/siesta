---
name: siesta-setup
description: Prepares a repository to be worked on with Siesta by writing its .siesta/ configuration through a short guided conversation with its owner. Use when the user asks to set up, adopt or reconfigure Siesta in a repository, or when Siesta is mentioned and the repository has no .siesta/config.yaml.
---

# Siesta setup

**REQUIRED BACKGROUND:** load the `siesta` skill and read its configuration reference and defaults. This skill writes what they define.

**Outcome:** a `.siesta/config.yaml` the human approved, holding `version: 1` and only what differs from the defaults; ignore entries for the files that are never committed; and a pointer to Siesta in the repository's agent instructions.

**Authority:** this skill changes only `.siesta/`, the repository's ignore file and its agent-instructions file. It does not commit, push, install anything, or touch anything outside the repository. Nothing in the setup depends on the harness: write nothing that only one harness reads.

## 1. Look before asking

Inspect the repository without changing it, and turn what you find into proposals:

| What you find | What it suggests |
|---|---|
| `.siesta/config.yaml` already exists | A change, not a new setup: summarize the effective configuration in a few lines and ask what to change |
| The remote's default branch and other long-lived branches | `git.integration_branch` |
| A task runner with lint, test, build or CI tasks | `execution.before_pr` |
| Commit signing in the repository's git configuration | `git.signed_commits: required` |
| Product, architecture or decision documents, or a planning folder, already in place | `paths` pointing at them, instead of moving them |
| An agent-instructions file, such as `AGENTS.md` | Where the pointer to Siesta goes |
| Coding-agent CLIs available on this machine | The options for `roles` |
| An `origin` remote on GitHub | The add-on `sync-github` |
| Whether this harness can open a session the human can follow | `sessions.launcher` |

Note anything that would stop agents from delivering, such as a check that cannot pass yet or a remote nobody can push to. Report it in the summary; fixing it is not part of the setup.

## 2. Ask, one question at a time

Open with what you found, in a few lines, and offer to skip the questions and take the defaults plus what you found. Then ask only what you could not infer: one question per message, the most consequential first. Write each question in the shape of the `siesta` skill's question reference; its recommended option is what you found or the default. "Default" is always a valid answer.

Ask in this order, skipping what is already settled:

1. **Who merges:** the project manager, once CI passes and the review finds nothing that blocks, or the human.
2. **What waits for the human:** propose the default list and ask what to add or remove.
3. **What never happens:** propose the default list and ask what to add.
4. **Standing approvals:** usually none at the start. Record each one with the human's own words in `said` and today's date in `granted`.
5. **The integration branch**, when what you found leaves it open.
6. **Roles**, when more than one harness is available or the human wants other models or efforts for some roles. When a role moves to another harness than this session's, propose its model and effort on that harness too.
7. **Review panels:** how many reviewers, and which perspectives, for plans and for pull requests.
8. **The language for talking to the human**, when the conversation does not make it clear.
9. **The sync add-on**, when the remote is on GitHub: whether the plan should show in GitHub's issues. With a yes, follow the setting-up steps of the `siesta-sync-github` skill.
10. **How workers' sessions open**, when this harness has no way of its own to open a session the human can follow: a command that opens one, such as a new terminal tab running the harness's CLI, or the human starting each one. It belongs to this machine, so it goes in `.siesta/config.local.yaml`.

## 3. Write

Show the complete `.siesta/config.yaml` and write it after the human's yes; their explicit word that they do not need to see it first counts as that yes. Keep only the keys that differ from the defaults: a short file is easier to review, and defaults improved later still reach the repository.

Then:

- Add to the repository's ignore file `.siesta/config.local.yaml`, the checkpoint's path, and the worktrees' folder when it lies inside the repository, unless already ignored.
- Add to the agent-instructions file a short section saying that the repository is worked on with Siesta, that its configuration is `.siesta/config.yaml`, and that agents load the `siesta` skill before working in it. If the repository has no agent-instructions file, ask before creating `AGENTS.md`.
- Create no empty folders: the skills that fill them create them.

## 4. Check and report

Read the written file against the configuration reference: `version`, known keys, values of the right kind. Then report:

- the files written or changed;
- each setting and where it came from: the human, what you found, or the default;
- anything you found that would stop agents from delivering;
- that nothing was committed, and that the configuration must reach the integration branch before any worker starts, since workers' worktrees start from that branch and would not see it otherwise;
- that the next step is defining the product.
