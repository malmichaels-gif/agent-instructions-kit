#!/usr/bin/env node
import * as fs from 'fs';
import { checkAgentsFile, checkClaudeFile } from './check.js';
import { runSafetyCheck } from './safety.js';
import { getTemplate, CLAUDE_TEMPLATE } from './templates.js';

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case 'init':
      runInit(args.slice(1));
      break;
    case 'check':
      runCheck(args.slice(1));
      break;
    case 'safety':
      runSafety(args.slice(1));
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

  fs.writeFileSync(agentsPath, getTemplate(template));
  fs.writeFileSync(claudePath, CLAUDE_TEMPLATE);

  console.log(`Created ${agentsPath} (${template} template)`);
  console.log(`Created ${claudePath}`);
  console.log('\nNext steps:');
  console.log('1. Edit AGENTS.md with your project-specific instructions');
  console.log('2. Commit both files to your repo');
}

function runCheck(args: string[]): void {
  let agentsPath = 'AGENTS.md';
  let claudePath = 'CLAUDE.md';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agents') {
      agentsPath = args[i + 1];
      i++;
    } else if (args[i] === '--claude') {
      claudePath = args[i + 1];
      i++;
    }
  }

  console.log(`Checking ${agentsPath}...`);
  const agentsResult = checkAgentsFile(agentsPath);

  for (const error of agentsResult.errors) {
    console.error(`  ERROR: ${error}`);
  }
  for (const warning of agentsResult.warnings) {
    console.warn(`  WARN: ${warning}`);
  }

  console.log(`Checking ${claudePath}...`);
  const claudeResult = checkClaudeFile(claudePath, agentsPath);

  for (const error of claudeResult.errors) {
    console.error(`  ERROR: ${error}`);
  }
  for (const warning of claudeResult.warnings) {
    console.warn(`  WARN: ${warning}`);
  }

  if (agentsResult.passed && claudeResult.passed) {
    console.log('\nAll checks passed!');
    process.exit(0);
  } else {
    console.log('\nCheck failed.');
    process.exit(1);
  }
}

function runSafety(args: string[]): void {
  let agentsPath = 'AGENTS.md';
  let failOnSafety = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agents') {
      agentsPath = args[i + 1];
      i++;
    } else if (args[i] === '--fail') {
      failOnSafety = true;
    }
  }

  console.log(`Running safety check on ${agentsPath}...`);
  const result = runSafetyCheck(agentsPath);

  if (result.findings.length === 0) {
    console.log('No safety issues found.');
    process.exit(0);
  }

  for (const finding of result.findings) {
    const prefix = finding.severity === 'error' ? 'ERROR' : 'WARN';
    console.log(`  ${prefix} [${finding.ruleId}] Line ${finding.line}: ${finding.message}`);
  }

  if (!result.passed && failOnSafety) {
    console.log('\nSafety check failed.');
    process.exit(1);
  } else {
    console.log(`\n${result.findings.length} finding(s).`);
    process.exit(0);
  }
}

function printHelp(): void {
  console.log(`
agent-instructions-kit

Commands:
  init      Generate AGENTS.md and CLAUDE.md files
  check     Validate that required sections exist
  safety    Check for suspicious/dangerous patterns

Options:
  init:
    -t, --template <name>   Template: minimal (default) or opinionated

  check:
    --agents <path>         Path to AGENTS.md (default: AGENTS.md)
    --claude <path>         Path to CLAUDE.md (default: CLAUDE.md)

  safety:
    --agents <path>         Path to AGENTS.md (default: AGENTS.md)
    --fail                  Exit with error code if issues found

Examples:
  npx agent-instructions-kit init
  npx agent-instructions-kit init --template opinionated
  npx agent-instructions-kit check
  npx agent-instructions-kit safety --fail
`);
}

main();
