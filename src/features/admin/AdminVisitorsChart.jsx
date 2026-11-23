import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { axisTick, token } from '../analytics/chartTheme';
import { shortDate } from '../analytics/insightsWords';

/** Visitors per day. Lazy-loaded so recharts stays out of the dashboard's first paint. */
export default function AdminVisitorsChart({ rows }) {
  const data = rows.map((r) => ({ day: shortDate(r.day), people: Number(r.unique_visitors) || 0 }));
  const primary = token('--v2-primary');
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="adminVisitorsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary} stopOpacity={0.2} />
            <stop offset="100%" stopColor={primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" tick={axisTick()} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={32} />
        <Tooltip
          cursor={{ stroke: token('--v2-divider'), strokeWidth: 1 }}
          formatter={(v) => [v, 'People']}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ borderRadius: 12, border: `1px solid ${token('--v2-divider')}`, fontSize: 13 }}
        />
        <Area type="monotone" dataKey="people" stroke={primary} strokeWidth={2.5} fill="url(#adminVisitorsFill)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
