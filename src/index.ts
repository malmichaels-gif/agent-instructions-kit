import * as core from '@actions/core';
import { checkAgentsFile, checkClaudeFile } from './check.js';
import { runSafetyCheck } from './safety.js';
import type { Config } from './types.js';

async function run(): Promise<void> {
  try {
    const config = getConfig();

    let checkPassed = true;
    let safetyPassed = true;
    let totalWarnings = 0;

    // Run check
    if (config.mode === 'check' || config.mode === 'all') {
      core.info(`Checking ${config.agentsPath}...`);
      const agentsResult = checkAgentsFile(config.agentsPath);

      for (const error of agentsResult.errors) {
        core.error(error);
      }
      for (const warning of agentsResult.warnings) {
        core.warning(warning);
        totalWarnings++;
      }

      if (!agentsResult.passed) {
        checkPassed = false;
      }

      core.info(`Checking ${config.claudePath}...`);
      const claudeResult = checkClaudeFile(config.claudePath, config.agentsPath);

      for (const error of claudeResult.errors) {
        core.error(error);
      }
      for (const warning of claudeResult.warnings) {
        core.warning(warning);
        totalWarnings++;
      }

      if (!claudeResult.passed) {
        checkPassed = false;
      }
    }

    // Run safety
    if (config.mode === 'safety' || config.mode === 'all') {
      core.info(`Running safety check on ${config.agentsPath}...`);
      const safetyResult = runSafetyCheck(config.agentsPath);

      for (const finding of safetyResult.findings) {
        const msg = `[${finding.ruleId}] Line ${finding.line}: ${finding.message}`;
        if (finding.severity === 'error') {
          if (config.failOnSafety) {
            core.error(msg);
          } else {
            core.warning(msg);
          }
        } else {
          core.warning(msg);
        }
        totalWarnings++;
      }

      if (!safetyResult.passed && config.failOnSafety) {
        safetyPassed = false;
      }
    }

    // Set outputs
    core.setOutput('check_passed', checkPassed.toString());
    core.setOutput('safety_passed', safetyPassed.toString());
    core.setOutput('warnings', totalWarnings.toString());

    if (!checkPassed) {
      core.setFailed('Check failed: missing required sections or invalid files');
    } else if (!safetyPassed) {
      core.setFailed('Safety check failed: suspicious patterns detected');
    } else {
      core.info('All checks passed!');
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

function getConfig(): Config {
  const mode = core.getInput('mode') || 'check';
  if (mode !== 'check' && mode !== 'safety' && mode !== 'all') {
    throw new Error(`Invalid mode: ${mode}. Must be check, safety, or all.`);
  }

  const template = core.getInput('template') || 'minimal';
  if (template !== 'minimal' && template !== 'opinionated') {
    throw new Error(`Invalid template: ${template}. Must be minimal or opinionated.`);
  }

  return {
    mode,
    template,
    failOnSafety: core.getInput('fail_on_safety') === 'true',
    agentsPath: core.getInput('agents_path') || 'AGENTS.md',
    claudePath: core.getInput('claude_path') || 'CLAUDE.md',
  };
}

run();
