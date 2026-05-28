import * as core from '@actions/core';
import * as fs from 'fs';
import { checkAgentsFile, checkClaudeFile, checkGeminiFile, checkCrossFileConsistency } from './check.js';
import { discoverAgentsFiles } from './discover.js';
import { runSafetyCheck } from './safety.js';
import { computeScore } from './score.js';
import { getGitDiff, changedLinesForFile } from './diff.js';
import { loadConfig } from './config.js';
import type { Config } from './types.js';

async function run(): Promise<void> {
  try {
    const config = getConfig();

    // Optional .aikconfig.json — tunes line thresholds and safety rules.
    // Absent file yields {} (defaults). Validation warnings are surfaced via
    // core.warning so they appear in the Action log without failing the run.
    const { config: aik, warnings: aikWarnings } = loadConfig();
    for (const warning of aikWarnings) core.warning(`config: ${warning}`);

    const agentsFileCount = discoverAgentsFiles('.').length;
    const agentsResult = checkAgentsFile(config.agentsPath, {
      agentsFileCount,
      lineWarnThreshold: aik.check?.lineWarnThreshold,
      lineErrorThreshold: aik.check?.lineErrorThreshold,
    });
    const claudeResult = checkClaudeFile(config.claudePath, config.agentsPath);
    // GEMINI.md is optional — only validate it when the file is present.
    const geminiResult = fs.existsSync(config.geminiPath)
      ? checkGeminiFile(config.geminiPath, config.agentsPath)
      : null;
    const consistencyResult = checkCrossFileConsistency(
      config.agentsPath,
      config.claudePath,
      config.geminiPath,
    );
    // Full-file safety result is always used for scoring so diff mode never
    // inflates the grade by hiding pre-existing issues.
    const safetyResult = runSafetyCheck(config.agentsPath, '.aikignore', undefined, aik.safety);

    // Diff-aware safety: when enabled, the CI safety report is filtered to lines
    // changed in the current git diff. Falls back to the full result (with a
    // warning) when git is unavailable. Default 'off' keeps existing behavior.
    let safetyReport = safetyResult;
    if (config.diffMode === 'force') {
      const diff = getGitDiff('.');
      if (diff.error) {
        core.warning(`--diff (diff_mode) disabled: ${diff.error}. Scanning full file.`);
      } else {
        const changedLines = changedLinesForFile(diff.ranges, config.agentsPath);
        safetyReport = runSafetyCheck(config.agentsPath, '.aikignore', changedLines, aik.safety);
      }
    }

    let checkPassed = true;
    let safetyPassed = true;
    let totalWarnings = 0;

    if (config.mode === 'check' || config.mode === 'all') {
      core.info(`Checking ${config.agentsPath}...`);
      for (const error of agentsResult.errors) core.error(error);
      for (const warning of agentsResult.warnings) {
        core.warning(warning);
        totalWarnings++;
      }
      if (!agentsResult.passed) checkPassed = false;

      core.info(`Checking ${config.claudePath}...`);
      for (const error of claudeResult.errors) core.error(error);
      for (const warning of claudeResult.warnings) {
        core.warning(warning);
        totalWarnings++;
      }
      if (!claudeResult.passed) checkPassed = false;

      if (geminiResult) {
        core.info(`Checking ${config.geminiPath}...`);
        for (const error of geminiResult.errors) core.error(error);
        for (const warning of geminiResult.warnings) {
          core.warning(warning);
          totalWarnings++;
        }
        if (!geminiResult.passed) checkPassed = false;
      }

      for (const issue of consistencyResult.issues) {
        core.warning(`[${issue.type}] ${issue.message}`);
        totalWarnings++;
      }
    }

    if (config.mode === 'safety' || config.mode === 'all') {
      core.info(`Running safety check on ${config.agentsPath}...`);
      for (const finding of safetyReport.findings) {
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
      if (!safetyReport.passed && config.failOnSafety) safetyPassed = false;
    }

    const scoreResult = computeScore(
      agentsResult,
      claudeResult,
      safetyResult,
      undefined,
      geminiResult,
      consistencyResult,
    );

    core.setOutput('check_passed', (config.mode === 'check' || config.mode === 'all') ? checkPassed.toString() : 'skipped');
    core.setOutput('safety_passed', (config.mode === 'safety' || config.mode === 'all') ? safetyPassed.toString() : 'skipped');
    core.setOutput('warnings', totalWarnings.toString());
    core.setOutput('score', scoreResult.score.toString());
    core.setOutput('grade', scoreResult.grade);
    core.info(`Quality: ${scoreResult.grade} (${scoreResult.score}/100)`);

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

  // diff_mode accepts 'off' (default), 'force', or the boolean-ish 'true'/'false'
  // for ergonomics. 'true' is an alias for 'force'.
  const rawDiff = (core.getInput('diff_mode') || 'off').toLowerCase();
  let diffMode: 'off' | 'force' = 'off';
  if (rawDiff === 'force' || rawDiff === 'true') {
    diffMode = 'force';
  } else if (rawDiff !== 'off' && rawDiff !== 'false' && rawDiff !== '') {
    throw new Error(`Invalid diff_mode: ${rawDiff}. Must be off or force (true/false accepted).`);
  }

  return {
    mode,
    template,
    failOnSafety: core.getInput('fail_on_safety') === 'true',
    agentsPath: core.getInput('agents_path') || 'AGENTS.md',
    claudePath: core.getInput('claude_path') || 'CLAUDE.md',
    geminiPath: core.getInput('gemini_path') || 'GEMINI.md',
    diffMode,
  };
}

run();
