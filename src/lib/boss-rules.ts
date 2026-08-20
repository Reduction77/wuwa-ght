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

/** 游戏版本更新：清空旧活动资料，保留日常/周常/海墟/深塔并重置其余版本任务。 */
export function resetBossVersionProgress(boss: Boss): Boss {
  return {
    ...boss,
    bigEvent: { name: '', image: '', done: false, openDate: '', deadline: '' },
    smallEvents: boss.smallEvents.map(() => ({ name: '', image: '', done: false, openDate: '', deadline: '' })),
    challenges: {
      ...boss.challenges,
      matrix: { ...boss.challenges.matrix, done: false },
      holo: { ...boss.challenges.holo, done: false },
    },
    optionals: {
      redeem: { ...boss.optionals.redeem, done: false },
      gacha: { ...boss.optionals.gacha, done: false },
      trial: { ...boss.optionals.trial, done: false },
    },
  };
}
