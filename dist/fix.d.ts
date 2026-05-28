export type FixType = 'add-section' | 'redact-secret' | 'replace-hedge' | 'add-agents-reference';
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
interface FileFix {
    content: string;
    actions: FixAction[];
}
export declare function fixAgentsContent(content: string, filePath: string): FileFix;
export declare function fixClaudeContent(content: string, filePath: string): FileFix;
export declare function redactSecrets(content: string, filePath: string): FileFix;
export declare function replaceHedgeWords(content: string, filePath: string): FileFix;
export declare function addMissingRequiredSections(content: string, filePath: string): FileFix;
export declare function addAgentsReference(content: string, filePath: string): FileFix;
export interface RunFixOptions {
    agentsPath: string;
    claudePath: string;
    dryRun: boolean;
}
export declare function runFix(options: RunFixOptions): FixReport;
export {};
