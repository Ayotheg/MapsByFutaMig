// Notification without blocking Claude. Usage: node notify.mjs "message"
// Desktop: Windows only (notify.ps1). Phone: set NTFY_TOPIC (ntfy.sh app).
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const topic = process.env.NTFY_TOPIC;
if (topic) {
  await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: 'POST',
    body: `Maps By FUTA: ${process.argv[2] || 'Claude Code is done'}`,
  }).catch(() => {});
}

if (process.platform === 'win32') {
  const script = join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.claude', 'hooks', 'notify.ps1');
  spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-File', script, process.argv[2] || 'Claude Code is done'], {
    detached: true, stdio: 'ignore', windowsHide: true,
  }).unref();
}
