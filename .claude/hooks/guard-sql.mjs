// PreToolUse (Supabase execute_sql): read-only queries run; anything that
// changes data or schema asks the user first.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const sql = String(input.tool_input?.query || '')
  .replace(/--.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .trim()
  .toLowerCase();

const readOnly = /^(select|with|explain|show)\b/.test(sql)
  && !/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|vacuum|call|do|copy|merge|refresh)\b/.test(sql);

if (!readOnly) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: 'This query changes the live database.',
    },
  }));
}
