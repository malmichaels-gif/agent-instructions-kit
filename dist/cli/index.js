#!/usr/bin/env node
require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 883:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.checkAgentsFile = checkAgentsFile;
exports.checkClaudeFile = checkClaudeFile;
exports.checkGeminiFile = checkGeminiFile;
exports.checkCrossFileConsistency = checkCrossFileConsistency;
const fs = __importStar(__nccwpck_require__(896));
const path = __importStar(__nccwpck_require__(928));
const frontmatter_js_1 = __nccwpck_require__(593);
const hooks_js_1 = __nccwpck_require__(987);
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
function checkAgentsFile(filePath, options = {}) {
    const errors = [];
    const warnings = [];
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
    const fileHasFrontmatter = (0, frontmatter_js_1.hasFrontmatter)(rawContent);
    if (fileHasFrontmatter) {
        const fm = (0, frontmatter_js_1.parseFrontmatter)(rawContent);
        if (!fm.success) {
            warnings.push(`Frontmatter could not be parsed: ${fm.error ?? 'malformed YAML'}`);
        }
        else if (fm.data) {
            warnings.push(...(0, frontmatter_js_1.validateFrontmatter)(fm.data));
        }
    }
    else if ((options.agentsFileCount ?? 1) > 1) {
        // Monorepos with multiple AGENTS.md files benefit from frontmatter
        // (description/tags) so the files can be distinguished. Recommended, not required.
        warnings.push('Multiple AGENTS.md files detected but this one has no frontmatter — add a "description" to distinguish it (optional, recommended for monorepos)');
    }
    const content = (0, frontmatter_js_1.stripFrontmatter)(rawContent);
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
    }
    else if (lineCount > lineWarnThreshold) {
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
    const hookSuggestions = (0, hooks_js_1.suggestHooks)(content);
    return {
        passed: errors.length === 0,
        errors,
        warnings,
        hookSuggestions,
    };
}
function checkClaudeFile(filePath, agentsPath) {
    return checkDeferringFile(filePath, agentsPath, 'CLAUDE.md');
}
function checkGeminiFile(filePath, agentsPath) {
    return checkDeferringFile(filePath, agentsPath, 'GEMINI.md');
}
// Shared validation for thin instruction files (CLAUDE.md, GEMINI.md) that are
// expected to defer to AGENTS.md. They should reference AGENTS.md and must not
// contradict it.
function checkDeferringFile(filePath, agentsPath, label) {
    const errors = [];
    const warnings = [];
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
function checkCrossFileConsistency(agentsPath, claudePath, geminiPath) {
    const issues = [];
    const files = [];
    for (const [name, p] of [
        ['AGENTS.md', agentsPath],
        ['CLAUDE.md', claudePath],
        ['GEMINI.md', geminiPath],
    ]) {
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
                if (!match)
                    continue;
                const aBody = getSectionBody(a.content, heading);
                const bBody = getSectionBody(b.content, match);
                if (!aBody || !bBody)
                    continue;
                if (hasContradiction(aBody, bBody)) {
                    issues.push({
                        type: 'contradiction',
                        files: [a.name, b.name],
                        message: `Section "${heading}" may contradict between ${a.name} and ${b.name} — review for consistency`,
                        severity: 'warn',
                    });
                }
                else if (normalizeBody(aBody) === normalizeBody(bBody)) {
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
function normalizeBody(body) {
    return body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .join('\n');
}
function splitSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentHeading = '';
    let bodyLines = [];
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
        }
        else if (currentHeading) {
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
function extractHeadings(content) {
    const headings = [];
    for (const line of content.split('\n')) {
        const match = line.match(/^##\s+(.+)/);
        if (match)
            headings.push(match[1]);
    }
    return headings;
}
function getSectionBody(content, heading) {
    const sections = splitSections(content);
    const section = sections.find((s) => s.heading.toLowerCase() === heading.toLowerCase());
    return section ? section.body.trim() : null;
}
function hasContradiction(bodyA, bodyB) {
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const wordsA = new Set(normalize(bodyA));
    const wordsB = new Set(normalize(bodyB));
    const opposites = [
        ['always', 'never'],
        ['allow', 'forbid'],
        ['allow', 'prohibited'],
        ['enable', 'disable'],
        ['require', 'optional'],
    ];
    for (const [a, b] of opposites) {
        if ((wordsA.has(a) && wordsB.has(b)) || (wordsA.has(b) && wordsB.has(a)))
            return true;
    }
    return false;
}
const NPM_SCRIPT_PATTERN = /npm\s+(run\s+)?(\w[\w-]*)/g;
function validateCommands(content, dir) {
    const broken = [];
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const scripts = pkg.scripts || {};
            const builtins = new Set(['test', 'start', 'install', 'publish', 'pack', 'init', 'version']);
            for (const match of content.matchAll(NPM_SCRIPT_PATTERN)) {
                const hasRun = !!match[1];
                const script = match[2];
                if (builtins.has(script))
                    continue;
                if (!scripts[script]) {
                    broken.push(hasRun ? `npm run ${script}` : `npm ${script}`);
                }
            }
        }
        catch {
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


/***/ }),

/***/ 581:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
const fs = __importStar(__nccwpck_require__(896));
const check_js_1 = __nccwpck_require__(883);
const safety_js_1 = __nccwpck_require__(617);
const templates_js_1 = __nccwpck_require__(340);
const detect_js_1 = __nccwpck_require__(52);
const score_js_1 = __nccwpck_require__(9);
const discover_js_1 = __nccwpck_require__(164);
const fix_js_1 = __nccwpck_require__(748);
const watch_js_1 = __nccwpck_require__(344);
const diff_js_1 = __nccwpck_require__(952);
const hooks_js_1 = __nccwpck_require__(987);
const config_js_1 = __nccwpck_require__(973);
function hasFlag(args, flag) {
    return args.includes(flag);
}
function getArg(args, flag, fallback) {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length)
        return fallback;
    const value = args[idx + 1];
    if (value.startsWith('-'))
        return fallback;
    return value;
}
// Surface .aikconfig.json validation warnings (invalid JSON, unknown keys,
// bad severities, uncompilable patterns) without failing the command. Skipped
// in JSON/badge output modes to keep machine-readable output clean.
function reportConfigWarnings(warnings) {
    for (const warning of warnings) {
        console.warn(`  CONFIG: ${warning}`);
    }
}
function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    if (!command || command === '--help' || command === '-h') {
        printHelp();
        process.exit(0);
    }
    const subArgs = args.slice(1);
    switch (command) {
        case 'init':
            runInit(subArgs);
            break;
        case 'check':
            runCheck(subArgs);
            break;
        case 'safety':
            runSafety(subArgs);
            break;
        case 'score':
            runScore(subArgs);
            break;
        case 'fix':
            runFixCommand(subArgs);
            break;
        case 'watch':
            runWatch(subArgs);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            printHelp();
            process.exit(1);
    }
}
function runInit(args) {
    let template = 'minimal';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--template' || args[i] === '-t') {
            const t = args[i + 1];
            if (t === 'minimal' || t === 'opinionated') {
                template = t;
            }
            else {
                console.error(`Invalid template: ${t}. Use 'minimal' or 'opinionated'.`);
                process.exit(1);
            }
            i++;
        }
    }
    const agentsPath = 'AGENTS.md';
    const claudePath = 'CLAUDE.md';
    const geminiPath = 'GEMINI.md';
    if (fs.existsSync(agentsPath)) {
        console.error(`${agentsPath} already exists. Remove it first or edit manually.`);
        process.exit(1);
    }
    if (fs.existsSync(claudePath)) {
        console.error(`${claudePath} already exists. Remove it first or edit manually.`);
        process.exit(1);
    }
    if (fs.existsSync(geminiPath)) {
        console.error(`${geminiPath} already exists. Remove it first or edit manually.`);
        process.exit(1);
    }
    let content = (0, templates_js_1.getTemplate)(template);
    const detected = (0, detect_js_1.detectProject)('.');
    if (detected) {
        content = (0, detect_js_1.renderTemplate)(content, detected);
        console.log(`Detected ${detected.language} / ${detected.framework} project`);
    }
    fs.writeFileSync(agentsPath, content);
    fs.writeFileSync(claudePath, templates_js_1.CLAUDE_TEMPLATE);
    fs.writeFileSync(geminiPath, templates_js_1.GEMINI_TEMPLATE);
    console.log(`Created ${agentsPath} (${template} template)`);
    console.log(`Created ${claudePath}`);
    console.log(`Created ${geminiPath}`);
    if (!detected) {
        console.log('\nNext steps:');
        console.log('1. Edit AGENTS.md with your project-specific instructions');
        console.log('2. Commit all three files to your repo');
    }
    else {
        console.log('\nStack auto-detected — review the generated AGENTS.md and adjust as needed.');
    }
}
function runCheck(args) {
    const json = hasFlag(args, '--json');
    const agentsPath = getArg(args, '--agents', 'AGENTS.md');
    const claudePath = getArg(args, '--claude', 'CLAUDE.md');
    const geminiPath = getArg(args, '--gemini', 'GEMINI.md');
    const { config, warnings: configWarnings } = (0, config_js_1.loadConfig)();
    if (!json)
        reportConfigWarnings(configWarnings);
    const agentsFileCount = (0, discover_js_1.discoverAgentsFiles)('.').length;
    const agentsResult = (0, check_js_1.checkAgentsFile)(agentsPath, {
        agentsFileCount,
        lineWarnThreshold: config.check?.lineWarnThreshold,
        lineErrorThreshold: config.check?.lineErrorThreshold,
    });
    const claudeResult = (0, check_js_1.checkClaudeFile)(claudePath, agentsPath);
    // GEMINI.md is optional — only validate it when the file is present.
    const geminiExists = fs.existsSync(geminiPath);
    const geminiResult = geminiExists ? (0, check_js_1.checkGeminiFile)(geminiPath, agentsPath) : null;
    const consistencyResult = (0, check_js_1.checkCrossFileConsistency)(agentsPath, claudePath, geminiPath);
    const passed = agentsResult.passed && claudeResult.passed && (geminiResult ? geminiResult.passed : true);
    if (json) {
        console.log(JSON.stringify({
            agents: { path: agentsPath, ...agentsResult },
            claude: { path: claudePath, ...claudeResult },
            gemini: geminiResult ? { path: geminiPath, ...geminiResult } : null,
            consistency: consistencyResult,
            passed,
        }, null, 2));
        process.exit(passed ? 0 : 1);
        return;
    }
    console.log(`Checking ${agentsPath}...`);
    for (const error of agentsResult.errors)
        console.error(`  ERROR: ${error}`);
    for (const warning of agentsResult.warnings)
        console.warn(`  WARN: ${warning}`);
    console.log(`Checking ${claudePath}...`);
    for (const error of claudeResult.errors)
        console.error(`  ERROR: ${error}`);
    for (const warning of claudeResult.warnings)
        console.warn(`  WARN: ${warning}`);
    if (geminiResult) {
        console.log(`Checking ${geminiPath}...`);
        for (const error of geminiResult.errors)
            console.error(`  ERROR: ${error}`);
        for (const warning of geminiResult.warnings)
            console.warn(`  WARN: ${warning}`);
    }
    if (consistencyResult.issues.length > 0) {
        console.log('Cross-file consistency...');
        for (const issue of consistencyResult.issues) {
            const prefix = issue.severity === 'error' ? 'ERROR' : 'WARN';
            console.warn(`  ${prefix} [${issue.type}] ${issue.message}`);
        }
    }
    const hookSuggestions = agentsResult.hookSuggestions ?? [];
    if (hookSuggestions.length > 0) {
        console.log('\nClaude Code hook suggestions (from your Verification section):');
        for (const suggestion of hookSuggestions) {
            console.log(`  - [${suggestion.hookType}] ${suggestion.description}`);
        }
        const settings = (0, hooks_js_1.renderHookSettings)(hookSuggestions);
        if (settings) {
            console.log('\n  Add to .claude/settings.json:');
            for (const line of settings.split('\n')) {
                console.log(`    ${line}`);
            }
        }
    }
    if (passed) {
        console.log('\nAll checks passed!');
        process.exit(0);
    }
    else {
        console.log('\nCheck failed.');
        process.exit(1);
    }
}
function runSafety(args) {
    const json = hasFlag(args, '--json');
    const failOnSafety = hasFlag(args, '--fail');
    const agentsPath = getArg(args, '--agents', 'AGENTS.md');
    const discover = hasFlag(args, '--discover');
    const diffMode = hasFlag(args, '--diff') || hasFlag(args, '--changed-only');
    const claudePath = getArg(args, '--claude', 'CLAUDE.md');
    const { config, warnings: configWarnings } = (0, config_js_1.loadConfig)();
    if (!json)
        reportConfigWarnings(configWarnings);
    const safetyConfig = config.safety;
    const discovered = discover ? (0, discover_js_1.discoverFiles)('.') : [];
    if (discover && fs.existsSync(claudePath))
        discovered.unshift(claudePath);
    const files = [agentsPath, ...discovered];
    // Diff-aware mode: read the current git diff once and filter findings to
    // changed lines. Degrade gracefully (warn + scan whole file) when git is
    // unavailable or the directory is not a repository.
    let diffResult = null;
    if (diffMode) {
        diffResult = (0, diff_js_1.getGitDiff)('.');
        if (diffResult.error && !json) {
            console.warn(`  WARN: --diff disabled: ${diffResult.error}. Scanning full files.`);
        }
    }
    const allResults = {};
    for (const file of files) {
        const changedLines = diffResult && !diffResult.error
            ? (0, diff_js_1.changedLinesForFile)(diffResult.ranges, file)
            : undefined;
        allResults[file] = (0, safety_js_1.runSafetyCheck)(file, '.aikignore', changedLines, safetyConfig);
    }
    if (json) {
        const anyFailed = Object.values(allResults).some((r) => !r.passed);
        console.log(JSON.stringify({
            files: allResults,
            passed: !anyFailed,
        }, null, 2));
        process.exit(anyFailed && failOnSafety ? 1 : 0);
        return;
    }
    let totalFindings = 0;
    let anyFailed = false;
    for (const [file, result] of Object.entries(allResults)) {
        console.log(`Running safety check on ${file}...`);
        if (result.findings.length === 0) {
            console.log('  No safety issues found.');
            continue;
        }
        for (const finding of result.findings) {
            const prefix = finding.severity === 'error' ? 'ERROR' : 'WARN';
            console.log(`  ${prefix} [${finding.ruleId}] Line ${finding.line}: ${finding.message}`);
        }
        totalFindings += result.findings.length;
        if (!result.passed)
            anyFailed = true;
    }
    if (totalFindings === 0) {
        console.log('No safety issues found.');
        process.exit(0);
    }
    if (anyFailed && failOnSafety) {
        console.log('\nSafety check failed.');
        process.exit(1);
    }
    else {
        console.log(`\n${totalFindings} finding(s).`);
        process.exit(0);
    }
}
function runScore(args) {
    const json = hasFlag(args, '--json');
    const badge = hasFlag(args, '--badge');
    const badgeOutput = getArg(args, '--badge-output', '');
    const badgeFormatArg = getArg(args, '--badge-format', 'markdown');
    const agentsPath = getArg(args, '--agents', 'AGENTS.md');
    const claudePath = getArg(args, '--claude', 'CLAUDE.md');
    const geminiPath = getArg(args, '--gemini', 'GEMINI.md');
    if (badgeFormatArg !== 'markdown' && badgeFormatArg !== 'svg') {
        console.error(`Invalid badge format: ${badgeFormatArg}. Use 'markdown' or 'svg'.`);
        process.exit(1);
    }
    const badgeFormat = badgeFormatArg;
    const { config, warnings: configWarnings } = (0, config_js_1.loadConfig)();
    if (!json && !badge)
        reportConfigWarnings(configWarnings);
    const agentsFileCount = (0, discover_js_1.discoverAgentsFiles)('.').length;
    const agentsResult = (0, check_js_1.checkAgentsFile)(agentsPath, {
        agentsFileCount,
        lineWarnThreshold: config.check?.lineWarnThreshold,
        lineErrorThreshold: config.check?.lineErrorThreshold,
    });
    const claudeResult = (0, check_js_1.checkClaudeFile)(claudePath, agentsPath);
    const geminiResult = fs.existsSync(geminiPath) ? (0, check_js_1.checkGeminiFile)(geminiPath, agentsPath) : null;
    const consistencyResult = (0, check_js_1.checkCrossFileConsistency)(agentsPath, claudePath, geminiPath);
    const safetyResult = (0, safety_js_1.runSafetyCheck)(agentsPath, '.aikignore', undefined, config.safety);
    let sourceText = '';
    if (fs.existsSync(agentsPath))
        sourceText += fs.readFileSync(agentsPath, 'utf8');
    if (fs.existsSync(claudePath))
        sourceText += fs.readFileSync(claudePath, 'utf8');
    if (fs.existsSync(geminiPath))
        sourceText += fs.readFileSync(geminiPath, 'utf8');
    const result = (0, score_js_1.computeScore)(agentsResult, claudeResult, safetyResult, sourceText, geminiResult, consistencyResult);
    const badgeText = badge ? (0, score_js_1.generateBadge)(result.grade, badgeFormat) : undefined;
    if (badgeText !== undefined && badgeOutput) {
        fs.writeFileSync(badgeOutput, badgeText);
    }
    if (json) {
        const payload = badgeText !== undefined
            ? { ...result, badge: badgeText, badgeFormat }
            : result;
        console.log(JSON.stringify(payload, null, 2));
        process.exit(0);
        return;
    }
    if (badgeText !== undefined) {
        console.log(badgeText);
        if (badgeOutput)
            console.log(`\nBadge written to ${badgeOutput}`);
        process.exit(0);
        return;
    }
    console.log(`\nGrade: ${result.grade}  (${result.score}/100)`);
    console.log('');
    for (const [category, points] of Object.entries(result.breakdown)) {
        console.log(`  ${category}: ${points}`);
    }
    if (result.tokenBudget) {
        const tb = result.tokenBudget;
        const tokens = tb.estimatedTokens.toLocaleString('en-US');
        const warn = tb.isWarning ? '  WARN: exceeds 5% of context window' : '';
        console.log('');
        console.log(`Token budget: ~${tokens} tokens (${tb.percentOfWindow.toFixed(1)}% of 100k window)${warn}`);
    }
    if (result.suggestions.length > 0) {
        console.log('\nSuggestions:');
        for (const suggestion of result.suggestions) {
            console.log(`  - ${suggestion}`);
        }
    }
    console.log('');
}
function runFixCommand(args) {
    const json = hasFlag(args, '--json');
    const dryRun = hasFlag(args, '--dry-run');
    const agentsPath = getArg(args, '--agents', 'AGENTS.md');
    const claudePath = getArg(args, '--claude', 'CLAUDE.md');
    const report = (0, fix_js_1.runFix)({ agentsPath, claudePath, dryRun });
    if (json) {
        console.log(JSON.stringify(report, null, 2));
        process.exit(0);
        return;
    }
    if (report.applied.length === 0 && report.skipped.length === 0) {
        console.log('No auto-fixable issues found.');
        process.exit(0);
        return;
    }
    if (report.applied.length > 0) {
        const verb = dryRun ? 'Would fix' : 'Fixed';
        console.log(`${verb} ${report.applied.length} issue(s):`);
        for (const action of report.applied) {
            const loc = action.lineNumber !== null ? `Line ${action.lineNumber}` : 'end of file';
            console.log(`  [${action.type}] ${action.path} (${loc}): ${action.description}`);
        }
    }
    if (report.skipped.length > 0) {
        console.log(`\n${report.skipped.length} issue(s) need manual review (not auto-fixed):`);
        for (const action of report.skipped) {
            const loc = action.lineNumber !== null ? `Line ${action.lineNumber}` : 'end of file';
            console.log(`  [${action.type}] ${action.path} (${loc}): ${action.description}`);
        }
    }
    if (report.applied.length > 0) {
        if (dryRun) {
            console.log('\nDry run — no files were written. Re-run without --dry-run to apply.');
        }
        else {
            console.log('\nFiles updated. Review the changes and re-run `check` / `safety` to confirm.');
        }
    }
    process.exit(0);
}
function runWatch(args) {
    const agentsPath = getArg(args, '--agents', 'AGENTS.md');
    const claudePath = getArg(args, '--claude', 'CLAUDE.md');
    const debounceArg = getArg(args, '--debounce', '300');
    const debounceMs = Number.parseInt(debounceArg, 10);
    if (!Number.isFinite(debounceMs) || debounceMs < 0) {
        console.error(`Invalid debounce value: ${debounceArg}. Use a non-negative integer (milliseconds).`);
        process.exit(1);
    }
    if (!fs.existsSync(agentsPath) && !fs.existsSync(claudePath)) {
        console.error(`Nothing to watch — neither ${agentsPath} nor ${claudePath} exists.`);
        process.exit(1);
    }
    const config = { agentsPath, claudePath, debounceMs };
    // Print an initial score so the author has a baseline before editing.
    const initial = (0, watch_js_1.computeWatchScore)(config);
    console.log(`Watching ${agentsPath} and ${claudePath} for changes (debounce ${debounceMs}ms)...`);
    console.log(`Initial Grade: ${initial.grade} (${initial.score}/100)`);
    console.log('Press Ctrl+C to stop.\n');
    const handle = (0, watch_js_1.watchAgentsFile)(config, (changedPath) => {
        try {
            const result = (0, watch_js_1.computeWatchScore)(config);
            console.log((0, watch_js_1.formatWatchResult)(result, changedPath));
        }
        catch (err) {
            console.error(`  Re-score failed: ${err.message}`);
        }
    });
    // Clean up watchers + timers on Ctrl+C so we don't leave orphaned handles.
    const shutdown = () => {
        handle.close();
        console.log('\nStopped watching.');
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
function printHelp() {
    console.log(`
agent-instructions-kit

Commands:
  init      Generate AGENTS.md, CLAUDE.md, and GEMINI.md files
  check     Validate required sections + cross-file consistency
  safety    Check for suspicious/dangerous patterns
  score     Grade your instruction files (A-F)
  fix       Auto-fix common instruction file issues
  watch     Watch AGENTS.md for changes and re-score on save (development mode)

Options:
  init:
    -t, --template <name>   Template: minimal (default) or opinionated

  check:
    --agents <path>         Path to AGENTS.md (default: AGENTS.md)
    --claude <path>         Path to CLAUDE.md (default: CLAUDE.md)
    --gemini <path>         Path to GEMINI.md (default: GEMINI.md, optional)
    --json                  Output results as JSON

  safety:
    --agents <path>         Path to AGENTS.md (default: AGENTS.md)
    --diff                  Only report findings on lines changed in the current git diff
    --fail                  Exit with error code if issues found
    --json                  Output results as JSON
    --discover              Also scan other agent config files

  score:
    --agents <path>         Path to AGENTS.md (default: AGENTS.md)
    --claude <path>         Path to CLAUDE.md (default: CLAUDE.md)
    --gemini <path>         Path to GEMINI.md (default: GEMINI.md, optional)
    --json                  Output results as JSON
    --badge                 Output shields.io badge for the grade
    --badge-output <path>   Write badge to file
    --badge-format <format> Badge format: markdown (default) or svg

  fix:
    --agents <path>         Path to AGENTS.md (default: AGENTS.md)
    --claude <path>         Path to CLAUDE.md (default: CLAUDE.md)
    --dry-run               Preview changes without writing to disk
    --json                  Output the fix report as JSON

  watch:
    --agents <path>         Path to AGENTS.md (default: AGENTS.md)
    --claude <path>         Path to CLAUDE.md (default: CLAUDE.md)
    --debounce <ms>         Debounce file change events (default: 300)

Examples:
  npx agent-instructions-kit init
  npx agent-instructions-kit init --template opinionated
  npx agent-instructions-kit check
  npx agent-instructions-kit check --json
  npx agent-instructions-kit safety --fail
  npx agent-instructions-kit safety --diff --fail
  npx agent-instructions-kit safety --discover
  npx agent-instructions-kit score
  npx agent-instructions-kit score --badge
  npx agent-instructions-kit score --badge --badge-format svg --badge-output badge.svg
  npx agent-instructions-kit fix
  npx agent-instructions-kit fix --dry-run
  npx agent-instructions-kit watch
  npx agent-instructions-kit watch --debounce 500
`);
}
main();


/***/ }),

