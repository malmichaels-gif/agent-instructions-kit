import * as fs from 'fs';
import type { CheckResult } from './types.js';

const REQUIRED_SECTIONS = [
  'Mission',
  'Local dev commands',
];

export function checkAgentsFile(path: string): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file exists
  if (!fs.existsSync(path)) {
    return {
      passed: false,
      errors: [`File not found: ${path}`],
      warnings: [],
    };
  }

  const content = fs.readFileSync(path, 'utf-8');

  // Check not empty
  if (content.trim().length === 0) {
    return {
      passed: false,
      errors: [`File is empty: ${path}`],
      warnings: [],
    };
  }

  // Check required sections
  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp(`^##\\s+${section}`, 'mi');
    if (!pattern.test(content)) {
      errors.push(`Missing required section: "${section}"`);
    }
  }

  // Check for placeholder text
  if (content.includes('TODO') || content.includes('FIXME')) {
    warnings.push('File contains TODO/FIXME placeholders');
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

export function checkClaudeFile(path: string, _agentsPath: string): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file exists
  if (!fs.existsSync(path)) {
    return {
      passed: false,
      errors: [`File not found: ${path}`],
      warnings: [],
    };
  }

  const content = fs.readFileSync(path, 'utf-8');

  // Check not empty
  if (content.trim().length === 0) {
    return {
      passed: false,
      errors: [`File is empty: ${path}`],
      warnings: [],
    };
  }

  // Check it references AGENTS.md
  if (!content.includes('AGENTS.md')) {
    warnings.push('CLAUDE.md should reference AGENTS.md as source of truth');
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}
