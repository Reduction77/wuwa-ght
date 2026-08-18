/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { tierServices, type AuditEntry, type Boss, type SiteData } from '@/types';
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
  readServerPublic,
  readServerData,
  saveAdminKey,
  writeServerData,
} from '@/lib/server';
import { addDays, cycleEndDate, todayStr } from '@/lib/dates';
import { renewBossForDate, resetBossVersionProgress } from '@/lib/boss-rules';

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
  online: boolean;
  setGithub: (c: GithubConfig | null) => void;
  setAdminKey: (key: string | null) => void;
  updateBoss: (id: string, patch: Partial<Boss>) => void;
  mutateBoss: (id: string, fn: (b: Boss) => Boss, audit?: { action: string; detail?: string }) => void;
  mutateBosses: (ids: string[], fn: (b: Boss) => Boss, audit?: { action: string; detail?: string }) => void;
  addBoss: (b: Boss) => void;
  removeBoss: (id: string) => void;
  save: () => Promise<void>;
  reload: () => Promise<void>;
  /** 同版本续期：从当前游戏日开始新的日常周期，只清空日常记录 */
  renewBoss: (id: string) => void;
  /** 版本更新：重置进行中老板的版本任务，保留日常、周常、海墟、深塔、矩阵 */
  resetVersionProgress: (version?: { name: string; expectedDays?: number }) => void;
  archiveBoss: (id: string, archived: boolean) => void;
  undo: () => void;
  canUndo: boolean;
  /** 一键切换接单状态（首页顶部徽章） */
  setAccepting: (on: boolean) => void;
  /** 整包替换数据（从本地备份恢复时用） */
  importData: (data: SiteData) => void;
  /** 同步活动名称/图片到所有老板（同一版本活动全服一样；完成状态仍各自独立） */
  syncEventMeta: (kind: 'big' | number, patch: Partial<Pick<Boss['bigEvent'], 'name' | 'image' | 'openDate' | 'deadline'>>) => void;
}

const Ctx = createContext<Store | null>(null);

