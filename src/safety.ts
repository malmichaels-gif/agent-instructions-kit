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
];

export function runSafetyCheck(path: string): SafetyResult {
  const findings: SafetyFinding[] = [];

  if (!fs.existsSync(path)) {
    return { passed: true, findings: [] };
  }

  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of SAFETY_RULES) {
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
