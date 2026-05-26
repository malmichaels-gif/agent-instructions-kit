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
const fs = __importStar(__nccwpck_require__(896));
const REQUIRED_SECTIONS = [
    'Mission',
    'Local dev commands',
];
function checkAgentsFile(path) {
    const errors = [];
    const warnings = [];
    // Check file exists
    if (!fs.existsSync(path)) {
        return {
            passed: false,
            errors: [`File not found: ${path}`],
            warnings: [],
        };
    }
    const content = fs.readFileSync(path, 'utf-8');
    // Check not empty
    if (content.trim().length === 0) {
        return {
            passed: false,
            errors: [`File is empty: ${path}`],
            warnings: [],
        };
    }
    // Check required sections
    for (const section of REQUIRED_SECTIONS) {
        const pattern = new RegExp(`^##\\s+${section}`, 'mi');
        if (!pattern.test(content)) {
            errors.push(`Missing required section: "${section}"`);
        }
    }
    // Check for placeholder text
    if (content.includes('TODO') || content.includes('FIXME')) {
        warnings.push('File contains TODO/FIXME placeholders');
    }
    return {
        passed: errors.length === 0,
        errors,
        warnings,
    };
}
function checkClaudeFile(path, _agentsPath) {
    const errors = [];
    const warnings = [];
    // Check file exists
    if (!fs.existsSync(path)) {
        return {
            passed: false,
            errors: [`File not found: ${path}`],
            warnings: [],
        };
    }
    const content = fs.readFileSync(path, 'utf-8');
    // Check not empty
    if (content.trim().length === 0) {
        return {
            passed: false,
            errors: [`File is empty: ${path}`],
            warnings: [],
        };
    }
    // Check it references AGENTS.md
    if (!content.includes('AGENTS.md')) {
        warnings.push('CLAUDE.md should reference AGENTS.md as source of truth');
    }
    return {
        passed: errors.length === 0,
        errors,
        warnings,
    };
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
function main() {
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
    if (fs.existsSync(agentsPath)) {
        console.error(`${agentsPath} already exists. Remove it first or edit manually.`);
        process.exit(1);
    }
    if (fs.existsSync(claudePath)) {
        console.error(`${claudePath} already exists. Remove it first or edit manually.`);
        process.exit(1);
    }
    fs.writeFileSync(agentsPath, (0, templates_js_1.getTemplate)(template));
    fs.writeFileSync(claudePath, templates_js_1.CLAUDE_TEMPLATE);
    console.log(`Created ${agentsPath} (${template} template)`);
    console.log(`Created ${claudePath}`);
    console.log('\nNext steps:');
    console.log('1. Edit AGENTS.md with your project-specific instructions');
    console.log('2. Commit both files to your repo');
}
function runCheck(args) {
    let agentsPath = 'AGENTS.md';
    let claudePath = 'CLAUDE.md';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--agents') {
            agentsPath = args[i + 1];
            i++;
        }
        else if (args[i] === '--claude') {
            claudePath = args[i + 1];
            i++;
        }
    }
    console.log(`Checking ${agentsPath}...`);
    const agentsResult = (0, check_js_1.checkAgentsFile)(agentsPath);
    for (const error of agentsResult.errors) {
        console.error(`  ERROR: ${error}`);
    }
    for (const warning of agentsResult.warnings) {
        console.warn(`  WARN: ${warning}`);
    }
    console.log(`Checking ${claudePath}...`);
    const claudeResult = (0, check_js_1.checkClaudeFile)(claudePath, agentsPath);
    for (const error of claudeResult.errors) {
        console.error(`  ERROR: ${error}`);
    }
    for (const warning of claudeResult.warnings) {
        console.warn(`  WARN: ${warning}`);
    }
    if (agentsResult.passed && claudeResult.passed) {
        console.log('\nAll checks passed!');
        process.exit(0);
    }
    else {
        console.log('\nCheck failed.');
        process.exit(1);
    }
}
function runSafety(args) {
    let agentsPath = 'AGENTS.md';
    let failOnSafety = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--agents') {
            agentsPath = args[i + 1];
            i++;
        }
        else if (args[i] === '--fail') {
            failOnSafety = true;
        }
    }
    console.log(`Running safety check on ${agentsPath}...`);
    const result = (0, safety_js_1.runSafetyCheck)(agentsPath);
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
    }
    else {
        console.log(`\n${result.findings.length} finding(s).`);
        process.exit(0);
    }
}
function printHelp() {
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
function runSafetyCheck(path, ignorePath = '.aikignore') {
    const findings = [];
    if (!fs.existsSync(path)) {
        return { passed: true, findings: [] };
    }
    const ignored = loadIgnoredRules(ignorePath);
    const content = fs.readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const rule of SAFETY_RULES) {
            if (ignored.has(rule.id))
                continue;
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

/***/ 340:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CLAUDE_TEMPLATE = exports.OPINIONATED_TEMPLATE = exports.MINIMAL_TEMPLATE = void 0;
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

## Change rules
- Update README if you change behavior
- Add tests for new features
- Keep PRs focused — one concern per PR
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

## Output rules
- Keep output clear and scannable
- Prefer structured data over prose
- Error messages should be actionable

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

## What NOT to do
- Don't add dependencies without discussion
- Don't bypass tests or linting
- Don't commit secrets or credentials
- Don't ignore type errors or lint warnings
`;
exports.CLAUDE_TEMPLATE = `Follow AGENTS.md exactly. If AGENTS.md conflicts with any other instructions, AGENTS.md wins.
`;
function getTemplate(name) {
    return name === 'minimal' ? exports.MINIMAL_TEMPLATE : exports.OPINIONATED_TEMPLATE;
}


/***/ }),

/***/ 896:
/***/ ((module) => {

module.exports = require("fs");

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