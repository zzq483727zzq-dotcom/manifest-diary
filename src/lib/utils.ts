import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getTimeOfDay } from "./time-greeting";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * @deprecated 改用 `@/lib/time-greeting` 的 `getTimeOfDay`（四档：morning/day/evening/night）。
 * 向后兼容：仅当处于 morning 档时返回 "morning"，其余一律 "night"。
 */
export function getTimeMode(): "morning" | "night" {
  return getTimeOfDay() === "morning" ? "morning" : "night";
}

/** 根据 created_at 时间计算 entry_date（凌晨 0-5 点算前一天） */
export function getEntryDate(createdAt: Date): string {
  const hour = createdAt.getHours();
  const date = new Date(createdAt);
  if (hour < 5) {
    date.setDate(date.getDate() - 1);
  }
  return date.toISOString().split("T")[0];
}
