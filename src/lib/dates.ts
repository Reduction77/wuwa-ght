import type { Boss } from '@/types';

/**
 * 鸣潮的“今天”：每日凌晨 4:00 才切换到下一天。
 * 例如 8 月 20 日 03:59 仍算 8 月 19 日，04:00 起才算 8 月 20 日。
 */
export function todayStr(now = new Date()): string {
  const shifted = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shifted);
  const value = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** 日期范围两端都填写时，开始日期不能晚于截止日期。 */
export function isDateRangeInvalid(start?: string, end?: string): boolean {
  return Boolean(start && end && start > end);
}

export function fmtCN(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 周期第几天（1 起）；未到开始日返回 0，超过周期返回 cycleDays */
export function cycleDayIndex(boss: Boss, date = todayStr()): number {
  if (date < boss.startDate) return 0;
  return Math.min(cycleDates(boss).filter((item) => item <= date).length, boss.cycleDays);
}

export function cycleEndDate(boss: Boss): string {
  return cycleDates(boss).at(-1) ?? boss.startDate;
}

/** 实际需要服务的日期；暂停日跳过，并自动把周期向后顺延。 */
export function cycleDates(boss: Boss): string[] {
  const excluded = new Set((boss.excludedDays ?? []).map((item) => item.date));
  const result: string[] = [];
  let offset = 0;
  while (result.length < boss.cycleDays && offset < boss.cycleDays + excluded.size + 366) {
    const date = addDays(boss.startDate, offset);
    if (!excluded.has(date)) result.push(date);
    offset += 1;
  }
  return result;
}

/** 距周期结束还剩几天（结束日当天为 0）；已到期返回负数 */
export function daysLeftInCycle(boss: Boss, date = todayStr()): number {
  const end = new Date(cycleEndDate(boss) + 'T00:00:00').getTime();
  const cur = new Date(date + 'T00:00:00').getTime();
  return Math.round((end - cur) / 86400000);
}

/** 开始日所在周的周一（周常按真实日历周对齐：周一 ~ 周日，和游戏每周一刷新一致） */
function weekMonday(boss: Boss): string {
  const d = new Date(boss.startDate + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // 周一 = 0
  return addDays(boss.startDate, -dow);
}

/** 周期覆盖的日历周数 */
export function cycleWeeks(boss: Boss): number {
  const d = new Date(boss.startDate + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7;
  const calendarDays = Math.round((new Date(cycleEndDate(boss) + 'T00:00:00').getTime() - d.getTime()) / 86400000) + 1;
  return Math.ceil((dow + calendarDays) / 7);
}

/** 第 weekIdx 周的日期范围（真实日历周：周一 ~ 周日） */
export function weekRange(boss: Boss, weekIdx: number): { from: string; to: string } {
  const from = addDays(weekMonday(boss), weekIdx * 7);
  return { from, to: addDays(from, 6) };
}

export function currentWeekIndex(boss: Boss): number {
  const today = todayStr();
  if (today < boss.startDate || today > cycleEndDate(boss)) return -1;
  const monday = new Date(weekMonday(boss) + 'T00:00:00').getTime();
  const current = new Date(today + 'T00:00:00').getTime();
  return Math.floor(Math.round((current - monday) / 86400000) / 7);
}

export interface BossStats {
  dayNow: number; // 周期第几天
  dailyDone: number;
  dailyElapsed: number; // 已流逝天数（应完成天数）
  weeksTotal: number;
  weeklyDone: number;
  tasksDone: number;
  tasksTotal: number;
  overall: number; // 0~100
}

export function bossStats(b: Boss): BossStats {
  const dayNow = cycleDayIndex(b);
  const eligibleDates = cycleDates(b);
  const eligibleSet = new Set(eligibleDates);
  const dailyElapsed = eligibleDates.filter((date) => date <= todayStr()).length;
  const dailyDone = b.daily.filter((date) => eligibleSet.has(date)).length;
  const weeksTotal = cycleWeeks(b);
  const visibleWeekKeys = new Set(Array.from({ length: weeksTotal }, (_, i) => weekRange(b, i).from));
  const weeklyDone = b.weekly.filter((key) => visibleWeekKeys.has(key)).length;

  let tasksDone = 0;
  let tasksTotal = 0;
  if (b.services.bigEvent && b.show.bigEvent) {
    tasksTotal += 1;
    if (b.bigEvent.done) tasksDone += 1;
  }
  if (b.services.smallEvents && b.show.bigEvent) {
    tasksTotal += 3; // 小活动
    b.smallEvents.forEach((e) => e.done && tasksDone++);
  }
  // 高难挑战按开启的单项计入
  (['matrix', 'sea', 'tower', 'holo'] as const).forEach((k) => {
    const c = b.challenges[k];
    if (c.enabled) {
      tasksTotal += 1;
      if (c.done) tasksDone += 1;
    }
  });
  if (b.optionals.redeem.enabled) {
    tasksTotal += 1;
    if (b.optionals.redeem.done) tasksDone++;
  }
  if (b.optionals.gacha.enabled) {
    tasksTotal += 1;
    if (b.optionals.gacha.done) tasksDone++;
  }
  if (b.optionals.trial.enabled) {
    tasksTotal += 1;
    if (b.optionals.trial.done) tasksDone++;
  }
  b.extraTasks.filter((task) => task.visible).forEach((task) => {
    tasksTotal += 1;
    if (task.done) tasksDone += 1;
  });

  const dailyPart = b.cycleDays > 0 ? dailyDone / b.cycleDays : 0;
  const weeklyPart = weeksTotal > 0 ? weeklyDone / weeksTotal : 0;
  const taskPart = tasksTotal > 0 ? tasksDone / tasksTotal : 1;
  const parts: Array<{ value: number; weight: number }> = [];
  if (b.services.daily && b.show.daily) parts.push({ value: dailyPart, weight: 0.5 });
  if (b.services.weekly && b.show.weekly) parts.push({ value: weeklyPart, weight: 0.2 });
  if (tasksTotal > 0) parts.push({ value: taskPart, weight: 0.3 });
  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  const overall = weight ? Math.round(parts.reduce((sum, part) => sum + part.value * part.weight, 0) / weight * 100) : 100;

  return { dayNow, dailyDone, dailyElapsed, weeksTotal, weeklyDone, tasksDone, tasksTotal, overall: Math.min(overall, 100) };
}
