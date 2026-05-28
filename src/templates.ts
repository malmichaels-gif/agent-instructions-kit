export const MINIMAL_TEMPLATE = `# AGENTS.md

## Mission
[Describe what this project does and its core goals]

## Stack
[List primary language, framework, and key libraries]

## Local dev commands
- Install: \`npm install\`
- Test: \`npm test\`
- Build: \`npm run build\`

## Project structure
[Describe the main directories and their purpose]

## Verification
- Run \`npm test\` before declaring any task complete
- Never claim success without checking actual output

## Change rules
- Update README if you change behavior
- Add tests for new features
- Keep PRs focused — one concern per PR

## Boundaries
- Never commit secrets, tokens, or credentials
- Never remove or skip failing tests to make CI pass
- Ask before adding new dependencies
`;

export const OPINIONATED_TEMPLATE = `# AGENTS.md

## Mission
[Describe what this project does and its core goals]

## Stack
[List primary language, framework, and key libraries]

## Local dev commands
- Install: \`npm install\`
- Typecheck: \`npm run typecheck\`
- Lint: \`npm run lint\`
- Test: \`npm test\`
- Build: \`npm run build\`

## Project structure
[Describe the main directories and their purpose]

## Core principles
- **Think before coding** — clarify assumptions before writing code. Never silently pick an interpretation and run with it.
- **Simplicity first** — implement the simplest solution that works. No premature abstractions, no config options nobody will use.
- **Surgical changes** — only modify what's necessary. Don't refactor surrounding code, rename variables "for consistency", or "clean up" unrelated files.
- **Verify, don't trust** — run \`npm test\` and \`npm run typecheck\` before declaring any task complete. Never claim success without checking actual output.

## When to stop and ask
- You are unsure which of multiple valid approaches to take
- The task requires changing a public API or database schema
- You need to add a new dependency
- Something feels wrong or the requirements seem contradictory
- Proceed without asking for: straightforward bug fixes, test additions, documentation updates, and changes that have a single obvious implementation

## Verification
A task is not done until all of these pass:
- \`npm run typecheck\` exits 0
- \`npm run lint\` exits 0
- \`npm test\` exits 0
- \`npm run build\` exits 0

## Output rules
- Keep output clear and scannable
- Prefer structured data over prose
- Error messages must be actionable

## Safety rules
- Never log secrets, tokens, or credentials
- Never execute untrusted input as code
- Validate all external input
- Keep dependencies minimal

## Change rules
- Update README if you change behavior
- Add tests for new features
- Document breaking changes clearly
- Keep PRs focused — one concern per PR

## Boundaries: always, ask first, never

**Always:**
- Run the full test suite before submitting
- Follow existing code style and patterns
- Provide evidence that your change works

**Ask first:**
- Adding new dependencies
- Changing database schemas or public APIs
- Modifying CI/CD configuration
- Architectural changes that affect multiple modules

**Never:**
- Commit secrets or credentials
- Remove or skip failing tests
- Bypass linting or type checking
- Make changes outside the scope of the current task
- Fabricate test results or claim untested code works
`;

export const CLAUDE_TEMPLATE = `Follow AGENTS.md exactly. If AGENTS.md conflicts with any other instructions, AGENTS.md wins.
`;

export const GEMINI_TEMPLATE = `Follow AGENTS.md exactly. If AGENTS.md conflicts with any other instructions, AGENTS.md wins.
`;

export function getTemplate(name: 'minimal' | 'opinionated'): string {
  return name === 'minimal' ? MINIMAL_TEMPLATE : OPINIONATED_TEMPLATE;
}
