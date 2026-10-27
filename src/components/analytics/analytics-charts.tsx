"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ApplicationStatus, TimeSeriesPoint } from "@/types";

/**
 * Recharts wrappers.
 *
 * Charts read their colours from the design tokens (`--chart-*`), so they follow
 * the light/dark theme without a second palette. Nothing here computes data: the
 * views pass in already-derived series, which keeps the maths testable in
 * `src/features/analytics`.
 */

const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" } as const;

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--popover-foreground)",
  fontSize: 12,
} as const;

const GRID_STROKE = "var(--border)";

/** Colour per pipeline status, reused by the donut and its legend. */
const STATUS_COLORS: Record<ApplicationStatus, string> = {
  interested: "var(--chart-2)",
  saved: "var(--chart-1)",
  applied: "var(--chart-1)",
  screening: "var(--chart-2)",
  interview: "var(--chart-5)",
  assessment: "var(--chart-4)",
  offer: "var(--chart-3)",
  rejected: "var(--chart-4)",
  withdrawn: "var(--muted-foreground)",
};

interface ChartProps {
  className?: string;
}

export function ApplicationsOverTimeChart({
  data,
  className,
}: ChartProps & { data: TimeSeriesPoint[] }): React.ReactElement {
  return (
    <div className={`h-64 w-full${className ? ` ${className}` : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            allowDecimals={false}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            formatter={(value) => [`${value}`, "Applications"]}
          />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonutChart({
  data,
  className,
}: ChartProps & {
  data: { status: ApplicationStatus; label: string; count: number }[];
}): React.ReactElement {
  return (
    <div className={`h-64 w-full${className ? ` ${className}` : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="var(--card)"
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [`${value}`, name]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span className="text-xs text-muted-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MatchDistributionChart({
  data,
  className,
}: ChartProps & { data: { bucket: string; count: number }[] }): React.ReactElement {
  return (
    <div className={`h-56 w-full${className ? ` ${className}` : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="bucket" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            allowDecimals={false}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            formatter={(value) => [`${value}`, "Jobs"]}
          />
          <Bar dataKey="count" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SkillBarChart({
  data,
  color = "var(--chart-1)",
  className,
}: ChartProps & {
  data: { label: string; count: number }[];
  color?: string;
}): React.ReactElement {
  return (
    <div className={`h-64 w-full${className ? ` ${className}` : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={104}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            formatter={(value) => [`${value}`, "Jobs"]}
          />
          <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
