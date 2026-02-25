"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTimeStore } from "@/store/useTimeStore";

export default function AnalyticsPage() {
  const { periods, loading } = useTimeStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f8fa] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading analytics...</div>
      </div>
    );
  }

  // Get all periods data
  const allPeriodsData = useMemo(() => {
    return Object.entries(periods)
      .map(([key, data]) => ({
        periodKey: key,
        tubes: data.tubes,
        totalHours: data.tubes.reduce((sum, t) => sum + t.hours, 0),
      }))
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  }, [periods]);

  // Aggregate activity data across all periods
  const activityTotals = useMemo(() => {
    const totals: Record<string, { name: string; hours: number; color: string }> = {};

    Object.values(periods).forEach((pd) => {
      pd.tubes.forEach((tube) => {
        if (!totals[tube.name]) {
          totals[tube.name] = { name: tube.name, hours: 0, color: tube.color };
        }
        totals[tube.name].hours += tube.hours;
      });
    });

    return Object.values(totals).sort((a, b) => b.hours - a.hours);
  }, [periods]);

  // Data for pie chart
  const pieData = useMemo(() => {
    return activityTotals.map((a) => ({
      name: a.name,
      value: a.hours,
      fill: a.color,
    }));
  }, [activityTotals]);

  // Data for bar chart (hours per period)
  const barData = useMemo(() => {
    return allPeriodsData.map((pd) => {
      const entry: Record<string, string | number> = {
        period: formatPeriodLabel(pd.periodKey),
      };
      pd.tubes.forEach((tube) => {
        entry[tube.name] = tube.hours;
      });
      return entry;
    });
  }, [allPeriodsData]);

  // Data for line chart (total hours trend)
  const lineData = useMemo(() => {
    return allPeriodsData.map((pd) => ({
      period: formatPeriodLabel(pd.periodKey),
      totalHours: pd.totalHours,
    }));
  }, [allPeriodsData]);

  // Get unique activity names for chart config
  const activityNames = useMemo(() => {
    const names = new Set<string>();
    Object.values(periods).forEach((pd) => {
      pd.tubes.forEach((tube) => names.add(tube.name));
    });
    return Array.from(names);
  }, [periods]);

  // Build chart config dynamically
  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {
      totalHours: {
        label: "Total Hours",
        color: "#6366f1",
      },
    };
    activityTotals.forEach((a) => {
      config[a.name] = {
        label: a.name,
        color: a.color,
      };
    });
    return config;
  }, [activityTotals]);

  const totalTrackedHours = activityTotals.reduce((sum, a) => sum + a.hours, 0);
  const avgHoursPerPeriod =
    allPeriodsData.length > 0 ? totalTrackedHours / allPeriodsData.length : 0;

  return (
    <div className="min-h-screen bg-[#f8f8fa]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-black tracking-tight text-gray-900 select-none hover:opacity-70 transition-opacity">
              tt<span className="text-indigo-500">.</span>
            </Link>
            <div className="h-4 w-px bg-gray-200" />
            <h1 className="text-sm font-semibold text-gray-600">Analytics</h1>
          </div>
          <Link
            href="/"
            className="text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-wide"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-16">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Tracked</CardDescription>
              <CardTitle className="text-3xl font-black tabular-nums">
                {totalTrackedHours.toFixed(1)}h
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Periods Tracked</CardDescription>
              <CardTitle className="text-3xl font-black tabular-nums">
                {allPeriodsData.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg per Period</CardDescription>
              <CardTitle className="text-3xl font-black tabular-nums">
                {avgHoursPerPeriod.toFixed(1)}h
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {allPeriodsData.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-gray-400">No data yet. Start tracking time to see analytics.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart - Activity Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Time Distribution</CardTitle>
                    <CardDescription>
                      How your time is split across activities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Activity Rankings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Rankings</CardTitle>
                    <CardDescription>
                      Most time-consuming activities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {activityTotals.slice(0, 8).map((activity, idx) => {
                        const pct =
                          totalTrackedHours > 0
                            ? (activity.hours / totalTrackedHours) * 100
                            : 0;
                        return (
                          <div key={activity.name} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-gray-700">
                                {idx + 1}. {activity.name}
                              </span>
                              <span className="tabular-nums text-gray-500">
                                {activity.hours.toFixed(1)}h ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: activity.color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Trends Tab */}
            <TabsContent value="trends" className="space-y-6">
              {/* Line Chart - Total Hours Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Hours Over Time</CardTitle>
                  <CardDescription>
                    Total tracked hours per period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}h`}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="totalHours"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ fill: "#6366f1", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Stacked Bar Chart - Activity Breakdown Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Breakdown Over Time</CardTitle>
                  <CardDescription>
                    How activities compare across periods
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[350px]">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}h`}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      {activityNames.map((name) => {
                        const activity = activityTotals.find((a) => a.name === name);
                        return (
                          <Bar
                            key={name}
                            dataKey={name}
                            stackId="a"
                            fill={activity?.color || "#6366f1"}
                            radius={[0, 0, 0, 0]}
                          />
                        );
                      })}
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Breakdown Tab */}
            <TabsContent value="breakdown" className="space-y-6">
              {/* Per-Period Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Period Details</CardTitle>
                  <CardDescription>
                    Detailed breakdown for each tracked period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {allPeriodsData.slice(-10).reverse().map((pd) => (
                      <div key={pd.periodKey} className="border-b border-gray-100 pb-4 last:border-0">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-gray-900">
                            {formatPeriodLabel(pd.periodKey)}
                          </span>
                          <span className="text-sm tabular-nums text-gray-500">
                            {pd.totalHours.toFixed(1)}h total
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {pd.tubes.map((tube) => (
                            <div
                              key={tube.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: tube.color }}
                              />
                              <span className="truncate text-gray-600">
                                {tube.name}
                              </span>
                              <span className="ml-auto tabular-nums font-medium">
                                {tube.hours}h
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function formatPeriodLabel(periodKey: string): string {
  const d = new Date(periodKey + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
