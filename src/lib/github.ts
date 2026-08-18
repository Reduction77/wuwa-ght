/**
 * GitHub 仓库读写 —— 把仓库当作数据库。
 * 数据文件：仓库里的 public/data.json（与线上 data.json 同源）
 * 图片上传：仓库里的 public/uploads/ 目录
 */

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

const GH_KEY = 'zzbb-github-config';

export function loadGithubConfig(): GithubConfig | null {
  try {
    const raw = sessionStorage.getItem(GH_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c && c.token && c.owner && c.repo) return { branch: 'main', ...c };
    return null;
  } catch {
    return null;
  }
}

export function saveGithubConfig(c: GithubConfig | null) {
  if (c) sessionStorage.setItem(GH_KEY, JSON.stringify(c));
  else sessionStorage.removeItem(GH_KEY);
}

function apiBase(c: GithubConfig) {
  return `https://api.github.com/repos/${c.owner}/${c.repo}`;
}

async function ghFetch(c: GithubConfig, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('令牌无效或已过期，请重新检查 Token');
    if (res.status === 404) throw new Error('找不到仓库或文件，请检查用户名 / 仓库名 / 分支名');
    if (res.status === 403) throw new Error('令牌权限不足，请确认勾选了 Contents 读写权限');
    throw new Error(`GitHub 请求失败（${res.status}）：${text.slice(0, 120)}`);
  }
  return res;
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** 读取仓库中 public/data.json 的内容与 sha */
export async function readRemoteData(c: GithubConfig): Promise<{ content: string; sha: string }> {
  const res = await ghFetch(c, `${apiBase(c)}/contents/public/data.json?ref=${encodeURIComponent(c.branch)}`);
  const json = await res.json();
  return { content: base64ToUtf8(json.content), sha: json.sha };
}

/** 把最新数据写回仓库（触发 Pages 重新部署，约 1~2 分钟生效） */
export async function writeRemoteData(c: GithubConfig, content: string, message: string): Promise<void> {
  let sha: string | undefined;
  try {
    sha = (await readRemoteData(c)).sha;
  } catch {
    sha = undefined; // 文件不存在则新建
  }
  await ghFetch(c, `${apiBase(c)}/contents/public/data.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: utf8ToBase64(content),
      branch: c.branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

/** 上传图片到 public/uploads/，返回站内相对路径 */
export async function uploadRemoteImage(c: GithubConfig, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `public/uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  await ghFetch(c, `${apiBase(c)}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `chore: upload image ${path}`,
      content: btoa(bin),
      branch: c.branch,
    }),
  });
  return path.replace(/^public\//, './');
}

/** 测试连接：能否读到仓库 */
export async function testConnection(c: GithubConfig): Promise<string> {
  const res = await ghFetch(c, apiBase(c));
  const json = await res.json();
  return json.full_name as string;
}
