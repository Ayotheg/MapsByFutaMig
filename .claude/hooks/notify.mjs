// Desktop notification without blocking Claude. Usage: node notify.mjs "message"
// Windows only (notify.ps1); on other systems it does nothing.
import { spawn } from 'node:child_process';
import { join } from 'node:path';

if (process.platform === 'win32') {
  const script = join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.claude', 'hooks', 'notify.ps1');
  spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-File', script, process.argv[2] || 'Claude Code is done'], {
    detached: true, stdio: 'ignore', windowsHide: true,
  }).unref();
}
