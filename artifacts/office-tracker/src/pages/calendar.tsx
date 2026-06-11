import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid } from "lucide-react";
import {
  useListAttendance,
  getListAttendanceQueryKey,
} from "@workspace/api-client-react";
import type { AttendanceDay, DayState } from "@workspace/api-client-react";
import { STATE_CONFIG } from "@/lib/states";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isFuture,
  isPast,
  getDay,
  startOfWeek,
  addWeeks,
  addDays,
  isSameDay,
  parseISO,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import DayModal from "@/components/day-modal";

// ─── Constants ───────────────────────────────────────────────────────────────

const WEEKDAYS_LONG  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_SHORT = ["Su",  "Mo",  "Tu",  "We",  "Th",  "Fr",  "Sa"];
const QUARTER_MONTHS = [[1,2,3],[4,5,6],[7,8,9],[10,11,12]] as const;
const QUARTER_NAMES  = ["Q1 · Jan – Mar","Q2 · Apr – Jun","Q3 · Jul – Sep","Q4 · Oct – Dec"];

const now = new Date();
const CURRENT_YEAR    = now.getFullYear();
const CURRENT_QUARTER = Math.ceil((now.getMonth() + 1) / 3);
const WEEKS_IN_WINDOW = 8;
const DAYS_TARGET_PER_WEEK = 2;
const TOTAL_TARGET = WEEKS_IN_WINDOW * DAYS_TARGET_PER_WEEK; // 16

// ─── Root component ──────────────────────────────────────────────────────────

type ViewMode = "quarter" | "8week";

