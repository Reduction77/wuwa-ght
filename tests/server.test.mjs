import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

test('服务器隔离老板数据并检测保存冲突', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'wuwa-ght-test-'));
  const port = 13991;
  const initial = {
    version: 1, revision: 0, updatedAt: new Date().toISOString(), accepting: { on: true, text: '测试' },
    bosses: [{
      id: 'boss-1', name: '测试老板', account: '***', passcode: '1234', startDate: '2026-08-19', cycleDays: 30, daily: [], weekly: [],
      bigEvent: { name: '旧活动', image: '/api/uploads/used.webp', done: false },
    }],
  };
  writeFileSync(join(dir, 'data.json'), JSON.stringify(initial));
  const uploadDir = join(dir, 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  writeFileSync(join(uploadDir, 'used.webp'), 'used');
  writeFileSync(join(uploadDir, 'orphan.webp'), 'orphan');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, ADMIN_PASSWORD: 'test-admin-password', NODE_ENV: 'test' },
    stdio: 'ignore',
  });
  t.after(() => {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${port}`;
  for (let index = 0; index < 30; index += 1) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch { /* 等待启动 */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert.equal((await fetch(`${base}/api/data`)).status, 401);
  const login = await fetch(`${base}/api/boss/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode: '1234' }) });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.equal(loginBody.boss.name, '测试老板');
  assert.equal('passcode' in loginBody.boss, false);

  const headers = { Authorization: 'Bearer test-admin-password', 'Content-Type': 'application/json' };
  const current = await (await fetch(`${base}/api/data`, { headers })).json();
  const firstCleanup = await (await fetch(`${base}/api/cleanup-uploads`, { method: 'POST', headers })).json();
  assert.equal(firstCleanup.removed, 1);
  assert.equal(existsSync(join(uploadDir, 'used.webp')), true);
  assert.equal(existsSync(join(uploadDir, 'orphan.webp')), false);

  current.bosses[0].bigEvent = { name: '', image: '', done: false };
  const saved = await fetch(`${base}/api/data`, { method: 'PUT', headers, body: JSON.stringify(current) });
  assert.equal(saved.status, 200);
  const secondCleanup = await (await fetch(`${base}/api/cleanup-uploads`, { method: 'POST', headers })).json();
  assert.equal(secondCleanup.removed, 1);
  assert.equal(existsSync(join(uploadDir, 'used.webp')), false);

  const conflict = await fetch(`${base}/api/data`, { method: 'PUT', headers, body: JSON.stringify(current) });
  assert.equal(conflict.status, 409);
});
