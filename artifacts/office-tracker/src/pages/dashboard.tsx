import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetQuarterlySummary,
  useGetYearSummary,
  useCheckinToday,
  useGetAttendance,
  getGetQuarterlySummaryQueryKey,
  getGetYearSummaryQueryKey,
  getListAttendanceQueryKey,
  getGetAttendanceQueryKey,
} from "@workspace/api-client-react";
import {
  Building2,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

const QUARTER_COLORS = [
  { text: "text-violet-700", bar: "bg-violet-500" },
  { text: "text-blue-700",   bar: "bg-blue-500"   },
  { text: "text-emerald-700",bar: "bg-emerald-500" },
  { text: "text-orange-700", bar: "bg-orange-500"  },
];

const TODAY = new Date().toISOString().split("T")[0];
const CURRENT_YEAR = new Date().getFullYear();

export default function Dashboard() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [yearDirection, setYearDirection] = useState<1 | -1>(1);
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: quarters, isLoading: qLoading } = useGetQuarterlySummary(
    { year },
    { query: { queryKey: getGetQuarterlySummaryQueryKey({ year }) } }
  );
  const { data: yearSummary } = useGetYearSummary(
    { year },
    { query: { queryKey: getGetYearSummaryQueryKey({ year }) } }
  );

  // Persistent check-in state — reads from DB, not local state
  const { data: todayRecord, isLoading: todayLoading } = useGetAttendance(TODAY, {
    query: { queryKey: getGetAttendanceQueryKey(TODAY), retry: false },
  });
  const isCheckedInToday = todayRecord?.state === "present";

  const checkin = useCheckinToday();
  const handleCheckin = () => {
    checkin.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAttendanceQueryKey(TODAY) });
        queryClient.invalidateQueries({ queryKey: getGetQuarterlySummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetYearSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      },
    });
  };

  const goPrevYear = () => { setYearDirection(-1); setYear((y) => y - 1); };
  const goNextYear = () => { setYearDirection(1);  setYear((y) => y + 1); };

  const isCurrentYear = year === CURRENT_YEAR;
  const isCheckinDisabled = checkin.isPending || todayLoading || isCheckedInToday;

  // "Days in Office" = present + planned (planned days count as office days)
  const totalOfficeDays = (yearSummary?.totalPresent ?? 0) + (yearSummary?.totalPlanned ?? 0);

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">

      {/* Header with year control */}
      <div className="flex items-start justify-between mb-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="text-sm text-muted-foreground mb-0.5">{todayStr}</p>
          <AnimatePresence mode="wait">
            <motion.h1
              key={year}
              initial={{ opacity: 0, x: yearDirection * 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: yearDirection * -14 }}
              transition={{ duration: 0.2 }}
              className="text-2xl font-bold text-foreground"
            >
              {year} Overview
            </motion.h1>
          </AnimatePresence>
        </motion.div>

        <div className="flex items-center gap-1 mt-1">
          <button onClick={goPrevYear} className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-foreground w-12 text-center">{year}</span>
          <button onClick={goNextYear} disabled={year >= CURRENT_YEAR} className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Check-in card (current year only) */}
      {isCurrentYear && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }} className="mb-6">
          <div className={cn(
            "rounded-2xl border p-4 flex items-center gap-4 shadow-sm transition-colors duration-300",
            isCheckedInToday ? "border-emerald-200 bg-emerald-50" : "border-border bg-card"
          )}>
            <div className="flex-1">
              <p className={cn("text-sm font-semibold transition-colors duration-200", isCheckedInToday ? "text-emerald-800" : "text-foreground")}>
                {isCheckedInToday ? "You're checked in today" : "In the office today?"}
              </p>
              <p className={cn("text-xs mt-0.5 transition-colors duration-200", isCheckedInToday ? "text-emerald-600" : "text-muted-foreground")}>
                {isCheckedInToday ? "Today is marked as attended" : "Tap to mark today as attended"}
              </p>
            </div>
            <button
              onClick={handleCheckin}
              disabled={isCheckinDisabled}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0",
                isCheckedInToday
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default"
                  : "bg-primary text-primary-foreground hover:opacity-90 shadow-sm disabled:opacity-60"
              )}
            >
              {checkin.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isCheckedInToday ? <CheckCircle2 className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              {isCheckedInToday ? "Checked in" : "Check in"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Year stats — Days in Office */}
      {yearSummary && (
        <motion.div key={year} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }} className="mb-6">
          <StatBadge icon={Building2} label="Days in Office" value={totalOfficeDays} color="text-emerald-600" bg="bg-emerald-50" />
        </motion.div>
      )}

      {/* Quarterly breakdown */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Quarterly Breakdown</h2>
        <button onClick={() => navigate("/calendar")} className="text-xs text-primary font-medium hover:underline">
          View calendar
        </button>
      </div>

      {qLoading ? (
        <div className="space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-32 rounded-2xl bg-secondary animate-pulse" />)}</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={year} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="space-y-3">
            {(quarters ?? []).map((q, i) => {
              const colors = QUARTER_COLORS[i];
              const isCurrentQ = isCurrentYear && q.quarter === currentQuarter;
              // Office days = present + planned
              const officeDays = q.presentDays + q.plannedDays;
              const density = q.totalWorkdays > 0 ? officeDays / q.totalWorkdays : 0;
              const pct = Math.round(density * 100);

              return (
                <div
                  key={q.quarter}
                  className={cn(
                    "rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
                    isCurrentQ ? "border-primary/30 ring-1 ring-primary/20" : "border-border"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-bold uppercase tracking-wider", colors.text)}>Q{q.quarter}</span>
                        {isCurrentQ && <span className="text-xs font-medium text-primary bg-accent px-1.5 py-0.5 rounded-full">Current</span>}
                      </div>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {q.label.replace(`Q${q.quarter} `, "")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">{officeDays}</p>
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
                        transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                        className={cn("h-full rounded-full", colors.bar)}
                      />
                    </div>
                  </div>

                  {/* Stats row — no remote */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span><span className="font-medium text-foreground">{q.totalWeeks}</span> weeks</span>
                    {q.plannedDays > 0 && (
                      <span className="text-blue-600"><span className="font-medium">{q.plannedDays}</span> planned</span>
                    )}
                    {q.personalLeaveDays > 0 && (
                      <span className="text-rose-500"><span className="font-medium">{q.personalLeaveDays}</span> leave</span>
                    )}
                    {q.companyLeaveDays > 0 && (
                      <span><span className="font-medium">{q.companyLeaveDays}</span> holidays</span>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function StatBadge({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: number; color: string; bg: string;
}) {
  return (
    <div className="rounded-xl p-3 border border-border bg-card">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-2", bg)}>
        <Icon className={cn("w-3.5 h-3.5", color)} />
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground leading-tight mt-0.5">{label}</p>
    </div>
  );
}
