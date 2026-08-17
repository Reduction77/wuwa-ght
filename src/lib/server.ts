/**
 * 服务器版数据层 —— 数据存在服务器自己的磁盘上（Docker 卷 /data），不依赖 GitHub。
 * 前端启动时探测 /api/data：通了就是服务器版；不通（GitHub Pages / 纯静态）就走 GitHub 或本地流程。
 */

const KEY_STORAGE = 'zzbb-admin-key';

/** 探测当前站点是不是服务器版（有 /api/data 即视为服务器版） */
export async function detectServer(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch('/api/data?t=' + Date.now(), { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    const type = res.headers.get('content-type') || '';
    return res.ok && type.includes('application/json');
  } catch {
    return false;
  }
}

export async function readServerData(): Promise<string> {
  const res = await fetch('/api/data?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('读取服务器数据失败');
  return res.text();
}

export async function checkAdminKey(key: string): Promise<boolean> {
  try {
    const res = await fetch('/api/check', { headers: { Authorization: `Bearer ${key}` } });
    return res.ok;
  } catch {
    return false;
  }
}

export async function writeServerData(key: string, json: string): Promise<void> {
  const res = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: json,
  });
  if (res.status === 401) throw new Error('管理密码不对，请重新进入后台');
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || '保存到服务器失败');
  }
}

/** 上传活动图片到服务器，返回可访问的 URL */
export async function uploadServerImage(key: string, file: File): Promise<string> {
  const dataUrl = await downscaleToDataUrl(file, 1280);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ name: file.name, data: dataUrl }),
  });
  if (res.status === 401) throw new Error('管理密码不对，请重新进入后台');
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.url) throw new Error(json?.error || '图片上传失败');
  return json.url as string;
}

export function loadAdminKey(): string | null {
  return sessionStorage.getItem(KEY_STORAGE);
}

export function saveAdminKey(key: string | null) {
  if (key) sessionStorage.setItem(KEY_STORAGE, key);
  else sessionStorage.removeItem(KEY_STORAGE);
}

/** 上传前压一压：宽超过 maxW 就缩到 maxW，转 jpeg/webp 存，省空间也快 */
function downscaleToDataUrl(file: File, maxW: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    img.src = url;
  });
}
