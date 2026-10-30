# Siesta — Agent entrypoint

Siesta packages a way of working with coding agents as skills that every harness can load: Claude
Code, Codex, Pi, OpenCode and others. [README.md](README.md) says what the method is and how each
harness installs it.

**Status.** Fifteen skills in `skills/`, one script with its tests (`siesta-sync-github`), and the
manifests for each harness. No agents, hooks or adapters yet.

## Rules

1. **One source.** Everything a harness loads lives once, in harness-neutral folders such as
   `skills/`. A harness's manifest only points to it; nothing is copied or generated per harness.
2. **Neutral skills.** Each skill is `skills/<name>/SKILL.md` in the [Agent
   Skills](https://agentskills.io) format, with `name` and `description` in its frontmatter. A
   skill's text never names one harness's tools, commands, paths or slash syntax: it says what to do
   ("start a new agent session for the epic"), and each harness does it its own way.
3. **How a harness invokes a skill lives beside it.** Every harness ignores what it does not read,
   so a skill may carry:
   - in its frontmatter, besides the standard's fields: `argument-hint` and `user-invocable`, which
     Claude Code reads, and `disable-model-invocation`, which Claude Code and Pi read;
   - `agents/openai.yaml`, Codex's interface and invocation policy, in every skill. Its
     `policy.allow_implicit_invocation` is the opposite of `disable-model-invocation`.

   A skill turns off the model's invocation only when no other skill, brief or plain request loads
   it. A skill only agents use is `user-invocable: false` and has no `default_prompt`.
4. **An adapter only when needed.** When a harness needs something else the others cannot read,
   such as hooks or a way to open sessions, it goes in `adapters/<harness>/`, referenced from that
   harness's manifest alone. No build step until two harnesses need different content for the same
   thing.
5. **One version.** These six fields hold the same version, changed together:
   - `.claude-plugin/plugin.json` › `version`
   - `.claude-plugin/marketplace.json` › `metadata.version` and the plugin's `version`
   - `.codex-plugin/plugin.json` › `version`
   - `.agents/plugins/marketplace.json` › the plugin's `version`
   - `package.json` › `version`

## Checking a change

Run the tests, `node --test tests/`, after changing a skill or a script; they need Node 20 or later and git, and reach no network. `tests/skills/` checks every skill's frontmatter and its `agents/openai.yaml` against rules 2 and 3. Codex's own skill validator refuses the frontmatter fields of rule 3, which Codex itself ignores when it runs.

Run each harness's own check before a pull request:

| Harness | Check |
|---|---|
| Claude Code | `claude plugin validate .`, and `claude --plugin-dir . plugin details siesta` to list what it loads |
| Codex | With `CODEX_HOME` set to an empty folder: `codex plugin marketplace add <checkout>`, then `codex plugin add siesta@siesta`. In an empty git repository, `codex debug prompt-input` lists each skill the model can invoke as `siesta:<name>` |
| Pi | In an empty folder: `pi install <checkout> -l`, then send `{"type":"get_commands"}` to `pi --mode rpc -a --no-session`; each skill shows as `skill:<name>` |

Never run these against your own harness configuration: an empty `CODEX_HOME` and a project-local
Pi install keep the checks from changing it.
