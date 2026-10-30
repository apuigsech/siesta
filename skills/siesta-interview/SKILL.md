---
name: siesta-interview
description: Interviews the human about an idea, a plan, a design or a decision until both share one understanding, and records what each answer settles. Use when the human asks to be interviewed, grilled or questioned about something, when a Siesta definition or planning session needs the human's decisions, or to resume an interview that stopped.
argument-hint: "[topic, or the interview to resume]"
---

# Siesta interview

**REQUIRED BACKGROUND:** the `siesta` skill, for the effective configuration. Where the repository is not set up for Siesta, interview all the same, write nothing in the repository, and offer `siesta-setup` when you close.

**Outcome:** the human confirms that you share one understanding of the subject, and every answer is recorded where later work will read it, so no answer lives only in the conversation.

The technique comes from Matt Pocock's `grilling` skill: a design tree, asked in rounds along its frontier, with facts found by you and decisions made by the human.

## The design tree and its frontier

Map the subject as a tree of decisions: each decision branches into the decisions that hang off it. The **frontier** is every decision whose prerequisites are settled, which you can ask now without guessing at an answer you haven't heard.

With `interview.questions: rounds`, ask the whole frontier in one message, then wait for the answers. A question that depends on another one still open belongs to a later round. With `one-at-a-time`, ask the frontier's most consequential question alone. Each answer reshapes the tree: recompute the frontier before the next message.

Write each question in the shape [the siesta skill's question reference](../siesta/references/questions.md) gives. Number questions across the whole interview, not per round.

## Facts are yours, decisions are theirs

Find every fact the repository, its documents or the tools can give. Never ask the human for one. If you can hand the search to a helper with a fresh context, do so and ask the rest of the frontier meanwhile; only the questions that depend on the search wait. Otherwise look it up before the round. A fact only the human knows, such as last year's peak sales, is asked as a fact, not as a decision.

Decisions are the human's. Never answer one yourself, and never record your recommendation as their answer.

## Answers that need more than a yes

- **Irreversible or lasting cost.** Deleting data, a migration with no way back, a public commitment, a cost that keeps running: ask it as its own question, say plainly that it cannot be undone, and settle it only with an answer to that question. An answer that accepts a round wholesale does not settle it: name it and ask again.
- **"I don't know", or "we'd have to try it".** Talking will not settle it. Stop asking it, record it as an open question, and propose the spike that would settle it: the question, what to try or measure, and what result would decide it.
- **An answer that contradicts an earlier one.** Point at both and ask which stands.

| What you might think | What holds |
|---|---|
| "They said yes to everything" | A wholesale yes covers what they read. An irreversible choice needs its own answer. |
| "I mentioned the risk" | Mentioning is not asking. |
| "They're in a hurry" | One more question costs a minute; a dropped column is gone for good. |
| "I can assume the rest" | A decision you could still ask is not a hypothesis. Ask it or record it as open. |

## Record as you go

Keep the interview's ledger in the notes folder (`paths.notes`), as `interview-{date}-{slug}.md`, and update it after every round. It holds the subject and its scope; every question by number and title, with your recommendation, the human's answer word for word and where that answer went; the open questions and proposed spikes; and the current frontier. It is what lets an interrupted interview resume, and what later skills read so that precise answers are not softened into vaguer prose.

From each round, also record:

- **A decision**, an answer that settles how the product or the system will be and that later work must not reopen by accident, in the decision log (`paths.decisions`) as the `siesta-decide` skill describes. Where that skill is not available, follow the log's existing format. The human's own answer in the interview is their acceptance.
- **A term** the project will use in the glossary (`paths.glossary`), when it resolves, in the shape the `siesta-define` skill gives.
- **An open question**, with its proposed spike when there is one, as the `siesta-decide` skill describes.

Write documents in `project.language.docs`. The interview writes only these records. The plan, the epics and the code are later work.

## Resume

When you start, look in the notes folder for an open ledger on the same subject. If there is one, tell the human in a few lines where it stands, recompute the frontier from it, and continue. Never ask a settled question again unless the human reopens it.

## Pause

When the human turns to something else without ending the interview, leave the ledger open, note where it stopped and the human's words, and resume from there when they come back.

## Close

The interview ends when the frontier is empty, or when the human asks to stop. To close:

1. Whatever is still unasked becomes an open question.
2. Summarize from the ledger: what was settled and where it was recorded, what is open, and the proposed spikes.
3. Ask the human to confirm that you share one understanding. Act on nothing before they do.
4. Mark the ledger closed, with the date of their confirmation.

If the human asks for the plan or for work to start, close first. Planning is the next step, and it starts after their confirmation.

When the tree keeps widening instead of closing, the subject is too big for one interview: propose splitting it, and interview the parts one at a time.
