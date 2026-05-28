import * as fs from 'fs';
import * as path from 'path';
import type { CheckResult, CheckAgentsOptions, CrossFileConsistencyResult, CrossFileIssue } from './types.js';
import { hasFrontmatter, parseFrontmatter, stripFrontmatter, validateFrontmatter } from './frontmatter.js';
import { suggestHooks } from './hooks.js';

const REQUIRED_SECTIONS = [
  'Mission',
  'Local dev commands',
];

const RECOMMENDED_SECTIONS = [
  { pattern: /testing|verification|verify|test plan/i, name: 'Testing / Verification' },
  { pattern: /boundary|boundaries|what not to do|never|constraints/i, name: 'Boundaries / Constraints' },
];

const DEFAULT_LINE_WARN_THRESHOLD = 150;
const DEFAULT_LINE_ERROR_THRESHOLD = 300;

const BACKTICK_COMMAND = /`[^`]+`/;

export function checkAgentsFile(filePath: string, options: CheckAgentsOptions = {}): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(filePath)) {
    return {
      passed: false,
      errors: [`File not found: ${filePath}`],
      warnings: [],
    };
  }

  const rawContent = fs.readFileSync(filePath, 'utf-8');

  if (rawContent.trim().length === 0) {
    return {
      passed: false,
      errors: [`File is empty: ${filePath}`],
      warnings: [],
    };
  }

  // AGENTS.md v1.1 supports an optional YAML frontmatter block (description,
  // tags). It is purely additive — files without it still pass. We strip it
  // before running structural/content checks so the metadata is not mistaken
  // for instructions and does not count against the line-length thresholds.
  const fileHasFrontmatter = hasFrontmatter(rawContent);
  if (fileHasFrontmatter) {
    const fm = parseFrontmatter(rawContent);
    if (!fm.success) {
      warnings.push(`Frontmatter could not be parsed: ${fm.error ?? 'malformed YAML'}`);
    } else if (fm.data) {
      warnings.push(...validateFrontmatter(fm.data));
    }
  } else if ((options.agentsFileCount ?? 1) > 1) {
    // Monorepos with multiple AGENTS.md files benefit from frontmatter
    // (description/tags) so the files can be distinguished. Recommended, not required.
    warnings.push('Multiple AGENTS.md files detected but this one has no frontmatter — add a "description" to distinguish it (optional, recommended for monorepos)');
  }

  const content = stripFrontmatter(rawContent);

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

  const lineWarnThreshold = options.lineWarnThreshold ?? DEFAULT_LINE_WARN_THRESHOLD;
  const lineErrorThreshold = options.lineErrorThreshold ?? DEFAULT_LINE_ERROR_THRESHOLD;
  const lines = content.split('\n');
  const lineCount = lines.length;
  if (lineCount > lineErrorThreshold) {
    warnings.push(`File is ${lineCount} lines (>${lineErrorThreshold}). Agent performance degrades with long instruction files — trim aggressively`);
  } else if (lineCount > lineWarnThreshold) {
    warnings.push(`File is ${lineCount} lines (>${lineWarnThreshold}). Consider trimming — shorter files correlate with better agent performance`);
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

  // Suggest Claude Code hooks based on verifiable commands documented in the
  // Verification section. Purely advisory — never affects pass/fail.
  const hookSuggestions = suggestHooks(content);

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    hookSuggestions,
  };
}

export function checkClaudeFile(filePath: string, agentsPath: string): CheckResult {
  return checkDeferringFile(filePath, agentsPath, 'CLAUDE.md');
}

export function checkGeminiFile(filePath: string, agentsPath: string): CheckResult {
  return checkDeferringFile(filePath, agentsPath, 'GEMINI.md');
}

// Shared validation for thin instruction files (CLAUDE.md, GEMINI.md) that are
// expected to defer to AGENTS.md. They should reference AGENTS.md and must not
// contradict it.
function checkDeferringFile(filePath: string, agentsPath: string, label: string): CheckResult {
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
    warnings.push(`${label} should reference AGENTS.md as source of truth`);
  }

  if (fs.existsSync(agentsPath)) {
    const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
    const agentsSections = extractHeadings(agentsContent);
    const fileSections = extractHeadings(content);

    for (const heading of fileSections) {
      const match = agentsSections.find((h) => h.toLowerCase() === heading.toLowerCase());
      if (match) {
        const agentsBody = getSectionBody(agentsContent, match);
        const fileBody = getSectionBody(content, heading);
        if (agentsBody && fileBody && hasContradiction(agentsBody, fileBody)) {
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

// Cross-file consistency: detect contradictions and duplicated sections across
// AGENTS.md, CLAUDE.md, and GEMINI.md. Only files that exist are compared.
// Issues are warnings (not errors) because the heuristics are deliberately
// conservative to keep false positives low.
export function checkCrossFileConsistency(
  agentsPath: string,
  claudePath: string,
  geminiPath: string,
): CrossFileConsistencyResult {
  const issues: CrossFileIssue[] = [];

  const files: { name: string; path: string; content: string }[] = [];
  for (const [name, p] of [
    ['AGENTS.md', agentsPath],
    ['CLAUDE.md', claudePath],
    ['GEMINI.md', geminiPath],
  ] as const) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      if (content.trim().length > 0) {
        files.push({ name, path: p, content });
      }
    }
  }

  // Pairwise comparison across every existing file.
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const a = files[i];
      const b = files[j];
      const aSections = extractHeadings(a.content);
      const bSections = extractHeadings(b.content);

      for (const heading of aSections) {
        const match = bSections.find((h) => h.toLowerCase() === heading.toLowerCase());
        if (!match) continue;
        const aBody = getSectionBody(a.content, heading);
        const bBody = getSectionBody(b.content, match);
        if (!aBody || !bBody) continue;

        if (hasContradiction(aBody, bBody)) {
          issues.push({
            type: 'contradiction',
            files: [a.name, b.name],
            message: `Section "${heading}" may contradict between ${a.name} and ${b.name} — review for consistency`,
            severity: 'warn',
          });
        } else if (normalizeBody(aBody) === normalizeBody(bBody)) {
          issues.push({
            type: 'duplication',
            files: [a.name, b.name],
            message: `Section "${heading}" is duplicated verbatim in ${a.name} and ${b.name} — keep the content in AGENTS.md only`,
            severity: 'warn',
          });
        }
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

function normalizeBody(body: string): string {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
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
