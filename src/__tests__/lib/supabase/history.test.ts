import { describe, it, expect } from "vitest";
import { aggregateMonthEntries } from "@/lib/supabase/history";

describe("aggregateMonthEntries", () => {
  it("groups journal and manifest entries by date", () => {
    const journalEntries = [
      { entry_date: "2026-06-15" },
      { entry_date: "2026-06-15" },
      { entry_date: "2026-06-16" },
    ];
    const manifestEntries = [
      { entry_date: "2026-06-15" },
      { entry_date: "2026-06-17" },
    ];
    const result = aggregateMonthEntries(journalEntries, manifestEntries);
    expect(result["2026-06-15"]).toEqual({ date: "2026-06-15", journalCount: 2, manifestCount: 1 });
    expect(result["2026-06-16"]).toEqual({ date: "2026-06-16", journalCount: 1, manifestCount: 0 });
    expect(result["2026-06-17"]).toEqual({ date: "2026-06-17", journalCount: 0, manifestCount: 1 });
  });

  it("returns empty object when given no entries", () => {
    expect(aggregateMonthEntries([], [])).toEqual({});
  });
});