/***/ 973:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.compileCustomPattern = compileCustomPattern;
exports.loadConfig = loadConfig;
const fs = __importStar(__nccwpck_require__(896));
const DEFAULT_CONFIG_PATH = '.aikconfig.json';
// Keys we recognize at each level. Anything else is reported as an unknown key
// (likely a typo) so users get fast feedback without a hard failure.
const ROOT_KEYS = new Set(['check', 'safety']);
const CHECK_KEYS = new Set(['lineWarnThreshold', 'lineErrorThreshold']);
const SAFETY_KEYS = new Set(['severityOverrides', 'customRules', 'ignoreRules']);
const CUSTOM_RULE_KEYS = new Set(['id', 'pattern', 'message', 'severity']);
const VALID_OVERRIDES = new Set(['warn', 'error', 'off']);
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
// Compile a user-supplied pattern to a case-insensitive RegExp, mirroring the
// built-in safety rules (most of which use the `i` flag). Returns null and a
// warning when the pattern does not compile. We also guard against catastrophic
// compile times (a coarse ReDoS smoke test): if compilation takes >100ms the
// rule is rejected. Compilation alone is cheap; this mainly trips on
// pathologically large patterns.
function compileCustomPattern(rule, warnings) {
    if (typeof rule.pattern !== 'string' || rule.pattern.length === 0) {
        warnings.push(`Custom rule "${rule.id ?? '(no id)'}" has no valid "pattern" string — skipped`);
        return null;
    }
    const start = Date.now();
    try {
        const re = new RegExp(rule.pattern, 'i');
        const elapsed = Date.now() - start;
        if (elapsed > 100) {
            warnings.push(`Custom rule "${rule.id}" pattern took ${elapsed}ms to compile — possible ReDoS, skipped`);
            return null;
        }
        return re;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Custom rule "${rule.id ?? '(no id)'}" has an invalid regex pattern (${msg}) — skipped`);
        return null;
    }
}
function validateCheck(raw, warnings) {
    const check = {};
    for (const key of Object.keys(raw)) {
        if (!CHECK_KEYS.has(key)) {
            warnings.push(`Unknown config key "check.${key}" — ignored`);
        }
    }
    const warn = raw.lineWarnThreshold;
    if (warn !== undefined) {
        if (typeof warn === 'number' && Number.isFinite(warn) && warn > 0) {
            check.lineWarnThreshold = warn;
        }
        else {
            warnings.push('"check.lineWarnThreshold" must be a positive number — ignored');
        }
    }
    const error = raw.lineErrorThreshold;
    if (error !== undefined) {
        if (typeof error === 'number' && Number.isFinite(error) && error > 0) {
            check.lineErrorThreshold = error;
        }
        else {
            warnings.push('"check.lineErrorThreshold" must be a positive number — ignored');
        }
    }
    if (check.lineWarnThreshold !== undefined &&
        check.lineErrorThreshold !== undefined &&
        check.lineWarnThreshold > check.lineErrorThreshold) {
        warnings.push('"check.lineWarnThreshold" is greater than "check.lineErrorThreshold" — the warn threshold will never trigger');
    }
    return check;
}
function validateSafety(raw, warnings) {
    const safety = {};
    for (const key of Object.keys(raw)) {
        if (!SAFETY_KEYS.has(key)) {
            warnings.push(`Unknown config key "safety.${key}" — ignored`);
        }
    }
    if (raw.severityOverrides !== undefined) {
        if (isPlainObject(raw.severityOverrides)) {
            const overrides = {};
            for (const [ruleId, value] of Object.entries(raw.severityOverrides)) {
                if (typeof value === 'string' && VALID_OVERRIDES.has(value)) {
                    overrides[ruleId] = value;
                }
                else {
                    warnings.push(`"safety.severityOverrides.${ruleId}" must be one of warn|error|off — ignored`);
                }
            }
            if (Object.keys(overrides).length > 0)
                safety.severityOverrides = overrides;
        }
        else {
            warnings.push('"safety.severityOverrides" must be an object — ignored');
        }
    }
    if (raw.ignoreRules !== undefined) {
        if (Array.isArray(raw.ignoreRules) && raw.ignoreRules.every((r) => typeof r === 'string')) {
            safety.ignoreRules = raw.ignoreRules;
        }
        else {
            warnings.push('"safety.ignoreRules" must be an array of strings — ignored');
        }
    }
    if (raw.customRules !== undefined) {
        if (Array.isArray(raw.customRules)) {
            const rules = [];
            const seen = new Set();
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
                let severity = 'warn';
                if (entry.severity !== undefined) {
                    if (entry.severity === 'warn' || entry.severity === 'error') {
                        severity = entry.severity;
                    }
                    else {
                        warnings.push(`Custom rule "${id}" has invalid severity — defaulting to "warn"`);
                    }
                }
                seen.add(id);
                rules.push({ id, pattern, message, severity });
            }
            if (rules.length > 0)
                safety.customRules = rules;
        }
        else {
            warnings.push('"safety.customRules" must be an array — ignored');
        }
    }
    return safety;
}
// Load and validate .aikconfig.json. Always returns a usable AIKConfig:
// - File absent          -> {} (every consumer falls back to defaults)
// - Invalid JSON         -> {} plus a warning (never throws)
// - Unknown/invalid keys -> dropped, each reported as a warning
function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
    const warnings = [];
    if (!fs.existsSync(configPath)) {
        return { config: {}, warnings };
    }
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    catch (err) {
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
    const config = {};
    if (parsed.check !== undefined) {
        if (isPlainObject(parsed.check)) {
            config.check = validateCheck(parsed.check, warnings);
        }
        else {
            warnings.push('"check" must be an object — ignored');
        }
    }
    if (parsed.safety !== undefined) {
        if (isPlainObject(parsed.safety)) {
            config.safety = validateSafety(parsed.safety, warnings);
        }
        else {
            warnings.push('"safety" must be an object — ignored');
        }
    }
    return { config, warnings };
}


/***/ }),

/***/ 52:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.detectProject = detectProject;
exports.renderTemplate = renderTemplate;
const fs = __importStar(__nccwpck_require__(896));
const path = __importStar(__nccwpck_require__(928));
function detectProject(dir = '.') {
    if (fs.existsSync(path.join(dir, 'package.json')))
        return detectNode(dir);
    if (fs.existsSync(path.join(dir, 'Cargo.toml')))
        return detectRust(dir);
    if (fs.existsSync(path.join(dir, 'pyproject.toml')) || fs.existsSync(path.join(dir, 'requirements.txt')))
        return detectPython(dir);
    if (fs.existsSync(path.join(dir, 'go.mod')))
        return detectGo(dir);
    return null;
}
function detectNode(dir) {
    const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf-8');
    let pkg;
    try {
        pkg = JSON.parse(raw);
    }
    catch {
        return null;
    }
    const scripts = pkg.scripts || {};
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    let framework = 'Node.js';
    if (allDeps['next'])
        framework = 'Next.js';
    else if (allDeps['@angular/core'])
        framework = 'Angular';
    else if (allDeps['vue'])
        framework = 'Vue';
    else if (allDeps['react'])
        framework = 'React';
    else if (allDeps['express'])
        framework = 'Express';
    else if (allDeps['fastify'])
        framework = 'Fastify';
    else if (allDeps['@nestjs/core'])
        framework = 'NestJS';
    const language = allDeps['typescript'] ? 'TypeScript' : 'JavaScript';
    const commands = {
        install: '`npm install`',
        test: scripts['test'] ? '`npm test`' : '`npm test` (no test script found — add one)',
    };
    if (scripts['typecheck'] || scripts['type-check']) {
        commands.typecheck = scripts['typecheck'] ? '`npm run typecheck`' : '`npm run type-check`';
    }
    if (scripts['lint'])
        commands.lint = '`npm run lint`';
    if (scripts['build'])
        commands.build = '`npm run build`';
    return { language, framework, commands };
}
function detectRust(dir) {
    let framework = 'Rust';
    const cargoContent = fs.readFileSync(path.join(dir, 'Cargo.toml'), 'utf-8');
    if (cargoContent.includes('actix-web'))
        framework = 'Actix Web';
    else if (cargoContent.includes('axum'))
        framework = 'Axum';
    else if (cargoContent.includes('rocket'))
        framework = 'Rocket';
    else if (cargoContent.includes('tauri'))
        framework = 'Tauri';
    return {
        language: 'Rust',
        framework,
        commands: {
            install: '`cargo build`',
            lint: '`cargo clippy`',
            test: '`cargo test`',
            build: '`cargo build --release`',
        },
    };
}
function detectPython(dir) {
    let framework = 'Python';
    const testCmd = '`pytest`';
    let installCmd = '`pip install -e ".[dev]"`';
    let lintCmd;
    const pyprojectPath = path.join(dir, 'pyproject.toml');
    if (fs.existsSync(pyprojectPath)) {
        const content = fs.readFileSync(pyprojectPath, 'utf-8');
        if (content.includes('fastapi'))
            framework = 'FastAPI';
        else if (content.includes('django'))
            framework = 'Django';
        else if (content.includes('flask'))
            framework = 'Flask';
        if (content.includes('poetry'))
            installCmd = '`poetry install`';
        else if (content.includes('[tool.uv]'))
            installCmd = '`uv sync`';
        if (content.includes('ruff'))
            lintCmd = '`ruff check .`';
        else if (content.includes('flake8'))
            lintCmd = '`flake8`';
    }
    if (installCmd === '`pip install -e ".[dev]"`' && fs.existsSync(path.join(dir, 'requirements.txt'))) {
        installCmd = '`pip install -r requirements.txt`';
    }
    const commands = {
        install: installCmd,
        test: testCmd,
    };
    if (lintCmd)
        commands.lint = lintCmd;
    return { language: 'Python', framework, commands };
}
function detectGo(_dir) {
    return {
        language: 'Go',
        framework: 'Go',
        commands: {
            install: '`go mod download`',
            lint: '`golangci-lint run`',
            test: '`go test ./...`',
            build: '`go build ./...`',
        },
    };
}
function renderTemplate(base, info) {
    let result = base;
    result = result.replace('[List primary language, framework, and key libraries]', `${info.language} / ${info.framework}`);
    const cmdLines = [];
    cmdLines.push(`- Install: ${info.commands.install}`);
    if (info.commands.typecheck)
        cmdLines.push(`- Typecheck: ${info.commands.typecheck}`);
    if (info.commands.lint)
        cmdLines.push(`- Lint: ${info.commands.lint}`);
    cmdLines.push(`- Test: ${info.commands.test}`);
    if (info.commands.build)
        cmdLines.push(`- Build: ${info.commands.build}`);
    const cmdSection = result.match(/## Local dev commands\n([\s\S]*?)(?=\n##|\n*$)/);
    if (cmdSection) {
        const newCmds = `## Local dev commands\n${cmdLines.join('\n')}\n`;
        result = result.replace(cmdSection[0], newCmds);
    }
    const verifyLines = [];
    verifyLines.push(`- Run ${info.commands.test} before declaring any task complete`);
    if (info.commands.typecheck)
        verifyLines.push(`- Run ${info.commands.typecheck} to catch type errors`);
    if (base.includes('A task is not done until all of these pass:')) {
        const exitLines = [];
        if (info.commands.typecheck)
            exitLines.push(`- ${info.commands.typecheck} exits 0`);
        if (info.commands.lint)
            exitLines.push(`- ${info.commands.lint} exits 0`);
        exitLines.push(`- ${info.commands.test} exits 0`);
        if (info.commands.build)
            exitLines.push(`- ${info.commands.build} exits 0`);
        const oldVerify = result.match(/A task is not done until all of these pass:\n([\s\S]*?)(?=\n##|\n*$)/);
        if (oldVerify) {
            result = result.replace(oldVerify[0], `A task is not done until all of these pass:\n${exitLines.join('\n')}\n`);
        }
    }
    else {
        const simpleVerify = result.match(/## Verification\n([\s\S]*?)(?=\n##|\n*$)/);
        if (simpleVerify) {
            const newVerify = `## Verification\n${verifyLines.join('\n')}\n- Never claim success without checking actual output\n`;
            result = result.replace(simpleVerify[0], newVerify);
        }
    }
    return result;
}


/***/ }),

/***/ 952:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseDiff = parseDiff;
exports.changedLinesForFile = changedLinesForFile;
exports.getGitDiff = getGitDiff;
const child_process_1 = __nccwpck_require__(317);
// Parses unified `git diff` output and extracts the set of *added/changed*
// lines per file, expressed as inclusive [startLine, endLine] ranges keyed by
// the post-image (new) file path. Only added lines (`+`) advance the new-file
// line counter and are recorded as changed; removed lines (`-`) and context
// lines are tracked for positioning but removals are not reported (they no
// longer exist in the file we are scanning).
//
// Diff-aware safety filters findings to lines that appear here, so we
// deliberately track the *new* file's line numbers — those match the line
// numbers `runSafetyCheck` reports when scanning the working-tree file.
//
// This is a simple line-oriented parser of standard unified diff output
// (lines starting with `diff --git`, `+++`, `@@`, `+`, `-`). It intentionally
// does not attempt to fully model renames, merges, or binary files — those are
// parsed loosely and contribute no changed lines, which is the safe default
// (fewer findings suppressed incorrectly is preferable to crashing).
function parseDiff(diffText) {
    const ranges = [];
    const lines = diffText.split('\n');
    let currentFile = null;
    // Line number in the new (post-image) file for the next non-removed line.
    let newLineNo = 0;
    // Accumulator for a contiguous run of changed lines so we emit compact ranges
    // instead of one range per line.
    let runStart = 0;
    let runEnd = 0;
    const flushRun = () => {
        if (currentFile !== null && runStart > 0) {
            ranges.push({ file: currentFile, startLine: runStart, endLine: runEnd });
        }
        runStart = 0;
        runEnd = 0;
    };
    for (const raw of lines) {
        // New file section. `+++ b/path` carries the post-image path; prefer it,
        // but fall back to the `diff --git a/x b/y` header.
        if (raw.startsWith('+++ ')) {
            flushRun();
            const p = raw.slice(4).trim();
            if (p === '/dev/null') {
                // File was deleted — nothing in the new tree to scan.
                currentFile = null;
            }
            else {
                currentFile = stripDiffPathPrefix(p);
            }
            continue;
        }
        if (raw.startsWith('--- ')) {
            // Pre-image header; ignored for new-file line tracking.
            continue;
        }
        if (raw.startsWith('diff --git')) {
            flushRun();
            // Defer the authoritative path to the following `+++` line, but record a
            // best-effort path so single-file diffs without `+++` still attribute.
            const m = /^diff --git a\/(.+) b\/(.+)$/.exec(raw);
            currentFile = m ? m[2] : null;
            continue;
        }
        // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        if (raw.startsWith('@@')) {
            flushRun();
            const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
            if (m) {
                newLineNo = Number.parseInt(m[1], 10);
            }
            continue;
        }
        if (currentFile === null)
            continue;
        if (raw.startsWith('+')) {
            // Added/changed line in the new file.
            if (runStart === 0) {
                runStart = newLineNo;
            }
            runEnd = newLineNo;
            newLineNo++;
        }
        else if (raw.startsWith('-')) {
            // Removed line — exists only in the old file; does not advance newLineNo
            // and breaks any contiguous added run.
            flushRun();
        }
        else if (raw.startsWith('\\')) {
            // "\ No newline at end of file" — metadata, not a content line.
            continue;
        }
        else {
            // Context line (leading space) or blank line within a hunk: advances the
            // new-file counter and ends the current changed run.
            flushRun();
            newLineNo++;
        }
    }
    flushRun();
    return { ranges };
}
// Strips the leading `a/` or `b/` prefix git adds to diff paths.
function stripDiffPathPrefix(p) {
    if (p.startsWith('a/') || p.startsWith('b/'))
        return p.slice(2);
    return p;
}
// Collapses parsed ranges for a single file into a flat set of changed line
// numbers, for O(1) membership checks during finding filtering.
function changedLinesForFile(ranges, filePath) {
    const normalized = normalizePath(filePath);
    const result = new Set();
    for (const r of ranges) {
        if (normalizePath(r.file) === normalized) {
            for (let n = r.startLine; n <= r.endLine; n++) {
                result.add(n);
            }
        }
    }
    return result;
}
function normalizePath(p) {
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
}
// Runs `git diff` (and `git diff --cached`) in `cwd` and returns the combined
// unified diff text. Returns an error string (not a throw) when git is missing
// or the directory is not a git repository, so callers can degrade gracefully.
// `runner` is injectable for tests.
function getGitDiff(cwd = '.', runner = defaultGitRunner) {
    try {
        const againstHead = runner(['diff', '--no-color', '--unified=0', 'HEAD'], cwd);
        return parseDiff(againstHead);
    }
    catch (err) {
        // `HEAD` may not exist (no commits yet) — fall back to the working-tree
        // diff plus the staged diff, and surface a clear error only if both fail.
        try {
            const unstaged = runner(['diff', '--no-color', '--unified=0'], cwd);
            const staged = runner(['diff', '--no-color', '--unified=0', '--cached'], cwd);
            const combined = staged ? `${unstaged}\n${staged}` : unstaged;
            return parseDiff(combined);
        }
        catch (err2) {
            return { ranges: [], error: gitErrorMessage(err2 ?? err) };
        }
    }
}
function defaultGitRunner(args, cwd) {
    return (0, child_process_1.execFileSync)('git', args, {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
}
function gitErrorMessage(err) {
    const e = err;
    if (e && e.code === 'ENOENT') {
        return 'git executable not found — diff mode requires git on PATH';
    }
    return 'could not read git diff — not a git repository or git failed';
}


/***/ }),

