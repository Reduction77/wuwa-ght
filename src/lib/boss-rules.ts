import type { Boss, CycleSnapshot } from '@/types';

export function renewBossForDate(boss: Boss, today: string, id = `cycle-${Date.now()}`): Boss {
  const snapshot: CycleSnapshot = {
    id,
    startDate: boss.startDate,
    cycleDays: boss.cycleDays,
    endedAt: today,
    daily: [...boss.daily],
    weekly: [...boss.weekly],
    bigEvent: { ...boss.bigEvent },
    smallEvents: boss.smallEvents.map((event) => ({ ...event })),
    challenges: structuredClone(boss.challenges),
    optionals: structuredClone(boss.optionals),
    extraTasks: boss.extraTasks.map((task) => ({ ...task })),
    excludedDays: boss.excludedDays.map((item) => ({ ...item })),
  };
  return {
    ...boss,
    startDate: today,
    daily: [],
    renewalState: 'renewed',
    cycleHistory: [...boss.cycleHistory, snapshot],
  };
}

/** 游戏版本更新保留固定刷新任务，只重置版本类完成状态。 */
export function resetBossVersionProgress(boss: Boss): Boss {
  return {
    ...boss,
    bigEvent: { ...boss.bigEvent, done: false, openDate: '', deadline: '' },
    smallEvents: boss.smallEvents.map((event) => ({ ...event, done: false, openDate: '', deadline: '' })),
    challenges: { ...boss.challenges, holo: { ...boss.challenges.holo, done: false } },
    optionals: {
      redeem: { ...boss.optionals.redeem, done: false },
      gacha: { ...boss.optionals.gacha, done: false },
    },
  };
}
