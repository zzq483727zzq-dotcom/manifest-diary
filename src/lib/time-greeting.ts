export type TimeOfDay = "morning" | "noon" | "afternoon" | "evening";

/** 返回真实当前时间所属时段 */
export function getTimeOfDay(now: Date = new Date()): TimeOfDay {
  const h = now.getHours();
  if (h >= 6 && h < 11) return "morning";
  if (h >= 11 && h < 14) return "noon";
  if (h >= 14 && h < 18) return "afternoon";
  return "evening"; // 18-6
}

const GREETINGS: Record<TimeOfDay, string> = {
  morning: "早安",
  noon: "午好",
  afternoon: "下午好",
  evening: "晚上好",
};

/** 中文问候语 */
export function greetingText(now: Date = new Date()): string {
  return GREETINGS[getTimeOfDay(now)];
}

/** 复盘页副标题：深夜更轻柔，白天更明朗 */
export function reflectionSubtitle(now: Date = new Date()): string {
  const tod = getTimeOfDay(now);
  if (tod === "evening") return "说也行，写也行——它会接住你";
  if (tod === "morning") return "新的一天，把昨晚没倒完的继续说";
  return "把现在的心绪倒在这里，不用整齐";
}

/** 主题：白天/夜晚都用 night 暖底（按 spec 不做昼夜切换底色），
 *  仅返回主题名供 ThemeProvider 使用。cosmos 由显化页路由层覆盖。 */
export function themeForTime(_tod: TimeOfDay): "night" {
  return "night";
}
