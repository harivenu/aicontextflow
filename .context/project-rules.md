# Project Rules & Architecture Guidelines

<!-- AIContextFlow: Global project rules loaded by all AI coding assistants -->

## 1. Architecture Overview
- Maintain clear modular separation between business logic, presentation, and data layers.
- Avoid tight coupling; prefer dependency injection and well-defined interface contracts.
- Keep dependencies updated and do not introduce unapproved external libraries.

## 2. Code Quality & Conventions
- Adhere strictly to project linting and formatting rules.
- Add descriptive documentation blocks for all public functions, interfaces, and classes.
- Handle error boundaries gracefully; do not swallow unexpected exceptions.
- Prefer self-documenting code with clear variable and function naming.

## 3. Testing & Verification
- Unit test coverage is required for all new logic and bug fixes.
- Run tests and linting before committing code changes.
- Never disable existing tests without explicit justification.

## 4. AI Assistant Guardrails
- **No silent breaking changes:** Always verify API backward compatibility.
- **Explain non-obvious design choices:** Include rationale for complex algorithms.
- **Respect established patterns:** Follow prevailing patterns in the codebase before introducing new paradigms.
