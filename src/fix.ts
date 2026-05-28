import * as fs from 'fs';

export type FixType =
  | 'add-section'
  | 'redact-secret'
  | 'replace-hedge'
  | 'add-agents-reference';

export interface FixAction {
  type: FixType;
  path: string;
  lineNumber: number | null;
  oldValue: string;
  newValue: string;
  description: string;
}

export interface FixReport {
  passed: boolean;
  applied: FixAction[];
  skipped: FixAction[];
  dryRun: boolean;
}

// Required sections (mirrors REQUIRED_SECTIONS in check.ts).
const REQUIRED_SECTIONS = ['Mission', 'Local dev commands'];

const REQUIRED_SECTION_STUBS: Record<string, string> = {
  Mission: '[Describe what this project does and its core goals]',
  'Local dev commands': '- Install: `npm install`\n- Test: `npm test`\n- Build: `npm run build`',
};

// Secret-detection rules reused from safety.ts (leaked-* family). Redaction is
// only applied to these high-confidence patterns to keep false positives low.
const SECRET_RULES: { id: string; pattern: RegExp }[] = [
  { id: 'leaked-aws-key', pattern: /AKIA[0-9A-Z]{16}/g },
  {
    id: 'leaked-generic-secret',
    pattern:
      /((?:api[_-]?key|api[_-]?secret|auth[_-]?token|access[_-]?token|secret[_-]?key)\s*[:=]\s*["']?)[A-Za-z0-9+/=_-]{20,}/gi,
  },
  {
    id: 'leaked-private-key',
    pattern: /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH|PGP)?\s*PRIVATE KEY-----/gi,
  },
  {
    id: 'leaked-jwt',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
];

const REDACTED = '[REDACTED]';

// Hedge-word replacements (mirrors ambiguous-hedge rule in safety.ts). Maps each
// vague phrase to a concrete, verifiable alternative.
const HEDGE_REPLACEMENTS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\btry to\b/gi, replacement: 'do' },
  { pattern: /\bwhere possible\b/gi, replacement: 'ensure' },
  { pattern: /\bif appropriate\b/gi, replacement: 'must' },
  { pattern: /\bwhen feasible\b/gi, replacement: 'must' },
  { pattern: /\bas needed\b/gi, replacement: 'must' },
  { pattern: /\bideally\b/gi, replacement: 'must' },
  { pattern: /\boptionally\b/gi, replacement: 'must' },
];

interface FileFix {
  content: string;
  actions: FixAction[];
}

export function fixAgentsContent(content: string, filePath: string): FileFix {
  const actions: FixAction[] = [];
  let result = content;

  const redaction = redactSecrets(result, filePath);
  result = redaction.content;
  actions.push(...redaction.actions);

  const hedges = replaceHedgeWords(result, filePath);
  result = hedges.content;
  actions.push(...hedges.actions);

  const sections = addMissingRequiredSections(result, filePath);
  result = sections.content;
  actions.push(...sections.actions);

  return { content: result, actions };
}

export function fixClaudeContent(content: string, filePath: string): FileFix {
  const actions: FixAction[] = [];
  let result = content;

  const redaction = redactSecrets(result, filePath);
  result = redaction.content;
  actions.push(...redaction.actions);

  const hedges = replaceHedgeWords(result, filePath);
  result = hedges.content;
  actions.push(...hedges.actions);

  const ref = addAgentsReference(result, filePath);
  result = ref.content;
  actions.push(...ref.actions);

  return { content: result, actions };
}

