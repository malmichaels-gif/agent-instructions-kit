# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
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
