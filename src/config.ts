import * as fs from 'fs';
import type {
  AIKConfig,
  AIKConfigResult,
  AIKCheckConfig,
  AIKSafetyConfig,
  CustomSafetyRule,
  SafetySeverityOverride,
} from './types.js';

const DEFAULT_CONFIG_PATH = '.aikconfig.json';

// Keys we recognize at each level. Anything else is reported as an unknown key
// (likely a typo) so users get fast feedback without a hard failure.
const ROOT_KEYS = new Set(['check', 'safety']);
const CHECK_KEYS = new Set(['lineWarnThreshold', 'lineErrorThreshold']);
const SAFETY_KEYS = new Set(['severityOverrides', 'customRules', 'ignoreRules']);
const CUSTOM_RULE_KEYS = new Set(['id', 'pattern', 'message', 'severity']);

const VALID_OVERRIDES = new Set<SafetySeverityOverride>(['warn', 'error', 'off']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Compile a user-supplied pattern to a case-insensitive RegExp, mirroring the
// built-in safety rules (most of which use the `i` flag). Returns null and a
// warning when the pattern does not compile. We also guard against catastrophic
// compile times (a coarse ReDoS smoke test): if compilation takes >100ms the
// rule is rejected. Compilation alone is cheap; this mainly trips on
// pathologically large patterns.
export function compileCustomPattern(
  rule: CustomSafetyRule,
  warnings: string[],
): RegExp | null {
  if (typeof rule.pattern !== 'string' || rule.pattern.length === 0) {
    warnings.push(`Custom rule "${rule.id ?? '(no id)'}" has no valid "pattern" string — skipped`);
    return null;
  }
  const start = Date.now();
  try {
    const re = new RegExp(rule.pattern, 'i');
    const elapsed = Date.now() - start;
    if (elapsed > 100) {
      warnings.push(
        `Custom rule "${rule.id}" pattern took ${elapsed}ms to compile — possible ReDoS, skipped`,
      );
      return null;
    }
    return re;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Custom rule "${rule.id ?? '(no id)'}" has an invalid regex pattern (${msg}) — skipped`);
    return null;
  }
}

function validateCheck(raw: Record<string, unknown>, warnings: string[]): AIKCheckConfig {
  const check: AIKCheckConfig = {};
  for (const key of Object.keys(raw)) {
    if (!CHECK_KEYS.has(key)) {
      warnings.push(`Unknown config key "check.${key}" — ignored`);
    }
  }

  const warn = raw.lineWarnThreshold;
  if (warn !== undefined) {
    if (typeof warn === 'number' && Number.isFinite(warn) && warn > 0) {
      check.lineWarnThreshold = warn;
    } else {
      warnings.push('"check.lineWarnThreshold" must be a positive number — ignored');
    }
  }

  const error = raw.lineErrorThreshold;
  if (error !== undefined) {
    if (typeof error === 'number' && Number.isFinite(error) && error > 0) {
      check.lineErrorThreshold = error;
    } else {
      warnings.push('"check.lineErrorThreshold" must be a positive number — ignored');
    }
  }

  if (
    check.lineWarnThreshold !== undefined &&
    check.lineErrorThreshold !== undefined &&
    check.lineWarnThreshold > check.lineErrorThreshold
  ) {
    warnings.push(
      '"check.lineWarnThreshold" is greater than "check.lineErrorThreshold" — the warn threshold will never trigger',
    );
  }

  return check;
}

function validateSafety(raw: Record<string, unknown>, warnings: string[]): AIKSafetyConfig {
  const safety: AIKSafetyConfig = {};
  for (const key of Object.keys(raw)) {
    if (!SAFETY_KEYS.has(key)) {
      warnings.push(`Unknown config key "safety.${key}" — ignored`);
    }
  }

  if (raw.severityOverrides !== undefined) {
    if (isPlainObject(raw.severityOverrides)) {
      const overrides: Record<string, SafetySeverityOverride> = {};
      for (const [ruleId, value] of Object.entries(raw.severityOverrides)) {
        if (typeof value === 'string' && VALID_OVERRIDES.has(value as SafetySeverityOverride)) {
          overrides[ruleId] = value as SafetySeverityOverride;
        } else {
          warnings.push(
            `"safety.severityOverrides.${ruleId}" must be one of warn|error|off — ignored`,
          );
        }
      }
      if (Object.keys(overrides).length > 0) safety.severityOverrides = overrides;
    } else {
      warnings.push('"safety.severityOverrides" must be an object — ignored');
    }
  }

  if (raw.ignoreRules !== undefined) {
    if (Array.isArray(raw.ignoreRules) && raw.ignoreRules.every((r) => typeof r === 'string')) {
      safety.ignoreRules = raw.ignoreRules as string[];
    } else {
      warnings.push('"safety.ignoreRules" must be an array of strings — ignored');
    }
  }

  if (raw.customRules !== undefined) {
    if (Array.isArray(raw.customRules)) {
      const rules: CustomSafetyRule[] = [];
      const seen = new Set<string>();
      for (const entry of raw.customRules) {
        if (!isPlainObject(entry)) {
          warnings.push('"safety.customRules" entries must be objects — skipped one entry');
          continue;
        }
        for (const key of Object.keys(entry)) {
          if (!CUSTOM_RULE_KEYS.has(key)) {
            warnings.push(`Unknown config key "safety.customRules[].${key}" — ignored`);
          }
        }
        const id = entry.id;
        const pattern = entry.pattern;
        const message = entry.message;
        if (typeof id !== 'string' || id.length === 0) {
          warnings.push('A custom rule is missing a string "id" — skipped');
          continue;
        }
        if (typeof pattern !== 'string' || pattern.length === 0) {
          warnings.push(`Custom rule "${id}" is missing a string "pattern" — skipped`);
          continue;
        }
        if (typeof message !== 'string' || message.length === 0) {
          warnings.push(`Custom rule "${id}" is missing a string "message" — skipped`);
          continue;
        }
        if (seen.has(id)) {
          warnings.push(`Duplicate custom rule id "${id}" — only the first is used`);
          continue;
        }
        let severity: 'warn' | 'error' = 'warn';
        if (entry.severity !== undefined) {
          if (entry.severity === 'warn' || entry.severity === 'error') {
            severity = entry.severity;
          } else {
            warnings.push(`Custom rule "${id}" has invalid severity — defaulting to "warn"`);
          }
        }
        seen.add(id);
        rules.push({ id, pattern, message, severity });
      }
      if (rules.length > 0) safety.customRules = rules;
    } else {
      warnings.push('"safety.customRules" must be an array — ignored');
    }
  }

  return safety;
}

// Load and validate .aikconfig.json. Always returns a usable AIKConfig:
// - File absent          -> {} (every consumer falls back to defaults)
// - Invalid JSON         -> {} plus a warning (never throws)
// - Unknown/invalid keys -> dropped, each reported as a warning
export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): AIKConfigResult {
  const warnings: string[] = [];

  if (!fs.existsSync(configPath)) {
    return { config: {}, warnings };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`${configPath} is not valid JSON (${msg}) — ignoring config and using defaults`);
    return { config: {}, warnings };
  }

  if (!isPlainObject(parsed)) {
    warnings.push(`${configPath} must contain a JSON object — ignoring config and using defaults`);
    return { config: {}, warnings };
  }

  for (const key of Object.keys(parsed)) {
    if (!ROOT_KEYS.has(key)) {
      warnings.push(`Unknown config key "${key}" — ignored`);
    }
  }

  const config: AIKConfig = {};

  if (parsed.check !== undefined) {
    if (isPlainObject(parsed.check)) {
      config.check = validateCheck(parsed.check, warnings);
    } else {
      warnings.push('"check" must be an object — ignored');
    }
  }

  if (parsed.safety !== undefined) {
    if (isPlainObject(parsed.safety)) {
      config.safety = validateSafety(parsed.safety, warnings);
    } else {
      warnings.push('"safety" must be an object — ignored');
    }
  }

  return { config, warnings };
}