export function redactSecrets(content: string, filePath: string): FileFix {
  const actions: FixAction[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    for (const rule of SECRET_RULES) {
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(lines[i])) continue;
      const original = lines[i];
      rule.pattern.lastIndex = 0;
      // For the generic-secret rule, keep the key prefix (capture group 1) and
      // redact only the value. Other rules redact the whole match.
      const replaced = original.replace(rule.pattern, (...m) => {
        // m: match, ...groups, offset, string
        if (rule.id === 'leaked-generic-secret' && typeof m[1] === 'string') {
          return `${m[1]}${REDACTED}`;
        }
        return REDACTED;
      });
      if (replaced !== original) {
        lines[i] = replaced;
        actions.push({
          type: 'redact-secret',
          path: filePath,
          lineNumber: i + 1,
          oldValue: original,
          newValue: replaced,
          description: `Redacted secret matching ${rule.id}`,
        });
      }
    }
  }

  return { content: lines.join('\n'), actions };
}

export function replaceHedgeWords(content: string, filePath: string): FileFix {
  const actions: FixAction[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (const { pattern, replacement } of HEDGE_REPLACEMENTS) {
      pattern.lastIndex = 0;
      if (!pattern.test(line)) continue;
      const before = line;
      pattern.lastIndex = 0;
      line = line.replace(pattern, replacement);
      if (line !== before) {
        actions.push({
          type: 'replace-hedge',
          path: filePath,
          lineNumber: i + 1,
          oldValue: before,
          newValue: line,
          description: 'Replaced ambiguous hedge word with concrete language',
        });
      }
    }
    lines[i] = line;
  }

  return { content: lines.join('\n'), actions };
}

export function addMissingRequiredSections(content: string, filePath: string): FileFix {
  const actions: FixAction[] = [];
  const additions: string[] = [];

  for (const section of REQUIRED_SECTIONS) {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^##\\s+${escaped}`, 'mi');
    if (pattern.test(content)) continue;

    const stub = REQUIRED_SECTION_STUBS[section] ?? '[Fill this in]';
    const block = `## ${section}\n${stub}`;
    additions.push(block);
    actions.push({
      type: 'add-section',
      path: filePath,
      lineNumber: null,
      oldValue: '',
      newValue: block,
      description: `Added missing required section "${section}"`,
    });
  }

  if (additions.length === 0) {
    return { content, actions };
  }

  const trimmed = content.replace(/\s+$/, '');
  const appended = `${trimmed}\n\n${additions.join('\n\n')}\n`;
  return { content: appended, actions };
}

export function addAgentsReference(content: string, filePath: string): FileFix {
  if (content.includes('AGENTS.md')) {
    return { content, actions: [] };
  }

  const reference =
    'Follow AGENTS.md exactly. If AGENTS.md conflicts with any other instructions, AGENTS.md wins.';
  const trimmedStart = content.replace(/^\s+/, '');
  const newContent = `${reference}\n\n${trimmedStart}`;

  return {
    content: newContent,
    actions: [
      {
        type: 'add-agents-reference',
        path: filePath,
        lineNumber: 1,
        oldValue: '',
        newValue: reference,
        description: 'Added reference to AGENTS.md as source of truth',
      },
    ],
  };
}

export interface RunFixOptions {
  agentsPath: string;
  claudePath: string;
  dryRun: boolean;
}

export function runFix(options: RunFixOptions): FixReport {
  const { agentsPath, claudePath, dryRun } = options;
  const applied: FixAction[] = [];

  if (fs.existsSync(agentsPath)) {
    const content = fs.readFileSync(agentsPath, 'utf-8');
    const { content: fixed, actions } = fixAgentsContent(content, agentsPath);
    if (actions.length > 0) {
      if (!dryRun && fixed !== content) {
        fs.writeFileSync(agentsPath, fixed);
      }
      applied.push(...actions);
    }
  }

  if (fs.existsSync(claudePath)) {
    const content = fs.readFileSync(claudePath, 'utf-8');
    const { content: fixed, actions } = fixClaudeContent(content, claudePath);
    if (actions.length > 0) {
      if (!dryRun && fixed !== content) {
        fs.writeFileSync(claudePath, fixed);
      }
      applied.push(...actions);
    }
  }

  return {
    passed: true,
    applied,
    skipped: [],
    dryRun,
  };
}
