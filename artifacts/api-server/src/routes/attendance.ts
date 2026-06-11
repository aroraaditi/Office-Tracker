import { Router } from "express";
import { db, attendanceTable, DAY_STATES } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  ListAttendanceQueryParams,
  UpsertAttendanceBody,
  GetAttendanceParams,
  DeleteAttendanceParams,
  GetQuarterlySummaryQueryParams,
  GetYearSummaryQueryParams,
} from "@workspace/api-zod";

const router = Router();

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getQuarterMonths(quarter: number): number[] {
  return [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]][quarter - 1];
}

function countWeeksInQuarter(year: number, quarter: number): number {
  const months = getQuarterMonths(quarter);
  const start = new Date(year, months[0] - 1, 1);
  const end = new Date(year, months[2], 0);
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil((diffMs / (1000 * 60 * 60 * 24) + 1) / 7);
}

function countWorkdays(year: number, quarter: number): number {
  const months = getQuarterMonths(quarter);
  const start = new Date(year, months[0] - 1, 1);
  const end = new Date(year, months[2], 0);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// GET /attendance
router.get("/attendance", async (req, res) => {
  const parsed = ListAttendanceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { year, month } = parsed.data;

  try {
    let records = await db.select().from(attendanceTable);

    if (year !== undefined) {
      records = records.filter((r) => r.date.startsWith(String(year)));
    }
    if (month !== undefined) {
      const monthStr = String(month).padStart(2, "0");
      const prefix = year ? `${year}-${monthStr}` : `-${monthStr}-`;
      records = records.filter((r) =>
        year ? r.date.startsWith(`${year}-${monthStr}`) : r.date.slice(5, 7) === monthStr
      );
    }

    res.json(records);
  } catch (err) {
    req.log.error({ err }, "Failed to list attendance");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /attendance (upsert)
router.post("/attendance", async (req, res) => {
  const parsed = UpsertAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }

  const { date, state, note } = parsed.data;

  try {
    const existing = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.date, date));

    let record;
    if (existing.length > 0) {
      const updated = await db
        .update(attendanceTable)
        .set({ state, note: note ?? null, updatedAt: new Date() })
        .where(eq(attendanceTable.date, date))
        .returning();
      record = updated[0];
    } else {
      const inserted = await db
        .insert(attendanceTable)
        .values({ date, state, note: note ?? null })
        .returning();
      record = inserted[0];
    }

    res.json(record);
  } catch (err) {
    req.log.error({ err }, "Failed to upsert attendance");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /attendance/:date
router.get("/attendance/:date", async (req, res) => {
  const parsed = GetAttendanceParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  try {
    const records = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.date, parsed.data.date));

    if (records.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(records[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to get attendance");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /attendance/:date
router.delete("/attendance/:date", async (req, res) => {
  const parsed = DeleteAttendanceParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  try {
    await db
      .delete(attendanceTable)
      .where(eq(attendanceTable.date, parsed.data.date));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete attendance");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /attendance/checkin
router.post("/attendance/checkin", async (req, res) => {
  const today = todayStr();

  try {
    const existing = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.date, today));

    let record;
    if (existing.length > 0) {
      const updated = await db
        .update(attendanceTable)
        .set({ state: "present", updatedAt: new Date() })
        .where(eq(attendanceTable.date, today))
        .returning();
      record = updated[0];
    } else {
      const inserted = await db
        .insert(attendanceTable)
        .values({ date: today, state: "present" })
        .returning();
      record = inserted[0];
    }

    res.json(record);
  } catch (err) {
    req.log.error({ err }, "Failed to checkin today");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /summary/quarterly
router.get("/summary/quarterly", async (req, res) => {
  const parsed = GetQuarterlySummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const year = parsed.data.year ?? new Date().getFullYear();

  try {
    const records = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          gte(attendanceTable.date, `${year}-01-01`),
          lte(attendanceTable.date, `${year}-12-31`)
        )
      );

    const quarters = [1, 2, 3, 4].map((q) => {
      const months = getQuarterMonths(q);
      const qRecords = records.filter((r) => {
        const m = parseInt(r.date.split("-")[1]);
        return months.includes(m);
      });

      const labels = ["Q1 Jan - Mar", "Q2 Apr - Jun", "Q3 Jul - Sep", "Q4 Oct - Dec"];

      return {
        quarter: q,
        label: labels[q - 1],
        months,
        totalWeeks: countWeeksInQuarter(year, q),
        presentDays: qRecords.filter((r) => r.state === "present").length,
        plannedDays: qRecords.filter((r) => r.state === "planned").length,
        personalLeaveDays: qRecords.filter((r) => r.state === "personal_leave").length,
        companyLeaveDays: qRecords.filter((r) => r.state === "company_leave").length,
        remoteDays: qRecords.filter((r) => r.state === "remote").length,
        totalWorkdays: countWorkdays(year, q),
      };
    });

    res.json(quarters);
  } catch (err) {
    req.log.error({ err }, "Failed to get quarterly summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /summary/year
router.get("/summary/year", async (req, res) => {
  const parsed = GetYearSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const year = parsed.data.year ?? new Date().getFullYear();

  try {
    const records = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          gte(attendanceTable.date, `${year}-01-01`),
          lte(attendanceTable.date, `${year}-12-31`)
        )
      );

    let totalWorkdays = 0;
    for (let q = 1; q <= 4; q++) totalWorkdays += countWorkdays(year, q);

    res.json({
      year,
      totalPresent: records.filter((r) => r.state === "present").length,
      totalPlanned: records.filter((r) => r.state === "planned").length,
      totalPersonalLeave: records.filter((r) => r.state === "personal_leave").length,
      totalCompanyLeave: records.filter((r) => r.state === "company_leave").length,
      totalRemote: records.filter((r) => r.state === "remote").length,
      totalWorkdays,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get year summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
