#!/usr/bin/env node
import * as fs from 'fs';
import { checkAgentsFile, checkClaudeFile } from './check.js';
import { runSafetyCheck } from './safety.js';
import { getTemplate, CLAUDE_TEMPLATE } from './templates.js';
import { detectProject, renderTemplate } from './detect.js';
import { computeScore } from './score.js';
import { discoverFiles } from './discover.js';

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

  if (fs.existsSync(agentsPath)) {
    console.error(`${agentsPath} already exists. Remove it first or edit manually.`);
    process.exit(1);
  }

  if (fs.existsSync(claudePath)) {
    console.error(`${claudePath} already exists. Remove it first or edit manually.`);
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

  console.log(`Created ${agentsPath} (${template} template)`);
  console.log(`Created ${claudePath}`);
  if (!detected) {
    console.log('\nNext steps:');
    console.log('1. Edit AGENTS.md with your project-specific instructions');
    console.log('2. Commit both files to your repo');
  } else {
    console.log('\nStack auto-detected — review the generated AGENTS.md and adjust as needed.');
  }
}

function runCheck(args: string[]): void {
  const json = hasFlag(args, '--json');
  const agentsPath = getArg(args, '--agents', 'AGENTS.md');
  const claudePath = getArg(args, '--claude', 'CLAUDE.md');

  const agentsResult = checkAgentsFile(agentsPath);
  const claudeResult = checkClaudeFile(claudePath, agentsPath);

  if (json) {
    console.log(JSON.stringify({
      agents: { path: agentsPath, ...agentsResult },
      claude: { path: claudePath, ...claudeResult },
      passed: agentsResult.passed && claudeResult.passed,
    }, null, 2));
    process.exit(agentsResult.passed && claudeResult.passed ? 0 : 1);
    return;
  }

  console.log(`Checking ${agentsPath}...`);
  for (const error of agentsResult.errors) console.error(`  ERROR: ${error}`);
  for (const warning of agentsResult.warnings) console.warn(`  WARN: ${warning}`);

  console.log(`Checking ${claudePath}...`);
  for (const error of claudeResult.errors) console.error(`  ERROR: ${error}`);
  for (const warning of claudeResult.warnings) console.warn(`  WARN: ${warning}`);

  if (agentsResult.passed && claudeResult.passed) {
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

  const claudePath = getArg(args, '--claude', 'CLAUDE.md');
  const discovered = discover ? discoverFiles('.') : [];
  if (discover && fs.existsSync(claudePath)) discovered.unshift(claudePath);
  const files = [agentsPath, ...discovered];
  const allResults: Record<string, ReturnType<typeof runSafetyCheck>> = {};

  for (const file of files) {
    allResults[file] = runSafetyCheck(file);
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
  const agentsPath = getArg(args, '--agents', 'AGENTS.md');
  const claudePath = getArg(args, '--claude', 'CLAUDE.md');

  const agentsResult = checkAgentsFile(agentsPath);
  const claudeResult = checkClaudeFile(claudePath, agentsPath);
  const safetyResult = runSafetyCheck(agentsPath);

  const result = computeScore(agentsResult, claudeResult, safetyResult);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
    return;
  }

  console.log(`\nGrade: ${result.grade}  (${result.score}/100)`);
  console.log('');
  for (const [category, points] of Object.entries(result.breakdown)) {
    console.log(`  ${category}: ${points}`);
  }
  if (result.suggestions.length > 0) {
    console.log('\nSuggestions:');
    for (const suggestion of result.suggestions) {
      console.log(`  - ${suggestion}`);
    }
  }
  console.log('');
}

function printHelp(): void {
  console.log(`
agent-instructions-kit

Commands:
  init      Generate AGENTS.md and CLAUDE.md files
  check     Validate that required sections exist
  safety    Check for suspicious/dangerous patterns
  score     Grade your instruction files (A-F)

Options:
  init:
    -t, --template <name>   Template: minimal (default) or opinionated

  check:
    --agents <path>         Path to AGENTS.md (default: AGENTS.md)
    --claude <path>         Path to CLAUDE.md (default: CLAUDE.md)
    --json                  Output results as JSON

  safety:
    --agents <path>         Path to AGENTS.md (default: AGENTS.md)
    --fail                  Exit with error code if issues found
    --json                  Output results as JSON
    --discover              Also scan other agent config files

  score:
    --agents <path>         Path to AGENTS.md (default: AGENTS.md)
    --claude <path>         Path to CLAUDE.md (default: CLAUDE.md)
    --json                  Output results as JSON

Examples:
  npx agent-instructions-kit init
  npx agent-instructions-kit init --template opinionated
  npx agent-instructions-kit check
  npx agent-instructions-kit check --json
  npx agent-instructions-kit safety --fail
  npx agent-instructions-kit safety --discover
  npx agent-instructions-kit score
`);
}

main();
