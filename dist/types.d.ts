export interface Config {
    mode: 'check' | 'safety' | 'all';
    template: 'minimal' | 'opinionated';
    failOnSafety: boolean;
    agentsPath: string;
    claudePath: string;
    geminiPath: string;
    diffMode?: 'off' | 'force';
}
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
    hookSuggestions?: HookSuggestion[];
}
export interface HookSuggestion {
    hookType: string;
    command: string;
    description: string;
}
export interface Frontmatter {
    description?: string;
    tags?: string[];
    raw?: string;
}
export interface CheckAgentsOptions {
    agentsFileCount?: number;
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
export type SafetySeverityOverride = 'warn' | 'error' | 'off';
export interface CustomSafetyRule {
    id: string;
    pattern: string;
    message: string;
    severity?: 'warn' | 'error';
}
export interface AIKSafetyConfig {
    severityOverrides?: Record<string, SafetySeverityOverride>;
    customRules?: CustomSafetyRule[];
    ignoreRules?: string[];
}
export interface AIKCheckConfig {
    lineWarnThreshold?: number;
    lineErrorThreshold?: number;
}
export interface AIKConfig {
    check?: AIKCheckConfig;
    safety?: AIKSafetyConfig;
}
export interface AIKConfigResult {
    config: AIKConfig;
    warnings: string[];
}