/***/ 164:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.discoverFiles = discoverFiles;
exports.discoverAgentsFiles = discoverAgentsFiles;
const fs = __importStar(__nccwpck_require__(896));
const path = __importStar(__nccwpck_require__(928));
const KNOWN_FILES = [
    '.github/copilot-instructions.md',
    '.cursor/rules',
    '.cursorrules',
    '.windsurfrules',
    '.aider/conventions.md',
    'CONVENTIONS.md',
];
function discoverFiles(dir = '.') {
    const found = [];
    for (const file of KNOWN_FILES) {
        const full = path.join(dir, file);
        if (fs.existsSync(full)) {
            found.push(full);
        }
    }
    return found;
}
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out', 'target', 'vendor']);
// Recursively find all AGENTS.md files under a directory (monorepo-aware).
// Used to decide whether a project is a monorepo so the frontmatter
// recommendation can be surfaced. Bounded depth keeps this cheap on large trees.
function discoverAgentsFiles(dir = '.', maxDepth = 6) {
    const found = [];
    const walk = (current, depth) => {
        if (depth > maxDepth)
            return;
        let entries;
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.'))
                    continue;
                walk(path.join(current, entry.name), depth + 1);
            }
            else if (entry.isFile() && entry.name === 'AGENTS.md') {
                found.push(path.join(current, entry.name));
            }
        }
    };
    walk(dir, 0);
    return found;
}


