'use client';

import { Line, LineChart, ResponsiveContainer } from 'recharts';

export function MiniSpark({
  data,
  stroke = 'var(--sibling-primary)',
}: {
  data: number[];
  stroke?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="mt-2 h-9 w-full rounded-md bg-[var(--glass)]/40 border border-[var(--glass-border)]/35" />
    );
  }
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="mt-2 h-9 w-full min-w-0 opacity-95">
      <ResponsiveContainer width="100%" height={36} minWidth={0}>
        <LineChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
