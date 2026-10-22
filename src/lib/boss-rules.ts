import type { Boss, CycleSnapshot, EventItem, RenewalState } from '@/types';
import { cycleEndDate } from './dates.ts';

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
  if (boss.archived) return boss;
  const renewalDays = boss.renewalDays ?? boss.cycleDays;
  if (cycleEndDate(boss) >= today) {
    return { ...boss, cycleDays: boss.cycleDays + renewalDays, renewalDays, renewalState: 'renewed' };
  }
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
    cycleDays: renewalDays,
    renewalDays,
    daily: [],
    excludedDays: [],
    renewalState: 'renewed',
    cycleHistory: [...boss.cycleHistory, snapshot],
  };
}

/** 临期下拉中的已续费执行同版本续期，不续订则保留记录并归档。 */
export function applyBossRenewalState(boss: Boss, state: RenewalState, today: string, at = new Date().toISOString()): Boss {
  if (boss.archived) return boss;
  if (state === 'renewed') return renewBossForDate(boss, today);
  if (state === 'ending') return { ...boss, renewalState: state, archived: true, archivedDay: today };
  if (state === 'reminded') return { ...boss, renewalState: state, reminderSentAt: at };
  return { ...boss, renewalState: state };
}

/** 归档账号本身就是留存资料，活动元数据同步不改动它。 */
export function syncBossEventMeta(boss: Boss, kind: 'big' | number, patch: Partial<Pick<EventItem, 'name' | 'image' | 'openDate' | 'deadline'>>): Boss {
  if (boss.archived) return boss;
  if (kind === 'big') return { ...boss, bigEvent: { ...boss.bigEvent, ...patch } };
  if (!boss.smallEvents[kind]) return boss;
  return { ...boss, smallEvents: boss.smallEvents.map((event, index) => index === kind ? { ...event, ...patch } : event) };
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
