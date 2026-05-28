export interface Config {
  mode: 'check' | 'safety' | 'all';
  template: 'minimal' | 'opinionated';
  failOnSafety: boolean;
  agentsPath: string;
  claudePath: string;
  geminiPath: string;
  // Diff-aware safety: when enabled, safety findings are filtered to lines
  // changed in the current git diff. Default 'off' (scan whole file).
  diffMode?: 'off' | 'force';
}

// A contiguous run of changed lines in a file, derived from `git diff` output.
// `startLine`/`endLine` are 1-based and inclusive, in the new (post-image) file.
export interface ParsedDiffRange {
  file: string;
  startLine: number;
  endLine: number;
}

export interface CrossFileIssue {
  type: 'contradiction' | 'duplication' | 'missing-reference';
  files: string[];
  message: string;
  severity: 'warn' | 'error';
}

export interface CrossFileConsistencyResult {
  passed: boolean;
  issues: CrossFileIssue[];
}

export interface CheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  // Suggested Claude Code hooks derived from the Verification section. Optional
  // so existing consumers of CheckResult are unaffected; only populated for the
  // primary AGENTS.md check.
  hookSuggestions?: HookSuggestion[];
}

// A suggested Claude Code hook (.claude/settings.json) derived from a verifiable
// command documented in the AGENTS.md Verification section.
export interface HookSuggestion {
  hookType: string;
  command: string;
  description: string;
}

// Optional AGENTS.md v1.1 YAML frontmatter. All fields are optional.
export interface Frontmatter {
  description?: string;
  tags?: string[];
  raw?: string;
}

export interface CheckAgentsOptions {
  // Number of AGENTS.md files present in the project. When greater than 1
  // (a monorepo), a missing frontmatter block is surfaced as a warning so the
  // various AGENTS.md files can be told apart. Defaults to 1.
  agentsFileCount?: number;
  // Optional line-length thresholds from .aikconfig.json. When omitted the
  // built-in defaults (150 / 300) apply, keeping behavior unchanged.
  lineWarnThreshold?: number;
  lineErrorThreshold?: number;
}

export interface SafetyRule {
  id: string;
  pattern: RegExp;
  message: string;
  severity: 'warn' | 'error';
}

export interface SafetyResult {
  passed: boolean;
  findings: SafetyFinding[];
}

export interface SafetyFinding {
  ruleId: string;
  message: string;
  line: number;
  severity: 'warn' | 'error';
}

export interface TokenBudgetInfo {
  estimatedTokens: number;
  percentOfWindow: number;
  isWarning: boolean;
}

export interface WatchConfig {
  agentsPath: string;
  claudePath: string;
  debounceMs: number;
}

export type BadgeFormat = 'markdown' | 'svg';

export interface BadgeOptions {
  output?: string;
  format?: BadgeFormat;
}

// ---------------------------------------------------------------------------
// .aikconfig.json — optional, backward-compatible rule customization.
//
// AIKConfig is distinct from `Config` (the GitHub Action input shape above):
// `Config` describes how a run is invoked, AIKConfig describes how rules are
// tuned. When .aikconfig.json is absent, an empty AIKConfig ({}) is used and
// every consumer falls back to its built-in defaults — behavior is unchanged.
// ---------------------------------------------------------------------------

// A severity level a built-in safety rule can be overridden to. 'off'
// suppresses the rule entirely (like listing it in .aikignore).
export type SafetySeverityOverride = 'warn' | 'error' | 'off';

// A user-defined safety rule. `pattern` is a string compiled to a
// case-insensitive RegExp at load time (invalid patterns are skipped with a
// warning). `severity` defaults to 'warn' when omitted.
export interface CustomSafetyRule {
  id: string;
  pattern: string;
  message: string;
  severity?: 'warn' | 'error';
}

export interface AIKSafetyConfig {
  // Map of built-in rule id -> override severity. Use 'off' to disable a rule.
  severityOverrides?: Record<string, SafetySeverityOverride>;
  // Additional user-defined rules applied alongside the built-in rules.
  customRules?: CustomSafetyRule[];
  // Rule ids to suppress, equivalent to entries in .aikignore (merged with it).
  ignoreRules?: string[];
}

export interface AIKCheckConfig {
  // Override the built-in AGENTS.md line-length thresholds (150 / 300).
  lineWarnThreshold?: number;
  lineErrorThreshold?: number;
}

export interface AIKConfig {
  check?: AIKCheckConfig;
  safety?: AIKSafetyConfig;
}

// Result of loading .aikconfig.json. `warnings` surfaces validation issues
// (invalid JSON, unknown keys, bad severities, uncompilable patterns) so the
// CLI/Action can report them without throwing. `config` is always usable —
// invalid pieces are dropped, so an empty/missing file yields {}.
export interface AIKConfigResult {
  config: AIKConfig;
  warnings: string[];
}
