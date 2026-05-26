export interface Config {
    mode: 'check' | 'safety' | 'all';
    template: 'minimal' | 'opinionated';
    failOnSafety: boolean;
    agentsPath: string;
    claudePath: string;
}
export interface CheckResult {
    passed: boolean;
    errors: string[];
    warnings: string[];
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
