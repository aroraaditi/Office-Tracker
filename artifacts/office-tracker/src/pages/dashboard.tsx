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
  Home,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

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

  const totalOfficeDays = (yearSummary?.totalPresent ?? 0) + (yearSummary?.totalPlanned ?? 0);

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">

      {/* Header */}
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

      {/* Days in Office stat */}
      {yearSummary && (
        <motion.div key={year} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }} className="mb-6">
          <div className="rounded-xl p-4 border border-border bg-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalOfficeDays}</p>
              <p className="text-xs text-muted-foreground leading-tight">Days in Office this year</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Quarterly breakdown */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Quarterly Breakdown</h2>
        <button onClick={() => navigate("/calendar")} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          View calendar
        </button>
      </div>

      {qLoading ? (
        <div className="space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-36 rounded-2xl bg-secondary animate-pulse" />)}</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={year}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="space-y-3 mb-6"
          >
            {(quarters ?? []).map((q, i) => {
              const isCurrentQ = isCurrentYear && q.quarter === currentQuarter;
              const officeDays = q.presentDays + q.plannedDays;
              const target = q.totalWeeks * 2;
              const pct = target > 0 ? Math.min(100, Math.round((officeDays / target) * 100)) : 0;
              const quarterLabels = ["Jan – Mar", "Apr – Jun", "Jul – Sep", "Oct – Dec"];

              return (
                <motion.div
                  key={q.quarter}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.06 }}
                  onClick={() => navigate(`/calendar?q=${q.quarter}&year=${year}`)}
                  className={cn(
                    "rounded-2xl border bg-card p-4 shadow-sm cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-px active:translate-y-0",
                    isCurrentQ
                      ? "border-primary/30 ring-1 ring-primary/20"
                      : "border-border hover:border-border/80"
                  )}
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          isCurrentQ ? "text-primary" : "text-muted-foreground"
                        )}>
                          Q{q.quarter}
                        </span>
                        {isCurrentQ && (
                          <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{quarterLabels[i]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">{officeDays}</p>
                      <p className="text-xs text-muted-foreground">
                        / {target} days target
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">
                        {q.totalWeeks} wks × 2 days/wk
                      </span>
                      <span className={cn(
                        "text-xs font-semibold",
                        isCurrentQ ? "text-primary" : "text-muted-foreground"
                      )}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                        className={cn(
                          "h-full rounded-full",
                          isCurrentQ ? "bg-primary" : "bg-muted-foreground/40"
                        )}
                      />
                    </div>
                  </div>

                  {/* Stats chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {q.wfhWeeks > 0 && (
                      <Chip icon={Home} label={`${q.wfhWeeks} WFH wk${q.wfhWeeks !== 1 ? "s" : ""}`} variant="neutral" />
                    )}
                    {q.personalLeaveDays > 0 && (
                      <Chip icon={CalendarDays} label={`${q.personalLeaveDays} leave`} variant="rose" />
                    )}
                    {q.companyLeaveDays > 0 && (
                      <Chip icon={CalendarDays} label={`${q.companyLeaveDays} holiday${q.companyLeaveDays !== 1 ? "s" : ""}`} variant="slate" />
                    )}
                    {q.plannedDays > 0 && isCurrentQ && (
                      <Chip icon={CalendarDays} label={`${q.plannedDays} planned`} variant="blue" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Check-in card — bottom */}
      {isCurrentYear && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
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
              {checkin.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isCheckedInToday
                ? <CheckCircle2 className="w-4 h-4" />
                : <Building2 className="w-4 h-4" />
              }
              {isCheckedInToday ? "Checked in" : "Check in"}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Chip({ icon: Icon, label, variant }: {
  icon: React.ElementType;
  label: string;
  variant: "neutral" | "rose" | "slate" | "blue";
}) {
  const styles = {
    neutral: "bg-secondary text-muted-foreground",
    rose:    "bg-rose-50 text-rose-600",
    slate:   "bg-slate-100 text-slate-600",
    blue:    "bg-blue-50 text-blue-600",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", styles[variant])}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
