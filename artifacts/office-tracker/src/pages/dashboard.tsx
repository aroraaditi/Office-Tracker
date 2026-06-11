import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetQuarterlySummary,
  useGetYearSummary,
  useCheckinToday,
  getGetQuarterlySummaryQueryKey,
  getGetYearSummaryQueryKey,
  getListAttendanceQueryKey,
} from "@workspace/api-client-react";
import { Building2, CalendarCheck, CheckCircle2, Loader2, TrendingUp, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

const QUARTER_COLORS = [
  { from: "from-violet-500", to: "to-indigo-600", light: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", bar: "bg-violet-500" },
  { from: "from-blue-500", to: "to-cyan-500", light: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", bar: "bg-blue-500" },
  { from: "from-emerald-500", to: "to-teal-500", light: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-500" },
  { from: "from-orange-500", to: "to-rose-500", light: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", bar: "bg-orange-500" },
];

export default function Dashboard() {
  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const [, navigate] = useLocation();

  const { data: quarters, isLoading: qLoading } = useGetQuarterlySummary(
    { year },
    { query: { queryKey: getGetQuarterlySummaryQueryKey({ year }) } }
  );
  const { data: yearSummary } = useGetYearSummary(
    { year },
    { query: { queryKey: getGetYearSummaryQueryKey({ year }) } }
  );

  const queryClient = useQueryClient();
  const checkin = useCheckinToday();
  const [checkedIn, setCheckedIn] = useState(false);

  const handleCheckin = () => {
    checkin.mutate(undefined, {
      onSuccess: () => {
        setCheckedIn(true);
        queryClient.invalidateQueries({ queryKey: getGetQuarterlySummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetYearSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        setTimeout(() => setCheckedIn(false), 3000);
      },
    });
  };

  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="mb-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-sm text-muted-foreground mb-0.5">{todayStr}</p>
          <h1 className="text-2xl font-bold text-foreground">{year} Overview</h1>
        </motion.div>
      </div>

      {/* Check-in card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="mb-6"
      >
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">In the office today?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tap to mark today as attended</p>
          </div>
          <button
            onClick={handleCheckin}
            disabled={checkin.isPending || checkedIn}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0",
              checkedIn
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
            )}
          >
            {checkin.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : checkedIn ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Building2 className="w-4 h-4" />
            )}
            {checkedIn ? "Checked in!" : "Check in"}
          </button>
        </div>
      </motion.div>

      {/* Year stats strip */}
      {yearSummary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mb-6 grid grid-cols-3 gap-3"
        >
          <StatBadge
            icon={Building2}
            label="Days in Office"
            value={yearSummary.totalPresent}
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
          <StatBadge
            icon={CalendarCheck}
            label="Days Planned"
            value={yearSummary.totalPlanned}
            color="text-blue-600"
            bg="bg-blue-50"
          />
          <StatBadge
            icon={TrendingUp}
            label="Total Workdays"
            value={yearSummary.totalWorkdays}
            color="text-violet-600"
            bg="bg-violet-50"
          />
        </motion.div>
      )}

      {/* Quarterly cards */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Quarterly Breakdown</h2>
        <button
          onClick={() => navigate("/calendar")}
          className="text-xs text-primary font-medium hover:underline"
        >
          View calendar
        </button>
      </div>

      {qLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(quarters ?? []).map((q, i) => {
            const colors = QUARTER_COLORS[i];
            const isCurrentQ = q.quarter === currentQuarter;
            const density = q.totalWorkdays > 0 ? q.presentDays / q.totalWorkdays : 0;
            const pct = Math.round(density * 100);

            return (
              <motion.div
                key={q.quarter}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.12 + i * 0.06 }}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
                  isCurrentQ ? "border-primary/30 ring-1 ring-primary/20" : "border-border"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-bold uppercase tracking-wider", colors.text)}>
                        Q{q.quarter}
                      </span>
                      {isCurrentQ && (
                        <span className="text-xs font-medium text-primary bg-accent px-1.5 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {q.label.replace(`Q${q.quarter} `, "")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{q.presentDays}</p>
                    <p className="text-xs text-muted-foreground">days in office</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Attendance rate</span>
                    <span className={cn("text-xs font-semibold", colors.text)}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease: "easeOut" }}
                      className={cn("h-full rounded-full", colors.bar)}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">{q.totalWeeks}</span> weeks
                  </span>
                  {q.plannedDays > 0 && (
                    <span className="text-blue-600">
                      <span className="font-medium">{q.plannedDays}</span> planned
                    </span>
                  )}
                  {q.personalLeaveDays > 0 && (
                    <span className="text-rose-500">
                      <span className="font-medium">{q.personalLeaveDays}</span> leave
                    </span>
                  )}
                  {q.companyLeaveDays > 0 && (
                    <span>
                      <span className="font-medium">{q.companyLeaveDays}</span> holidays
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBadge({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={cn("rounded-xl p-3 border border-border bg-card")}>
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-2", bg)}>
        <Icon className={cn("w-3.5 h-3.5", color)} />
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground leading-tight mt-0.5">{label}</p>
    </div>
  );
}
