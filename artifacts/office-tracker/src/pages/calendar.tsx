import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, CheckSquare, X, Loader2, Check } from "lucide-react";
import {
  useListAttendance,
  useBulkUpdateAttendance,
  BulkAttendanceBodyRecordsItemAction,
  getListAttendanceQueryKey,
  getGetQuarterlySummaryQueryKey,
  getGetYearSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { AttendanceDay, DayState } from "@workspace/api-client-react";
import { STATE_CONFIG, ALL_STATES } from "@/lib/states";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isFuture,
  getDay,
  startOfWeek,
  addWeeks,
  addDays,
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
const TOTAL_TARGET = WEEKS_IN_WINDOW * DAYS_TARGET_PER_WEEK;

// ─── Select props interface ───────────────────────────────────────────────────

interface SelectProps {
  selectMode: boolean;
  selectedDates: Set<string>;
  onToggleDate: (date: string) => void;
}

// ─── Root component ──────────────────────────────────────────────────────────

type ViewMode = "quarter" | "8week";

function getUrlParams() {
  const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  return {
    q: parseInt(p.get("q") ?? "") || null,
    year: parseInt(p.get("year") ?? "") || null,
  };
}

export default function Calendar() {
  const urlParams = useMemo(getUrlParams, []);
  const [view, setView] = useState<ViewMode>("quarter");

  // Multi-select state
  const [selectMode, setSelectMode]     = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  const toggleSelectMode = () => {
    setSelectMode((m) => !m);
    setSelectedDates(new Set());
  };

  const onToggleDate = (date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedDates(new Set());
    setSelectMode(false);
  };

  // All attendance records
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

  const selectProps: SelectProps = { selectMode, selectedDates, onToggleDate };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 pb-32">

      {/* ── View toggle + Select button ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex items-center bg-secondary rounded-xl p-1 gap-1">
          <ViewTab id="quarter" active={view === "quarter"} icon={LayoutGrid}   label="Quarter"  onClick={() => setView("quarter")} />
          <ViewTab id="8week"   active={view === "8week"}   icon={CalendarDays} label="8 Weeks"  onClick={() => setView("8week")}  />
        </div>

        <button
          onClick={toggleSelectMode}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all duration-150",
            selectMode
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          {selectMode ? `${selectedDates.size} selected` : "Select"}
        </button>
      </div>

      {/* ── Views ── */}
      <AnimatePresence mode="wait">
        {view === "quarter" ? (
          <motion.div key="quarter" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <QuarterView
              recordMap={recordMap}
              onSelectDate={(d) => !selectMode && setSelectedDate(d)}
              selectProps={selectProps}
              initialQuarter={urlParams.q ?? CURRENT_QUARTER}
              initialYear={urlParams.year ?? CURRENT_YEAR}
            />
          </motion.div>
        ) : (
          <motion.div key="8week" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <EightWeekView
              recordMap={recordMap}
              onSelectDate={(d) => !selectMode && setSelectedDate(d)}
              selectProps={selectProps}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Day modal (single date) ── */}
      {selectedDate && !selectMode && (
        <DayModal date={selectedDate} record={selectedRecord} onClose={() => setSelectedDate(null)} />
      )}

      {/* ── Bulk action bar ── */}
      <BulkActionBar
        selectedDates={selectedDates}
        recordMap={recordMap}
        onClose={clearSelection}
      />
    </div>
  );
}

function ViewTab({ active, icon: Icon, label, onClick }: {
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

// ─── Bulk action bar ──────────────────────────────────────────────────────────

function BulkActionBar({ selectedDates, recordMap, onClose }: {
  selectedDates: Set<string>;
  recordMap: Record<string, AttendanceDay>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const bulk = useBulkUpdateAttendance();
  const count = selectedDates.size;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetQuarterlySummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetYearSummaryQueryKey() });
  };

  const applyState = (state: DayState) => {
    if (count === 0 || bulk.isPending) return;
    const records = Array.from(selectedDates).map((date) => ({
      date,
      action: state === "remote"
        ? BulkAttendanceBodyRecordsItemAction.delete
        : BulkAttendanceBodyRecordsItemAction.upsert,
      ...(state !== "remote" && { state }),
      ...(recordMap[date]?.note && { note: recordMap[date].note as string }),
    }));
    bulk.mutate(
      { data: { records } },
      { onSuccess: () => { invalidateAll(); onClose(); } }
    );
  };

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 380 }}
          className="fixed bottom-4 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[560px] z-40 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/40">
            <span className="text-sm font-semibold text-foreground">
              {count} day{count !== 1 ? "s" : ""} selected — set status:
            </span>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* State buttons */}
          <div className="p-3 grid grid-cols-5 gap-2">
            {ALL_STATES.map((state) => {
              const cfg = STATE_CONFIG[state];
              return (
                <button
                  key={state}
                  onClick={() => applyState(state)}
                  disabled={bulk.isPending}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-center transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50",
                    cfg.bg, cfg.border
                  )}
                >
                  {bulk.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <div className={cn("w-4 h-4 rounded-full", cfg.dot)} />
                  )}
                  <span className={cn("text-[10px] font-medium leading-tight", cfg.color)}>
                    {state === "present"       ? "Attended"  :
                     state === "planned"       ? "Planned"   :
                     state === "personal_leave"? "Personal"  :
                     state === "company_leave" ? "Holiday"   : "Remote"}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Quarter view ─────────────────────────────────────────────────────────────

function QuarterView({ recordMap, onSelectDate, selectProps, initialQuarter, initialYear }: {
  recordMap: Record<string, AttendanceDay>;
  onSelectDate: (d: string) => void;
  selectProps: SelectProps;
  initialQuarter: number;
  initialYear: number;
}) {
  const [year, setYear]       = useState(initialYear);
  const [quarter, setQuarter] = useState(initialQuarter);
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

      <StateLegend />

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
            <MonthBlock
              key={`${year}-${m}`}
              year={year}
              month={m}
              recordMap={recordMap}
              onSelectDate={onSelectDate}
              selectProps={selectProps}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// ─── 8-week rolling view ─────────────────────────────────────────────────────

function EightWeekView({ recordMap, onSelectDate, selectProps }: {
  recordMap: Record<string, AttendanceDay>;
  onSelectDate: (d: string) => void;
  selectProps: SelectProps;
}) {
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

  const { officeDaysInWindow, weeklyAvg, weeklyBreakdown } = useMemo(() => {
    let total = 0;
    const breakdown: number[] = [];
    for (const week of weeks) {
      let weekCount = 0;
      for (const day of week) {
        if (day.getDay() === 0 || day.getDay() === 6) continue;
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
  const isAtDefault = format(windowStart, "yyyy-MM-dd") === format(defaultStart, "yyyy-MM-dd");
  const rangeLabel = `${format(windowStart, "MMM d")} – ${format(windowEnd, "MMM d, yyyy")}`;

  const goPrev = () => { setDirection(-1); setWindowStart((d) => addWeeks(d, -1)); };
  const goNext = () => { setDirection(1);  setWindowStart((d) => addWeeks(d, 1)); };
  const goToNow = () => {
    setDirection(windowStart < defaultStart ? 1 : -1);
    setWindowStart(defaultStart);
  };

  return (
    <>
      <div className="flex items-start justify-between mb-4">
        <AnimatePresence mode="wait">
          <motion.div key={format(windowStart, "yyyy-MM-dd")} initial={{ opacity: 0, x: direction * 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -10 }} transition={{ duration: 0.2 }}>
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
      <div className={cn("rounded-2xl border p-4 mb-5 shadow-sm", isOnTarget ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
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
              {officeDaysInWindow}<span className="text-sm font-normal opacity-60"> / {TOTAL_TARGET}</span>
            </p>
            <p className={cn("text-xs", isOnTarget ? "text-emerald-600" : "text-amber-600")}>
              avg {weeklyAvg}/wk · target 2/wk
            </p>
          </div>
        </div>
        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
          <motion.div key={officeDaysInWindow} initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
            className={cn("h-full rounded-full", isOnTarget ? "bg-emerald-500" : "bg-amber-500")} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className={cn("text-[10px]", isOnTarget ? "text-emerald-500" : "text-amber-500")}>{progressPct}%</span>
          <span className={cn("text-[10px]", isOnTarget ? "text-emerald-500" : "text-amber-500")}>Target: {TOTAL_TARGET} days</span>
        </div>
      </div>

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
          <div className="grid grid-cols-8 border-b border-border bg-secondary/30">
            <div className="py-2.5 px-3 text-xs font-medium text-muted-foreground">Week</div>
            {WEEKDAYS_LONG.map((d) => (
              <div key={d} className="py-2.5 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>

          {weeks.map((week, wi) => {
            const weekLabel = format(week[0], "MMM d");
            const count = weeklyBreakdown[wi];
            const isTargetMet = count >= DAYS_TARGET_PER_WEEK;
            const allFuture = week.every(d => isFuture(d) && !isToday(d));

            return (
              <div key={`week-${wi}`} className={cn("grid grid-cols-8 border-b border-border last:border-b-0", allFuture && "opacity-60")}>
                <div className="flex flex-col justify-center px-3 py-2 border-r border-border bg-secondary/10">
                  <span className="text-xs font-medium text-muted-foreground">{weekLabel}</span>
                  <span className={cn("text-[10px] font-semibold mt-0.5",
                    isTargetMet ? "text-emerald-600" : count > 0 ? "text-amber-600" : "text-muted-foreground/50"
                  )}>
                    {count}/{DAYS_TARGET_PER_WEEK}
                  </span>
                </div>

                {week.map((day) => {
                  const ds = format(day, "yyyy-MM-dd");
                  const record = recordMap[ds];
                  const state = (record?.state ?? "remote") as DayState;
                  const cfg = STATE_CONFIG[state];
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const hasRecord = !!record && state !== "remote";
                  const isTodayDay = isToday(day);
                  const isSelected = selectProps.selectedDates.has(ds);

                  const handleClick = () => {
                    if (isWeekend) return;
                    if (selectProps.selectMode) { selectProps.onToggleDate(ds); return; }
                    onSelectDate(ds);
                  };

                  return (
                    <button
                      key={`day-${ds}`}
                      onClick={handleClick}
                      disabled={isWeekend && !selectProps.selectMode}
                      title={format(day, "MMM d")}
                      className={cn(
                        "relative py-2 px-0.5 border-r border-border last:border-r-0 flex flex-col items-center justify-center gap-0.5 min-h-[52px] transition-all duration-100",
                        isWeekend ? "bg-secondary/20 cursor-default" :
                          isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary cursor-pointer" :
                          hasRecord ? cn(cfg.bg, "hover:brightness-95 cursor-pointer") :
                          "bg-white hover:bg-secondary/50 cursor-pointer",
                        isTodayDay && !isSelected && "ring-1 ring-inset ring-primary/40"
                      )}
                    >
                      <span className={cn(
                        "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                        isTodayDay ? "bg-primary text-primary-foreground font-bold" :
                          isWeekend ? "text-muted-foreground/40" :
                          hasRecord ? cfg.color : "text-foreground"
                      )}>
                        {format(day, "d")}
                      </span>
                      {isSelected ? (
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      ) : hasRecord && !isWeekend ? (
                        <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                      ) : null}
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
            const barPct = count === 0 ? 4 : Math.min(100, (count / 5) * 100);
            const isTarget = count >= DAYS_TARGET_PER_WEEK;
            const isCurrent = weeks[i].some(d => isToday(d));
            return (
              <div key={`bar-${i}`} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: "36px" }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${barPct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.04, ease: "easeOut" }}
                    className={cn("w-full rounded-t-sm min-h-[3px]",
                      count === 0 ? "bg-secondary" : isTarget ? "bg-emerald-400" : "bg-amber-400",
                      isCurrent && "ring-1 ring-primary ring-offset-1"
                    )}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground font-medium">{format(weekStart, "M/d")}</span>
              </div>
            );
          })}
        </div>
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

function MonthBlock({ year, month, recordMap, onSelectDate, selectProps }: {
  year: number; month: number;
  recordMap: Record<string, AttendanceDay>;
  onSelectDate: (d: string) => void;
  selectProps: SelectProps;
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
          <div key={`e-${year}-${month}-${i}`} className="border-b border-r border-border last:border-r-0 min-h-[44px] md:min-h-[52px] bg-secondary/10" />
        ))}

        {days.map((day, i) => {
          const ds = format(day, "yyyy-MM-dd");
          const record = recordMap[ds];
          const state = (record?.state ?? "remote") as DayState;
          const cfg = STATE_CONFIG[state];
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const colIndex = (startOffset + i) % 7;
          const isLastCol = colIndex === 6;
          const hasRecord = !!record && state !== "remote";
          const isSelected = selectProps.selectedDates.has(ds);

          const handleClick = () => {
            if (isWeekend) return;
            if (selectProps.selectMode) { selectProps.onToggleDate(ds); return; }
            onSelectDate(ds);
          };

          return (
            <button
              key={`day-${ds}`}
              onClick={handleClick}
              disabled={isWeekend && !selectProps.selectMode}
              className={cn(
                "relative min-h-[44px] md:min-h-[52px] p-1.5 border-b border-r border-border text-left transition-all duration-100",
                isLastCol && "border-r-0",
                isWeekend ? "bg-secondary/20 cursor-default" :
                  isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary cursor-pointer" :
                  hasRecord ? cn(cfg.bg, "hover:bg-opacity-80 cursor-pointer") :
                  "bg-white hover:bg-secondary/60 cursor-pointer"
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

              {isSelected ? (
                <div className="mt-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              ) : hasRecord && !isWeekend ? (
                <div className="mt-0.5">
                  {state === "planned" ? (
                    <span className={cn("text-[9px] font-semibold px-1 py-0.5 rounded border border-dashed hidden sm:inline-block", cfg.bg, cfg.border, cfg.color)}>
                      Planned
                    </span>
                  ) : (
                    <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                  )}
                </div>
              ) : null}
            </button>
          );
        })}

        {(() => {
          const total = startOffset + days.length;
          const trail = total % 7 === 0 ? 0 : 7 - (total % 7);
          return Array.from({ length: trail }).map((_, i) => (
            <div key={`t-${year}-${month}-${i}`} className={cn(
              "border-b border-r border-border bg-secondary/10 min-h-[44px] md:min-h-[52px]",
              i === trail - 1 && "border-r-0"
            )} />
          ));
        })()}
      </div>
    </div>
  );
}
