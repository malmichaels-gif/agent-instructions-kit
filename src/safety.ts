import * as fs from 'fs';
import type { SafetyRule, SafetyResult, SafetyFinding } from './types.js';

const SAFETY_RULES: SafetyRule[] = [
  {
    id: 'ignore-instructions',
    pattern: /ignore\s+(previous|all|prior)\s+instructions/i,
    message: 'Prompt injection attempt: "ignore previous instructions"',
    severity: 'error',
  },
  {
    id: 'print-secrets',
    pattern: /print\s+(env|environment|secrets?|api.?keys?|tokens?)/i,
    message: 'Suspicious instruction: asking to print secrets or environment variables',
    severity: 'error',
  },
  {
    id: 'upload-repo',
    pattern: /upload\s+(repo|repository|codebase|source)/i,
    message: 'Suspicious instruction: asking to upload repository contents',
    severity: 'error',
  },
  {
    id: 'curl-bash',
    pattern: /curl\s+.*\|\s*(ba)?sh/i,
    message: 'Dangerous pattern: piping curl to shell',
    severity: 'warn',
  },
  {
    id: 'disable-security',
    pattern: /disable\s+(security|verification|checks?|validation)/i,
    message: 'Suspicious instruction: asking to disable security features',
    severity: 'warn',
  },
  {
    id: 'exfiltrate',
    pattern: /exfiltrat|send\s+(to|data|code)\s+(external|remote|server)/i,
    message: 'Suspicious instruction: potential data exfiltration',
    severity: 'error',
  },
  {
    id: 'base64-obfuscation',
    pattern: /base64\s+(decode|encode|eval)|atob\s*\(|eval\s*\(\s*atob/i,
    message: 'Suspicious pattern: base64 encoding may be used to obfuscate malicious instructions',
    severity: 'warn',
  },
  {
    id: 'override-instructions',
    pattern: /override\s+(system|safety|security)\s+(prompt|instructions|rules|guardrails)/i,
    message: 'Prompt injection attempt: overriding system instructions',
    severity: 'error',
  },
  {
    id: 'mcp-tool-abuse',
    pattern: /use_mcp_tool\s+to\s+(delete|destroy|drop|remove\s+all|wipe)/i,
    message: 'Suspicious instruction: destructive MCP tool usage',
    severity: 'error',
  },
  {
    id: 'webhook-exfil',
    pattern: /send\s+.*(webhook|slack|discord|telegram)|post\s+.*(to|data).*(http|url)/i,
    message: 'Suspicious instruction: sending data to external webhooks',
    severity: 'warn',
  },
  {
    id: 'new-identity',
    pattern: /you\s+are\s+(now|no\s+longer)|forget\s+(you|your|that\s+you)\s+are/i,
    message: 'Prompt injection attempt: identity override',
    severity: 'error',
  },
  {
    id: 'hidden-instructions',
    pattern: /<!--\s*(ignore|override|system|inject|secret)/i,
    message: 'Suspicious pattern: instructions hidden in HTML comments',
    severity: 'error',
  },
];

function loadIgnoredRules(ignorePath: string): Set<string> {
  if (!fs.existsSync(ignorePath)) {
    return new Set();
  }
  const content = fs.readFileSync(ignorePath, 'utf-8');
  return new Set(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#')),
  );
}

export function runSafetyCheck(path: string, ignorePath = '.aikignore'): SafetyResult {
  const findings: SafetyFinding[] = [];

  if (!fs.existsSync(path)) {
    return { passed: true, findings: [] };
  }

  const ignored = loadIgnoredRules(ignorePath);
  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of SAFETY_RULES) {
      if (ignored.has(rule.id)) continue;
      if (rule.pattern.test(line)) {
        findings.push({
          ruleId: rule.id,
          message: rule.message,
          line: i + 1,
          severity: rule.severity,
        });
      }
    }
  }

  const hasErrors = findings.some((f) => f.severity === 'error');

  return {
    passed: !hasErrors,
    findings,
  };
}

export function getSafetyRules(): SafetyRule[] {
  return SAFETY_RULES;
}
