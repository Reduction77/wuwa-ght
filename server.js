/**
 * 鸣潮托管站 · 服务器版一体服务（零依赖，Node 20+ 直接跑）
 * - 静态托管 dist/ 前端页面（gzip + 缓存策略）
 * - GET  /api/data           读取托管数据（公开，老板端要查）
 * - PUT  /api/data           保存托管数据（需管理密码）
 * - GET  /api/check          校验管理密码
 * - POST /api/upload         上传活动图片（需管理密码，存服务器本地）
 * - POST /api/passcode       老板自助改口令（凭旧口令验证，只改自己的，不需要管理密码）
 * - GET  /api/uploads/*      读取已上传图片
 *
 * 环境变量：
 *   PORT           监听端口（默认 130）
 *   DATA_DIR       数据目录（默认 ./data；Docker 里挂 /data 卷即可持久化）
 *   ADMIN_PASSWORD 后台管理密码（默认 admin888，务必修改！）
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 130);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin888';
const DIST = path.join(__dirname, 'dist');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_BODY = 12 * 1024 * 1024; // 12MB，够放压缩后的图片

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// 首次启动：用打包进镜像的初始数据做种子
if (!fs.existsSync(DATA_FILE)) {
  const seed = path.join(DIST, 'data.json');
  fs.copyFileSync(fs.existsSync(seed) ? seed : path.join(__dirname, 'public', 'data.json'), DATA_FILE);
  console.log('[init] 已用初始数据创建', DATA_FILE);
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}

function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function authed(req) {
  const h = req.headers.authorization || '';
  return h === `Bearer ${ADMIN_PASSWORD}`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const pathname = decodeURIComponent(url.pathname);

    /* ---------- API ---------- */
    if (pathname === '/api/data' && req.method === 'GET') {
      send(res, 200, fs.readFileSync(DATA_FILE), { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
      return;
    }
    if (pathname === '/api/check' && req.method === 'GET') {
      sendJson(res, authed(req) ? 200 : 401, { ok: authed(req) });
      return;
    }
    if (pathname === '/api/data' && req.method === 'PUT') {
      if (!authed(req)) return sendJson(res, 401, { ok: false, error: '管理密码不对' });
      const body = await readBody(req);
      const parsed = JSON.parse(body.toString('utf8'));
      if (!parsed || !Array.isArray(parsed.bosses)) return sendJson(res, 400, { ok: false, error: '数据格式不正确' });
      fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 1));
      sendJson(res, 200, { ok: true });
      return;
    }
    if (pathname === '/api/passcode' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8'));
      const id = String(body.id || '');
      const oldCode = String(body.oldPasscode || '').trim();
      const newCode = String(body.newPasscode || '').trim();
      if (!id || !oldCode || !newCode) return sendJson(res, 400, { ok: false, error: '参数不完整' });
      if (newCode.length < 4 || newCode.length > 16) return sendJson(res, 400, { ok: false, error: '新口令要 4-16 位' });
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      const boss = (data.bosses || []).find((b) => b.id === id);
      if (!boss) return sendJson(res, 404, { ok: false, error: '找不到这位老板' });
      if (boss.passcode !== oldCode) return sendJson(res, 403, { ok: false, error: '旧口令不对' });
      boss.passcode = newCode;
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 1));
      sendJson(res, 200, { ok: true });
      return;
    }
    if (pathname === '/api/upload' && req.method === 'POST') {
      if (!authed(req)) return sendJson(res, 401, { ok: false, error: '管理密码不对' });
      const body = JSON.parse((await readBody(req)).toString('utf8'));
      const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(body.data || '');
      if (!m) return sendJson(res, 400, { ok: false, error: '只支持 png/jpg/webp/gif 图片' });
      const ext = m[1] === 'jpeg' ? '.jpg' : `.${m[1]}`;
      const name = `img-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[2], 'base64'));
      sendJson(res, 200, { ok: true, url: `/api/uploads/${name}` });
      return;
    }
    if (pathname.startsWith('/api/uploads/') && req.method === 'GET') {
      const name = path.basename(pathname);
      const ext = path.extname(name).toLowerCase();
      const fp = path.join(UPLOAD_DIR, name);
      if (!IMG_EXT.has(ext) || !fs.existsSync(fp)) return sendJson(res, 404, { ok: false });
      const headers = { 'Content-Type': MIME[ext], 'Cache-Control': 'public, max-age=31536000, immutable' };
      send(res, 200, fs.readFileSync(fp), headers);
      return;
    }

    /* ---------- 静态页面 ---------- */
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { ok: false });
    let rel = pathname === '/' ? '/index.html' : pathname;
    let fp = path.normalize(path.join(DIST, rel));
    if (!fp.startsWith(DIST)) return sendJson(res, 403, { ok: false });
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      rel = '/index.html'; // SPA 兜底
      fp = path.join(DIST, 'index.html');
    }
    const ext = path.extname(fp).toLowerCase();
    const immutable = rel.startsWith('/assets/') || rel.startsWith('/uploads/');
    const acceptsGzip = String(req.headers['accept-encoding'] || '').includes('gzip');
    const buf = fs.readFileSync(fp);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    const compressible = ['.html', '.js', '.css', '.json', '.svg', '.txt'].includes(ext);
    if (compressible && acceptsGzip && buf.length > 1024) {
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
      send(res, 200, zlib.gzipSync(buf, { level: 6 }), headers);
    } else {
      send(res, 200, buf, headers);
    }
  } catch (e) {
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: '服务器开小差了' });
    console.error('[error]', e);
  }
});

server.listen(PORT, () => {
  console.log(`[ready] 鸣潮托管站服务器版已启动：http://0.0.0.0:${PORT}`);
  console.log(`[ready] 数据目录：${DATA_DIR}（挂载卷即可持久化）`);
});
