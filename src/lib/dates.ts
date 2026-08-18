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
  return Math.ceil((dow + boss.cycleDays) / 7);
}

/** 第 weekIdx 周的日期范围（真实日历周：周一 ~ 周日） */
export function weekRange(boss: Boss, weekIdx: number): { from: string; to: string } {
  const from = addDays(weekMonday(boss), weekIdx * 7);
  return { from, to: addDays(from, 6) };
}

export function currentWeekIndex(boss: Boss): number {
  const day = cycleDayIndex(boss);
  if (day <= 0) return -1;
  const d = new Date(boss.startDate + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7;
  return Math.floor((dow + day - 1) / 7);
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
  const visibleWeekKeys = new Set(Array.from({ length: weeksTotal }, (_, i) => weekRange(b, i).from));
  const weeklyDone = b.weekly.filter((key) => visibleWeekKeys.has(key)).length;

  let tasksDone = 0;
  let tasksTotal = 0;
  if (b.tier >= 3 && b.show.bigEvent) {
    tasksTotal += 1;
    if (b.bigEvent.done) tasksDone += 1;
  }
  if (b.tier === 4) {
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

  const dailyPart = b.cycleDays > 0 ? dailyDone / b.cycleDays : 0;
  const weeklyPart = weeksTotal > 0 ? weeklyDone / weeksTotal : 0;
  const taskPart = tasksTotal > 0 ? tasksDone / tasksTotal : 1;
  const overall = Math.round(
    (dailyPart * 0.5 + (b.tier >= 2 ? weeklyPart * 0.2 : 0) + (tasksTotal > 0 ? taskPart * (b.tier >= 2 ? 0.3 : 0.5) : 0)) * 100
  );

  return { dayNow, dailyDone, dailyElapsed, weeksTotal, weeklyDone, tasksDone, tasksTotal, overall: Math.min(overall, 100) };
}
