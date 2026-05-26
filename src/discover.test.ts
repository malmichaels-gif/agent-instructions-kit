import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { discoverFiles } from './discover.js';

const TEST_DIR = './test-fixtures-discover';

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

describe('discoverFiles', () => {
  it('returns empty for clean directory', () => {
    const files = discoverFiles(TEST_DIR);
    expect(files).toHaveLength(0);
  });

  it('discovers .cursorrules', () => {
    fs.writeFileSync(path.join(TEST_DIR, '.cursorrules'), 'some rules');
    const files = discoverFiles(TEST_DIR);
    expect(files.some((f) => f.includes('.cursorrules'))).toBe(true);
  });

  it('discovers .github/copilot-instructions.md', () => {
    fs.mkdirSync(path.join(TEST_DIR, '.github'), { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, '.github', 'copilot-instructions.md'), 'copilot rules');
    const files = discoverFiles(TEST_DIR);
    expect(files.some((f) => f.includes('copilot-instructions.md'))).toBe(true);
  });

  it('discovers multiple files', () => {
    fs.writeFileSync(path.join(TEST_DIR, '.cursorrules'), 'rules');
    fs.writeFileSync(path.join(TEST_DIR, '.windsurfrules'), 'rules');
    const files = discoverFiles(TEST_DIR);
    expect(files.length).toBe(2);
  });
});
