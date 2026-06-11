import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const DAY_STATES = ["present", "company_leave", "personal_leave", "planned", "remote"] as const;
export type DayState = (typeof DAY_STATES)[number];

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  state: text("state").$type<DayState>().notNull().default("remote"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
