import test from 'node:test';
import assert from 'node:assert/strict';
import { renewBossForDate, resetBossVersionProgress } from '../src/lib/boss-rules.ts';

function boss() {
  return {
    id: '1', startDate: '2026-07-01', cycleDays: 30, daily: ['2026-07-01'], weekly: ['2026-06-29'], renewalState: 'none', cycleHistory: [], excludedDays: [],
    bigEvent: { name: '大活动', image: '', done: true, openDate: '2026-07-01', deadline: '2026-07-20' },
    smallEvents: [{ name: '小活动', image: '', done: true }],
    challenges: { matrix: { enabled: true, done: true }, sea: { enabled: true, done: true }, tower: { enabled: true, done: true }, holo: { enabled: true, done: true } },
    optionals: { redeem: { enabled: true, done: true }, gacha: { enabled: true, done: true } }, extraTasks: [],
  };
}

test('同版本续期只清日常并归档旧周期', () => {
  const before = boss();
  const after = renewBossForDate(before, '2026-08-19', 'cycle-test');
  assert.deepEqual(after.daily, []);
  assert.deepEqual(after.weekly, before.weekly);
  assert.equal(after.bigEvent.done, true);
  assert.equal(after.challenges.matrix.done, true);
  assert.equal(after.cycleHistory[0].daily.length, 1);
});

test('版本更新保留日常周常海墟深塔矩阵并重置其余版本任务', () => {
  const before = boss();
  const after = resetBossVersionProgress(before);
  assert.deepEqual(after.daily, before.daily);
  assert.deepEqual(after.weekly, before.weekly);
  assert.equal(after.challenges.matrix.done, true);
  assert.equal(after.challenges.sea.done, true);
  assert.equal(after.challenges.tower.done, true);
  assert.equal(after.challenges.holo.done, false);
  assert.equal(after.bigEvent.done, false);
  assert.equal(after.optionals.redeem.done, false);
});
