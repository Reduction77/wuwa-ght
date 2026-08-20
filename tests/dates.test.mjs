import test from 'node:test';
import assert from 'node:assert/strict';
import { bossStats, cycleDates, cycleEndDate, todayStr, weekRange } from '../src/lib/dates.ts';

test('游戏日按北京时间凌晨4点切换', () => {
  assert.equal(todayStr(new Date('2026-08-19T19:59:59Z')), '2026-08-19');
  assert.equal(todayStr(new Date('2026-08-19T20:00:00Z')), '2026-08-20');
});

test('周常使用真实日历周的周一作为键', () => {
  const boss = { startDate: '2026-08-19', cycleDays: 30 };
  assert.deepEqual(weekRange(boss, 0), { from: '2026-08-17', to: '2026-08-23' });
  assert.deepEqual(weekRange(boss, 1), { from: '2026-08-24', to: '2026-08-30' });
});

test('暂停日不计入服务天数并自动顺延结束日期', () => {
  const boss = { startDate: '2026-08-19', cycleDays: 3, excludedDays: [{ date: '2026-08-20', reason: '维护' }] };
  assert.deepEqual(cycleDates(boss), ['2026-08-19', '2026-08-21', '2026-08-22']);
  assert.equal(cycleEndDate(boss), '2026-08-22');
});

test('只有日常的套餐完成后总体进度可以达到100%', () => {
  const daily = Array.from({ length: 3 }, (_, index) => `2026-08-${String(19 + index).padStart(2, '0')}`);
  const boss = {
    startDate: '2026-08-19', cycleDays: 3, daily, weekly: [],
    services: { daily: true, weekly: false, bigEvent: false, smallEvents: false },
    show: { daily: true, weekly: false, bigEvent: false },
    bigEvent: { name: '', image: '', done: false }, smallEvents: [],
    challenges: { matrix: { enabled: false, done: false }, sea: { enabled: false, done: false }, tower: { enabled: false, done: false }, holo: { enabled: false, done: false } },
    optionals: { redeem: { enabled: false, done: false }, gacha: { enabled: false, done: false }, trial: { enabled: false, done: false } },
    extraTasks: [],
  };
  assert.equal(bossStats(boss).overall, 100);
});
