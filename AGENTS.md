# Siesta — Agent entrypoint

Siesta packages a way of working with coding agents as skills that every harness can load: Claude
Code, Codex, Pi, OpenCode and others. [README.md](README.md) says what the method is and how each
harness installs it.

**Status.** An empty skeleton: the manifests for each harness and an empty `skills/`. No skills,
agents, hooks or scripts yet.

## Rules

1. **One source.** Everything a harness loads lives once, in harness-neutral folders such as
   `skills/`. A harness's manifest only points to it; nothing is copied or generated per harness.
2. **Neutral skills.** Each skill is `skills/<name>/SKILL.md` in the [Agent
   Skills](https://agentskills.io) format, with `name` and `description` in its frontmatter. A skill
   never names one harness's tools, commands, paths or slash syntax: it says what to do ("start a
   new agent session for the epic"), and each harness does it its own way.
3. **An adapter only when needed.** When a harness needs something the others cannot read, such as
   hooks or a way to open sessions, it goes in `adapters/<harness>/`, referenced from that harness's
   manifest alone. No build step until two harnesses need different content for the same thing.
4. **One version.** These six fields hold the same version, changed together:
   - `.claude-plugin/plugin.json` › `version`
   - `.claude-plugin/marketplace.json` › `metadata.version` and the plugin's `version`
   - `.codex-plugin/plugin.json` › `version`
   - `.agents/plugins/marketplace.json` › the plugin's `version`
   - `package.json` › `version`

## Checking a change

Run each harness's own check before a pull request:

| Harness | Check |
|---|---|
| Claude Code | `claude plugin validate .`, and `claude --plugin-dir . plugin details siesta` to list what it loads |
| Codex | With `CODEX_HOME` set to an empty folder: `codex plugin marketplace add <checkout>`, then `codex plugin add siesta@siesta`; the installed copy holds the skills |
| Pi | In an empty folder: `pi install <checkout> -l`, then send `{"type":"get_commands"}` to `pi --mode rpc -a --no-session`; each skill shows as `skill:<name>` |

Never run these against your own harness configuration: an empty `CODEX_HOME` and a project-local
Pi install keep the checks from changing it.
