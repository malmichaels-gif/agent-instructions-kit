import * as fs from 'fs';
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

export function checkAgentsFile(path: string): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(path)) {
    return {
      passed: false,
      errors: [`File not found: ${path}`],
      warnings: [],
    };
  }

  const content = fs.readFileSync(path, 'utf-8');

  if (content.trim().length === 0) {
    return {
      passed: false,
      errors: [`File is empty: ${path}`],
      warnings: [],
    };
  }

  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp(`^##\\s+${section}`, 'mi');
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

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

export function checkClaudeFile(path: string, agentsPath: string): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(path)) {
    return {
      passed: false,
      errors: [`File not found: ${path}`],
      warnings: [],
    };
  }

  const content = fs.readFileSync(path, 'utf-8');

  if (content.trim().length === 0) {
    return {
      passed: false,
      errors: [`File is empty: ${path}`],
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
  const negationPattern = /\b(never|don'?t|do not|must not|shall not|forbidden|prohibited)\b/gi;
  const negationsA = [...bodyA.matchAll(negationPattern)].map((m) => m[0].toLowerCase());
  const negationsB = [...bodyB.matchAll(negationPattern)].map((m) => m[0].toLowerCase());

  if ((negationsA.length > 0) !== (negationsB.length > 0)) return true;
  return false;
}
