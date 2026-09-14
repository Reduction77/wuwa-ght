import test from 'node:test';
import assert from 'node:assert/strict';
import { renewBossForDate, resetBossVersionProgress, resetBossChallengeProgress, upcomingServiceEvents } from '../src/lib/boss-rules.ts';

function boss() {
  return {
    id: '1', startDate: '2026-07-01', cycleDays: 30, daily: ['2026-07-01'], weekly: ['2026-06-29'], renewalState: 'none', cycleHistory: [], excludedDays: [],
    bigEvent: { name: '大活动', image: '/api/uploads/big.webp', done: true, openDate: '2026-07-01', deadline: '2026-07-20' },
    smallEvents: [{ name: '小活动', image: '/api/uploads/small.webp', done: true }],
    challenges: { matrix: { enabled: true, done: true }, sea: { enabled: true, done: true }, tower: { enabled: true, done: true }, holo: { enabled: true, done: true } },
    optionals: { redeem: { enabled: true, done: true }, gacha: { enabled: true, done: true }, trial: { enabled: true, done: true } }, extraTasks: [],
  };
}

test('活动截止提醒按实际服务筛选大小活动，而不是按套餐或老板可见性', () => {
  const account = {
    ...boss(), tier: 4, show: { bigEvent: false },
    services: { daily: true, weekly: true, bigEvent: false, smallEvents: false },
    bigEvent: { name: '大活动', done: false, deadline: '2026-09-15' },
    smallEvents: [{ name: '小活动', done: false, deadline: '2026-09-16' }],
  };
  const names = () => upcomingServiceEvents(account, '2026-09-14', '2026-09-17').map(event => event.name);
  assert.deepEqual(names(), []);
  account.services.bigEvent = true;
  assert.deepEqual(names(), ['大活动']);
  account.services.bigEvent = false;
  account.services.smallEvents = true;
  assert.deepEqual(names(), ['小活动']);
  account.services.bigEvent = true;
  assert.deepEqual(names(), ['大活动', '小活动']);
  account.services.bigEvent = false;
  account.services.smallEvents = false;
  assert.deepEqual(names(), []);
});

test('活动截止提醒保留原日期窗口，排除已完成、过期和没有截止日期的活动', () => {
  const account = {
    ...boss(), services: { bigEvent: true, smallEvents: true },
    bigEvent: { name: '今天截止', done: false, deadline: '2026-09-14' },
    smallEvents: [
      { name: '三天后截止', done: false, deadline: '2026-09-17' },
      { name: '已完成', done: true, deadline: '2026-09-15' },
      { name: '已过期', done: false, deadline: '2026-09-13' },
      { name: '稍后截止', done: false, deadline: '2026-09-18' },
      { name: '未设日期', done: false },
    ],
  };
  const before = structuredClone(account);
  assert.deepEqual(upcomingServiceEvents(account, '2026-09-14', '2026-09-17').map(event => event.name), ['今天截止', '三天后截止']);
  assert.deepEqual(account, before);
});

test('同版本续期只清日常并归档旧周期', () => {
  const before = boss();
  const after = renewBossForDate(before, '2026-08-19', 'cycle-test');
  assert.deepEqual(after.daily, []);
  assert.deepEqual(after.weekly, before.weekly);
  assert.equal(after.bigEvent.done, true);
  assert.equal(after.challenges.matrix.done, true);
  assert.equal(after.cycleHistory[0].daily.length, 1);
});

for (const [kind, label] of [['tower', '深塔'], ['sea', '海墟']]) {
  test(`${label}独立重置仅修改目标完成状态，保留其他记录`, () => {
    const before = boss();
    before.cycleHistory = [{ challenges: structuredClone(before.challenges) }];
    const snapshot = structuredClone(before);
    const after = resetBossChallengeProgress(before, kind);
    assert.deepEqual(after, {
      ...before,
      challenges: { ...before.challenges, [kind]: { enabled: true, done: false } },
    });
    assert.deepEqual(before, snapshot);
    assert.equal(resetBossChallengeProgress(after, kind), after);
    const disabled = boss();
    disabled.challenges[kind].enabled = false;
    assert.equal(resetBossChallengeProgress(disabled, kind), disabled);
  });
}

test('版本更新保留日常周常海墟深塔并清空活动资料及重置矩阵', () => {
  const before = boss();
  const after = resetBossVersionProgress(before);
  assert.deepEqual(after.daily, before.daily);
  assert.deepEqual(after.weekly, before.weekly);
  assert.equal(after.challenges.matrix.done, false);
  assert.equal(after.challenges.sea.done, true);
  assert.equal(after.challenges.tower.done, true);
  assert.deepEqual(after.challenges.sea, before.challenges.sea);
  assert.deepEqual(after.challenges.tower, before.challenges.tower);
  assert.equal(after.challenges.holo.done, false);
  assert.equal(after.bigEvent.done, false);
  assert.equal(after.bigEvent.name, '');
  assert.equal(after.bigEvent.image, '');
  assert.equal(after.smallEvents[0].name, '');
  assert.equal(after.smallEvents[0].image, '');
  assert.equal(after.optionals.redeem.done, false);
  assert.equal(after.optionals.trial.done, false);
});
