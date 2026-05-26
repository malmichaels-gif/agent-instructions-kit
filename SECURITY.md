# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in agent-instructions-kit, please report it responsibly.

**Do not open a public issue.**

Instead, email **malmichaels@gmail.com** with:

1. A description of the vulnerability
2. Steps to reproduce
3. The potential impact
4. (Optional) A suggested fix

You should receive a response within 72 hours. Once confirmed, we'll work on a fix and coordinate disclosure.

## Scope

This project lints agent instruction files for suspicious patterns. Security reports in scope include:

- Bypasses of safety rules (patterns that should be flagged but aren't)
- False negatives that allow dangerous instructions through
- Vulnerabilities in the CLI or GitHub Action itself
- Supply chain concerns in dependencies

## Out of Scope

- Reports about the sample templates containing placeholder text
- Vulnerabilities in upstream GitHub Actions runtime
