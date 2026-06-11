import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  getDay,
  parseISO,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import DayModal from "@/components/day-modal";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const QUARTER_MONTHS = [[1,2,3],[4,5,6],[7,8,9],[10,11,12]] as const;
const QUARTER_NAMES = ["Q1 · Jan – Mar", "Q2 · Apr – Jun", "Q3 · Jul – Sep", "Q4 · Oct – Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_QUARTER = Math.ceil((new Date().getMonth() + 1) / 3);

export default function Calendar() {
  const [year, setYear]       = useState(CURRENT_YEAR);
  const [quarter, setQuarter] = useState(CURRENT_QUARTER);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch the full year so we can filter per-month without extra requests
  const { data: records } = useListAttendance(
    { year },
    { query: { queryKey: getListAttendanceQueryKey({ year }) } }
  );

  const recordMap = useMemo(() => {
    const map: Record<string, AttendanceDay> = {};
    (records ?? []).forEach((r) => { map[r.date] = r; });
    return map;
  }, [records]);

  const months = QUARTER_MONTHS[quarter - 1];

  // Quarter-level stats
  const quarterStats = useMemo(() => {
    let present = 0, planned = 0, leave = 0;
    for (const m of months) {
      const mStr = String(m).padStart(2, "0");
      const prefix = `${year}-${mStr}-`;
      for (const [k, v] of Object.entries(recordMap)) {
        if (!k.startsWith(prefix)) continue;
        if (v.state === "present") present++;
        else if (v.state === "planned") planned++;
        else if (v.state === "personal_leave") leave++;
      }
    }
    return { present, planned, leave };
  }, [recordMap, months, year]);

  // Navigation
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
    setDirection(CURRENT_YEAR > year || (CURRENT_YEAR === year && CURRENT_QUARTER > quarter) ? 1 : -1);
    setYear(CURRENT_YEAR);
    setQuarter(CURRENT_QUARTER);
  };

  const isCurrentQ = year === CURRENT_YEAR && quarter === CURRENT_QUARTER;
  const isMaxQ = year > CURRENT_YEAR || (year === CURRENT_YEAR && quarter >= CURRENT_QUARTER);

  const selectedRecord = selectedDate ? recordMap[selectedDate] ?? null : null;

  const officeDays = quarterStats.present + quarterStats.planned;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

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
            <h1 className="text-2xl font-bold text-foreground">{QUARTER_NAMES[quarter - 1]}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {year} · {officeDays} in office
              {quarterStats.leave > 0 && ` · ${quarterStats.leave} leave`}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button onClick={goPrev} className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {!isCurrentQ && (
            <button onClick={goToNow} className="px-3 h-9 rounded-xl border border-border bg-card text-xs font-medium text-foreground hover:bg-secondary transition-colors">
              Now
            </button>
          )}
          <button onClick={goNext} disabled={isMaxQ} className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
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

      {/* 3-month quarter grid */}
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
              onSelectDate={setSelectedDate}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Day modal */}
      {selectedDate && (
        <DayModal
          date={selectedDate}
          record={selectedRecord}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

// ─── Single month calendar block ────────────────────────────────────────────

function MonthBlock({
  year,
  month,
  recordMap,
  onSelectDate,
}: {
  year: number;
  month: number;
  recordMap: Record<string, AttendanceDay>;
  onSelectDate: (d: string) => void;
}) {
  const monthDate = new Date(year, month - 1, 1);
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
  const startOffset = getDay(startOfMonth(monthDate));

  const presentCount = days.filter((d) => {
    const ds = format(d, "yyyy-MM-dd");
    const r = recordMap[ds];
    return r && (r.state === "present" || r.state === "planned");
  }).length;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
        <h2 className="text-sm font-semibold text-foreground">
          {format(monthDate, "MMMM yyyy")}
        </h2>
        <span className="text-xs text-muted-foreground font-medium">
          {presentCount} office days
        </span>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {/* Offset empties */}
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
                  : hasRecord
                  ? cfg.color
                  : "text-foreground"
              )}>
                {format(day, "d")}
              </span>

              {/* State indicator */}
              {hasRecord && !isWeekend && (
                <div className="mt-0.5">
                  {isPlanned ? (
                    <span className={cn(
                      "text-[9px] font-semibold px-1 py-0.5 rounded border border-dashed hidden sm:inline-block",
                      cfg.bg, cfg.border, cfg.color
                    )}>
                      Planned
                    </span>
                  ) : (
                    <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                  )}
                </div>
              )}

              {/* Note dot */}
              {record?.note && (
                <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-current opacity-25" />
              )}
            </button>
          );
        })}

        {/* Trailing empties */}
        {(() => {
          const total = startOffset + days.length;
          const trail = total % 7 === 0 ? 0 : 7 - (total % 7);
          return Array.from({ length: trail }).map((_, i) => (
            <div key={`t-${i}`} className={cn(
              "border-b border-r border-border bg-secondary/10 min-h-[44px] md:min-h-[52px]",
              i === trail - 1 && "border-r-0"
            )} />
          ));
        })()}
      </div>
    </div>
  );
}
