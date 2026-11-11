// Stop: if src/ or scripts/ have uncommitted changes, run `npm test`.
// Failure blocks the stop so Claude fixes it. Silent on success.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const input = JSON.parse(readFileSync(0, 'utf8'));
if (input.stop_hook_active) process.exit(0); // already retried once — don't loop

const cwd = process.env.CLAUDE_PROJECT_DIR;
const changed = execSync('git status --porcelain -- src scripts', { cwd, encoding: 'utf8' }).trim();
if (!changed) process.exit(0);

try {
  execSync('npm test', { cwd, stdio: 'pipe' });
} catch (err) {
  const out = `${err.stdout || ''}${err.stderr || ''}`.trim();
  process.stderr.write(`npm test failed — fix before finishing:\n${out.slice(-3000)}\n`);
  process.exit(2);
}
