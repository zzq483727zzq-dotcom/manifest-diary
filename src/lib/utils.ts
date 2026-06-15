import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 判断当前时间属于哪个模式 */
export function getTimeMode(): "morning" | "night" {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 9) return "morning";
  return "night";
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
