import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTheme, resolveTheme } from '../src/lib/theme.ts';

test('手动主题优先于系统设置', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('跟随系统支持明暗两种状态，无效偏好恢复跟随系统', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  for (const value of [null, undefined, '', 'invalid', 'system']) {
    assert.equal(normalizeTheme(value), 'system');
  }
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('light'), 'light');
});
