# Re-check of <target>, round <n>

- **Checked:** <branch> at <commit>, in a copy; nothing in the branch was changed. **Tests:** <the command and its result>.
- **Fixes given:** <the findings whose fixes `recheck` gave the re-checker; the lead checked the others, in the round file>.
- **Re-checker:** <its harness, model and effort; or "not independent", when the lead re-checked alone, and why>.
- **Cost:** <added by the lead once the re-checker has ended: its tokens, its tool calls and how long it ran, as the harness reports them; "not reported" for a figure it does not give>.

## F-1 · Holds

- **Evidence:** <what was run or read, and what it showed; for a fix tested by mutation, the test that fails when the fix is undone; for any other, the test that names its case>

## F-2 · Partial

- **Missing:** <what the fix does not do yet, with evidence>

## New findings

### F-6 · <severity> · <title>

- **Where:** <file and line, or the plan's passage>
- **What happens:** <the input, what comes out, what should come out>
- **Why it matters:** <the criterion, decision or rule it breaks, or the harm>
- **A fix must bring:** <what the fix must do>
- **Found by:** the re-checker, at the <effort> effort, in round <n>.
