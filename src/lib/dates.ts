import type { Boss } from '@/types';

export function todayStr(): string {
  const d = new Date();
  return toDateStr(d);
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

export function fmtCN(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 周期第几天（1 起）；未到开始日返回 0，超过周期返回 cycleDays */
export function cycleDayIndex(boss: Boss, date = todayStr()): number {
  const start = new Date(boss.startDate + 'T00:00:00').getTime();
  const cur = new Date(date + 'T00:00:00').getTime();
  const diff = Math.round((cur - start) / 86400000);
  return Math.min(Math.max(diff + 1, 0), boss.cycleDays);
}

export function cycleEndDate(boss: Boss): string {
  return addDays(boss.startDate, boss.cycleDays - 1);
}

/** 距周期结束还剩几天（结束日当天为 0）；已到期返回负数 */
export function daysLeftInCycle(boss: Boss, date = todayStr()): number {
  const end = new Date(cycleEndDate(boss) + 'T00:00:00').getTime();
  const cur = new Date(date + 'T00:00:00').getTime();
  return Math.round((end - cur) / 86400000);
}

/** 周期内的周数（每周 7 天，从开始日算起） */
export function cycleWeeks(boss: Boss): number {
  return Math.ceil(boss.cycleDays / 7);
}

/** 本周（周期内第 weekIdx 周）的日期范围 */
export function weekRange(boss: Boss, weekIdx: number): { from: string; to: string } {
  const from = addDays(boss.startDate, weekIdx * 7);
  const to = addDays(boss.startDate, Math.min(weekIdx * 7 + 6, boss.cycleDays - 1));
  return { from, to };
}

export function currentWeekIndex(boss: Boss): number {
  const day = cycleDayIndex(boss);
  if (day <= 0) return -1;
  return Math.floor((day - 1) / 7);
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
  const dailyElapsed = dayNow;
  const dailyDone = b.daily.length;
  const weeksTotal = cycleWeeks(b);
  const weeklyDone = b.weekly.length;

  let tasksDone = 0;
  let tasksTotal = 0;
  if (b.tier >= 3) {
    tasksTotal += 1;
    if (b.bigEvent.done) tasksDone += 1;
  }
  if (b.tier >= 4) {
    tasksTotal += 3 + 3; // 小活动 + 矩阵/海城/深塔
    b.smallEvents.forEach((e) => e.done && tasksDone++);
    if (b.challenges.matrix) tasksDone++;
    if (b.challenges.sea) tasksDone++;
    if (b.challenges.tower) tasksDone++;
  }
  if (b.optionals.redeem.enabled) {
    tasksTotal += 1;
    if (b.optionals.redeem.done) tasksDone++;
  }
  if (b.optionals.gacha.enabled) {
    tasksTotal += 1;
    if (b.optionals.gacha.done) tasksDone++;
  }

  const dailyPart = b.cycleDays > 0 ? dailyDone / b.cycleDays : 0;
  const weeklyPart = weeksTotal > 0 ? weeklyDone / weeksTotal : 0;
  const taskPart = tasksTotal > 0 ? tasksDone / tasksTotal : 1;
  const overall = Math.round(
    (dailyPart * 0.5 + (b.tier >= 2 ? weeklyPart * 0.2 : 0) + (tasksTotal > 0 ? taskPart * (b.tier >= 2 ? 0.3 : 0.5) : 0)) * 100
  );

  return { dayNow, dailyDone, dailyElapsed, weeksTotal, weeklyDone, tasksDone, tasksTotal, overall: Math.min(overall, 100) };
}
