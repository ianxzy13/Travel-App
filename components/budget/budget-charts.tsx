"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/budget/money";
import { donutSlices, type BudgetSummary } from "@/lib/budget/stats";

// Colours come from the validated palette in globals.css (--chart-1…7, fixed
// order; "Other" is neutral). Text always uses text colours, never series colours.
const SLOT = (i: number) => `var(--chart-${i + 1})`;

export function BudgetCharts({ summary, currency }: { summary: BudgetSummary; currency: string }) {
  const t = useTranslations("budget");
  const slices = donutSlices(summary, 7, (count) => t("other", { count }));
  const total = slices.reduce((n, s) => n + s.value, 0);
  const bars = summary.categories
    .filter((c) => c.allocated > 0 || c.totals.committed > 0)
    .map((c) => ({ name: c.name, planned: c.allocated, committed: c.totals.committed }));
  const money = (v: number) => formatMoney(v, currency);

  if (slices.length === 0 && bars.length === 0) return null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{t("charts.byCategory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {slices.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("charts.noSpend")}</p>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="size-48 shrink-0" role="img" aria-label={t("charts.donutLabel")}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="100%"
                      stroke="var(--card)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {slices.map((s, i) => (
                        <Cell key={s.id} fill={s.id === "other" ? "var(--chart-other)" : SLOT(i)} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip format={money} total={total} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* legend with direct values: identity never depends on colour alone */}
              <ul className="w-full space-y-1.5 text-sm">
                {slices.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ background: s.id === "other" ? "var(--chart-other)" : SLOT(i) }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="tabular-nums">{money(s.value)}</span>
                    <span className="text-muted-foreground w-10 text-end text-xs tabular-nums">
                      {Math.round((s.value / total) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{t("charts.plannedVsCommitted")}</CardTitle>
          <ul className="text-muted-foreground flex gap-4 text-xs" aria-label={t("charts.legend")}>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: SLOT(0) }} aria-hidden />{" "}
              {t("charts.planned")}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: SLOT(1) }} aria-hidden />{" "}
              {t("charts.committed")}
            </li>
          </ul>
        </CardHeader>
        <CardContent>
          <div
            style={{ height: Math.max(160, bars.length * 44 + 30) }}
            role="img"
            aria-label={t("charts.barLabel")}
          >
            <ResponsiveContainer>
              <BarChart
                data={bars}
                layout="vertical"
                margin={{ left: 0, right: 12, top: 0, bottom: 0 }}
                barGap={2}
                barCategoryGap="22%"
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => formatMoney(v, currency, { cents: false })}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fill: "var(--foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={<ChartTooltip format={money} />}
                />
                <Bar
                  dataKey="planned"
                  name={t("charts.planned")}
                  fill={SLOT(0)}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="committed"
                  name={t("charts.committed")}
                  fill={SLOT(1)}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: { name?: string } }[];
  label?: string;
  format: (v: number) => string;
  total?: number;
};

function ChartTooltip({ active, payload, label, format, total }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const title = label ?? payload[0].payload?.name;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      {title && <p className="mb-1 font-medium">{title}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          {label && <span className="text-muted-foreground">{p.name}</span>}
          <span className="ms-auto tabular-nums">
            {format(p.value ?? 0)}
            {total ? ` · ${Math.round(((p.value ?? 0) / total) * 100)}%` : ""}
          </span>
        </p>
      ))}
    </div>
  );
}