/***/ }),

/***/ 748:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fixAgentsContent = fixAgentsContent;
exports.fixClaudeContent = fixClaudeContent;
exports.redactSecrets = redactSecrets;
exports.detectHedgeWords = detectHedgeWords;
exports.addMissingRequiredSections = addMissingRequiredSections;
exports.addAgentsReference = addAgentsReference;
exports.runFix = runFix;
const fs = __importStar(__nccwpck_require__(896));
// Required sections (mirrors REQUIRED_SECTIONS in check.ts).
const REQUIRED_SECTIONS = ['Mission', 'Local dev commands'];
const REQUIRED_SECTION_STUBS = {
    Mission: '[Describe what this project does and its core goals]',
    'Local dev commands': '- Install: `npm install`\n- Test: `npm test`\n- Build: `npm run build`',
};
// Secret-detection rules reused from safety.ts (leaked-* family). Redaction is
// only applied to these high-confidence patterns to keep false positives low.
const SECRET_RULES = [
    { id: 'leaked-aws-key', pattern: /AKIA[0-9A-Z]{16}/g },
    {
        id: 'leaked-generic-secret',
        pattern: /((?:api[_-]?key|api[_-]?secret|auth[_-]?token|access[_-]?token|secret[_-]?key)\s*[:=]\s*["']?)[A-Za-z0-9+/=_-]{20,}/gi,
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
// Ambiguous hedge phrases (mirrors the ambiguous-hedge rule in safety.ts). These
// are deliberately NOT auto-replaced: a blind token swap mangles grammar (e.g.
// "add tests where possible" -> "add tests ensure"). Instead `fix` flags each
// occurrence as a warning so the author can reword it into a concrete requirement.
const HEDGE_PHRASES = [
    { pattern: /\btry to\b/gi, suggestion: 'state the action directly' },
    { pattern: /\bwhere possible\b/gi, suggestion: 'state when it is required' },
    { pattern: /\bif appropriate\b/gi, suggestion: 'state the condition' },
    { pattern: /\bwhen feasible\b/gi, suggestion: 'state the condition' },
    { pattern: /\bas needed\b/gi, suggestion: 'state the condition' },
    { pattern: /\bideally\b/gi, suggestion: 'state the requirement' },
    { pattern: /\boptionally\b/gi, suggestion: 'state whether it is required' },
];
function fixAgentsContent(content, filePath) {
    const actions = [];
    let result = content;
    const redaction = redactSecrets(result, filePath);
    result = redaction.content;
    actions.push(...redaction.actions);
    const warnings = detectHedgeWords(result, filePath);
    const sections = addMissingRequiredSections(result, filePath);
    result = sections.content;
    actions.push(...sections.actions);
    return { content: result, actions, warnings };
}
function fixClaudeContent(content, filePath) {
    const actions = [];
    let result = content;
    const redaction = redactSecrets(result, filePath);
    result = redaction.content;
    actions.push(...redaction.actions);
    const warnings = detectHedgeWords(result, filePath);
    const ref = addAgentsReference(result, filePath);
    result = ref.content;
    actions.push(...ref.actions);
    return { content: result, actions, warnings };
}
function redactSecrets(content, filePath) {
    const actions = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        for (const rule of SECRET_RULES) {
            rule.pattern.lastIndex = 0;
            if (!rule.pattern.test(lines[i]))
                continue;
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
// Flags ambiguous hedge phrases without modifying content. Rewording vague prose
// into a concrete requirement needs human judgement, so these are reported as
// warnings (FixReport.skipped) rather than auto-applied.
function detectHedgeWords(content, filePath) {
    const warnings = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        for (const { pattern, suggestion } of HEDGE_PHRASES) {
            pattern.lastIndex = 0;
            for (const match of lines[i].matchAll(pattern)) {
                warnings.push({
                    type: 'replace-hedge',
                    path: filePath,
                    lineNumber: i + 1,
                    oldValue: lines[i],
                    newValue: '',
                    description: `Ambiguous hedge word "${match[0]}" — reword manually (${suggestion})`,
                });
            }
        }
    }
    return warnings;
}
function addMissingRequiredSections(content, filePath) {
    const actions = [];
    const additions = [];
    for (const section of REQUIRED_SECTIONS) {
        const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^##\\s+${escaped}`, 'mi');
        if (pattern.test(content))
            continue;
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
function addAgentsReference(content, filePath) {
    if (content.includes('AGENTS.md')) {
        return { content, actions: [] };
    }
    const reference = 'Follow AGENTS.md exactly. If AGENTS.md conflicts with any other instructions, AGENTS.md wins.';
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
function runFix(options) {
    const { agentsPath, claudePath, dryRun } = options;
    const applied = [];
    const skipped = [];
    if (fs.existsSync(agentsPath)) {
        const content = fs.readFileSync(agentsPath, 'utf-8');
        const { content: fixed, actions, warnings } = fixAgentsContent(content, agentsPath);
        if (!dryRun && fixed !== content) {
            fs.writeFileSync(agentsPath, fixed);
        }
        applied.push(...actions);
        skipped.push(...warnings);
    }
    if (fs.existsSync(claudePath)) {
        const content = fs.readFileSync(claudePath, 'utf-8');
        const { content: fixed, actions, warnings } = fixClaudeContent(content, claudePath);
        if (!dryRun && fixed !== content) {
            fs.writeFileSync(claudePath, fixed);
        }
        applied.push(...actions);
        skipped.push(...warnings);
    }
    return {
        passed: true,
        applied,
        skipped,
        dryRun,
    };
}


/***/ }),

/***/ 593:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.hasFrontmatter = hasFrontmatter;
exports.stripFrontmatter = stripFrontmatter;
exports.parseFrontmatter = parseFrontmatter;
exports.validateFrontmatter = validateFrontmatter;
const DELIMITER = /^---\s*$/;
function stripBom(line) {
    return line.charCodeAt(0) === 0xfeff ? line.slice(1) : line;
}
// Detect whether content opens with a YAML frontmatter block (--- ... ---).
function hasFrontmatter(content) {
    const lines = content.split('\n');
    // The very first line (ignoring a possible BOM) must be the opening delimiter.
    const first = stripBom(lines[0] ?? '');
    if (!DELIMITER.test(first))
        return false;
    for (let i = 1; i < lines.length; i++) {
        if (DELIMITER.test(lines[i]))
            return true;
    }
    return false;
}
// Return the markdown content with any leading frontmatter block removed.
// If no frontmatter is present the content is returned unchanged.
function stripFrontmatter(content) {
    if (!hasFrontmatter(content))
        return content;
    const lines = content.split('\n');
    for (let i = 1; i < lines.length; i++) {
        if (DELIMITER.test(lines[i])) {
            return lines.slice(i + 1).join('\n').replace(/^\n+/, '');
        }
    }
    return content;
}
// Parse the optional YAML frontmatter at the top of an AGENTS.md file.
// Returns null (via success=false with no error) semantics handled by caller
// when no frontmatter block exists. This is a deliberately tiny YAML reader
// that only understands the v1.1 shape: a `description` scalar and a `tags`
// list (either inline `[a, b]` or block `- a` form). Nested structures are
// intentionally unsupported.
function parseFrontmatter(content) {
    if (!hasFrontmatter(content)) {
        return { success: false };
    }
    const lines = content.split('\n');
    const body = [];
    let closed = false;
    for (let i = 1; i < lines.length; i++) {
        if (DELIMITER.test(lines[i])) {
            closed = true;
            break;
        }
        body.push(lines[i]);
    }
    if (!closed) {
        return { success: false, error: 'Frontmatter block is not closed with "---"' };
    }
    const data = { raw: body.join('\n') };
    for (let i = 0; i < body.length; i++) {
        const line = body[i];
        if (line.trim().length === 0)
            continue;
        // Indented lines belong to a block list (handled by the tags branch below)
        // or are otherwise ignored here.
        const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
        if (!kv)
            continue;
        const key = kv[1].toLowerCase();
        const rawValue = kv[2];
        if (key === 'description') {
            data.description = unquote(rawValue.trim());
        }
        else if (key === 'tags') {
            const inline = rawValue.trim();
            if (inline.length > 0) {
                data.tags = parseInlineList(inline);
            }
            else {
                // Block list form: subsequent indented "- value" lines.
                const collected = [];
                let j = i + 1;
                for (; j < body.length; j++) {
                    const itemMatch = body[j].match(/^\s*-\s+(.*)$/);
                    if (!itemMatch) {
                        if (body[j].trim().length === 0)
                            continue;
                        break;
                    }
                    collected.push(unquote(itemMatch[1].trim()));
                }
                data.tags = collected;
                i = j - 1;
            }
        }
    }
    return { success: true, data };
}
function parseInlineList(value) {
    let inner = value;
    if (inner.startsWith('[') && inner.endsWith(']')) {
        inner = inner.slice(1, -1);
    }
    return inner
        .split(',')
        .map((s) => unquote(s.trim()))
        .filter((s) => s.length > 0);
}
function unquote(value) {
    if (value.length >= 2) {
        const first = value[0];
        const last = value[value.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
            return value.slice(1, -1);
        }
    }
    return value;
}
// Validate the v1.1 frontmatter fields. All fields are optional; this only
// flags fields that are present but malformed. Returns human-readable warning
// strings (empty array means valid / nothing present).
function validateFrontmatter(data) {
    const warnings = [];
    if (data.description !== undefined) {
        if (typeof data.description !== 'string' || data.description.trim().length === 0) {
            warnings.push('Frontmatter "description" is present but empty — provide a short description or remove it');
        }
    }
    if (data.tags !== undefined) {
        if (!Array.isArray(data.tags) || data.tags.length === 0) {
            warnings.push('Frontmatter "tags" is present but empty — provide at least one tag or remove it');
        }
        else {
            const allStrings = data.tags.every((t) => typeof t === 'string' && t.trim().length > 0);
            if (!allStrings) {
                warnings.push('Frontmatter "tags" must be a list of non-empty strings');
            }
        }
    }
    return warnings;
}


/***/ }),

/***/ 987:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.suggestHooks = suggestHooks;
exports.renderHookSettings = renderHookSettings;
// Heuristic parsing of the AGENTS.md "Verification" section into Claude Code
// hook suggestions. The idea: if a project documents that "`npm test` exits 0"
// is part of its definition of done, that command is a natural fit for a Stop
// hook in .claude/settings.json so the agent re-runs it before finishing.
//
// We deliberately keep this conservative to avoid false positives:
//   - Only the Verification section (or a Testing/Verify heading) is scanned.
//   - Only backtick-wrapped commands are considered (prose is ignored).
//   - Only commands whose leading token matches a known build/test tool are
//     suggested (npm/pnpm/yarn/cargo/go/pytest/poetry/uv/ruff/make).
// All suggestions map to the Stop hook, which fires when the agent finishes a
// response — the right moment to assert "is the work actually verified?".
// Headings whose body we treat as the verification section. Matched against
// `## <heading>` lines, case-insensitively.
const VERIFICATION_HEADING = /testing|verification|verify|test plan|definition of done/i;
// Leading command tokens we recognize as verifiable build/test commands. Mirrors
// the tools understood by detect.ts so the two stay roughly aligned.
const KNOWN_COMMAND_LEADERS = new Set([
    'npm',
    'pnpm',
    'yarn',
    'cargo',
    'go',
    'pytest',
    'poetry',
    'uv',
    'ruff',
    'flake8',
    'make',
    'mypy',
    'tsc',
    'eslint',
    'golangci-lint',
]);
// A command must start with a known leader (optionally via a runner like
// `npm run`). We extract the backtick-wrapped contents first, then validate.
const BACKTICK_GLOBAL = /`([^`]+)`/g;
/**
 * Extract the body lines of the verification section from an AGENTS.md content
 * string. Returns the lines between the matching `## heading` and the next `##`
 * heading (exclusive). Returns an empty array when no verification section is
 * present.
 */
function extractVerificationLines(content) {
    const lines = content.split('\n');
    const body = [];
    let inSection = false;
    for (const line of lines) {
        const headingMatch = line.match(/^##\s+(.+?)\s*$/);
        if (headingMatch) {
            if (inSection)
                break; // reached the next section
            inSection = VERIFICATION_HEADING.test(headingMatch[1]);
            continue;
        }
        if (inSection)
            body.push(line);
    }
    return body;
}
/**
 * Normalize a raw backtick command into the canonical command we would run in a
 * hook, or null if it is not a recognized verifiable command.
 *
 * Examples:
 *   "npm test"            -> "npm test"
 *   "npm run build"       -> "npm run build"
 *   "cargo test --release"-> "cargo test --release"
 *   "see the docs"        -> null
 */
function normalizeCommand(raw) {
    const trimmed = raw.trim().replace(/\s+/g, ' ');
    if (!trimmed)
        return null;
    const tokens = trimmed.split(' ');
    const leader = tokens[0].toLowerCase();
    if (!KNOWN_COMMAND_LEADERS.has(leader))
        return null;
    // Guard against accidental matches like a bare tool name with no action
    // (e.g. just `npm`), which is not a meaningful hook command.
    if (tokens.length < 2 && leader !== 'pytest' && leader !== 'flake8') {
        return null;
    }
    return trimmed;
}
/**
 * Parse the Verification section of an AGENTS.md content string and return
 * suggested Claude Code hooks. Each recognized verification command becomes a
 * Stop-hook suggestion. Duplicate commands are de-duplicated.
 */
function suggestHooks(content) {
    const suggestions = [];
    const seen = new Set();
    const verificationLines = extractVerificationLines(content);
    if (verificationLines.length === 0)
        return suggestions;
    for (const line of verificationLines) {
        for (const match of line.matchAll(BACKTICK_GLOBAL)) {
            const command = normalizeCommand(match[1]);
            if (!command || seen.has(command))
                continue;
            seen.add(command);
            suggestions.push({
                hookType: 'Stop',
                command,
                description: `Run \`${command}\` automatically when the agent finishes (it's part of your Verification section)`,
            });
        }
    }
    return suggestions;
}
/**
 * Render the suggested hooks as a `.claude/settings.json` snippet so users can
 * copy it directly. Returns null when there are no suggestions. All matching
 * commands are combined into a single Stop hook (chained with `&&`) since
 * Claude Code runs one command per hook entry.
 */
function renderHookSettings(suggestions) {
    if (suggestions.length === 0)
        return null;
    const command = suggestions.map((s) => s.command).join(' && ');
    const settings = {
        hooks: {
            Stop: [
                {
                    hooks: [
                        {
                            type: 'command',
                            command,
                        },
                    ],
                },
            ],
        },
    };
    return JSON.stringify(settings, null, 2);
}


/***/ }),

/***/ 617:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.runSafetyCheck = runSafetyCheck;
exports.getSafetyRules = getSafetyRules;
const fs = __importStar(__nccwpck_require__(896));
const config_js_1 = __nccwpck_require__(973);
const SAFETY_RULES = [
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
    {
        id: 'ambiguous-hedge',
        pattern: /\b(try to|where possible|if appropriate|when feasible|as needed|be careful|ideally|optionally)\b/i,
        message: 'Ambiguous hedge word — agents default to non-interactive behavior when instructions are vague (ICLR 2026). Use concrete, verifiable language instead',
        severity: 'warn',
    },
    {
        id: 'vague-persona',
        pattern: /you\s+are\s+a?\s*(helpful|friendly|smart|intelligent|skilled)\s+(assistant|coder|developer|helper)/i,
        message: 'Vague persona instruction — generic roles degrade agent performance. Define specific responsibilities instead',
        severity: 'warn',
    },
    {
        id: 'leaked-aws-key',
        pattern: /AKIA[0-9A-Z]{16}/,
        message: 'Potential AWS access key detected',
        severity: 'error',
    },
    {
        id: 'leaked-generic-secret',
        pattern: /(api[_-]?key|api[_-]?secret|auth[_-]?token|access[_-]?token|secret[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9+/=_-]{20,}/i,
        message: 'Potential hardcoded secret or API key detected',
        severity: 'error',
    },
    {
        id: 'leaked-private-key',
        pattern: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH|PGP)?\s*PRIVATE KEY-----/i,
        message: 'Private key detected in instruction file',
        severity: 'error',
    },
    {
        id: 'leaked-jwt',
        pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
        message: 'JWT token detected in instruction file',
        severity: 'error',
    },
];
function loadIgnoredRules(ignorePath) {
    if (!fs.existsSync(ignorePath)) {
        return new Set();
    }
    const content = fs.readFileSync(ignorePath, 'utf-8');
    return new Set(content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#')));
}
// Build the effective rule set from the built-in rules plus optional config:
//   - severityOverrides remap a built-in rule's severity ('off' drops it),
//   - customRules are appended (a custom rule whose id matches a built-in rule
//     overrides that built-in — custom takes precedence),
//   - rules listed in `ignored` (from .aikignore + config.ignoreRules) are
//     dropped entirely.
// Invalid custom patterns are silently skipped here; loadConfig already
// surfaced a warning for them at load time.
function buildEffectiveRules(ignored, config) {
    const overrides = config?.severityOverrides ?? {};
    const byId = new Map();
    for (const rule of SAFETY_RULES) {
        const override = overrides[rule.id];
        if (override === 'off')
            continue;
        byId.set(rule.id, override ? { ...rule, severity: override } : rule);
    }
    for (const custom of config?.customRules ?? []) {
        const pattern = (0, config_js_1.compileCustomPattern)(custom, []);
        if (!pattern)
            continue;
        byId.set(custom.id, {
            id: custom.id,
            pattern,
            message: custom.message,
            severity: custom.severity ?? 'warn',
        });
    }
    return [...byId.values()].filter((rule) => !ignored.has(rule.id));
}
// Optional `changedLines` restricts findings to the given 1-based line numbers
// (diff-aware mode). When omitted, every line in the file is scanned. This
// keeps the signature backward compatible — existing callers pass only `path`
// (and optionally `ignorePath`). `config` (from .aikconfig.json) is also
// optional; when absent the built-in rules run unchanged.
function runSafetyCheck(path, ignorePath = '.aikignore', changedLines, config) {
    const findings = [];
    if (!fs.existsSync(path)) {
        return { passed: true, findings: [] };
    }
    const ignored = loadIgnoredRules(ignorePath);
    for (const id of config?.ignoreRules ?? [])
        ignored.add(id);
    const rules = buildEffectiveRules(ignored, config);
    const content = fs.readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        // Diff-aware mode: skip lines that weren't changed in the current diff.
        if (changedLines && !changedLines.has(i + 1))
            continue;
        const line = lines[i];
        for (const rule of rules) {
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
function getSafetyRules() {
    return SAFETY_RULES;
}


/***/ }),

/***/ 9:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.estimateTokens = estimateTokens;
exports.computeTokenBudget = computeTokenBudget;
exports.computeScore = computeScore;
exports.badgeUrl = badgeUrl;
exports.generateBadgeMarkdown = generateBadgeMarkdown;
exports.generateBadgeSvg = generateBadgeSvg;
exports.generateBadge = generateBadge;
const CLARITY_RULE_IDS = new Set(['ambiguous-hedge', 'vague-persona']);
// Rough heuristic: ~4 characters per token. Actual token counts vary by content
// (code is denser than prose), so this is an estimate, not an exact measure.
const CHARS_PER_TOKEN = 4;
// Typical context window used as the reference for budget percentages.
const CONTEXT_WINDOW_TOKENS = 100_000;
// Warn when instruction files consume more than this share of the window.
const WARNING_THRESHOLD_PERCENT = 5;
function estimateTokens(text) {
    if (!text)
        return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}
function computeTokenBudget(text) {
    const estimatedTokens = estimateTokens(text);
    const percentOfWindow = (estimatedTokens / CONTEXT_WINDOW_TOKENS) * 100;
    return {
        estimatedTokens,
        percentOfWindow,
        isWarning: percentOfWindow >= WARNING_THRESHOLD_PERCENT,
    };
}
function computeScore(agentsCheck, claudeCheck, safetyResult, sourceText, geminiCheck, consistencyResult) {
    const breakdown = {};
    const suggestions = [];
    let structurePoints = 30;
    if (!agentsCheck.passed) {
        structurePoints -= agentsCheck.errors.length * 10;
        suggestions.push('Fix required section errors in AGENTS.md');
    }
    const qualityWarnings = agentsCheck.warnings.filter((w) => w.includes('recommended section') || w.includes('boundary constraints') || w.includes('no executable commands'));
    structurePoints -= qualityWarnings.length * 3;
    if (qualityWarnings.some((w) => w.includes('Verification'))) {
        suggestions.push('Add a Verification section with concrete exit criteria');
    }
    if (qualityWarnings.some((w) => w.includes('Boundaries'))) {
        suggestions.push('Add a Boundaries section with explicit limits');
    }
    if (qualityWarnings.some((w) => w.includes('no executable commands'))) {
        suggestions.push('Add verifiable commands (in backticks) to prose-only sections');
    }
    breakdown['Structure'] = Math.max(0, structurePoints);
    let safetyPoints = 30;
    const errors = safetyResult.findings.filter((f) => f.severity === 'error');
    const warns = safetyResult.findings.filter((f) => f.severity === 'warn' && !CLARITY_RULE_IDS.has(f.ruleId));
    safetyPoints -= errors.length * 10;
    safetyPoints -= warns.length * 3;
    if (errors.length > 0)
        suggestions.push(`Fix ${errors.length} safety error(s) — these indicate dangerous patterns`);
    if (warns.length > 0)
        suggestions.push(`Review ${warns.length} safety warning(s)`);
    breakdown['Safety'] = Math.max(0, safetyPoints);
    let clarityPoints = 20;
    const lengthWarning = agentsCheck.warnings.find((w) => w.includes('lines'));
    if (lengthWarning) {
        const isHardWarn = />\s*300\)/.test(lengthWarning);
        clarityPoints -= isHardWarn ? 10 : 5;
        suggestions.push('Trim instruction file — shorter files correlate with better agent performance');
    }
    const ambiguityFindings = safetyResult.findings.filter((f) => f.ruleId === 'ambiguous-hedge');
    clarityPoints -= ambiguityFindings.length * 2;
    if (ambiguityFindings.length > 0) {
        suggestions.push('Replace hedge words ("try to", "where possible") with concrete instructions');
    }
    const personaFindings = safetyResult.findings.filter((f) => f.ruleId === 'vague-persona');
    clarityPoints -= personaFindings.length * 3;
    breakdown['Clarity'] = Math.max(0, clarityPoints);
    let consistencyPoints = 20;
    if (!claudeCheck.passed) {
        consistencyPoints -= claudeCheck.errors.length * 10;
        suggestions.push('Fix errors in CLAUDE.md');
    }
    consistencyPoints -= claudeCheck.warnings.length * 5;
    if (claudeCheck.warnings.some((w) => w.includes('reference AGENTS.md'))) {
        suggestions.push('CLAUDE.md should reference AGENTS.md as source of truth');
    }
    if (claudeCheck.warnings.some((w) => w.includes('contradict'))) {
        suggestions.push('Resolve contradictions between CLAUDE.md and AGENTS.md');
    }
    if (geminiCheck) {
        if (!geminiCheck.passed) {
            consistencyPoints -= geminiCheck.errors.length * 10;
            suggestions.push('Fix errors in GEMINI.md');
        }
        consistencyPoints -= geminiCheck.warnings.length * 5;
        if (geminiCheck.warnings.some((w) => w.includes('reference AGENTS.md'))) {
            suggestions.push('GEMINI.md should reference AGENTS.md as source of truth');
        }
        if (geminiCheck.warnings.some((w) => w.includes('contradict'))) {
            suggestions.push('Resolve contradictions between GEMINI.md and AGENTS.md');
        }
    }
    if (consistencyResult && consistencyResult.issues.length > 0) {
        consistencyPoints -= consistencyResult.issues.length * 3;
        if (consistencyResult.issues.some((i) => i.type === 'contradiction')) {
            suggestions.push('Resolve cross-file contradictions across AGENTS.md / CLAUDE.md / GEMINI.md');
        }
        if (consistencyResult.issues.some((i) => i.type === 'duplication')) {
            suggestions.push('Remove duplicated sections — keep shared content in AGENTS.md only');
        }
    }
    breakdown['Consistency'] = Math.max(0, consistencyPoints);
    const score = Math.max(0, Math.min(100, breakdown['Structure'] + breakdown['Safety'] + breakdown['Clarity'] + breakdown['Consistency']));
    let grade;
    if (score >= 90)
        grade = 'A';
    else if (score >= 80)
        grade = 'B';
    else if (score >= 70)
        grade = 'C';
    else if (score >= 60)
        grade = 'D';
    else
        grade = 'F';
    const result = { score, grade, breakdown, suggestions };
    if (sourceText !== undefined) {
        const tokenBudget = computeTokenBudget(sourceText);
        result.tokenBudget = tokenBudget;
        if (tokenBudget.isWarning) {
            suggestions.push(`Instruction files consume ~${tokenBudget.percentOfWindow.toFixed(1)}% of a ${formatWindowLabel()} context window — trim to free up tokens for the agent`);
        }
    }
    return result;
}
function formatWindowLabel() {
    return `${CONTEXT_WINDOW_TOKENS / 1000}k`;
}
// shields.io color names keyed by grade. These are the standard named colors
// shields.io accepts directly in the badge URL.
const GRADE_COLORS = {
    A: 'brightgreen',
    B: 'green',
    C: 'yellow',
    D: 'orange',
    F: 'red',
};
function badgeColor(grade) {
    return GRADE_COLORS[grade] ?? 'lightgrey';
}
// Escapes a value for a shields.io static badge path segment. Per shields.io,
// literal dashes must be doubled and underscores/spaces have special meaning,
// so encode the label/grade conservatively.
function shieldsEscape(value) {
    return value.replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '_');
}
function badgeUrl(grade) {
    const label = shieldsEscape('agent-instructions');
    const message = shieldsEscape(grade);
    return `https://img.shields.io/badge/${label}-${message}-${badgeColor(grade)}`;
}
function generateBadgeMarkdown(grade) {
    return `![Agent Instructions Score: ${grade}](${badgeUrl(grade)})`;
}
// Renders a self-contained SVG badge equivalent to the shields.io "flat" style,
// so the badge can be committed/served without a network dependency.
function generateBadgeSvg(grade) {
    const label = 'agent-instructions';
    const message = grade;
    const color = SVG_COLORS[grade] ?? '#9f9f9f';
    // Approximate width: ~7px per char + padding. Keeps text from clipping.
    const labelWidth = label.length * 7 + 10;
    const messageWidth = message.length * 7 + 10;
    const totalWidth = labelWidth + messageWidth;
    const labelMid = labelWidth / 2;
    const messageMid = labelWidth + messageWidth / 2;
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">`,
        `<title>${label}: ${message}</title>`,
        `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
        `<clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>`,
        `<g clip-path="url(#r)">`,
        `<rect width="${labelWidth}" height="20" fill="#555"/>`,
        `<rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>`,
        `<rect width="${totalWidth}" height="20" fill="url(#s)"/>`,
        `</g>`,
        `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`,
        `<text x="${labelMid}" y="14">${label}</text>`,
        `<text x="${messageMid}" y="14">${message}</text>`,
        `</g>`,
        `</svg>`,
    ].join('');
}
// Hex equivalents of the shields.io named colors, used for self-contained SVGs.
const SVG_COLORS = {
    A: '#4c1',
    B: '#97ca00',
    C: '#dfb317',
    D: '#fe7d37',
    F: '#e05d44',
};
function generateBadge(grade, format = 'markdown') {
    return format === 'svg' ? generateBadgeSvg(grade) : generateBadgeMarkdown(grade);
}


/***/ }),

/***/ 340:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GEMINI_TEMPLATE = exports.CLAUDE_TEMPLATE = exports.OPINIONATED_TEMPLATE = exports.MINIMAL_TEMPLATE = void 0;
exports.getTemplate = getTemplate;
exports.MINIMAL_TEMPLATE = `# AGENTS.md

## Mission
[Describe what this project does and its core goals]

## Stack
[List primary language, framework, and key libraries]

## Local dev commands
- Install: \`npm install\`
- Test: \`npm test\`
- Build: \`npm run build\`

## Project structure
[Describe the main directories and their purpose]

## Verification
- Run \`npm test\` before declaring any task complete
- Never claim success without checking actual output

## Change rules
- Update README if you change behavior
- Add tests for new features
- Keep PRs focused — one concern per PR

## Boundaries
- Never commit secrets, tokens, or credentials
- Never remove or skip failing tests to make CI pass
- Ask before adding new dependencies
`;
exports.OPINIONATED_TEMPLATE = `# AGENTS.md

## Mission
[Describe what this project does and its core goals]

## Stack
[List primary language, framework, and key libraries]

## Local dev commands
- Install: \`npm install\`
- Typecheck: \`npm run typecheck\`
- Lint: \`npm run lint\`
- Test: \`npm test\`
- Build: \`npm run build\`

## Project structure
[Describe the main directories and their purpose]

## Core principles
- **Think before coding** — clarify assumptions before writing code. Never silently pick an interpretation and run with it.
- **Simplicity first** — implement the simplest solution that works. No premature abstractions, no config options nobody will use.
- **Surgical changes** — only modify what's necessary. Don't refactor surrounding code, rename variables "for consistency", or "clean up" unrelated files.
- **Verify, don't trust** — run \`npm test\` and \`npm run typecheck\` before declaring any task complete. Never claim success without checking actual output.

## When to stop and ask
- You are unsure which of multiple valid approaches to take
- The task requires changing a public API or database schema
- You need to add a new dependency
- Something feels wrong or the requirements seem contradictory
- Proceed without asking for: straightforward bug fixes, test additions, documentation updates, and changes that have a single obvious implementation

## Verification
A task is not done until all of these pass:
- \`npm run typecheck\` exits 0
- \`npm run lint\` exits 0
- \`npm test\` exits 0
- \`npm run build\` exits 0

## Output rules
- Keep output clear and scannable
- Prefer structured data over prose
- Error messages must be actionable

## Safety rules
- Never log secrets, tokens, or credentials
- Never execute untrusted input as code
- Validate all external input
- Keep dependencies minimal

## Change rules
- Update README if you change behavior
- Add tests for new features
- Document breaking changes clearly
- Keep PRs focused — one concern per PR

## Boundaries: always, ask first, never

**Always:**
- Run the full test suite before submitting
- Follow existing code style and patterns
- Provide evidence that your change works

**Ask first:**
- Adding new dependencies
- Changing database schemas or public APIs
- Modifying CI/CD configuration
- Architectural changes that affect multiple modules

**Never:**
- Commit secrets or credentials
- Remove or skip failing tests
- Bypass linting or type checking
- Make changes outside the scope of the current task
- Fabricate test results or claim untested code works
`;
exports.CLAUDE_TEMPLATE = `Follow AGENTS.md exactly. If AGENTS.md conflicts with any other instructions, AGENTS.md wins.
`;
exports.GEMINI_TEMPLATE = `Follow AGENTS.md exactly. If AGENTS.md conflicts with any other instructions, AGENTS.md wins.
`;
function getTemplate(name) {
    return name === 'minimal' ? exports.MINIMAL_TEMPLATE : exports.OPINIONATED_TEMPLATE;
}


/***/ }),

