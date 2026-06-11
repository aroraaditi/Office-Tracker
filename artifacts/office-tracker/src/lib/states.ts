export type DayState = "present" | "company_leave" | "personal_leave" | "planned" | "remote";

export interface StateConfig {
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}

export const STATE_CONFIG: Record<DayState, StateConfig> = {
  present: {
    label: "Attended Office",
    description: "Worked from the office",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  personal_leave: {
    label: "Personal Leave",
    description: "Sick / casual / vacation leave",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    dot: "bg-rose-400",
  },
  company_leave: {
    label: "Company Leave",
    description: "Public holiday / office closed",
    color: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
  planned: {
    label: "Plan to be in Office",
    description: "Upcoming planned office day",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-300",
    dot: "bg-blue-500",
  },
  remote: {
    label: "Remote / Default",
    description: "Working from home",
    color: "text-slate-500",
    bg: "bg-white",
    border: "border-border",
    dot: "bg-slate-300",
  },
};

export const ALL_STATES: DayState[] = ["present", "planned", "personal_leave", "company_leave", "remote"];
