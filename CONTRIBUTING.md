# Contributing to agent-instructions-kit

This project exists to keep agent instruction files:
- consistent
- useful
- harder to hijack
- easy to adopt

If your change makes it more complicated to adopt, it's probably the wrong change.

## Project scope (read this first)

We accept:
- better templates (minimal/opinionated)
- clearer required-section rules
- safety lint rules that are explainable + testable
- better docs and examples

We do NOT accept (for now):
- giant rule engines
- network calls / "phone home"
- heavy agent-specific integrations that lock us in
- complex sync logic wars (AGENTS.md is source of truth in v0.x)

## Dev setup

### Requirements
- Node.js 20+
- npm

### Install
```bash
npm install
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

### Run locally

```bash
npm run dev -- init --template minimal
npm run dev -- check
npm run dev -- safety
```

## Templates

Templates live in `templates/`.

Rules:

* Keep them short
* Keep them practical
* No corporate TED Talk language
* Every section should answer: "What should an agent do here?"

If you add a template section, update:

* README examples
* required sections list (if it becomes mandatory)
* tests (yes, templates should be tested)

## Adding a safety lint rule

A safety rule must be:

* understandable in one sentence
* explainable in output ("why this matters")
* covered by tests
* low false-positive risk

Each rule should have:

* `id` (stable)
* `severity` (warn/fail-capable)
* `pattern` (regex or simple matcher)
* `message` (human readable)

If your rule is "clever," it's probably too clever.

## CI behavior

Default is:

* `check` fails on missing required sections
* `safety` warns (unless `fail_on_safety` is enabled)

If you want to change defaults, expect discussion.

## PR checklist

* [ ] Tests updated/added
* [ ] README updated if behavior/config changed
* [ ] Templates still render cleanly
* [ ] Safety rules include "why it matters"
* [ ] No new dependencies unless absolutely necessary

## Issues

When filing an issue:

* paste your AGENTS.md (if safe) or a reduced example
* include exact command used and output
* propose what "good" looks like

## License

By contributing, you agree your contributions are under the MIT License.
