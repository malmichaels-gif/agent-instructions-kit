import * as fs from 'fs';
import * as path from 'path';

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

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export function detectProject(dir = '.'): ProjectInfo | null {
  if (fs.existsSync(path.join(dir, 'package.json'))) return detectNode(dir);
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) return detectRust(dir);
  if (fs.existsSync(path.join(dir, 'pyproject.toml')) || fs.existsSync(path.join(dir, 'requirements.txt'))) return detectPython(dir);
  if (fs.existsSync(path.join(dir, 'go.mod'))) return detectGo(dir);
  return null;
}

function detectNode(dir: string): ProjectInfo | null {
  const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf-8');
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return null;
  }
  const scripts = pkg.scripts || {};
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  let framework = 'Node.js';
  if (allDeps['next']) framework = 'Next.js';
  else if (allDeps['@angular/core']) framework = 'Angular';
  else if (allDeps['vue']) framework = 'Vue';
  else if (allDeps['react']) framework = 'React';
  else if (allDeps['express']) framework = 'Express';
  else if (allDeps['fastify']) framework = 'Fastify';
  else if (allDeps['@nestjs/core']) framework = 'NestJS';

  const language = allDeps['typescript'] ? 'TypeScript' : 'JavaScript';

  const commands: ProjectInfo['commands'] = {
    install: '`npm install`',
    test: scripts['test'] ? '`npm test`' : '`npm test` (no test script found — add one)',
  };

  if (scripts['typecheck'] || scripts['type-check']) {
    commands.typecheck = scripts['typecheck'] ? '`npm run typecheck`' : '`npm run type-check`';
  }
  if (scripts['lint']) commands.lint = '`npm run lint`';
  if (scripts['build']) commands.build = '`npm run build`';

  return { language, framework, commands };
}

function detectRust(dir: string): ProjectInfo {
  let framework = 'Rust';
  const cargoContent = fs.readFileSync(path.join(dir, 'Cargo.toml'), 'utf-8');
  if (cargoContent.includes('actix-web')) framework = 'Actix Web';
  else if (cargoContent.includes('axum')) framework = 'Axum';
  else if (cargoContent.includes('rocket')) framework = 'Rocket';
  else if (cargoContent.includes('tauri')) framework = 'Tauri';

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

function detectPython(dir: string): ProjectInfo {
  let framework = 'Python';
  const testCmd = '`pytest`';
  let installCmd = '`pip install -e ".[dev]"`';
  let lintCmd: string | undefined;

  const pyprojectPath = path.join(dir, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    const content = fs.readFileSync(pyprojectPath, 'utf-8');
    if (content.includes('fastapi')) framework = 'FastAPI';
    else if (content.includes('django')) framework = 'Django';
    else if (content.includes('flask')) framework = 'Flask';

    if (content.includes('poetry')) installCmd = '`poetry install`';
    else if (content.includes('[tool.uv]')) installCmd = '`uv sync`';

    if (content.includes('ruff')) lintCmd = '`ruff check .`';
    else if (content.includes('flake8')) lintCmd = '`flake8`';
  }

  if (installCmd === '`pip install -e ".[dev]"`' && fs.existsSync(path.join(dir, 'requirements.txt'))) {
    installCmd = '`pip install -r requirements.txt`';
  }

  const commands: ProjectInfo['commands'] = {
    install: installCmd,
    test: testCmd,
  };
  if (lintCmd) commands.lint = lintCmd;

  return { language: 'Python', framework, commands };
}

function detectGo(_dir: string): ProjectInfo {
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

export function renderTemplate(base: string, info: ProjectInfo): string {
  let result = base;

  result = result.replace(
    '[List primary language, framework, and key libraries]',
    `${info.language} / ${info.framework}`,
  );

  const cmdLines: string[] = [];
  cmdLines.push(`- Install: ${info.commands.install}`);
  if (info.commands.typecheck) cmdLines.push(`- Typecheck: ${info.commands.typecheck}`);
  if (info.commands.lint) cmdLines.push(`- Lint: ${info.commands.lint}`);
  cmdLines.push(`- Test: ${info.commands.test}`);
  if (info.commands.build) cmdLines.push(`- Build: ${info.commands.build}`);

  const cmdSection = result.match(/## Local dev commands\n([\s\S]*?)(?=\n##|\n*$)/);
  if (cmdSection) {
    const newCmds = `## Local dev commands\n${cmdLines.join('\n')}\n`;
    result = result.replace(cmdSection[0], newCmds);
  }

  const verifyLines: string[] = [];
  verifyLines.push(`- Run ${info.commands.test} before declaring any task complete`);
  if (info.commands.typecheck) verifyLines.push(`- Run ${info.commands.typecheck} to catch type errors`);

  if (base.includes('A task is not done until all of these pass:')) {
    const exitLines: string[] = [];
    if (info.commands.typecheck) exitLines.push(`- ${info.commands.typecheck} exits 0`);
    if (info.commands.lint) exitLines.push(`- ${info.commands.lint} exits 0`);
    exitLines.push(`- ${info.commands.test} exits 0`);
    if (info.commands.build) exitLines.push(`- ${info.commands.build} exits 0`);

    const oldVerify = result.match(/A task is not done until all of these pass:\n([\s\S]*?)(?=\n##|\n*$)/);
    if (oldVerify) {
      result = result.replace(oldVerify[0], `A task is not done until all of these pass:\n${exitLines.join('\n')}\n`);
    }
  } else {
    const simpleVerify = result.match(/## Verification\n([\s\S]*?)(?=\n##|\n*$)/);
    if (simpleVerify) {
      const newVerify = `## Verification\n${verifyLines.join('\n')}\n- Never claim success without checking actual output\n`;
      result = result.replace(simpleVerify[0], newVerify);
    }
  }

  return result;
}
