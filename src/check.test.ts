import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { checkAgentsFile, checkClaudeFile } from './check.js';

const TEST_DIR = './test-fixtures-check';

beforeEach(() => {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterEach(() => {
  try {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  } catch {
    // Ignore cleanup errors
  }
});

function writeAgents(name: string, content: string): string {
  const filePath = path.join(TEST_DIR, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

const VALID_AGENTS = `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- Install: \`npm install\`
- Test: \`npm test\`

## Verification
- Run \`npm test\` before declaring complete

## Boundaries
- Never commit secrets
`;

describe('checkAgentsFile', () => {
  it('fails if file does not exist', () => {
    const result = checkAgentsFile('./nonexistent.md');
    expect(result.passed).toBe(false);
    expect(result.errors).toContain('File not found: ./nonexistent.md');
  });

  it('fails if file is empty', () => {
    const filePath = writeAgents('empty.md', '');
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('empty');
  });

  it('fails if missing required sections', () => {
    const filePath = writeAgents('missing-sections.md', '# AGENTS.md\n\nSome content here.');
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('Mission'))).toBe(true);
  });

  it('passes with all required sections', () => {
    const filePath = writeAgents('valid.md', VALID_AGENTS);
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('warns about TODO placeholders', () => {
    const filePath = writeAgents('todo.md', `# AGENTS.md

## Mission
TODO: fill this in

## Local dev commands
- \`npm install\`
`);
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes('TODO'))).toBe(true);
  });

  it('warns when file exceeds 150 lines', () => {
    const header = '# AGENTS.md\n\n## Mission\nDo stuff.\n\n## Local dev commands\n- `npm test`\n\n';
    const padding = Array(160).fill('- rule').join('\n');
    const filePath = writeAgents('long.md', header + padding);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('150'))).toBe(true);
  });

  it('warns harder when file exceeds 300 lines', () => {
    const header = '# AGENTS.md\n\n## Mission\nDo stuff.\n\n## Local dev commands\n- `npm test`\n\n';
    const padding = Array(310).fill('- rule').join('\n');
    const filePath = writeAgents('very-long.md', header + padding);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('300'))).toBe(true);
  });

  it('warns when missing verification section', () => {
    const filePath = writeAgents('no-verify.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('Verification'))).toBe(true);
  });

  it('warns when missing boundary section', () => {
    const filePath = writeAgents('no-bounds.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`

## Verification
- Run \`npm test\`
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('Boundaries'))).toBe(true);
  });

  it('warns when no boundary language exists at all', () => {
    const filePath = writeAgents('no-boundary-words.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`

## Rules
- Run tests
- Update docs
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('boundary constraints'))).toBe(true);
  });

  it('does not warn about boundary language when "never" is present', () => {
    const filePath = writeAgents('has-never.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`

## Rules
- Never commit secrets
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('boundary constraints'))).toBe(false);
  });

  it('warns about sections with prose but no commands', () => {
    const filePath = writeAgents('prose-only.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`

## Code style
Follow the existing patterns in the codebase.
Use consistent naming conventions.
Make sure imports are organized.
Keep functions small and focused.
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('Code style') && w.includes('no executable commands'))).toBe(true);
  });

  it('does not warn about sections that have backtick commands', () => {
    const filePath = writeAgents('has-commands.md', `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- \`npm test\`

## Code style
- Run \`eslint src\` to check
- Format with \`prettier --write\`
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('Code style') && w.includes('no executable commands'))).toBe(false);
  });

  it('skips prose check for Mission section', () => {
    const filePath = writeAgents('mission-prose.md', `# AGENTS.md

## Mission
This project is a CLI tool that helps
teams maintain consistent agent instruction
files across their repositories.

## Local dev commands
- \`npm test\`
`);
    const result = checkAgentsFile(filePath);
    expect(result.warnings.some((w) => w.includes('Mission') && w.includes('no executable commands'))).toBe(false);
  });
});

describe('checkClaudeFile', () => {
  it('fails if file does not exist', () => {
    const result = checkClaudeFile('./nonexistent.md', 'AGENTS.md');
    expect(result.passed).toBe(false);
  });

  it('warns if AGENTS.md not referenced', () => {
    const filePath = writeAgents('claude.md', 'Just follow the rules.');
    const result = checkClaudeFile(filePath, 'AGENTS.md');
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes('AGENTS.md'))).toBe(true);
  });

  it('passes when referencing AGENTS.md', () => {
    const filePath = writeAgents('claude.md', 'Follow AGENTS.md exactly.');
    const result = checkClaudeFile(filePath, 'AGENTS.md');
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns on cross-file contradiction', () => {
    const agentsPath = writeAgents('AGENTS.md', `# AGENTS.md

## Safety rules
- Never log secrets
`);
    const claudePath = writeAgents('CLAUDE.md', `Follow AGENTS.md exactly.

## Safety rules
- Log everything for debugging
`);
    const result = checkClaudeFile(claudePath, agentsPath);
    expect(result.warnings.some((w) => w.includes('contradict'))).toBe(true);
  });

  it('no contradiction warning when sections are consistent', () => {
    const agentsPath = writeAgents('AGENTS.md', `# AGENTS.md

## Safety rules
- Never log secrets
`);
    const claudePath = writeAgents('CLAUDE.md', `Follow AGENTS.md exactly.

## Safety rules
- Never expose credentials
`);
    const result = checkClaudeFile(claudePath, agentsPath);
    expect(result.warnings.some((w) => w.includes('contradict'))).toBe(false);
  });
});
