import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBossRenewalState, renewBossForDate, resetBossVersionProgress, resetBossChallengeProgress, syncBossEventMeta, upcomingServiceEvents } from '../src/lib/boss-rules.ts';
import { cycleEndDate } from '../src/lib/dates.ts';

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

test('临期选择已续费按原周期天数续期，只清日常并保留原记录', () => {
  const before = { ...boss(), archived: false, cycleDays: 42, renewalState: 'pending' };
  const snapshot = structuredClone(before);
  const after = applyBossRenewalState(before, 'renewed', '2026-10-22');
  assert.equal(after.startDate, '2026-10-22');
  assert.equal(after.cycleDays, 42);
  assert.equal(after.renewalState, 'renewed');
  assert.equal(after.archived, false);
  assert.deepEqual(after.daily, []);
  assert.equal(after.cycleHistory.length, 1);
  assert.deepEqual(after.cycleHistory[0].daily, before.daily);
  assert.equal(after.cycleHistory[0].startDate, before.startDate);
  for (const key of ['weekly', 'bigEvent', 'smallEvents', 'challenges', 'optionals', 'extraTasks', 'excludedDays']) {
    assert.deepEqual(after[key], before[key]);
  }
  assert.deepEqual(before, snapshot);
});

test('选择不续订同时标记并归档，托管资料完整保留', () => {
  const before = { ...boss(), archived: false };
  const snapshot = structuredClone(before);
  assert.deepEqual(applyBossRenewalState(before, 'ending', '2026-10-22'), { ...before, archived: true, archivedDay: '2026-10-22', renewalState: 'ending' });
  assert.deepEqual(before, snapshot);
});

test('未处理和待续费仍然只更新状态，已提醒记录实际发出时间', () => {
  const before = { ...boss(), archived: false };
  for (const state of ['none', 'pending']) {
    assert.deepEqual(applyBossRenewalState(before, state, '2026-10-22'), { ...before, renewalState: state });
  }
  assert.deepEqual(applyBossRenewalState(before, 'reminded', '2026-10-22', '2026-10-22T04:00:00.000Z'), { ...before, renewalState: 'reminded', reminderSentAt: '2026-10-22T04:00:00.000Z' });
});

test('提前续费保留剩余天数和当前打卡，连续续费使用固定购买天数', () => {
  const before = { ...boss(), startDate: '2026-10-01' };
  const snapshot = structuredClone(before);
  const renewed = renewBossForDate(before, '2026-10-27');
  assert.equal(cycleEndDate(renewed), '2026-11-29');
  assert.equal(renewed.startDate, before.startDate);
  assert.deepEqual(renewed.daily, before.daily);
  assert.deepEqual(renewed.cycleHistory, before.cycleHistory);
  const again = renewBossForDate(renewed, '2026-11-26');
  assert.equal(again.renewalDays, 30);
  assert.equal(again.cycleDays, 90);
  assert.equal(cycleEndDate(again), '2026-12-29');
  const expired = renewBossForDate(again, '2026-12-31');
  assert.equal(expired.startDate, '2026-12-31');
  assert.equal(expired.cycleDays, 30);
  assert.deepEqual(expired.daily, []);
  assert.equal(expired.cycleHistory[0].cycleDays, 90);
  assert.deepEqual(before, snapshot);
});

test('到期日当天续费和暂停顺延后续费都不会损失剩余服务', () => {
  const before = { ...boss(), startDate: '2026-10-01', excludedDays: [{ date: '2026-10-10', reason: '暂停' }] };
  const renewed = renewBossForDate(before, '2026-10-31');
  assert.equal(cycleEndDate(renewed), '2026-11-30');
  assert.deepEqual(renewed.excludedDays, before.excludedDays);
});

test('归档账号拒绝续费和活动资料同步，活动图和完成记录保持原样', () => {
  const archived = { ...boss(), archived: true, archivedDay: '2026-10-22' };
  assert.equal(renewBossForDate(archived, '2026-10-23'), archived);
  assert.equal(applyBossRenewalState(archived, 'pending', '2026-10-23'), archived);
  assert.equal(syncBossEventMeta(archived, 'big', { name: '新名称', image: 'new.webp' }), archived);
  assert.equal(syncBossEventMeta(archived, 0, { name: '新小活动' }), archived);
  const current = boss();
  assert.equal(syncBossEventMeta(current, 'big', { name: '新大活动' }).bigEvent.name, '新大活动');
  assert.equal(syncBossEventMeta(current, 0, { name: '新小活动' }).smallEvents[0].name, '新小活动');
  assert.equal(syncBossEventMeta(current, 0, { name: '新小活动' }).smallEvents[0].done, true);
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
