export const MINIMAL_TEMPLATE = `# AGENTS.md

## Mission
[Describe what this project does and its core goals]

## Local dev commands
- Install: \`npm install\`
- Test: \`npm test\`
- Build: \`npm run build\`

## Change rules
- Update README if you change behavior
- Add tests for new features
`;

export const OPINIONATED_TEMPLATE = `# AGENTS.md

## Mission
[Describe what this project does and its core goals]

## Local dev commands
- Install: \`npm install\`
- Typecheck: \`npm run typecheck\`
- Lint: \`npm run lint\`
- Test: \`npm test\`
- Build: \`npm run build\`

## Output rules
- Keep output clear and scannable
- Prefer structured data over prose
- Error messages should be actionable

## Safety rules
- Never log secrets, tokens, or credentials
- Validate all external input
- Keep dependencies minimal

## Change rules
- Update README if you change behavior
- Add tests for new features
- Document breaking changes clearly

## What NOT to do
- Don't add dependencies without discussion
- Don't bypass tests or linting
- Don't commit secrets or credentials
`;

export const CLAUDE_TEMPLATE = `Follow AGENTS.md exactly. If AGENTS.md conflicts with any other instructions, AGENTS.md wins.
`;

export function getTemplate(name: 'minimal' | 'opinionated'): string {
  return name === 'minimal' ? MINIMAL_TEMPLATE : OPINIONATED_TEMPLATE;
}