/***/ 344:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.computeWatchScore = computeWatchScore;
exports.watchAgentsFile = watchAgentsFile;
exports.formatWatchResult = formatWatchResult;
const fs = __importStar(__nccwpck_require__(896));
const path = __importStar(__nccwpck_require__(928));
const check_js_1 = __nccwpck_require__(883);
const safety_js_1 = __nccwpck_require__(617);
const score_js_1 = __nccwpck_require__(9);
const discover_js_1 = __nccwpck_require__(164);
// Re-runs the full scoring pipeline for the watched files. Mirrors the `score`
// command so the grade printed in watch mode matches `score` exactly.
function computeWatchScore(config) {
    const { agentsPath, claudePath } = config;
    const geminiPath = 'GEMINI.md';
    const agentsFileCount = (0, discover_js_1.discoverAgentsFiles)('.').length;
    const agentsResult = (0, check_js_1.checkAgentsFile)(agentsPath, { agentsFileCount });
    const claudeResult = (0, check_js_1.checkClaudeFile)(claudePath, agentsPath);
    const geminiResult = fs.existsSync(geminiPath) ? (0, check_js_1.checkGeminiFile)(geminiPath, agentsPath) : null;
    const consistencyResult = (0, check_js_1.checkCrossFileConsistency)(agentsPath, claudePath, geminiPath);
    const safetyResult = (0, safety_js_1.runSafetyCheck)(agentsPath);
    let sourceText = '';
    if (fs.existsSync(agentsPath))
        sourceText += fs.readFileSync(agentsPath, 'utf8');
    if (fs.existsSync(claudePath))
        sourceText += fs.readFileSync(claudePath, 'utf8');
    if (fs.existsSync(geminiPath))
        sourceText += fs.readFileSync(geminiPath, 'utf8');
    const result = (0, score_js_1.computeScore)(agentsResult, claudeResult, safetyResult, sourceText, geminiResult, consistencyResult);
    return { score: result.score, grade: result.grade, timestamp: new Date() };
}
// Watches the configured instruction files and invokes `onRescore` after each
// change, debounced by `config.debounceMs`. Rapid saves within the debounce
// window collapse into a single callback. Returns a handle to stop watching.
//
// fs.watch is platform-dependent (e.g. Windows may emit `rename` rather than
// `change`), so we react to ALL events and rely on the debounce + existence
// check to settle. Files that don't yet exist are skipped (no watcher created).
function watchAgentsFile(config, onRescore, deps = {}) {
    const watchFn = deps.watch ?? fs.watch;
    const exists = deps.existsSync ?? fs.existsSync;
    const setT = deps.setTimeout ?? setTimeout;
    const clearT = deps.clearTimeout ?? clearTimeout;
    // De-duplicate paths (agents and claude could be the same file) and only
    // watch files that exist.
    const targets = Array.from(new Set([config.agentsPath, config.claudePath]));
    let timer = null;
    let lastChanged = '';
    let closed = false;
    const schedule = (changedPath) => {
        if (closed)
            return;
        lastChanged = changedPath;
        if (timer !== null)
            clearT(timer);
        timer = setT(() => {
            timer = null;
            if (closed)
                return;
            onRescore(lastChanged);
        }, config.debounceMs);
    };
    const watchers = [];
    for (const target of targets) {
        if (!exists(target))
            continue;
        try {
            const watcher = watchFn(target, () => schedule(target));
            // Surface watcher errors (e.g. file removed) without crashing the process.
            watcher.on('error', () => {
                /* ignore — file may have been removed; next save re-triggers via dir */
            });
            watchers.push(watcher);
        }
        catch {
            // Unable to watch this path (e.g. permissions); skip it.
        }
    }
    return {
        close: () => {
            closed = true;
            if (timer !== null) {
                clearT(timer);
                timer = null;
            }
            for (const w of watchers) {
                try {
                    w.close();
                }
                catch {
                    // Ignore close errors.
                }
            }
        },
    };
}
// Formats a WatchResult for human-readable stdout in watch mode.
function formatWatchResult(result, changedPath) {
    const time = result.timestamp.toLocaleTimeString('en-US', { hour12: false });
    const file = path.basename(changedPath);
    return `[${time}] ${file} changed -> Grade: ${result.grade} (${result.score}/100)`;
}


/***/ }),

/***/ 317:
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ 896:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 928:
/***/ ((module) => {

module.exports = require("path");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(581);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=index.js.map