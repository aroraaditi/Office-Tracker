import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string, formatStr: string = "MMM d, yyyy") {
  try {
    return format(parseISO(dateStr), formatStr);
  } catch (e) {
    return dateStr;
  }
}

export function getTodayDateString() {
  return format(new Date(), "yyyy-MM-dd");
}
