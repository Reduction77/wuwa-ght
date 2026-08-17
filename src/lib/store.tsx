import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Boss, SiteData } from '@/types';
import initialJson from '@/data/initial.json';
import {
  type GithubConfig,
  loadGithubConfig,
  readRemoteData,
  saveGithubConfig,
  writeRemoteData,
} from '@/lib/github';
import {
  detectServer,
  loadAdminKey,
  readServerData,
  saveAdminKey,
  writeServerData,
} from '@/lib/server';

const LOCAL_KEY = 'zzbb-local-data';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Store {
  data: SiteData;
  loading: boolean;
  dirty: boolean;
  saveState: SaveState;
  saveError: string;
  github: GithubConfig | null;
  /** 是否服务器版（数据存在服务器上，不需要 GitHub） */
  serverMode: boolean;
  /** 服务器版后台管理密码 */
  adminKey: string | null;
  /** 当前数据来源提示 */
  source: 'remote' | 'local' | 'bundled';
  setGithub: (c: GithubConfig | null) => void;
  setAdminKey: (key: string | null) => void;
  updateBoss: (id: string, patch: Partial<Boss>) => void;
  mutateBoss: (id: string, fn: (b: Boss) => Boss) => void;
  addBoss: (b: Boss) => void;
  removeBoss: (id: string) => void;
  save: () => Promise<void>;
  reload: () => Promise<void>;
  /** 续期：从今天开始新周期，清空本周期所有完成记录（保留套餐、名称、图片设置） */
  renewBoss: (id: string) => void;
  /** 一键切换接单状态（首页顶部徽章） */
  setAccepting: (on: boolean) => void;
  /** 整包替换数据（从本地备份恢复时用） */
  importData: (data: SiteData) => void;
  /** 同步活动名称/图片到所有老板（同一版本活动全服一样；完成状态仍各自独立） */
  syncEventMeta: (kind: 'big' | number, patch: { name?: string; image?: string }) => void;
}

const Ctx = createContext<Store | null>(null);

