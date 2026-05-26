import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { detectProject, renderTemplate } from './detect.js';
import { MINIMAL_TEMPLATE, OPINIONATED_TEMPLATE } from './templates.js';

const TEST_DIR = './test-fixtures-detect';

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

describe('detectProject', () => {
  it('detects Node.js/TypeScript project', () => {
    fs.writeFileSync(path.join(TEST_DIR, 'package.json'), JSON.stringify({
      scripts: { test: 'vitest', build: 'tsc', lint: 'eslint src', typecheck: 'tsc --noEmit' },
      devDependencies: { typescript: '^5.0.0' },
    }));
    const info = detectProject(TEST_DIR);
    expect(info).not.toBeNull();
    expect(info!.language).toBe('TypeScript');
    expect(info!.commands.typecheck).toContain('typecheck');
    expect(info!.commands.lint).toContain('lint');
  });

  it('detects Next.js project', () => {
    fs.writeFileSync(path.join(TEST_DIR, 'package.json'), JSON.stringify({
      scripts: { test: 'jest', build: 'next build' },
      dependencies: { next: '^14.0.0', react: '^18.0.0' },
    }));
    const info = detectProject(TEST_DIR);
    expect(info!.framework).toBe('Next.js');
  });

  it('detects plain JavaScript project', () => {
    fs.writeFileSync(path.join(TEST_DIR, 'package.json'), JSON.stringify({
      scripts: { test: 'jest' },
      dependencies: { express: '^4.0.0' },
    }));
    const info = detectProject(TEST_DIR);
    expect(info!.language).toBe('JavaScript');
    expect(info!.framework).toBe('Express');
  });

  it('detects Rust project', () => {
    fs.writeFileSync(path.join(TEST_DIR, 'Cargo.toml'), '[package]\nname = "myapp"\n');
    const info = detectProject(TEST_DIR);
    expect(info!.language).toBe('Rust');
    expect(info!.commands.test).toContain('cargo test');
  });

  it('detects Python project', () => {
    fs.writeFileSync(path.join(TEST_DIR, 'pyproject.toml'), '[tool.ruff]\nline-length = 88\n');
    const info = detectProject(TEST_DIR);
    expect(info!.language).toBe('Python');
    expect(info!.commands.lint).toContain('ruff');
  });

  it('detects Go project', () => {
    fs.writeFileSync(path.join(TEST_DIR, 'go.mod'), 'module example.com/myapp\n\ngo 1.22\n');
    const info = detectProject(TEST_DIR);
    expect(info!.language).toBe('Go');
    expect(info!.commands.test).toContain('go test');
  });

  it('returns null for unknown project', () => {
    const info = detectProject(TEST_DIR);
    expect(info).toBeNull();
  });
});

describe('renderTemplate', () => {
  it('fills in detected stack for minimal template', () => {
    const info = {
      language: 'TypeScript',
      framework: 'Express',
      commands: {
        install: '`npm install`',
        test: '`npm test`',
        lint: '`npm run lint`',
        build: '`npm run build`',
      },
    };
    const result = renderTemplate(MINIMAL_TEMPLATE, info);
    expect(result).toContain('TypeScript / Express');
    expect(result).not.toContain('[List primary language');
  });

  it('fills in verification for opinionated template', () => {
    const info = {
      language: 'TypeScript',
      framework: 'Next.js',
      commands: {
        install: '`npm install`',
        typecheck: '`npm run typecheck`',
        lint: '`npm run lint`',
        test: '`npm test`',
        build: '`npm run build`',
      },
    };
    const result = renderTemplate(OPINIONATED_TEMPLATE, info);
    expect(result).toContain('TypeScript / Next.js');
    expect(result).toContain('`npm run typecheck` exits 0');
  });
});
