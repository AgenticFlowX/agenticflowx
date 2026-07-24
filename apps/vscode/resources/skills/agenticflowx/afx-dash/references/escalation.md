# afx-dash escalation

Re-evaluate complexity after every `new`, `refine`, `code`, `verify`, and whenever implementation discovers new scope. The agent must not wait for the user to notice the Dash has outgrown its shape.

## Advisory signals → recommend Sprint

- Expected product behavior is ambiguous or contested.
- More than one architectural choice is required.
- Multiple components/packages become coupled.
- Task groups split into independent workstreams.
- New requirements, non-goals, rollout concerns, or design trade-offs need durable treatment.
- The task list no longer explains one coherent Purpose.

## Advisory signals → recommend Full SDD

- Authentication/security boundary changes.
- Destructive or high-risk database/data migration.
- Public API, protocol, or schema-contract changes with multiple consumers.
- Cross-team/cross-repository coordination.
- Multiple staged approval boundaries.
- Long-running work needing independently reviewed spec/design/tasks.

## Hard boundaries → block continued Dash coding

Block only when continuing would otherwise commit an **unauthorized** decision in one of:

- authentication/security boundary,
- new architecture,
- destructive/high-risk migration.

When blocked: preserve the Dash unchanged, explain the concrete signal, and offer the exact `/afx-dash graduate --to sprint|full` action. Never silently graduate; never discard work.

## Rendering

Advisory escalation is explicit and reversible. In a pure-skill host, present the choice conversationally (`graduate` / `keep as dash` / `explain`). Do not repeat the prompt after `keep as dash` unless a **new** signal appears.
