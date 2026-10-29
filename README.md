# Siesta

> You nap. They ship.

Siesta is a way of working with coding agents over long stretches without watching every step. You
define the work in depth first: the product, the architecture and a roadmap whose doubts become
spikes. Then a project-manager agent runs the roadmap: it starts one worker session per epic, has a
panel of reviewers go over every pull request until nothing blocks, and merges. You meet it a few
times a day to see what shipped and to make the decisions only you can make.

This repository will package that method as skills any coding agent can load. **It is an empty
skeleton for now:** there are no skills yet.

## Harnesses

Siesta's skills follow the [Agent Skills](https://agentskills.io) format, which Claude Code, Codex,
Pi, OpenCode and others read. Each harness gets a thin manifest at the repository root that points
to the same `skills/` directory: nothing is generated or copied per harness.

| Harness | Its manifest | Install |
|---|---|---|
| Claude Code | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | `claude plugin marketplace add apuigsech/siesta`, then `claude plugin install siesta@siesta` |
| Codex | `.codex-plugin/plugin.json`, `.agents/plugins/marketplace.json` | `codex plugin marketplace add apuigsech/siesta`, then `codex plugin add siesta@siesta` |
| Pi | `package.json`, its `pi` key | `pi install git:github.com/apuigsech/siesta` |
| OpenCode and others | none | Clone the repository and link each skill into `~/.agents/skills/`, which they read |

Claude Code, Codex and Pi were checked on 2026-10-29 with a probe skill: each found it in `skills/`.
OpenCode was not checked.

## Layout

```text
skills/                          the skills, one folder each, shared by every harness
.claude-plugin/                  Claude Code: the plugin and its marketplace
.codex-plugin/                   Codex: the plugin
.agents/plugins/marketplace.json Codex: the marketplace
package.json                     Pi: the package
```

## Contributing

Read [AGENTS.md](AGENTS.md) first: it holds the rules that keep Siesta harness-neutral.
