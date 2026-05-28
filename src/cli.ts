#!/usr/bin/env node
import * as fs from 'fs';
import { checkAgentsFile, checkClaudeFile, checkGeminiFile, checkCrossFileConsistency } from './check.js';
import { runSafetyCheck } from './safety.js';
import { getTemplate, CLAUDE_TEMPLATE, GEMINI_TEMPLATE } from './templates.js';
import { detectProject, renderTemplate } from './detect.js';
import { computeScore, generateBadge } from './score.js';
import type { BadgeFormat } from './types.js';
import { discoverFiles, discoverAgentsFiles } from './discover.js';
import { runFix } from './fix.js';
import { watchAgentsFile, computeWatchScore, formatWatchResult } from './watch.js';
import { getGitDiff, changedLinesForFile } from './diff.js';
import { renderHookSettings } from './hooks.js';
import { loadConfig } from './config.js';

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function getArg(args: string[], flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  const value = args[idx + 1];
  if (value.startsWith('-')) return fallback;
  return value;
}

// Surface .aikconfig.json validation warnings (invalid JSON, unknown keys,
// bad severities, uncompilable patterns) without failing the command. Skipped
// in JSON/badge output modes to keep machine-readable output clean.
function reportConfigWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    console.warn(`  CONFIG: ${warning}`);
  }
}