export default function Calendar() {
  const [view, setView] = useState<ViewMode>("quarter");

  // All attendance records (no year filter so 8-week window can span year boundary)
  const { data: allRecords } = useListAttendance(
    {},
    { query: { queryKey: getListAttendanceQueryKey() } }
  );

  const recordMap = useMemo(() => {
    const map: Record<string, AttendanceDay> = {};
    (allRecords ?? []).forEach((r) => { map[r.date] = r; });
    return map;
  }, [allRecords]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedRecord = selectedDate ? recordMap[selectedDate] ?? null : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

      {/* ── View toggle ── */}
      <div className="flex items-center gap-2 mb-6">
        <div className="inline-flex items-center bg-secondary rounded-xl p-1 gap-1">
          <ViewTab id="quarter" active={view === "quarter"} icon={LayoutGrid}   label="Quarter"  onClick={() => setView("quarter")} />
          <ViewTab id="8week"   active={view === "8week"}   icon={CalendarDays} label="8 Weeks"  onClick={() => setView("8week")}  />
        </div>
      </div>

      {/* ── Views ── */}
      <AnimatePresence mode="wait">
        {view === "quarter" ? (
          <motion.div key="quarter" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <QuarterView recordMap={recordMap} onSelectDate={setSelectedDate} />
          </motion.div>
        ) : (
          <motion.div key="8week" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <EightWeekView recordMap={recordMap} onSelectDate={setSelectedDate} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Day modal ── */}
      {selectedDate && (
        <DayModal date={selectedDate} record={selectedRecord} onClose={() => setSelectedDate(null)} />
      )}
    </div>
  );
}

function ViewTab({ id, active, icon: Icon, label, onClick }: {
  id: string; active: boolean; icon: React.ElementType; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// ─── Quarter view ─────────────────────────────────────────────────────────────

function QuarterView({ recordMap, onSelectDate }: {
  recordMap: Record<string, AttendanceDay>;
  onSelectDate: (d: string) => void;
}) {
  const [year, setYear]       = useState(CURRENT_YEAR);
  const [quarter, setQuarter] = useState(CURRENT_QUARTER);
  const [direction, setDirection] = useState<1 | -1>(1);

  const months = QUARTER_MONTHS[quarter - 1];
  const isCurrentQ = year === CURRENT_YEAR && quarter === CURRENT_QUARTER;

  const quarterStats = useMemo(() => {
    let present = 0, planned = 0, leave = 0;
    for (const m of months) {
      const prefix = `${year}-${String(m).padStart(2,"0")}-`;
      for (const [k, v] of Object.entries(recordMap)) {
        if (!k.startsWith(prefix)) continue;
        if (v.state === "present") present++;
        else if (v.state === "planned") planned++;
        else if (v.state === "personal_leave") leave++;
      }
    }
    return { present, planned, leave };
  }, [recordMap, months, year]);

  const officeDays = quarterStats.present + quarterStats.planned;

  const goPrev = () => {
    setDirection(-1);
    if (quarter === 1) { setQuarter(4); setYear((y) => y - 1); }
    else setQuarter((q) => q - 1);
  };
  const goNext = () => {
    setDirection(1);
    if (quarter === 4) { setQuarter(1); setYear((y) => y + 1); }
    else setQuarter((q) => q + 1);
  };
  const goToNow = () => {
    setDirection(
      year < CURRENT_YEAR || (year === CURRENT_YEAR && quarter < CURRENT_QUARTER) ? 1 : -1
    );
    setYear(CURRENT_YEAR);
    setQuarter(CURRENT_QUARTER);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${year}-${quarter}`}
            initial={{ opacity: 0, x: direction * 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -12 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-xl font-bold text-foreground">{QUARTER_NAMES[quarter - 1]}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {year} · {officeDays} in office
              {quarterStats.leave > 0 && ` · ${quarterStats.leave} leave`}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={goPrev} className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {!isCurrentQ && (
            <button onClick={goToNow} className="px-3 h-9 rounded-xl border border-border bg-card text-xs font-medium text-foreground hover:bg-secondary transition-colors">
              Now
            </button>
          )}
          <button onClick={goNext} className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <StateLegend />

      {/* 3-month grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${year}-${quarter}`}
          initial={{ opacity: 0, x: direction * 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -30 }}
          transition={{ duration: 0.22 }}
          className="space-y-5"
        >
          {months.map((m) => (
            <MonthBlock key={`${year}-${m}`} year={year} month={m} recordMap={recordMap} onSelectDate={onSelectDate} />
          ))}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// ─── 8-week rolling view ─────────────────────────────────────────────────────

function EightWeekView({ recordMap, onSelectDate }: {
  recordMap: Record<string, AttendanceDay>;
  onSelectDate: (d: string) => void;
}) {
  // Default: window starts 7 weeks ago (Sunday), so today falls in week 8
  const defaultStart = startOfWeek(addWeeks(now, -(WEEKS_IN_WINDOW - 1)), { weekStartsOn: 0 });
  const [windowStart, setWindowStart] = useState(defaultStart);
  const [direction, setDirection] = useState<1 | -1>(1);

  const windowEnd = addDays(windowStart, WEEKS_IN_WINDOW * 7 - 1);

  const weeks = useMemo(() =>
    Array.from({ length: WEEKS_IN_WINDOW }, (_, i) => {
      const weekStart = addWeeks(windowStart, i);
      return Array.from({ length: 7 }, (_, j) => addDays(weekStart, j));
    }),
    [windowStart]
  );

  // Stats: count office days (present + planned) in the window
  const { officeDaysInWindow, weeklyAvg, weeklyBreakdown } = useMemo(() => {
    let total = 0;
    const breakdown: number[] = [];
    for (const week of weeks) {
      let weekCount = 0;
      for (const day of week) {
        if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends
        const ds = format(day, "yyyy-MM-dd");
        const r = recordMap[ds];
        if (r && (r.state === "present" || r.state === "planned")) {
          total++;
          weekCount++;
        }
      }
      breakdown.push(weekCount);
    }
    return {
      officeDaysInWindow: total,
      weeklyAvg: Math.round((total / WEEKS_IN_WINDOW) * 10) / 10,
      weeklyBreakdown: breakdown,
    };
  }, [weeks, recordMap]);

  const progressPct = Math.min(100, Math.round((officeDaysInWindow / TOTAL_TARGET) * 100));
  const isOnTarget = weeklyAvg >= DAYS_TARGET_PER_WEEK;

  const goPrev = () => { setDirection(-1); setWindowStart((d) => addWeeks(d, -1)); };
  const goNext = () => { setDirection(1);  setWindowStart((d) => addWeeks(d, 1)); };
  const goToNow = () => {
    setDirection(windowStart < defaultStart ? 1 : -1);
    setWindowStart(defaultStart);
  };

  const isAtDefault = format(windowStart, "yyyy-MM-dd") === format(defaultStart, "yyyy-MM-dd");

  const rangeLabel = `${format(windowStart, "MMM d")} – ${format(windowEnd, "MMM d, yyyy")}`;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={format(windowStart, "yyyy-MM-dd")}
            initial={{ opacity: 0, x: direction * 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -10 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-xl font-bold text-foreground">Rolling 8 Weeks</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rangeLabel}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={goPrev} className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {!isAtDefault && (
            <button onClick={goToNow} className="px-3 h-9 rounded-xl border border-border bg-card text-xs font-medium text-foreground hover:bg-secondary transition-colors">
              Now
            </button>
          )}
          <button onClick={goNext} className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target tracker card */}
      <div className={cn(
        "rounded-2xl border p-4 mb-5 shadow-sm",
        isOnTarget ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
      )}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className={cn("text-sm font-semibold", isOnTarget ? "text-emerald-800" : "text-amber-800")}>
              {isOnTarget ? "On target" : "Below target"}
            </p>
            <p className={cn("text-xs mt-0.5", isOnTarget ? "text-emerald-600" : "text-amber-600")}>
              Tracking 2 office days / week
            </p>
          </div>
          <div className="text-right">
            <p className={cn("text-2xl font-bold", isOnTarget ? "text-emerald-700" : "text-amber-700")}>
              {officeDaysInWindow}
              <span className="text-sm font-normal text-current opacity-60"> / {TOTAL_TARGET}</span>
            </p>
            <p className={cn("text-xs", isOnTarget ? "text-emerald-600" : "text-amber-600")}>
              avg {weeklyAvg}/wk · target 2/wk
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
          <motion.div
            key={officeDaysInWindow}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={cn("h-full rounded-full", isOnTarget ? "bg-emerald-500" : "bg-amber-500")}
          />
        </div>
        {/* Target markers */}
        <div className="flex items-center justify-between mt-1">
          <span className={cn("text-[10px]", isOnTarget ? "text-emerald-500" : "text-amber-500")}>
            {progressPct}%
          </span>
          <span className={cn("text-[10px]", isOnTarget ? "text-emerald-500" : "text-amber-500")}>
            Target: {TOTAL_TARGET} days
          </span>
        </div>
      </div>

      {/* Legend */}
      <StateLegend />

      {/* 8-week grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={format(windowStart, "yyyy-MM-dd")}
          initial={{ opacity: 0, x: direction * 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -30 }}
          transition={{ duration: 0.22 }}
          className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
        >
          {/* Column headers */}
          <div className="grid grid-cols-8 border-b border-border bg-secondary/30">
            <div className="py-2.5 px-3 text-xs font-medium text-muted-foreground">Week</div>
            {WEEKDAYS_LONG.map((d) => (
              <div key={d} className="py-2.5 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>

          {/* Week rows */}
          {weeks.map((week, wi) => {
            const weekLabel = format(week[0], "MMM d");
            const count = weeklyBreakdown[wi];
            const isTargetMet = count >= DAYS_TARGET_PER_WEEK;
            // Check if week is entirely in the future
            const allFuture = week.every(d => isFuture(d) && !isToday(d));

            return (
              <div key={wi} className={cn(
                "grid grid-cols-8 border-b border-border last:border-b-0",
                allFuture && "opacity-60"
              )}>
                {/* Week label */}
                <div className="flex flex-col justify-center px-3 py-2 border-r border-border bg-secondary/10">
                  <span className="text-xs font-medium text-muted-foreground">{weekLabel}</span>
                  <span className={cn(
                    "text-[10px] font-semibold mt-0.5",
                    isTargetMet ? "text-emerald-600" : count > 0 ? "text-amber-600" : "text-muted-foreground/50"
                  )}>
                    {count}/{DAYS_TARGET_PER_WEEK}
                  </span>
                </div>

                {/* Day cells */}
                {week.map((day) => {
                  const ds = format(day, "yyyy-MM-dd");
                  const record = recordMap[ds];
                  const state = (record?.state ?? "remote") as DayState;
                  const cfg = STATE_CONFIG[state];
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const hasRecord = !!record && state !== "remote";
                  const isTodayDay = isToday(day);
                  const isPlanned = state === "planned";

                  return (
                    <button
                      key={ds}
                      onClick={() => !isWeekend && onSelectDate(ds)}
                      disabled={isWeekend}
                      title={hasRecord ? `${format(day, "MMM d")} · ${cfg.label}${record?.note ? ` · ${record.note}` : ""}` : format(day, "MMM d")}
                      className={cn(
                        "relative py-2 px-0.5 border-r border-border last:border-r-0 flex flex-col items-center justify-center gap-0.5 min-h-[52px] transition-all duration-100",
                        isWeekend
                          ? "bg-secondary/20 cursor-default"
                          : hasRecord
                          ? cn(cfg.bg, "hover:brightness-95 cursor-pointer")
                          : "bg-white hover:bg-secondary/50 cursor-pointer",
                        isPlanned && "bg-blue-50 hover:bg-blue-100",
                        isTodayDay && "ring-1 ring-inset ring-primary/40"
                      )}
                    >
                      {/* Day number */}
                      <span className={cn(
                        "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                        isTodayDay
                          ? "bg-primary text-primary-foreground font-bold"
                          : isWeekend
                          ? "text-muted-foreground/40"
                          : hasRecord
                          ? cfg.color
                          : "text-foreground"
                      )}>
                        {format(day, "d")}
                      </span>

                      {/* State dot / badge */}
                      {hasRecord && !isWeekend && (
                        isPlanned ? (
                          <span className={cn(
                            "text-[9px] font-semibold px-1 py-px rounded border border-dashed leading-tight hidden sm:inline-block",
                            cfg.border, cfg.color
                          )}>
                            Plan
                          </span>
                        ) : (
                          <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Per-week bar chart */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium text-muted-foreground mb-3">Office days per week</p>
        <div className="flex items-end gap-1.5 h-12">
          {weeklyBreakdown.map((count, i) => {
            const weekStart = addWeeks(windowStart, i);
            const barPct = count === 0 ? 4 : Math.min(100, (count / 5) * 100); // 5 workdays max
            const isTarget = count >= DAYS_TARGET_PER_WEEK;
            const isCurrent = weeks[i].some(d => isToday(d));
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: "36px" }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${barPct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.04, ease: "easeOut" }}
                    className={cn(
                      "w-full rounded-t-sm min-h-[3px]",
                      count === 0
                        ? "bg-secondary"
                        : isTarget
                        ? "bg-emerald-400"
                        : "bg-amber-400",
                      isCurrent && "ring-1 ring-primary ring-offset-1"
                    )}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground font-medium">
                  {format(weekStart, "M/d")}
                </span>
              </div>
            );
          })}
        </div>
        {/* Target line label */}
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-3 h-px bg-emerald-400" />
          <span className="text-[10px] text-muted-foreground">Target: {DAYS_TARGET_PER_WEEK} days/week</span>
        </div>
      </div>
    </>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function StateLegend() {
  return (
    <div className="flex flex-wrap gap-3 mb-5">
      {(["present", "planned", "personal_leave", "company_leave"] as DayState[]).map((state) => {
        const cfg = STATE_CONFIG[state];
        return (
          <div key={state} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
            <span>{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MonthBlock({ year, month, recordMap, onSelectDate }: {
  year: number; month: number;
  recordMap: Record<string, AttendanceDay>;
  onSelectDate: (d: string) => void;
}) {
  const monthDate = new Date(year, month - 1, 1);
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
  const startOffset = getDay(startOfMonth(monthDate));

  const officeDays = days.filter((d) => {
    const ds = format(d, "yyyy-MM-dd");
    const r = recordMap[ds];
    return r && (r.state === "present" || r.state === "planned");
  }).length;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
        <h3 className="text-sm font-semibold text-foreground">{format(monthDate, "MMMM yyyy")}</h3>
        <span className="text-xs text-muted-foreground font-medium">{officeDays} office days</span>
      </div>

      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`e-${i}`} className="border-b border-r border-border last:border-r-0 min-h-[44px] md:min-h-[52px] bg-secondary/10" />
        ))}

        {days.map((day, i) => {
          const ds = format(day, "yyyy-MM-dd");
          const record = recordMap[ds];
          const state = (record?.state ?? "remote") as DayState;
          const cfg = STATE_CONFIG[state];
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isPlanned = state === "planned";
          const colIndex = (startOffset + i) % 7;
          const isLastCol = colIndex === 6;
          const hasRecord = !!record && state !== "remote";

          return (
            <button
              key={ds}
              onClick={() => !isWeekend && onSelectDate(ds)}
              disabled={isWeekend}
              className={cn(
                "relative min-h-[44px] md:min-h-[52px] p-1.5 border-b border-r border-border text-left transition-all duration-100",
                isLastCol && "border-r-0",
                !isWeekend && "hover:bg-secondary/60 cursor-pointer",
                isWeekend && "bg-secondary/20 cursor-default",
                hasRecord && !isWeekend && cfg.bg,
                isPlanned && "bg-blue-50"
              )}
            >
              <span className={cn(
                "text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full",
                isToday(day)
                  ? "bg-primary text-primary-foreground font-bold"
                  : isWeekend
                  ? "text-muted-foreground/40"
                  : hasRecord ? cfg.color : "text-foreground"
              )}>
                {format(day, "d")}
              </span>

              {hasRecord && !isWeekend && (
                <div className="mt-0.5">
                  {isPlanned ? (
                    <span className={cn("text-[9px] font-semibold px-1 py-0.5 rounded border border-dashed hidden sm:inline-block", cfg.bg, cfg.border, cfg.color)}>
                      Planned
                    </span>
                  ) : (
                    <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                  )}
                </div>
              )}
              {record?.note && <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-current opacity-25" />}
            </button>
          );
        })}

        {(() => {
          const total = startOffset + days.length;
          const trail = total % 7 === 0 ? 0 : 7 - (total % 7);
          return Array.from({ length: trail }).map((_, i) => (
            <div key={`t-${i}`} className={cn("border-b border-r border-border bg-secondary/10 min-h-[44px] md:min-h-[52px]", i === trail - 1 && "border-r-0")} />
          ));
        })()}
      </div>
    </div>
  );
}
