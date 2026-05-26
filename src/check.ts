import * as fs from 'fs';
import * as path from 'path';
import type { CheckResult } from './types.js';

const REQUIRED_SECTIONS = [
  'Mission',
  'Local dev commands',
];

const RECOMMENDED_SECTIONS = [
  { pattern: /testing|verification|verify|test plan/i, name: 'Testing / Verification' },
  { pattern: /boundary|boundaries|what not to do|never|constraints/i, name: 'Boundaries / Constraints' },
];

const LINE_WARN_THRESHOLD = 150;
const LINE_ERROR_THRESHOLD = 300;

const BACKTICK_COMMAND = /`[^`]+`/;

export function checkAgentsFile(filePath: string): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(filePath)) {
    return {
      passed: false,
      errors: [`File not found: ${filePath}`],
      warnings: [],
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (content.trim().length === 0) {
    return {
      passed: false,
      errors: [`File is empty: ${filePath}`],
      warnings: [],
    };
  }

  for (const section of REQUIRED_SECTIONS) {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^##\\s+${escaped}`, 'mi');
    if (!pattern.test(content)) {
      errors.push(`Missing required section: "${section}"`);
    }
  }

  if (content.includes('TODO') || content.includes('FIXME')) {
    warnings.push('File contains TODO/FIXME placeholders');
  }

  const lines = content.split('\n');
  const lineCount = lines.length;
  if (lineCount > LINE_ERROR_THRESHOLD) {
    warnings.push(`File is ${lineCount} lines (>${LINE_ERROR_THRESHOLD}). Agent performance degrades with long instruction files — trim aggressively`);
  } else if (lineCount > LINE_WARN_THRESHOLD) {
    warnings.push(`File is ${lineCount} lines (>${LINE_WARN_THRESHOLD}). Consider trimming — shorter files correlate with better agent performance`);
  }

  for (const rec of RECOMMENDED_SECTIONS) {
    if (!rec.pattern.test(content)) {
      warnings.push(`Missing recommended section: "${rec.name}" — top-performing instruction files include this`);
    }
  }

  const hasBoundaryLanguage = /\bnever\b|\bdon'?t\b|\bdo not\b|\bforbidden\b|\bprohibited\b/i.test(content);
  if (!hasBoundaryLanguage) {
    warnings.push('No boundary constraints found (e.g., "never", "don\'t", "do not"). Agents perform better with explicit limits');
  }

  const sections = splitSections(content);
  for (const section of sections) {
    if (section.lineCount >= 4 && !BACKTICK_COMMAND.test(section.body) && !section.heading.toLowerCase().includes('mission')) {
      warnings.push(`Section "${section.heading}" has no executable commands — agents follow instructions with verifiable commands more reliably`);
    }
  }

  const dir = path.dirname(filePath);
  const brokenCmds = validateCommands(content, dir);
  for (const cmd of brokenCmds) {
    warnings.push(`Referenced command \`${cmd}\` does not appear to exist in this project`);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

export function checkClaudeFile(filePath: string, agentsPath: string): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(filePath)) {
    return {
      passed: false,
      errors: [`File not found: ${filePath}`],
      warnings: [],
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (content.trim().length === 0) {
    return {
      passed: false,
      errors: [`File is empty: ${filePath}`],
      warnings: [],
    };
  }

  if (!content.includes('AGENTS.md')) {
    warnings.push('CLAUDE.md should reference AGENTS.md as source of truth');
  }

  if (fs.existsSync(agentsPath)) {
    const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
    const agentsSections = extractHeadings(agentsContent);
    const claudeSections = extractHeadings(content);

    for (const heading of claudeSections) {
      const match = agentsSections.find((h) => h.toLowerCase() === heading.toLowerCase());
      if (match) {
        const agentsBody = getSectionBody(agentsContent, match);
        const claudeBody = getSectionBody(content, heading);
        if (agentsBody && claudeBody && hasContradiction(agentsBody, claudeBody)) {
          warnings.push(`Section "${heading}" may contradict AGENTS.md — review for consistency`);
        }
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

interface Section {
  heading: string;
  body: string;
  lineCount: number;
}

function splitSections(content: string): Section[] {
  const sections: Section[] = [];
  const lines = content.split('\n');
  let currentHeading = '';
  let bodyLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          body: bodyLines.join('\n'),
          lineCount: bodyLines.filter((l) => l.trim().length > 0).length,
        });
      }
      currentHeading = headingMatch[1];
      bodyLines = [];
    } else if (currentHeading) {
      bodyLines.push(line);
    }
  }

  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      body: bodyLines.join('\n'),
      lineCount: bodyLines.filter((l) => l.trim().length > 0).length,
    });
  }

  return sections;
}

function extractHeadings(content: string): string[] {
  const headings: string[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^##\s+(.+)/);
    if (match) headings.push(match[1]);
  }
  return headings;
}

function getSectionBody(content: string, heading: string): string | null {
  const sections = splitSections(content);
  const section = sections.find((s) => s.heading.toLowerCase() === heading.toLowerCase());
  return section ? section.body.trim() : null;
}

function hasContradiction(bodyA: string, bodyB: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const wordsA = new Set(normalize(bodyA));
  const wordsB = new Set(normalize(bodyB));

  const opposites: [string, string][] = [
    ['always', 'never'],
    ['allow', 'forbid'],
    ['allow', 'prohibited'],
    ['enable', 'disable'],
    ['require', 'optional'],
  ];

  for (const [a, b] of opposites) {
    if ((wordsA.has(a) && wordsB.has(b)) || (wordsA.has(b) && wordsB.has(a))) return true;
  }
  return false;
}

const NPM_SCRIPT_PATTERN = /npm\s+(run\s+)?(\w[\w-]*)/g;

function validateCommands(content: string, dir: string): string[] {
  const broken: string[] = [];

  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const scripts: Record<string, string> = pkg.scripts || {};
      const builtins = new Set(['test', 'start', 'install', 'publish', 'pack', 'init', 'version']);

      for (const match of content.matchAll(NPM_SCRIPT_PATTERN)) {
        const hasRun = !!match[1];
        const script = match[2];
        if (builtins.has(script)) continue;
        if (!scripts[script]) {
          broken.push(hasRun ? `npm run ${script}` : `npm ${script}`);
        }
      }
    } catch {
      // Skip if package.json is invalid
    }
  }

  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
    // Cargo commands are built-in — always valid
  }

  if (fs.existsSync(path.join(dir, 'go.mod'))) {
    // Go commands are built-in — always valid
  }

  return broken;
}
