# Questions to the human

Every Siesta skill that puts a question to the human, in a conversation or in a checkpoint, writes it this way, so that the human reads and answers every question the same way.

Write each question to the human in this shape, in `project.language.human`:

```text
**Q-3 - Receipts.** What the question decides, with an example.

What else the human needs in order to answer.

**a) Stripe sends them.** (recommended) What this option means.

Pros:
• A reason for it.

Cons:
• A reason against it.

**b) The shop sends them.** What this option means.

Pros:
• A reason for it.

Cons:
• A reason against it.
```

- Put your recommended option first, and mark it alone as recommended.
- Add the context paragraph only when the explanation leaves out something the human needs, and pros or cons only when they help the choice.
- A question that asks for a fact has no options: its title, its explanation, and its context when needed.
- Write each pro and con as a line that starts with `•`, not as a Markdown list: some terminals draw every list item with a dash.
- The id is `Q-<n>` in every language. Translate `recommended` into the human's language; `Pros` and `Cons` stay as they are.
- "Yes" accepts the recommended option, and a letter picks another. Number questions across the whole conversation or checkpoint they belong to, so an answer like "Q-3 b" stays unambiguous.
