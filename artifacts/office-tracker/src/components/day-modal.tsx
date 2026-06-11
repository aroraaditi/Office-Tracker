import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpsertAttendance,
  useDeleteAttendance,
  getListAttendanceQueryKey,
  getGetQuarterlySummaryQueryKey,
  getGetYearSummaryQueryKey,
} from "@workspace/api-client-react";
import type { AttendanceDay, DayState } from "@workspace/api-client-react";
import { STATE_CONFIG, ALL_STATES } from "@/lib/states";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface DayModalProps {
  date: string | null;
  record: AttendanceDay | null;
  onClose: () => void;
}

export default function DayModal({ date, record, onClose }: DayModalProps) {
  const [selectedState, setSelectedState] = useState<DayState>("remote");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const upsert = useUpsertAttendance();
  const deleteAttendance = useDeleteAttendance();

  useEffect(() => {
    if (record) {
      setSelectedState(record.state as DayState);
      setNote(record.note ?? "");
    } else {
      setSelectedState("remote");
      setNote("");
    }
  }, [record, date]);

  if (!date) return null;

  const parsedDate = parseISO(date);
  const isWeekend = parsedDate.getDay() === 0 || parsedDate.getDay() === 6;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetQuarterlySummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetYearSummaryQueryKey() });
  };

  const handleSave = () => {
    if (selectedState === "remote" && !record) {
      onClose();
      return;
    }

    if (selectedState === "remote" && record) {
      deleteAttendance.mutate(
        { date },
        {
          onSuccess: () => {
            invalidateAll();
            onClose();
          },
        }
      );
      return;
    }

    upsert.mutate(
      { data: { date, state: selectedState as DayState, note: note || undefined } },
      {
        onSuccess: () => {
          invalidateAll();
          onClose();
        },
      }
    );
  };

  const isPending = upsert.isPending || deleteAttendance.isPending;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Mobile: bottom sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 350 }}
        className="fixed inset-x-0 bottom-0 z-50 md:hidden rounded-t-2xl bg-card border-t border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalContent
          date={date}
          parsedDate={parsedDate}
          isWeekend={isWeekend}
          selectedState={selectedState}
          setSelectedState={setSelectedState}
          note={note}
          setNote={setNote}
          onClose={onClose}
          onSave={handleSave}
          isPending={isPending}
        />
      </motion.div>

      {/* Desktop: centered dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className="fixed inset-0 z-50 hidden md:flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl">
          <ModalContent
            date={date}
            parsedDate={parsedDate}
            isWeekend={isWeekend}
            selectedState={selectedState}
            setSelectedState={setSelectedState}
            note={note}
            setNote={setNote}
            onClose={onClose}
            onSave={handleSave}
            isPending={isPending}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ModalContent({
  date,
  parsedDate,
  isWeekend,
  selectedState,
  setSelectedState,
  note,
  setNote,
  onClose,
  onSave,
  isPending,
}: {
  date: string;
  parsedDate: Date;
  isWeekend: boolean;
  selectedState: DayState;
  setSelectedState: (s: DayState) => void;
  note: string;
  setNote: (n: string) => void;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}) {
  const config = STATE_CONFIG[selectedState];
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-5">
      {/* Handle (mobile) */}
      <div className="md:hidden w-10 h-1 rounded-full bg-border mx-auto mb-4" />

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
            {format(parsedDate, "EEEE")}
          </p>
          <h2 className="text-xl font-bold text-foreground">
            {format(parsedDate, "MMMM d, yyyy")}
          </h2>
          {date === today && (
            <span className="inline-block mt-1 text-xs font-medium text-primary bg-accent px-2 py-0.5 rounded-full">
              Today
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* State selector */}
      <div className="space-y-2 mb-5">
        {ALL_STATES.map((state) => {
          const cfg = STATE_CONFIG[state];
          const isSelected = selectedState === state;
          return (
            <button
              key={state}
              onClick={() => setSelectedState(state)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150",
                isSelected
                  ? cn(cfg.bg, cfg.border, "shadow-sm")
                  : "border-border bg-white hover:bg-secondary/60"
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  isSelected ? "border-current" : "border-border"
                )}
              >
                {isSelected && (
                  <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                )}
              </div>
              <div>
                <p
                  className={cn(
                    "text-sm font-medium leading-tight",
                    isSelected ? cfg.color : "text-foreground"
                  )}
                >
                  {cfg.label}
                </p>
                <p className="text-xs text-muted-foreground">{cfg.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Note field */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Note (optional)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note for this day..."
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-border bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isPending}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}
