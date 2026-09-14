import type { Boss, CycleSnapshot } from '@/types';

/** 后台截止提醒只统计实际承接的活动，不受老板端可见开关影响。 */
export function upcomingServiceEvents(boss: Boss, today: string, through: string) {
  const events = [
    ...(boss.services.bigEvent ? [boss.bigEvent] : []),
    ...(boss.services.smallEvents ? boss.smallEvents : []),
  ];
  return events.filter(event => !event.done && event.deadline && event.deadline >= today && event.deadline <= through);
}

export type ResettableChallenge = 'tower' | 'sea';

/** 独立挑战换期只撤销这一项的完成状态，不更改服务开关及其他记录。 */
export function resetBossChallengeProgress(boss: Boss, kind: ResettableChallenge): Boss {
  const challenge = boss.challenges[kind];
  if (!challenge.enabled || !challenge.done) return boss;
  return {
    ...boss,
    challenges: { ...boss.challenges, [kind]: { ...challenge, done: false } },
  };
}

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
