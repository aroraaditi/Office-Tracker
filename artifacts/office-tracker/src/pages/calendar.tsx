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
  isSameMonth,
  isToday,
  getDay,
  parseISO,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import DayModal from "@/components/day-modal";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: records } = useListAttendance(
    { year, month },
    { query: { queryKey: getListAttendanceQueryKey({ year, month }) } }
  );

  const recordMap = useMemo(() => {
    const map: Record<string, AttendanceDay> = {};
    (records ?? []).forEach((r) => {
      map[r.date] = r;
    });
    return map;
  }, [records]);

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const startOffset = getDay(startOfMonth(currentDate));

  const prevMonth = () => {
    setDirection(-1);
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setDirection(1);
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const selectedRecord = selectedDate ? recordMap[selectedDate] ?? null : null;

  // Summary counts for this month
  const presentCount = Object.values(recordMap).filter((r) => r.state === "present").length;
  const plannedCount = Object.values(recordMap).filter((r) => r.state === "planned").length;
  const leaveCount = Object.values(recordMap).filter((r) => r.state === "personal_leave").length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <motion.div
          key={format(currentDate, "yyyy-MM")}
          initial={{ opacity: 0, x: direction * 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <h1 className="text-2xl font-bold text-foreground">
            {format(currentDate, "MMMM yyyy")}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {presentCount} in office · {plannedCount} planned · {leaveCount} leave
          </p>
        </motion.div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setDirection(new Date() > currentDate ? 1 : -1);
              setCurrentDate(new Date());
            }}
            className="px-3 h-9 rounded-xl border border-border bg-card text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {(["present", "planned", "personal_leave", "company_leave"] as DayState[]).map((state) => {
          const cfg = STATE_CONFIG[state];
          return (
            <div key={state} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={cn("w-2.5 h-2.5 rounded-full", cfg.dot)} />
              <span>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-2.5 text-center text-xs font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={format(currentDate, "yyyy-MM")}
            initial={{ opacity: 0, x: direction * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -20 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-7"
          >
            {/* Empty cells for offset */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="border-b border-r border-border last:border-r-0"
              />
            ))}

            {days.map((day, i) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const record = recordMap[dateStr];
              const state = (record?.state ?? "remote") as DayState;
              const cfg = STATE_CONFIG[state];
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isPlanned = state === "planned";
              const colIndex = (startOffset + i) % 7;
              const isLastCol = colIndex === 6;

              return (
                <button
                  key={dateStr}
                  onClick={() => !isWeekend && setSelectedDate(dateStr)}
                  disabled={isWeekend}
                  className={cn(
                    "relative min-h-[52px] md:min-h-[64px] p-1.5 md:p-2 border-b border-r border-border transition-all duration-150 text-left group",
                    isLastCol && "border-r-0",
                    !isWeekend && "hover:bg-secondary/60 cursor-pointer",
                    isWeekend && "bg-secondary/30 cursor-default",
                    record && !isWeekend && cn(cfg.bg),
                    isPlanned && "bg-blue-50"
                  )}
                >
                  {/* Day number */}
                  <span
                    className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isToday(day)
                        ? "bg-primary text-primary-foreground font-bold"
                        : isWeekend
                        ? "text-muted-foreground/50"
                        : record
                        ? cfg.color
                        : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {/* State indicator */}
                  {record && !isWeekend && (
                    <div className="mt-1">
                      {isPlanned ? (
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                            cfg.bg,
                            cfg.border,
                            cfg.color,
                            "border-dashed hidden md:inline-block"
                          )}
                        >
                          Planned
                        </span>
                      ) : (
                        <div className={cn("w-2 h-2 rounded-full md:w-1.5 md:h-1.5", cfg.dot)} />
                      )}
                    </div>
                  )}

                  {/* Note indicator */}
                  {record?.note && (
                    <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-current opacity-30" />
                  )}
                </button>
              );
            })}

            {/* Trailing empty cells */}
            {(() => {
              const totalCells = startOffset + days.length;
              const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
              return Array.from({ length: remaining }).map((_, i) => (
                <div
                  key={`trail-${i}`}
                  className={cn(
                    "border-b border-r border-border bg-secondary/20",
                    i === remaining - 1 && "border-r-0"
                  )}
                />
              ));
            })()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Month summary */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniStat
          label="In office"
          value={presentCount}
          color="text-emerald-700"
          bg="bg-emerald-50"
          border="border-emerald-100"
        />
        <MiniStat
          label="Planned days"
          value={plannedCount}
          color="text-blue-700"
          bg="bg-blue-50"
          border="border-blue-100"
        />
      </div>

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

function MiniStat({
  label,
  value,
  color,
  bg,
  border,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <div className={cn("rounded-xl border p-3 bg-card flex items-center gap-3", border)}>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold", bg, color)}>
        {value}
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
