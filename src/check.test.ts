import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { checkAgentsFile, checkClaudeFile } from './check.js';

const TEST_DIR = './test-fixtures';

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

describe('checkAgentsFile', () => {
  it('fails if file does not exist', () => {
    const result = checkAgentsFile('./nonexistent.md');
    expect(result.passed).toBe(false);
    expect(result.errors).toContain('File not found: ./nonexistent.md');
  });

  it('fails if file is empty', () => {
    const filePath = path.join(TEST_DIR, 'empty.md');
    fs.writeFileSync(filePath, '');
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('empty');
  });

  it('fails if missing required sections', () => {
    const filePath = path.join(TEST_DIR, 'missing-sections.md');
    fs.writeFileSync(filePath, '# AGENTS.md\n\nSome content here.');
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('Mission'))).toBe(true);
  });

  it('passes with all required sections', () => {
    const filePath = path.join(TEST_DIR, 'valid.md');
    fs.writeFileSync(
      filePath,
      `# AGENTS.md

## Mission
Do stuff.

## Local dev commands
- npm install
`
    );
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('warns about TODO placeholders', () => {
    const filePath = path.join(TEST_DIR, 'todo.md');
    fs.writeFileSync(
      filePath,
      `# AGENTS.md

## Mission
TODO: fill this in

## Local dev commands
- npm install
`
    );
    const result = checkAgentsFile(filePath);
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes('TODO'))).toBe(true);
  });
});

describe('checkClaudeFile', () => {
  it('fails if file does not exist', () => {
    const result = checkClaudeFile('./nonexistent.md', 'AGENTS.md');
    expect(result.passed).toBe(false);
  });

  it('warns if AGENTS.md not referenced', () => {
    const filePath = path.join(TEST_DIR, 'claude.md');
    fs.writeFileSync(filePath, 'Just follow the rules.');
    const result = checkClaudeFile(filePath, 'AGENTS.md');
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.includes('AGENTS.md'))).toBe(true);
  });

  it('passes when referencing AGENTS.md', () => {
    const filePath = path.join(TEST_DIR, 'claude.md');
    fs.writeFileSync(filePath, 'Follow AGENTS.md exactly.');
    const result = checkClaudeFile(filePath, 'AGENTS.md');
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
