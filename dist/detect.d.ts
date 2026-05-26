export interface ProjectInfo {
    language: string;
    framework: string;
    commands: {
        install: string;
        typecheck?: string;
        lint?: string;
        test: string;
        build?: string;
    };
    structure?: string;
}
export declare function detectProject(dir?: string): ProjectInfo | null;
export declare function renderTemplate(base: string, info: ProjectInfo): string;