export function normalizeSiteData(data: SiteData): SiteData {
  type PB = Partial<Boss> & { bigEvent?: Partial<Boss['bigEvent']> };
  // 兼容旧格式：challenges 的某项可能是 boolean（旧），也可能是 {enabled,done}（新）
  const tog = (v: unknown, defaultEnabled: boolean): Boss['optionals']['redeem'] => {
    if (v && typeof v === 'object') {
      const o = v as { enabled?: boolean; done?: boolean };
      return { enabled: o.enabled ?? defaultEnabled, done: o.done ?? false };
    }
    return { enabled: defaultEnabled, done: v === true };
  };
  return {
    version: Math.max(data.version ?? 1, 2),
    // 服务器用 revision 做并发保存校验；迁移数据时必须保留，否则每次保存都会被误判为冲突。
    revision: Number.isInteger(data.revision) ? data.revision : 0,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
    accepting: {
      on: data.accepting?.on ?? true,
      text: data.accepting?.text ?? '鸣潮 · 托管进行中',
    },
    gameVersion: data.gameVersion ?? { name: '当前版本', startedAt: '', updatedAt: '' },
    bosses: ((data.bosses ?? []) as PB[]).map((b) => {
      const ch = (b.challenges ?? {}) as Record<string, unknown>;
      const tier = b.tier ?? 4;
      const startDate = b.startDate ?? todayStr();
      const start = new Date(startDate + 'T00:00:00');
      const startDow = (start.getDay() + 6) % 7;
      const weekly = ((b.weekly ?? []) as unknown[])
        .map((w) => {
          // 兼容旧数据：旧格式保存的是“周期内第几周”的数字序号。
          if (typeof w === 'number' && Number.isInteger(w) && w >= 0) {
            return addDays(startDate, -startDow + w * 7);
          }
          return typeof w === 'string' ? w : '';
        })
        .filter(Boolean);
      // 全托老板默认把深塔海墟矩阵全息打开，其它套餐默认关
      const full = b.tier === 4;
      return {
        id: b.id ?? `boss-${Math.random().toString(36).slice(2, 9)}`,
        name: b.name ?? '',
        account: b.account ?? '',
        passcode: b.passcode ?? '0000',
        tier,
        cycleDays: b.cycleDays ?? 30,
        startDate,
        note: b.note ?? '',
        internalNote: b.internalNote ?? '',
        tags: Array.isArray(b.tags) ? b.tags.filter((tag) => typeof tag === 'string') : [],
        archived: b.archived ?? false,
        renewalState: b.renewalState ?? 'none',
        issue: {
          kind: b.issue?.kind ?? 'none',
          message: b.issue?.message ?? '',
          updatedAt: b.issue?.updatedAt ?? '',
        },
        excludedDays: Array.isArray(b.excludedDays) ? b.excludedDays.filter((item) => item && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) : [],
        services: { ...tierServices(tier), ...(b.services ?? {}) },
        daily: b.daily ?? [],
        weekly: [...new Set(weekly)].sort(),
        bigEvent: { name: '版本大活动', image: '', done: false, openDate: '', deadline: '', ...(b.bigEvent ?? {}) },
        smallEvents: ((b.smallEvents ?? []) as Array<Partial<Boss['smallEvents'][number]>>).map((e) => ({ name: '', image: '', done: false, openDate: '', deadline: '', ...e })),
        challenges: {
          matrix: tog(ch.matrix, full),
          sea: tog(ch.sea, full),
          tower: tog(ch.tower, full),
          holo: tog(ch.holo, full),
        },
        optionals: {
          redeem: tog(b.optionals?.redeem, false),
          gacha: tog(b.optionals?.gacha, false),
        },
        extraTasks: (b.extraTasks ?? []).map((task) => ({
          id: task.id || `task-${Math.random().toString(36).slice(2, 9)}`,
          name: task.name ?? '',
          done: task.done ?? false,
          visible: task.visible ?? true,
          createdAt: task.createdAt ?? new Date().toISOString(),
          ...(task.doneAt ? { doneAt: task.doneAt } : {}),
        })),
        cycleHistory: Array.isArray(b.cycleHistory) ? b.cycleHistory : [],
        show: {
          daily: b.show?.daily ?? true,
          weekly: b.show?.weekly ?? true,
          bigEvent: b.show?.bigEvent ?? true,
        },
      };
    }),
    audit: Array.isArray(data.audit) ? data.audit.slice(-300) : [],
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SiteData>(normalizeSiteData(initialJson as unknown as SiteData));
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [github, setGithubState] = useState<GithubConfig | null>(() => loadGithubConfig());
  const [serverMode, setServerMode] = useState(false);
  const [adminKey, setAdminKeyState] = useState<string | null>(() => loadAdminKey());
  const [source, setSource] = useState<'remote' | 'local' | 'bundled'>('bundled');
  const [online, setOnline] = useState(() => navigator.onLine);
  const dataRef = useRef(data);
  const undoRef = useRef<SiteData | null>(null);
  const wasOfflineRef = useRef(!navigator.onLine);
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const reload = useCallback(async () => {
    setLoading(true);
    const acceptRemote = (raw: string) => {
      const next = normalizeSiteData(JSON.parse(raw));
      dataRef.current = next;
      setData(next);
      setSource('remote');
      setDirty(false);
      setSaveState('idle');
      setSaveError('');
    };
    // 服务器版：数据直接在服务器上
    if (await detectServer()) {
      setServerMode(true);
      try {
        const key = loadAdminKey();
        const content = key ? await readServerData(key) : await readServerPublic();
        acceptRemote(content);
        setLoading(false);
        return;
      } catch {
        // 管理凭据失效时清理它，但服务器模式保持不变且绝不回退到公开 data.json。
        saveAdminKey(null);
        setAdminKeyState(null);
        try {
          acceptRemote(await readServerPublic());
        } catch {
          setSource('bundled');
        }
        setDirty(false);
        setSaveState('idle');
        setSaveError('');
        setLoading(false);
        return;
      }
    }
    setServerMode(false);
    const gh = loadGithubConfig();
    if (gh) {
      try {
        const { content } = await readRemoteData(gh);
        acceptRemote(content);
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
          setData(normalizeSiteData(JSON.parse(local)));
          setSource('local');
        } else {
          setData(normalizeSiteData(json));
          setSource('bundled');
        }
      }
    } catch {
      /* 保持内置数据 */
    }
    setLoading(false);
  }, [dirty]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touch = useCallback((next: SiteData, audit?: Omit<AuditEntry, 'id' | 'at'>) => {
    undoRef.current = dataRef.current;
    setCanUndo(true);
    if (audit) {
      next.audit = [...(next.audit ?? []), {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at: new Date().toISOString(),
        ...audit,
      }].slice(-300);
    }
    next.updatedAt = new Date().toISOString();
    dataRef.current = next;
    setData({ ...next });
    setDirty(true);
    setSaveState('idle');
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch {
      /* 超出本地配额时忽略 */
    }
  }, []);

  const undo = useCallback(() => {
    const previous = undoRef.current;
    if (!previous) return;
    undoRef.current = null;
    setCanUndo(false);
    previous.updatedAt = new Date().toISOString();
    dataRef.current = previous;
    setData({ ...previous });
    setDirty(true);
    setSaveState('idle');
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(previous));
    } catch {
      // 浏览器空间不足时仍保留内存中的撤销结果。
    }
  }, []);

  const mutateBoss = useCallback(
    (id: string, fn: (b: Boss) => Boss, audit?: { action: string; detail?: string }) => {
      const cur = dataRef.current;
      const bosses = cur.bosses.map((b) => (b.id === id ? fn({ ...b }) : b));
      touch({ ...cur, bosses }, audit ? { ...audit, bossId: id } : undefined);
    },
    [touch]
  );

  const updateBoss = useCallback(
    (id: string, patch: Partial<Boss>) => {
      mutateBoss(id, (b) => ({ ...b, ...patch }));
    },
    [mutateBoss]
  );

  const mutateBosses = useCallback(
    (ids: string[], fn: (b: Boss) => Boss, audit?: { action: string; detail?: string }) => {
      const selected = new Set(ids);
      const cur = dataRef.current;
      touch({ ...cur, bosses: cur.bosses.map((b) => selected.has(b.id) ? fn({ ...b }) : b) }, audit ? { ...audit, detail: `${audit.detail ?? ''}${audit.detail ? ' · ' : ''}${ids.length} 位` } : undefined);
    },
    [touch]
  );

  const addBoss = useCallback(
    (b: Boss) => {
      const cur = dataRef.current;
      touch({ ...cur, bosses: [...cur.bosses, b] }, { action: '新增老板', bossId: b.id, detail: b.name });
    },
    [touch]
  );

  const removeBoss = useCallback(
    (id: string) => {
      const cur = dataRef.current;
      touch({ ...cur, bosses: cur.bosses.filter((b) => b.id !== id) }, { action: '永久删除老板', bossId: id });
    },
    [touch]
  );

  const renewBoss = useCallback(
    (id: string) => {
      const today = todayStr();
      const cur = dataRef.current;
      const bosses = cur.bosses.map((b) => b.id === id ? renewBossForDate(b, today) : b);
      touch({ ...cur, bosses }, { action: '同版本续期', bossId: id, detail: `${today} 起` });
    },
    [touch]
  );

  const resetVersionProgress = useCallback((version?: { name: string; expectedDays?: number }) => {
    const cur = dataRef.current;
    const today = todayStr();
    const bosses = cur.bosses.map((b) => {
      // 已到期的老板不参与新版本，避免改动其留存数据。
      if (b.archived || cycleEndDate(b) < today) return b;
      return resetBossVersionProgress(b);
    });
    touch({
      ...cur,
      gameVersion: {
        name: version?.name.trim() || cur.gameVersion?.name || '当前版本',
        startedAt: today,
        ...(version?.expectedDays ? { expectedDays: version.expectedDays } : {}),
        updatedAt: new Date().toISOString(),
      },
      bosses,
    }, { action: '游戏版本更新', detail: `${version?.name || '未命名版本'} · 重置 ${bosses.filter((b, i) => b !== cur.bosses[i]).length} 位老板` });
  }, [touch]);

  const archiveBoss = useCallback((id: string, archived: boolean) => {
    const cur = dataRef.current;
    const boss = cur.bosses.find((item) => item.id === id);
    touch({ ...cur, bosses: cur.bosses.map((item) => item.id === id ? { ...item, archived } : item) }, {
      action: archived ? '归档老板' : '恢复老板', bossId: id, detail: boss?.name,
    });
  }, [touch]);

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
      // 恢复备份是明确的整包覆盖，但提交仍需携带服务器当前修订号，不能沿用旧备份的 revision。
      touch({ ...normalizeSiteData(incoming), revision: dataRef.current.revision ?? 0 });
    },
    [touch]
  );

  const syncEventMeta = useCallback(
    (kind: 'big' | number, patch: Partial<Pick<Boss['bigEvent'], 'name' | 'image' | 'openDate' | 'deadline'>>) => {
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
        const saved = normalizeSiteData(JSON.parse(await writeServerData(adminKey, JSON.stringify(dataRef.current, null, 1))));
        dataRef.current = saved;
        setData(saved);
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

  // 服务器版自动保存；GitHub Pages 仍保留手动保存，避免每次输入都产生提交记录。
  useEffect(() => {
    if (!dirty || !online || !serverMode || !adminKey || saveState === 'saving' || saveState === 'error') return;
    const timer = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timer);
  }, [data.updatedAt, dirty, online, serverMode, adminKey, saveState, save]);

  useEffect(() => {
    if (!online) {
      wasOfflineRef.current = true;
      return;
    }
    if (wasOfflineRef.current && dirty && serverMode && adminKey && saveState === 'error') {
      setSaveState('idle');
    }
    wasOfflineRef.current = false;
  }, [online, dirty, serverMode, adminKey, saveState]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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
      online,
      setGithub,
      setAdminKey,
      updateBoss,
      mutateBoss,
      mutateBosses,
      renewBoss,
      resetVersionProgress,
      archiveBoss,
      undo,
      canUndo,
      setAccepting,
      importData,
      syncEventMeta,
      addBoss,
      removeBoss,
      save,
      reload,
    }),
    [data, loading, dirty, saveState, saveError, github, serverMode, adminKey, source, online, setGithub, setAdminKey, updateBoss, mutateBoss, mutateBosses, renewBoss, resetVersionProgress, archiveBoss, undo, canUndo, setAccepting, importData, syncEventMeta, addBoss, removeBoss, save, reload]
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
    startDate: todayStr(),
    note: '',
    internalNote: '',
    tags: [],
    archived: false,
    renewalState: 'none',
    issue: { kind: 'none', message: '', updatedAt: '' },
    excludedDays: [],
    services: tierServices(4),
    daily: [],
    weekly: [],
    bigEvent: { name: '版本大活动', image: '', done: false },
    smallEvents: [
      { name: '版本小活动①', image: '', done: false },
      { name: '版本小活动②', image: '', done: false },
      { name: '版本小活动③', image: '', done: false },
    ],
    challenges: {
      matrix: { enabled: false, done: false },
      sea: { enabled: false, done: false },
      tower: { enabled: false, done: false },
      holo: { enabled: false, done: false },
    },
    optionals: {
      redeem: { enabled: false, done: false },
      gacha: { enabled: false, done: false },
    },
    extraTasks: [],
    cycleHistory: [],
    show: { daily: true, weekly: true, bigEvent: true },
  };
}

/** 根据手机后四位生成口令；与其他老板重复时在末尾补 1、2、3… */
export function makePasscode(tail: string, bosses: Boss[]): string {
  const base = tail.replace(/\D/g, '').slice(-4) || '0000';
  const taken = new Set(bosses.map((b) => b.passcode));
  if (!taken.has(base)) return base;
  for (let i = 1; i <= 9; i++) {
    const cand = base + String(i);
    if (!taken.has(cand)) return cand;
  }
  return base + String(Date.now() % 100);
}
