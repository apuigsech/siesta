---
name: siesta-define
description: Writes or revises a definition document from an interview with the human, whether the product, the architecture, the glossary or any other kind the repository defines, such as a module's charter. Use when the human wants to define or redefine what the product is, how the system is built, the project's vocabulary, or any other document later work must follow.
argument-hint: "[document: product, architecture, glossary, feature, module…]"
---

# Siesta define

**REQUIRED BACKGROUND:** the `siesta` skill for the effective configuration, the `siesta-interview` skill for how to ask, and the `siesta-decide` skill for how to record decisions and open questions.

**Outcome:** the document says what the human settled, in the shape of its kind, with its decisions and open questions linked. Nothing in it is a guess.

## Kinds of document

| Kind | What it settles | Template | Where it goes | Builds on |
|---|---|---|---|---|
| `product` | What the product is, for whom, its goals and non-goals | [assets/product.md](assets/product.md) | `paths.product` | — |
| `architecture` | The system's parts and the rules every change keeps | [assets/architecture.md](assets/architecture.md) | `paths.architecture` | The product |
| `feature` | What a feature does and for whom, with its acceptance criteria; nothing technical | [assets/feature.md](assets/feature.md) | `paths.feature` | The product |
| `feature-design` | How a feature is built | [assets/feature-design.md](assets/feature-design.md) | `paths.feature_design` | Its feature and the architecture |
| `module` | A module's charter: what it owns, offers and depends on | [assets/module.md](assets/module.md) | `paths.module` | The architecture |
| `glossary` | The project's own words | [assets/glossary.md](assets/glossary.md) | `paths.glossary` | — |
| Any other | What its template says | `<kind>.md` in `paths.templates` | The path its template names | What its template names |

A document reads what it builds on as settled: an architecture interview does not ask again what the product already says, and a feature's design starts from its feature. When an answer contradicts a document it builds on, put the contradiction to the human; changing that document is a revision of it.

A small feature that changes a line or two of the product needs no document of its own: revise the product, and the architecture when it gains a part or a rule. A feature that needs its own acceptance criteria gets a `feature`, and then its `feature-design`.

A repository's template with the name of one of Siesta's replaces it. A repository's template starts by naming its kind and where its documents go, with placeholders the interview fills:

```yaml
---
kind: module-charter
path: modules/{module}/README.md
---
```

For a document with no template, the interview's first question settles its sections and its path.

## 1. Start from what exists

Read the document if it exists, the decisions and open questions it touches, and the notes folder's ledgers on its subject.

- A closed interview the human confirmed is the material: go to writing without asking again.
- An open interview on the subject: resume it.
- An existing document makes this a revision: interview about what changes, and keep what still holds.

## 2. Interview

Interview the human with `siesta-interview`. The template's sections are the first branches of the design tree. Find the facts yourself; put the decisions to the human.

## 3. Write

Write once the human confirms the shared understanding. Their request to write it counts as that confirmation when the interview has already closed.

- Fill every section of the template from the ledger, the decisions and the facts you found in the repository, its documents or its tools. A section nothing settled keeps its heading and links to its open question. A section the human said is empty says "None".
- Something you know only from your own knowledge, such as a law that applies, is not yet a fact of this document: put it to the human as a question first, and write it in once they confirm it.
- State what is, in the present tense. The reasons live in the decisions: link each by its id. Carry numbers, limits and requirements exactly as they were settled. Quote the human only where their exact words are the requirement.
- Writing often shows a point nobody settled, such as how a goal is counted. When the human is in the conversation, ask it now, in the interview's question format. When they are not, record it as an open question. Leave it unfilled in the document either way.
- In the ledger, point each answer's record at the section that now holds it.
- Write the document in `project.language.docs`.

### Glossary

A term enters the glossary only when it is the project's own word, not a general one. Each entry says what the term is in one or two sentences, and lists the words to avoid for it:

```markdown
**Order:** A customer's request to buy one or more products, from checkout until it is delivered or cancelled.
Avoid: purchase, basket.
```

The glossary holds no implementation detail. An interview adds terms in this shape as they resolve.

### Architecture

Every rule says how it is enforced: the check that fails when the rule breaks, such as a test, a lint rule or a CI job. A rule with no check yet says "Not enforced yet" and links to its open question. A rule nothing checks is one an autonomous agent can break without anyone noticing.

## 4. Report

Tell the human in a few lines what the document says, every interpretation you made and what you chose, and what stays open. Then name the next step: after the product, the architecture; after the architecture, the plan. Commit nothing.
