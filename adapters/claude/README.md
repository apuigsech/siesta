# Siesta Pulse for Claude

The native pane shares the Siesta plugin with its skills. It uses Claude's `Box`, `Text`, `Button`,
`Link` and, where available, `Svg` elements in plain JavaScript. No React, JSX, Vue, bundler, CDN or
web server is involved. The native element API has no DOM; a Vue application cannot mount into it.

## Open it

For development, start Claude in a repository configured for Siesta:

```sh
claude --plugin-dir /absolute/path/to/siesta
```

Run `/siesta-panel`, optionally followed by a roadmap id. The panel opens on request, stays out
of the model's transcript, and refreshes every 60 seconds while open. Refresh runs `node` from
the host's PATH. Escape closes the focused pane. The ES/EN control switches labels; the initial
language follows `project.language.human` for Spanish and otherwise uses English, including `auto`.
Document text remains in its original language.

Loading the published Siesta plugin loads the same adapter; no second plugin is needed. A temporary
`--plugin-dir` load does not install it. Changes to an already installed version need a plugin update
and a new session. Mods are an early-access Claude API; the offline tests were run on 2.1.322.

## What it reads

`skills/siesta-status/scripts/read-status.mjs` is the harness-neutral reader. It uses the defaults,
machine config, repository config and checkout config in Siesta's documented order. It writes
nothing, makes no network requests, and runs Git with argument vectors rather than a shell.

- **Delivered:** completed specs on the local `origin/<integration>` ref, excluding cancelled
  epics. If that ref is absent, the local integration branch is used with a warning. With no
  configured integration branch, `origin/HEAD` must exist. The panel does not fetch for you.
- **Worker progress:** the coordinator's exact branch in the Workers table of
  `paths.notes/pm-<roadmap-id>.md`; otherwise a unique branch matching the epic's slug, including
  resumed suffixes. Ambiguity is reported. The local worktree supplies uncommitted progress when
  present; otherwise a local branch or an origin ref supplies it. The source appears on each card.
  A branch marked completed remains in progress until its spec is completed on integration.
- **Criteria and tasks:** checkboxes outside code examples in the spec's Acceptance criteria
  section and in its plan, following `status.progress`: `criteria` measures the criteria, `tasks`
  the plan's tasks, and `mixed` draws the tasks' bar with the criteria counted beside it. No
  checkboxes means no measurable fraction.
- **Capacity:** detected active epics and coordinator assignments across all roadmaps, including
  paused or blocked assignments. This is recorded work, not a count of running agent processes.
- **Working now:** the session id in the Workers table's Session cell. In Claude Desktop the pane
  asks the app's session server every 10 seconds whether that session is running a turn, and its
  card's border beats while it is. Elsewhere nothing answers, and no card beats.
- **Reviews:** the active assignment's recorded stage when it names review or recheck. No live
  host or CI status is inferred, and there is no estimated completion time without evidence.
- **Checkpoint:** `paths.checkpoint`, relative to the main checkout or an explicitly configured
  absolute path. A relative path not found in the main checkout is looked for in the checkout the
  panel runs in, such as a coordinator's worktree. Only Q/H item definitions are counted, not mentions or examples. If unavailable,
  its counters show a dash, not zero. Questions retain their id, wording and order.
- **Ready:** planned epics in accepted phases, with completed dependencies, no blocker, no
  `waits_for` entries and no active assignment. This is a queue from the record, not authorization
  to start. The coordinator still checks the current questions and shared resources.
- **Phases:** their recorded lifecycle status, checked completion criteria and completed epics
  are shown separately. A full epic bar does not silently close a phase.
- **Recent deliveries:** comparison with integration at the newest `status-YYYYMMDD-HHMM.md`
  report's timestamp in `paths.notes`. Filenames use the reader machine's local time. With no saved
  report, this section is omitted; with missing history it is unknown and a warning appears.

The experimental `ontopix/app` mod inspired the layout. Its personal Node path, checkpoint override,
manual overlay, durations and fixed roadmap are deliberately not shipped. To use a checkpoint in
another worktree, set its actual path in `.siesta/config.local.yaml`. Keep the coordinator's Workers
table current to identify resumed branches. This adapter never rewrites those records.

## Checks

```sh
node --test tests/*/*.test.mjs
claude plugin validate .
claude plugin test .
```

Run these from the plugin root. Reader tests use disposable Git repositories. Claude's tests mock
process output and exercise rendering and controls on terminal, desktop, VS Code and mobile.
They validate native trees and interactions, not the host's pixel rendering. There are no runtime
dependencies to install and no generated UI assets to commit.
