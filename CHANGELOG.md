# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.4.0] - 2026-05-28

### Added

#### High priority
- `fix` command — auto-fixes the common issues the linter catches (like `eslint --fix`): adds missing required sections (`## Mission`, `## Local dev commands`) with starter stubs, redacts detected secrets (AWS keys, generic API keys/tokens, private keys, JWTs) to `[REDACTED]`, and adds the AGENTS.md reference to CLAUDE.md when missing. Ambiguous hedge words are flagged for manual review rather than auto-rewritten (a blind word swap mangles grammar). Supports `--dry-run` (preview) and `--json` (machine-readable report). It never rewrites boundary/constraint decisions or section bodies — those stay human judgement calls.
- Token budget estimate in `score` — estimates token count (`chars / 4` heuristic) for AGENTS.md + CLAUDE.md + GEMINI.md combined, reports the percentage of a typical 100k-token context window consumed, and warns when instruction files exceed 5% of the window. Exposed in `--json` as a `tokenBudget` object (`estimatedTokens`, `percentOfWindow`, `isWarning`).
- Score badge generation — new `--badge` flag on `score` prints a [shields.io](https://shields.io) markdown badge for the current grade (color-mapped A→brightgreen … F→red). `--badge-format svg` emits a self-contained, network-free SVG and `--badge-output <path>` writes the badge to a file. The badge is included in `--json` output as `badge`/`badgeFormat`.

#### Medium priority
- GEMINI.md generation and linting — `init` now generates GEMINI.md alongside AGENTS.md and CLAUDE.md (a thin file that defers to AGENTS.md). `check` and `score` validate GEMINI.md the same way as CLAUDE.md when present (optional — absent GEMINI.md never fails), and cross-file consistency now spans all three files.
- AGENTS.md v1.1 frontmatter support — parses optional YAML frontmatter, validates `description` (non-empty string) and `tags` (non-empty list of strings) when present, and excludes frontmatter from line-length thresholds. In a monorepo (multiple AGENTS.md files), `check` warns when a file lacks frontmatter so files can be told apart. Frontmatter is purely additive — files without it pass unchanged.
- `watch` command — `npx agent-instructions-kit watch` re-scores AGENTS.md (and CLAUDE.md) on every save during authoring, using Node's built-in `fs.watch` (no new dependency) with a configurable debounce (`--debounce`, default 300ms). Development-only; never exits non-zero and not meant for CI.

#### Lower priority / exploratory
- Diff-aware safety — `safety --diff` (alias `--changed-only`) reads the current `git diff` and reports safety findings only on changed lines, trimming noise on large pre-existing files. Falls back to scanning the whole file (with a warning) when git is unavailable or the directory is not a repo. The quality `score` always evaluates the full file. Wired into the Action via the `diff_mode` input (`off` default, `force`).
- Claude Code hook suggestions — `check` reads backtick-wrapped, verifiable commands (npm, pnpm, yarn, cargo, go, pytest, poetry, uv, ruff, make, etc.) from the Verification section and prints a ready-to-paste `.claude/settings.json` `Stop` hook snippet so the agent re-verifies before finishing. Advisory only — never affects pass/fail. Available in `--json` under `agents.hookSuggestions`.
- Rule customization via config — optional `.aikconfig.json` at the repo root tunes behavior: `check.lineWarnThreshold` / `check.lineErrorThreshold`, `safety.severityOverrides` (per-rule `warn`/`error`/`off`), `safety.ignoreRules` (merged with `.aikignore`), and `safety.customRules` (user-defined `{ id, pattern, message, severity? }`, compiled case-insensitively, ReDoS-guarded). Everything is optional and backward compatible; unknown keys and invalid values are reported as warnings, never fatal.

### Changed
- `init` now writes three files (AGENTS.md, CLAUDE.md, GEMINI.md) and refuses to overwrite an existing GEMINI.md.
- `score` and `check` now factor GEMINI.md and cross-file consistency across all three files into the Consistency category.
- GitHub Action gained the `diff_mode` and `gemini_path` inputs.

### Tests
- New colocated test suites for `fix`, `watch`, `diff`, `hooks`, `config`, and `frontmatter`, plus expanded CLI integration coverage.

## [0.3.0] - 2026-05-25

### Added
- `score` command — grades instruction files A through F across Structure, Safety, Clarity, and Consistency (100-point scale)
- `--json` output mode for `check`, `safety`, and `score` commands
- `--discover` flag for `safety` — scans `.cursor/rules`, `.github/copilot-instructions.md`, `.windsurfrules`, and other agent config files
- Smart `init` — auto-detects Node.js, Rust, Python, and Go projects and pre-fills templates with real commands and framework
- Command validation — warns if AGENTS.md references `npm run` scripts that don't exist in `package.json`
- npm publish workflow — publishes to npm registry on GitHub Release
- `score` and `grade` outputs for the GitHub Action
- 6 new safety rules: `override-instructions`, `new-identity`, `hidden-instructions`, `mcp-tool-abuse`, `base64-obfuscation`, `webhook-exfil`
- 6 more safety rules: `ambiguous-hedge`, `vague-persona`, `leaked-aws-key`, `leaked-generic-secret`, `leaked-private-key`, `leaked-jwt`
- Quality checks in `check` command: file length warnings, missing verification/boundary sections, prose-without-commands detection, cross-file consistency between CLAUDE.md and AGENTS.md, boundary language detection
- `.aikignore` support — suppress specific rules by ID
- CLI integration tests and tests for all new rules (13 → 49 tests)
- GitHub community health files: SECURITY.md, CODE_OF_CONDUCT.md, issue templates, PR template
- Release workflow for automated GitHub Releases on tag push
- Dependabot configuration for npm and GitHub Actions updates
- "What gets flagged" table and `fail_on_safety` behavior docs in README

### Changed
- Opinionated template now includes Karpathy's four principles (think-first, simplicity, surgical changes, verify-don't-trust), boundary tiers (always/ask first/never), "when to stop and ask" decision framework, and exit-code-based verification
- Minimal template now includes verification and boundary sections
- Upgraded to TypeScript 6.0, ESLint 10 (flat config), Vitest 4, typescript-eslint 8
- Migrated ESLint from `.eslintrc.json` to `eslint.config.mjs`
- Upgraded `@types/node` to v22, `tsx` to v4.22, `@vercel/ncc` to v0.38.4
- CLI now builds to `dist/cli/` alongside the Action bundle in `dist/`
- `npm run build` now produces both Action and CLI bundles

### Removed
- Unused `@actions/github` dependency (eliminated transitive `undici` vulnerabilities)
- Legacy `.eslintrc.json` configuration

### Fixed
- CLI binary was not built by the main `build` script
- `dist/` freshness check in CI now covers all subdirectories

## [0.1.0] - 2026-01-14

### Added
- Initial release
- `init` command with minimal and opinionated templates
- `check` command to validate required sections
- `safety` command with 6 lint rules
- GitHub Action with configurable inputs/outputs
- CI pipeline with dogfooding