function main(): void {
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

function runInit(args: string[]): void {
  let template: 'minimal' | 'opinionated' = 'minimal';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--template' || args[i] === '-t') {
      const t = args[i + 1];
      if (t === 'minimal' || t === 'opinionated') {
        template = t;
      } else {
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

  let content = getTemplate(template);
  const detected = detectProject('.');
  if (detected) {
    content = renderTemplate(content, detected);
    console.log(`Detected ${detected.language} / ${detected.framework} project`);
  }

  fs.writeFileSync(agentsPath, content);
  fs.writeFileSync(claudePath, CLAUDE_TEMPLATE);
  fs.writeFileSync(geminiPath, GEMINI_TEMPLATE);

  console.log(`Created ${agentsPath} (${template} template)`);
  console.log(`Created ${claudePath}`);
  console.log(`Created ${geminiPath}`);
  if (!detected) {
    console.log('\nNext steps:');
    console.log('1. Edit AGENTS.md with your project-specific instructions');
    console.log('2. Commit all three files to your repo');
  } else {
    console.log('\nStack auto-detected — review the generated AGENTS.md and adjust as needed.');
  }
}

function runCheck(args: string[]): void {
  const json = hasFlag(args, '--json');
  const agentsPath = getArg(args, '--agents', 'AGENTS.md');
  const claudePath = getArg(args, '--claude', 'CLAUDE.md');
  const geminiPath = getArg(args, '--gemini', 'GEMINI.md');

  const { config, warnings: configWarnings } = loadConfig();
  if (!json) reportConfigWarnings(configWarnings);

  const agentsFileCount = discoverAgentsFiles('.').length;
  const agentsResult = checkAgentsFile(agentsPath, {
    agentsFileCount,
    lineWarnThreshold: config.check?.lineWarnThreshold,
    lineErrorThreshold: config.check?.lineErrorThreshold,
  });
  const claudeResult = checkClaudeFile(claudePath, agentsPath);
  // GEMINI.md is optional — only validate it when the file is present.
  const geminiExists = fs.existsSync(geminiPath);
  const geminiResult = geminiExists ? checkGeminiFile(geminiPath, agentsPath) : null;
  const consistencyResult = checkCrossFileConsistency(agentsPath, claudePath, geminiPath);

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
  for (const error of agentsResult.errors) console.error(`  ERROR: ${error}`);
  for (const warning of agentsResult.warnings) console.warn(`  WARN: ${warning}`);

  console.log(`Checking ${claudePath}...`);
  for (const error of claudeResult.errors) console.error(`  ERROR: ${error}`);
  for (const warning of claudeResult.warnings) console.warn(`  WARN: ${warning}`);

  if (geminiResult) {
    console.log(`Checking ${geminiPath}...`);
    for (const error of geminiResult.errors) console.error(`  ERROR: ${error}`);
    for (const warning of geminiResult.warnings) console.warn(`  WARN: ${warning}`);
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
    const settings = renderHookSettings(hookSuggestions);
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
  } else {
    console.log('\nCheck failed.');
    process.exit(1);
  }
}

function runSafety(args: string[]): void {
  const json = hasFlag(args, '--json');
  const failOnSafety = hasFlag(args, '--fail');
  const agentsPath = getArg(args, '--agents', 'AGENTS.md');
  const discover = hasFlag(args, '--discover');
  const diffMode = hasFlag(args, '--diff') || hasFlag(args, '--changed-only');

  const claudePath = getArg(args, '--claude', 'CLAUDE.md');

  const { config, warnings: configWarnings } = loadConfig();
  if (!json) reportConfigWarnings(configWarnings);
  const safetyConfig = config.safety;

  const discovered = discover ? discoverFiles('.') : [];
  if (discover && fs.existsSync(claudePath)) discovered.unshift(claudePath);
  const files = [agentsPath, ...discovered];

  // Diff-aware mode: read the current git diff once and filter findings to
  // changed lines. Degrade gracefully (warn + scan whole file) when git is
  // unavailable or the directory is not a repository.
  let diffResult: ReturnType<typeof getGitDiff> | null = null;
  if (diffMode) {
    diffResult = getGitDiff('.');
    if (diffResult.error && !json) {
      console.warn(`  WARN: --diff disabled: ${diffResult.error}. Scanning full files.`);
    }
  }

  const allResults: Record<string, ReturnType<typeof runSafetyCheck>> = {};

  for (const file of files) {
    const changedLines =
      diffResult && !diffResult.error
        ? changedLinesForFile(diffResult.ranges, file)
        : undefined;
    allResults[file] = runSafetyCheck(file, '.aikignore', changedLines, safetyConfig);
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
    if (!result.passed) anyFailed = true;
  }

  if (totalFindings === 0) {
    console.log('No safety issues found.');
    process.exit(0);
  }

  if (anyFailed && failOnSafety) {
    console.log('\nSafety check failed.');
    process.exit(1);
  } else {
    console.log(`\n${totalFindings} finding(s).`);
    process.exit(0);
  }
}

function runScore(args: string[]): void {
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
  const badgeFormat: BadgeFormat = badgeFormatArg;

  const { config, warnings: configWarnings } = loadConfig();
  if (!json && !badge) reportConfigWarnings(configWarnings);

  const agentsFileCount = discoverAgentsFiles('.').length;
  const agentsResult = checkAgentsFile(agentsPath, {
    agentsFileCount,
    lineWarnThreshold: config.check?.lineWarnThreshold,
    lineErrorThreshold: config.check?.lineErrorThreshold,
  });
  const claudeResult = checkClaudeFile(claudePath, agentsPath);
  const geminiResult = fs.existsSync(geminiPath) ? checkGeminiFile(geminiPath, agentsPath) : null;
  const consistencyResult = checkCrossFileConsistency(agentsPath, claudePath, geminiPath);
  const safetyResult = runSafetyCheck(agentsPath, '.aikignore', undefined, config.safety);

  let sourceText = '';
  if (fs.existsSync(agentsPath)) sourceText += fs.readFileSync(agentsPath, 'utf8');
  if (fs.existsSync(claudePath)) sourceText += fs.readFileSync(claudePath, 'utf8');
  if (fs.existsSync(geminiPath)) sourceText += fs.readFileSync(geminiPath, 'utf8');

  const result = computeScore(
    agentsResult,
    claudeResult,
    safetyResult,
    sourceText,
    geminiResult,
    consistencyResult,
  );

  const badgeText = badge ? generateBadge(result.grade, badgeFormat) : undefined;
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
    if (badgeOutput) console.log(`\nBadge written to ${badgeOutput}`);
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

function runFixCommand(args: string[]): void {
  const json = hasFlag(args, '--json');
  const dryRun = hasFlag(args, '--dry-run');
  const agentsPath = getArg(args, '--agents', 'AGENTS.md');
  const claudePath = getArg(args, '--claude', 'CLAUDE.md');

  const report = runFix({ agentsPath, claudePath, dryRun });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
    return;
  }

  if (report.applied.length === 0) {
    console.log('No auto-fixable issues found.');
    process.exit(0);
    return;
  }

  const verb = dryRun ? 'Would fix' : 'Fixed';
  console.log(`${verb} ${report.applied.length} issue(s):`);
  for (const action of report.applied) {
    const loc = action.lineNumber !== null ? `Line ${action.lineNumber}` : 'end of file';
    console.log(`  [${action.type}] ${action.path} (${loc}): ${action.description}`);
  }

  if (dryRun) {
    console.log('\nDry run — no files were written. Re-run without --dry-run to apply.');
  } else {
    console.log('\nFiles updated. Review the changes and re-run `check` / `safety` to confirm.');
  }
  process.exit(0);
}

function runWatch(args: string[]): void {
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
  const initial = computeWatchScore(config);
  console.log(`Watching ${agentsPath} and ${claudePath} for changes (debounce ${debounceMs}ms)...`);
  console.log(`Initial Grade: ${initial.grade} (${initial.score}/100)`);
  console.log('Press Ctrl+C to stop.\n');

  const handle = watchAgentsFile(config, (changedPath) => {
    try {
      const result = computeWatchScore(config);
      console.log(formatWatchResult(result, changedPath));
    } catch (err) {
      console.error(`  Re-score failed: ${(err as Error).message}`);
    }
  });

  // Clean up watchers + timers on Ctrl+C so we don't leave orphaned handles.
  const shutdown = (): void => {
    handle.close();
    console.log('\nStopped watching.');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function printHelp(): void {
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