function normalize(data: SiteData): SiteData {
  type PB = Partial<Boss> & { bigEvent?: Partial<Boss['bigEvent']>; challenges?: Partial<Boss['challenges']> };
  return {
    version: data.version ?? 1,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
    accepting: {
      on: data.accepting?.on ?? true,
      text: data.accepting?.text ?? '鸣潮 · 托管进行中',
    },
    bosses: ((data.bosses ?? []) as PB[]).map((b) => ({
      id: b.id ?? `boss-${Math.random().toString(36).slice(2, 9)}`,
      name: b.name ?? '',
      account: b.account ?? '',
      passcode: b.passcode ?? '0000',
      tier: b.tier ?? 4,
      cycleDays: b.cycleDays ?? 30,
      startDate: b.startDate ?? new Date().toISOString().slice(0, 10),
      note: b.note ?? '',
      daily: b.daily ?? [],
      weekly: b.weekly ?? [],
      bigEvent: { name: '版本大活动', image: '', done: false, ...(b.bigEvent ?? {}) },
      smallEvents: ((b.smallEvents ?? []) as Array<Partial<Boss['smallEvents'][number]>>).map((e) => ({ name: '', image: '', done: false, ...e })),
      challenges: { matrix: false, sea: false, tower: false, ...(b.challenges ?? {}) },
      optionals: {
        redeem: { enabled: false, done: false, ...(b.optionals?.redeem ?? {}) },
        gacha: { enabled: false, done: false, ...(b.optionals?.gacha ?? {}) },
      },
    })),
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SiteData>(normalize(initialJson as SiteData));
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [github, setGithubState] = useState<GithubConfig | null>(() => loadGithubConfig());
  const [serverMode, setServerMode] = useState(false);
  const [adminKey, setAdminKeyState] = useState<string | null>(() => loadAdminKey());
  const [source, setSource] = useState<'remote' | 'local' | 'bundled'>('bundled');
  const dataRef = useRef(data);
  dataRef.current = data;

  const reload = useCallback(async () => {
    setLoading(true);
    // 服务器版：数据直接在服务器上
    if (await detectServer()) {
      try {
        const content = await readServerData();
        setData(normalize(JSON.parse(content)));
        setServerMode(true);
        setSource('remote');
        setDirty(false);
        setLoading(false);
        return;
      } catch {
        // 读取失败则退回本地
      }
    }
    setServerMode(false);
    const gh = loadGithubConfig();
    if (gh) {
      try {
        const { content } = await readRemoteData(gh);
        setData(normalize(JSON.parse(content)));
        setSource('remote');
        setDirty(false);
        setLoading(false);
        return;
      } catch {
        // 远端读取失败则退回本地
      }
    }
    try {
      const res = await fetch('./data.json?t=' + Date.now());
      if (res.ok) {
        const json = await res.json();
        // 本地未保存的修改优先
        const local = localStorage.getItem(LOCAL_KEY);
        if (local && dirty) {
          setData(normalize(JSON.parse(local)));
          setSource('local');
        } else {
          setData(normalize(json));
          setSource('bundled');
        }
      }
    } catch {
      /* 保持内置数据 */
    }
    setLoading(false);
  }, [dirty]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touch = useCallback((next: SiteData) => {
    next.updatedAt = new Date().toISOString();
    setData({ ...next });
    setDirty(true);
    setSaveState('idle');
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch {
      /* 超出本地配额时忽略 */
    }
  }, []);

  const mutateBoss = useCallback(
    (id: string, fn: (b: Boss) => Boss) => {
      const cur = dataRef.current;
      const bosses = cur.bosses.map((b) => (b.id === id ? fn({ ...b }) : b));
      touch({ ...cur, bosses });
    },
    [touch]
  );

  const updateBoss = useCallback(
    (id: string, patch: Partial<Boss>) => {
      mutateBoss(id, (b) => ({ ...b, ...patch }));
    },
    [mutateBoss]
  );

  const addBoss = useCallback(
    (b: Boss) => {
      const cur = dataRef.current;
      touch({ ...cur, bosses: [...cur.bosses, b] });
    },
    [touch]
  );

  const removeBoss = useCallback(
    (id: string) => {
      const cur = dataRef.current;
      touch({ ...cur, bosses: cur.bosses.filter((b) => b.id !== id) });
    },
    [touch]
  );

  const renewBoss = useCallback(
    (id: string) => {
      const today = new Date().toISOString().slice(0, 10);
      mutateBoss(id, (b) => ({
        ...b,
        startDate: today,
        daily: [],
        weekly: [],
        bigEvent: { ...b.bigEvent, done: false },
        smallEvents: b.smallEvents.map((e) => ({ ...e, done: false })),
        challenges: { matrix: false, sea: false, tower: false },
        optionals: {
          redeem: { ...b.optionals.redeem, done: false },
          gacha: { ...b.optionals.gacha, done: false },
        },
      }));
    },
    [mutateBoss]
  );

  const setGithub = useCallback((c: GithubConfig | null) => {
    saveGithubConfig(c);
    setGithubState(c);
  }, []);

  const setAdminKey = useCallback((key: string | null) => {
    saveAdminKey(key);
    setAdminKeyState(key);
  }, []);

  const setAccepting = useCallback(
    (on: boolean) => {
      const cur = dataRef.current;
      const acc = cur.accepting ?? { on: true, text: '鸣潮 · 托管进行中' };
      touch({ ...cur, accepting: { ...acc, on, text: on ? '鸣潮 · 托管进行中' : '鸣潮 · 暂时停止接单' } });
    },
    [touch]
  );

  const importData = useCallback(
    (incoming: SiteData) => {
      touch(normalize(incoming));
    },
    [touch]
  );

  const syncEventMeta = useCallback(
    (kind: 'big' | number, patch: { name?: string; image?: string }) => {
      const cur = dataRef.current;
      const bosses = cur.bosses.map((b) => {
        if (kind === 'big') return { ...b, bigEvent: { ...b.bigEvent, ...patch } };
        const arr = [...b.smallEvents];
        if (arr[kind]) arr[kind] = { ...arr[kind], ...patch };
        return { ...b, smallEvents: arr };
      });
      touch({ ...cur, bosses });
    },
    [touch]
  );

  const save = useCallback(async () => {
    setSaveState('saving');
    setSaveError('');
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(dataRef.current));
      if (serverMode && adminKey) {
        await writeServerData(adminKey, JSON.stringify(dataRef.current, null, 1));
        setSource('remote');
      } else if (github) {
        await writeRemoteData(
          github,
          JSON.stringify(dataRef.current, null, 1),
          'chore: 更新托管数据'
        );
        setSource('remote');
      }
      setDirty(false);
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存失败');
      setSaveState('error');
    }
  }, [github, serverMode, adminKey]);

  const value = useMemo<Store>(
    () => ({
      data,
      loading,
      dirty,
      saveState,
      saveError,
      github,
      serverMode,
      adminKey,
      source,
      setGithub,
      setAdminKey,
      updateBoss,
      mutateBoss,
      renewBoss,
      setAccepting,
      importData,
      syncEventMeta,
      addBoss,
      removeBoss,
      save,
      reload,
    }),
    [data, loading, dirty, saveState, saveError, github, serverMode, adminKey, source, setGithub, setAdminKey, updateBoss, mutateBoss, renewBoss, setAccepting, importData, syncEventMeta, addBoss, removeBoss, save, reload]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used within DataProvider');
  return s;
}

export function emptyBoss(id: string): Boss {
  return {
    id,
    name: '',
    account: '',
    passcode: String(Math.floor(1000 + Math.random() * 9000)),
    tier: 4,
    cycleDays: 30,
    startDate: new Date().toISOString().slice(0, 10),
    note: '',
    daily: [],
    weekly: [],
    bigEvent: { name: '', image: '', done: false },
    smallEvents: [
      { name: '', image: '', done: false },
      { name: '', image: '', done: false },
      { name: '', image: '', done: false },
    ],
    challenges: { matrix: false, sea: false, tower: false },
    optionals: {
      redeem: { enabled: false, done: false },
      gacha: { enabled: false, done: false },
    },
  };
}

/** 手机号后四位生成口令；重复时往后补数字（0001 → 00011 → 00012……） */
export function makePasscode(tail: string, existing: Boss[]): string {
  const used = new Set(existing.map((b) => b.passcode));
  if (!used.has(tail)) return tail;
  for (let i = 1; i < 100; i++) {
    const cand = `${tail}${i}`;
    if (!used.has(cand)) return cand;
  }
  return `${tail}${Date.now() % 100}`;
}
