// PostToolUse (Edit|Write): lints the edited JS/JSX file. Silent when clean.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path || '';
if (!/\.(jsx?|mjs)$/.test(file) || /node_modules|[\\/]dist/.test(file)) process.exit(0);

try {
  execFileSync('npx', ['--no-install', 'oxlint', '--deny-warnings', file], {
    cwd: process.env.CLAUDE_PROJECT_DIR, stdio: 'pipe', shell: true,
  });
} catch (err) {
  const out = `${err.stdout || ''}${err.stderr || ''}`.trim();
  if (out) {
    process.stderr.write(`Lint problems in ${file}:\n${out.slice(0, 3000)}\n`);
    process.exit(2);
  }
}
