/** 鸣潮托管站服务器：公共信息、老板会话、后台数据三层隔离。 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 130);
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin888';
const DIST = path.join(ROOT_DIR, 'dist');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SESSION_TTL = 12 * 60 * 60 * 1000;
const MAX_BODY = 12 * 1024 * 1024;
const MAX_BACKUPS = 30;

if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_PASSWORD || ADMIN_PASSWORD === 'admin888')) {
  throw new Error('生产环境必须设置非默认的 ADMIN_PASSWORD');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const sessions = new Map();
const loginAttempts = new Map();

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  const builtSeed = path.join(DIST, 'data.json');
  fs.copyFileSync(fs.existsSync(builtSeed) ? builtSeed : path.join(ROOT_DIR, 'public', 'data.json'), DATA_FILE);
}

function send(res, code, body = '', headers = {}) {
  res.writeHead(code, { 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}

function sendJson(res, code, value, headers = {}) {
  send(res, code, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('请求体过大'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  try {
    return JSON.parse((await readBody(req)).toString('utf8'));
  } catch (error) {
    if (error?.status) throw error;
    throw Object.assign(new Error('JSON 格式不正确'), { status: 400 });
  }
}

function loadData() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  data.revision = Number.isInteger(data.revision) ? data.revision : 0;
  data.bosses = Array.isArray(data.bosses) ? data.bosses : [];
  return data;
}

function backupCurrent() {
  if (!fs.existsSync(DATA_FILE)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `data-${stamp}.json`));
  fs.readdirSync(BACKUP_DIR).filter((name) => /^data-.*\.json$/.test(name)).sort().reverse()
    .slice(MAX_BACKUPS).forEach((name) => fs.unlinkSync(path.join(BACKUP_DIR, name)));
}

function atomicWriteData(data, backup = true) {
  if (backup) backupCurrent();
  const temp = path.join(DATA_DIR, `.data-${process.pid}-${Date.now()}.tmp`);
  fs.writeFileSync(temp, JSON.stringify(data, null, 1), { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temp, DATA_FILE);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function adminAuthed(req) {
  return safeEqual(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), ADMIN_PASSWORD);
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function currentBoss(req, data) {
  const token = cookies(req).wuwa_boss_session;
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL;
  return data.bosses.find((boss) => boss.id === session.bossId) || null;
}

function bossView(boss) {
  const { passcode: _passcode, internalNote: _internalNote, ...safe } = boss;
  return safe;
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function loginAllowed(ip) {
  const recent = (loginAttempts.get(ip) || []).filter((time) => Date.now() - time < 10 * 60 * 1000);
  loginAttempts.set(ip, recent);
  return recent.length < 10;
}

function validateData(data) {
  if (!data || !Array.isArray(data.bosses)) return '数据格式不正确';
  const ids = new Set();
  const passcodes = new Set();
  for (const boss of data.bosses) {
    if (!boss || typeof boss.id !== 'string' || !boss.id) return '存在缺少 ID 的老板';
    if (ids.has(boss.id)) return `老板 ID 重复：${boss.id}`;
    ids.add(boss.id);
    const passcode = String(boss.passcode || '').trim();
    if (passcode.length < 4 || passcode.length > 16) return `${boss.name || boss.id} 的口令必须为 4-16 位`;
    if (passcodes.has(passcode)) return `查看口令重复：${passcode}`;
    passcodes.add(passcode);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(boss.startDate || ''))) return `${boss.name || boss.id} 的开始日期无效`;
    if (!Number.isInteger(boss.cycleDays) || boss.cycleDays < 1 || boss.cycleDays > 365) return `${boss.name || boss.id} 的周期天数无效`;
  }
  return '';
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/api/mode' && req.method === 'GET') return sendJson(res, 200, { server: true });
    if (pathname === '/api/health' && req.method === 'GET') {
      const stat = fs.statSync(DATA_FILE);
      return sendJson(res, 200, { ok: true, updatedAt: stat.mtime.toISOString(), backups: fs.readdirSync(BACKUP_DIR).length });
    }
    if (pathname === '/api/public' && req.method === 'GET') {
      const data = loadData();
      return sendJson(res, 200, { version: data.version, revision: data.revision, updatedAt: data.updatedAt, accepting: data.accepting, bosses: [] });
    }
    if (pathname === '/api/check' && req.method === 'GET') return sendJson(res, adminAuthed(req) ? 200 : 401, { ok: adminAuthed(req) });
    if (pathname === '/api/data' && req.method === 'GET') {
      if (!adminAuthed(req)) return sendJson(res, 401, { ok: false, error: '需要后台身份' });
      return sendJson(res, 200, loadData());
    }
    if (pathname === '/api/data' && req.method === 'PUT') {
      if (!adminAuthed(req)) return sendJson(res, 401, { ok: false, error: '管理密码不对' });
      const incoming = await readJsonBody(req);
      const error = validateData(incoming);
      if (error) return sendJson(res, 400, { ok: false, error });
      const current = loadData();
      if (Number(incoming.revision || 0) !== current.revision) {
        return sendJson(res, 409, { ok: false, error: '服务器数据已被其他页面更新，请重新读取后再操作' });
      }
      incoming.revision = current.revision + 1;
      incoming.updatedAt = new Date().toISOString();
      atomicWriteData(incoming);
      return sendJson(res, 200, incoming);
    }
    if (pathname === '/api/boss/login' && req.method === 'POST') {
      const ip = clientIp(req);
      if (!loginAllowed(ip)) return sendJson(res, 429, { ok: false, error: '尝试次数过多，请10分钟后再试' });
      const { passcode = '' } = await readJsonBody(req);
      const data = loadData();
      const boss = data.bosses.find((item) => safeEqual(item.passcode || '', String(passcode).trim()));
      if (!boss) {
        loginAttempts.set(ip, [...(loginAttempts.get(ip) || []), Date.now()]);
        return sendJson(res, 401, { ok: false, error: '口令不正确' });
      }
      loginAttempts.delete(ip);
      const token = crypto.randomBytes(32).toString('base64url');
      sessions.set(token, { bossId: boss.id, expiresAt: Date.now() + SESSION_TTL });
      const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
      return sendJson(res, 200, { ok: true, boss: bossView(boss), updatedAt: data.updatedAt }, {
        'Set-Cookie': `wuwa_boss_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL / 1000}${secure}`,
      });
    }
    if (pathname === '/api/boss/me' && req.method === 'GET') {
      const data = loadData();
      const boss = currentBoss(req, data);
      return boss ? sendJson(res, 200, { ok: true, boss: bossView(boss), updatedAt: data.updatedAt }) : sendJson(res, 401, { ok: false, error: '登录已过期' });
    }
    if (pathname === '/api/boss/session' && req.method === 'DELETE') {
      const token = cookies(req).wuwa_boss_session;
      if (token) sessions.delete(token);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'wuwa_boss_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' });
    }
    if (pathname === '/api/passcode' && req.method === 'POST') {
      const { newPasscode = '' } = await readJsonBody(req);
      const newCode = String(newPasscode).trim();
      if (newCode.length < 4 || newCode.length > 16) return sendJson(res, 400, { ok: false, error: '新口令要 4-16 位' });
      const data = loadData();
      const boss = currentBoss(req, data);
      if (!boss) return sendJson(res, 401, { ok: false, error: '登录已过期，请重新登录' });
      if (data.bosses.some((item) => item.id !== boss.id && safeEqual(item.passcode || '', newCode))) return sendJson(res, 409, { ok: false, error: '这个口令已被使用，请换一个' });
      boss.passcode = newCode;
      data.revision += 1;
      data.updatedAt = new Date().toISOString();
      atomicWriteData(data);
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === '/api/upload' && req.method === 'POST') {
      if (!adminAuthed(req)) return sendJson(res, 401, { ok: false, error: '管理密码不对' });
      const body = await readJsonBody(req);
      const match = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(body.data || '');
      if (!match) return sendJson(res, 400, { ok: false, error: '只支持 png/jpg/webp/gif 图片' });
      const binary = Buffer.from(match[2], 'base64');
      if (binary.length > 8 * 1024 * 1024) return sendJson(res, 413, { ok: false, error: '图片不能超过 8MB' });
      const ext = match[1] === 'jpeg' ? '.jpg' : `.${match[1]}`;
      const name = `img-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, name), binary, { flag: 'wx' });
      return sendJson(res, 200, { ok: true, url: `/api/uploads/${name}` });
    }
    if (pathname === '/api/cleanup-uploads' && req.method === 'POST') {
      if (!adminAuthed(req)) return sendJson(res, 401, { ok: false, error: '管理密码不对' });
      const serialized = JSON.stringify(loadData());
      const used = new Set([...serialized.matchAll(/\/api\/uploads\/([^"\\]+)/g)].map((match) => path.basename(match[1])));
      let removed = 0;
      for (const name of fs.readdirSync(UPLOAD_DIR)) {
        if (!used.has(name) && IMG_EXT.has(path.extname(name).toLowerCase())) {
          fs.unlinkSync(path.join(UPLOAD_DIR, name));
          removed += 1;
        }
      }
      return sendJson(res, 200, { ok: true, removed });
    }
    if (pathname.startsWith('/api/uploads/') && req.method === 'GET') {
      const name = path.basename(pathname);
      const ext = path.extname(name).toLowerCase();
      const file = path.join(UPLOAD_DIR, name);
      if (!IMG_EXT.has(ext) || !fs.existsSync(file)) return sendJson(res, 404, { ok: false });
      return send(res, 200, fs.readFileSync(file), { 'Content-Type': MIME[ext], 'Cache-Control': 'public, max-age=31536000, immutable' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { ok: false });
    let relative = pathname === '/' ? '/index.html' : pathname;
    let file = path.normalize(path.join(DIST, relative));
    if (!file.startsWith(DIST + path.sep) && file !== DIST) return sendJson(res, 403, { ok: false });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      relative = '/index.html';
      file = path.join(DIST, 'index.html');
    }
    const ext = path.extname(file).toLowerCase();
    const buffer = fs.readFileSync(file);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': relative.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' };
    if (['.html', '.js', '.css', '.json', '.svg', '.txt'].includes(ext) && String(req.headers['accept-encoding'] || '').includes('gzip') && buffer.length > 1024) {
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
      return send(res, 200, zlib.gzipSync(buffer, { level: 6 }), headers);
    }
    return send(res, 200, req.method === 'HEAD' ? '' : buffer, headers);
  } catch (error) {
    console.error('[error]', error);
    if (!res.headersSent) sendJson(res, error?.status || 500, { ok: false, error: error?.status ? error.message : '服务器开小差了' });
  }
});

setInterval(() => {
  for (const [token, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(token);
}, 30 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`[ready] 鸣潮托管站：http://0.0.0.0:${PORT}`);
  console.log(`[ready] 数据目录：${DATA_DIR}`);
});
