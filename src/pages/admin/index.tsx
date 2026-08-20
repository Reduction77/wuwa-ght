import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, bossStats, currentWeekIndex, cycleEndDate, daysLeftInCycle, fmtCN, todayStr, weekRange } from '@/lib/dates';
import { emptyBoss, makePasscode, normalizeSiteData, useStore } from '@/lib/store';
import { testConnection, type GithubConfig } from '@/lib/github';
import { checkAdminKey, cleanupServerImages } from '@/lib/server';
import { TIER_LABEL, tierServices, type Boss, type SiteData } from '@/types';
import BossEditor from './BossEditor';
import { Archive, ArchiveRestore, ArrowLeft, BellRing, CheckCircle2, Circle, CloudUpload, Download, Github, KeyRound, Plus, RefreshCw, RotateCcw, Search, Trash2, Unplug, Upload } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export default function Admin({ onBack }: Props) {
  const store = useStore();
  const { data, github, setGithub, serverMode, adminKey, setAdminKey, reload } = store;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');

  const entered = serverMode ? !!adminKey : !!github;
  const selected = data.bosses.find((b) => b.id === selectedId) ?? null;
  const visibleBosses = data.bosses
    .filter((boss) => boss.archived === showArchived)
    .filter((boss) => !query.trim() || `${boss.name} ${boss.account} ${boss.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const issue = Number(b.issue.kind !== 'none') - Number(a.issue.kind !== 'none');
      if (issue) return issue;
      const daily = Number(a.daily.includes(todayStr())) - Number(b.daily.includes(todayStr()));
      if (daily) return daily;
      return daysLeftInCycle(a) - daysLeftInCycle(b);
    });

  useEffect(() => {
    if (!serverMode || !adminKey) return;
    const expire = () => {
      setAdminKey(null);
      void reload();
    };
    let timer = window.setTimeout(expire, 30 * 60 * 1000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(expire, 30 * 60 * 1000);
    };
    const events = ['pointerdown', 'keydown'] as const;
    events.forEach((event) => window.addEventListener(event, reset));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [serverMode, adminKey, setAdminKey, reload]);

  if (store.loading) {
    return <div className="flex min-h-[70vh] items-center justify-center font-display text-lg" style={{ color: '#5b7a97' }}>正在读取数据…</div>;
  }
  if (!entered) {
    return <LoginGate onBack={onBack} onConnected={(c) => setGithub(c)} onKey={async (k) => {
      setAdminKey(k);
      await store.reload();
    }} />;
  }

  return (
    <div className="admin-shell view-swap mx-auto max-w-6xl px-5 pb-36">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="btn-ghost !px-4 !py-2 text-xs">
            <ArrowLeft size={14} /> 首页
          </button>
          <div>
            <h1 className="font-display text-xl" style={{ color: '#22405c' }}>托管登记后台</h1>
            <p className="text-[11px] font-semibold" style={{ color: '#8aa2b8' }}>
              {serverMode
                ? '服务器模式：数据直接保存在服务器上'
                : github
                  ? `已连接 GitHub：${github.owner}/${github.repo}`
                  : '本地模式：改动只存在这个浏览器里'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {serverMode ? (
            adminKey && (
              <button type="button" className="btn-ghost !px-4 !py-2 text-xs" onClick={() => { setAdminKey(null); void reload(); }}>
                <Unplug size={14} /> 退出后台
              </button>
            )
          ) : (
            <button type="button" className="btn-ghost !px-4 !py-2 text-xs" onClick={() => setGithub(null)}>
              <Unplug size={14} /> 断开 GitHub
            </button>
          )}
          <button type="button" className="btn-ghost !px-4 !py-2 text-xs" onClick={() => store.reload()}>
            <RefreshCw size={14} className={store.loading ? 'animate-spin' : ''} /> 重新读取
          </button>
        </div>
      </header>

      <RenewReminder onSelect={setSelectedId} />
      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <AcceptingCard />
        <VersionResetCard />
        <div className="md:col-span-2">
          <BackupCard />
        </div>
      </div>
      <TodayWorkbench onSelect={setSelectedId} />
      <AuditLog />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* 老板列表 */}
        <aside className="space-y-3">
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-3.5 text-sm font-bold transition-all duration-300 hover:border-[#45a9ff] hover:bg-[#f0f7ff]"
            style={{ borderColor: '#b8d8f5', color: '#2a7fd4' }}
          >
            <Plus size={16} /> 新增老板
          </button>

          <div className="paper-card space-y-2 px-3 py-3">
            <label className="relative block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa2b8]" />
              <input className="input-soft !py-2 !pl-9 text-xs" placeholder="搜索称呼、账号、标签" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button type="button" className="w-full text-center text-xs font-bold text-[#7e96ad]" onClick={() => { setShowArchived((value) => !value); setSelectedId(null); }}>
              {showArchived ? '← 返回当前老板' : `查看归档（${data.bosses.filter((boss) => boss.archived).length}）`}
            </button>
          </div>

          {visibleBosses.map((b) => {
            const s = bossStats(b);
            const active = b.id === selectedId;
            const left = daysLeftInCycle(b);
            return (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(b.id)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedId(b.id)}
                className={`paper-card w-full cursor-pointer px-4 py-3.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${active ? 'ring-2 ring-[#45a9ff]' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <p className="font-bold" style={{ color: '#22405c' }}>{b.name || '（未命名）'}</p>
                  <span className="chip" style={{ background: '#e7f3ff', color: '#2a7fd4' }}>{TIER_LABEL[b.tier]}</span>
                  {b.issue.kind !== 'none' && <span className="chip" style={{ background: '#fff1dc', color: '#b06f0e' }}>有异常</span>}
                </div>
                <p className="mt-1 text-[11px]" style={{ color: '#8aa2b8' }}>
                  {fmtCN(b.startDate)} 开始 · {b.cycleDays}天 · 第 {s.dayNow} 天
                  {b.daily.includes(todayStr()) && <span style={{ color: '#1d9e74' }}> · 今日已清✓</span>}
                  {left < 0 && <span className="font-bold" style={{ color: '#9f7aea' }}> · 已到期</span>}
                  {left >= 0 && left <= 5 && (
                    <span className="font-bold" style={{ color: '#d18d1f' }}> · {left === 0 ? '今天到期' : `还剩${left}天`}</span>
                  )}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: '#e3effc' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.overall}%`, background: 'linear-gradient(90deg,#45a9ff,#1e8bf0)' }} />
                </div>
              </div>
            );
          })}
        </aside>

        {/* 编辑区 */}
        <main>
          {selected ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg" style={{ color: '#22405c' }}>
                  正在登记：{selected.name || '（未命名）'}
                  <span className="ml-2 align-middle text-xs font-sans" style={{ color: '#8aa2b8' }}>
                    <KeyRound size={11} className="mr-1 inline" />口令 {selected.passcode}
                  </span>
                </h2>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost !px-3.5 !py-1.5 text-xs" onClick={() => {
                    if (!selected.archived && !confirm(`把「${selected.name}」移入归档吗？记录都会保留，可以随时恢复。`)) return;
                    store.archiveBoss(selected.id, !selected.archived);
                    setSelectedId(null);
                  }}>
                    {selected.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />} {selected.archived ? '恢复' : '归档'}
                  </button>
                  {selected.archived && <button type="button" className="btn-ghost !px-3.5 !py-1.5 text-xs !text-[#e05548]" onClick={() => {
                    if (confirm(`确定永久删除「${selected.name}」吗？请先确认已有备份，此操作保存后不可恢复。`)) {
                      store.removeBoss(selected.id);
                      setSelectedId(null);
                    }
                  }}><Trash2 size={13} /> 永久删除</button>}
                </div>
              </div>
              <BossEditorLoader bossId={selected.id} />
            </div>
          ) : (
            <div className="paper-card flex h-64 flex-col items-center justify-center text-center">
              <p className="font-display text-xl" style={{ color: '#22405c' }}>点左边一位老板开始登记</p>
              <p className="mt-2 text-sm" style={{ color: '#8aa2b8' }}>登记完别忘了点底部的「保存」哦</p>
            </div>
          )}
        </main>
      </div>

      <SaveBar />
      {showNew && (
        <NewBossModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

/* ---------- 今日工作台：按异常、未完成、已完成排列 ---------- */
function TodayWorkbench({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, mutateBoss, mutateBosses } = useStore();
  const today = todayStr();
  const active = data.bosses
    .filter((boss) => !boss.archived && boss.startDate <= today && cycleEndDate(boss) >= today)
    .sort((a, b) => {
      const issue = Number(b.issue.kind !== 'none') - Number(a.issue.kind !== 'none');
      if (issue) return issue;
      return Number(a.daily.includes(today)) - Number(b.daily.includes(today));
    });
  const pending = active.filter((boss) => boss.services.daily && !boss.daily.includes(today));
  const batchable = pending.filter((boss) => boss.issue.kind === 'none');

  const toggleDaily = (boss: Boss) => mutateBoss(boss.id, (current) => ({
    ...current,
    daily: current.daily.includes(today) ? current.daily.filter((date) => date !== today) : [...current.daily, today].sort(),
  }), { action: boss.daily.includes(today) ? '撤销日常打卡' : '完成日常打卡', detail: today });

  const toggleWeekly = (boss: Boss) => {
    const index = currentWeekIndex(boss);
    if (index < 0) return;
    const key = weekRange(boss, index).from;
    mutateBoss(boss.id, (current) => ({
      ...current,
      weekly: current.weekly.includes(key) ? current.weekly.filter((week) => week !== key) : [...current.weekly, key].sort(),
    }), { action: boss.weekly.includes(key) ? '撤销周常打卡' : '完成周常打卡', detail: key });
  };

  const completeAll = () => {
    if (!batchable.length || !confirm(`确定把 ${batchable.length} 位无异常老板的今日体力全部标记为已清吗？`)) return;
    mutateBosses(batchable.map((boss) => boss.id), (boss) => ({ ...boss, daily: [...new Set([...boss.daily, today])].sort() }), { action: '批量完成日常', detail: today });
  };

  return (
    <section className="paper-card mb-5 px-5 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="font-display text-lg text-[#22405c]">今日工作台</h2>
          <p className="mt-1 text-xs text-[#8aa2b8]">{fmtCN(today)} · 凌晨4点刷新 · 待完成 {pending.length}/{active.length} 位</p>
        </div>
        <button type="button" disabled={!batchable.length} className="btn-primary mobile-full !px-4 !py-2 text-xs sm:w-auto" onClick={completeAll}>无异常账号全部已清</button>
      </div>
      <div className="mt-4">
        <div className="space-y-2">
          {active.map((boss) => {
            const dailyDone = boss.daily.includes(today);
            const weekIndex = currentWeekIndex(boss);
            const weekKey = weekIndex >= 0 ? weekRange(boss, weekIndex).from : '';
            const weeklyDone = !!weekKey && boss.weekly.includes(weekKey);
            const eventDeadlines = [boss.bigEvent, ...boss.smallEvents].filter((event) => !event.done && event.deadline && event.deadline >= today && event.deadline <= addDays(today, 3));
            return (
              <div key={boss.id} className={`grid grid-cols-1 items-center gap-2 rounded-xl border px-3 py-3 sm:grid-cols-[minmax(140px,1fr)_140px_140px_100px] sm:gap-3 sm:px-4 ${boss.issue.kind !== 'none' ? 'border-[#ffd9a0] bg-[#fffaf2]' : 'border-[var(--line)] bg-white'}`}>
                <button type="button" className="min-w-0 text-left" onClick={() => onSelect(boss.id)}>
                  <p className="truncate text-sm font-bold text-[#22405c]">{boss.name}</p>
                  <p className="truncate text-[11px] text-[#8aa2b8]">{boss.issue.kind !== 'none' ? `⚠ ${boss.issue.message || '存在异常'}` : eventDeadlines.length ? `⏰ ${eventDeadlines.length} 个活动即将截止` : boss.tags.join(' · ') || boss.account || TIER_LABEL[boss.tier]}</p>
                </button>
                {boss.services.daily ? <button type="button" disabled={boss.issue.kind === 'paused'} onClick={() => toggleDaily(boss)} className="flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold" style={dailyDone ? { background: '#d6f4e7', color: '#1d9e74' } : { background: '#fdf3e3', color: '#d18d1f' }}>{dailyDone ? <CheckCircle2 size={15} /> : <Circle size={15} />}{dailyDone ? '今日已清' : boss.issue.kind === 'paused' ? '已暂停' : '待清体力'}</button> : <span className="text-center text-xs text-[#b0c2d3]">无日体</span>}
                {boss.services.weekly ? <button type="button" disabled={boss.issue.kind === 'paused'} onClick={() => toggleWeekly(boss)} className="flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold" style={weeklyDone ? { background: '#e7f3ff', color: '#2a7fd4' } : { background: '#f5f8fb', color: '#7e96ad' }}>{weeklyDone ? <CheckCircle2 size={15} /> : <Circle size={15} />}{weeklyDone ? '本周已清' : boss.issue.kind === 'paused' ? '已暂停' : '本周待清'}</button> : <span className="text-center text-xs text-[#b0c2d3]">无周常</span>}
                <button type="button" className="btn-ghost !px-3 !py-2 text-xs" onClick={() => onSelect(boss.id)}>查看详情</button>
              </div>
            );
          })}
          {active.length === 0 && <p className="py-8 text-center text-sm text-[#9db4c9]">当前没有进行中的托管</p>}
        </div>
      </div>
    </section>
  );
}

function AuditLog() {
  const { data } = useStore();
  const entries = [...(data.audit ?? [])].reverse().slice(0, 50);
  if (!entries.length) return null;
  return (
    <details className="paper-card mb-5 px-5 py-4">
      <summary className="cursor-pointer text-sm font-bold text-[#5b7a97]">最近操作记录（{entries.length}）</summary>
      <div className="mt-3 max-h-64 space-y-2 overflow-auto">
        {entries.map((entry) => {
          const boss = entry.bossId ? data.bosses.find((item) => item.id === entry.bossId) : null;
          return <div key={entry.id} className="flex flex-wrap gap-x-3 text-xs text-[#7e96ad]"><span>{new Date(entry.at).toLocaleString('zh-CN')}</span><strong className="text-[#2b3f54]">{entry.action}</strong>{boss && <span>{boss.name}</span>}{entry.detail && <span>{entry.detail}</span>}</div>;
        })}
      </div>
    </details>
  );
}

/* ---------- 续订提醒：还剩 5 天以内（含已到期）的老板 ---------- */
const REMIND_DAYS = 5;

function RenewReminder({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, mutateBoss } = useStore();
  const expiring = data.bosses
    .map((b) => ({ b, left: daysLeftInCycle(b) }))
    .filter((x) => !x.b.archived && x.left <= REMIND_DAYS)
    .sort((a, z) => a.left - z.left);

  if (expiring.length === 0) return null;

  return (
    <div
      className="paper-card rise-in mb-5 px-5 py-4"
      style={{ border: '1.5px solid #ffd9a0', background: 'linear-gradient(135deg,#fffaf2,#fff1dc)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: '#ffe3b3', color: '#c07f16' }}>
          <BellRing size={16} />
        </span>
        <p className="font-display text-base" style={{ color: '#8a5a10' }}>续订提醒</p>
        <span className="chip" style={{ background: '#ffe8c2', color: '#b06f0e' }}>{expiring.length} 位</span>
        <p className="w-full text-[11px] font-semibold sm:w-auto sm:flex-1 sm:text-right" style={{ color: '#c09a5a' }}>
          周期还剩 {REMIND_DAYS} 天以内（或已到期）的老板会出现在这里，记得提醒续费哦
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {expiring.map(({ b, left }) => {
          const expired = left < 0;
          return (
            <div
              key={b.id}
              className="flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-xs font-bold shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              style={{ color: '#7a5a18', border: expired ? '1.5px solid #d6bcfa' : '1.5px solid #ffd9a0' }}
            >
              <button type="button" onClick={() => onSelect(b.id)} className="font-display text-sm" style={{ color: expired ? '#7c5cbf' : '#8a5a10' }}>{b.name}</button>
              <span className="chip" style={{ background: '#e7f3ff', color: '#2a7fd4' }}>{TIER_LABEL[b.tier]}</span>
              <span style={{ color: expired ? '#9f7aea' : '#d18d1f' }}>
                {expired ? `已到期 ${-left} 天` : left === 0 ? '今天到期！' : `还剩 ${left} 天`}
              </span>
              <span style={{ color: '#b9a276' }}>{fmtCN(cycleEndDate(b))} 截止</span>
              <button type="button" className="rounded-full bg-[#eef5fc] px-2 py-1 text-[11px] text-[#2a7fd4]" onClick={() => {
                const when = expired ? `已经到期 ${-left} 天` : left === 0 ? '今天到期' : `还有 ${left} 天到期`;
                void navigator.clipboard.writeText(`${b.name}老板你好～你的鸣潮托管周期${when}，需要续期的话跟我说一声就好。`);
              }}>复制提醒</button>
              <select className="rounded-full border border-[#ead8b4] bg-white px-2 py-1 text-[11px]" value={b.renewalState} onChange={(e) => mutateBoss(b.id, (boss) => ({ ...boss, renewalState: e.target.value as Boss['renewalState'] }))}>
                <option value="none">未处理</option>
                <option value="reminded">已提醒</option>
                <option value="pending">待续费</option>
                <option value="renewed">已续费</option>
                <option value="ending">不续订</option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 托管周期：常用 30 / 42 天，也可以自定义任意天数 */
function CycleDaysField({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const preset = value === 30 || value === 42;
  const [custom, setCustom] = useState(!preset);
  const [draft, setDraft] = useState(String(preset ? '' : value));

  const pick = (v: string) => {
    if (v === 'custom') {
      setCustom(true);
      setDraft(preset ? '' : String(value));
    } else {
      setCustom(false);
      onChange(Number(v));
    }
  };

  const commit = (raw: string) => {
    setDraft(raw);
    const n = Math.max(1, Math.min(365, Math.round(Number(raw) || 0)));
    if (raw && n >= 1) onChange(n);
  };

  return (
    <div className="space-y-2">
      <select className="input-soft" value={custom ? 'custom' : String(value)} onChange={(e) => pick(e.target.value)}>
        <option value={30}>30 天</option>
        <option value={42}>42 天</option>
        <option value="custom">自定义天数…</option>
      </select>
      {custom && (
        <span className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={365}
            className="input-soft !w-28 text-center font-bold"
            placeholder="天数"
            value={draft}
            onChange={(e) => commit(e.target.value)}
          />
          <span className="text-xs font-bold" style={{ color: '#5b7a97' }}>天（1~365）</span>
        </span>
      )}
    </div>
  );
}

/* ---------- 接单状态：一键切换首页顶部徽章 ---------- */
function AcceptingCard() {
  const { data, setAccepting } = useStore();
  const acc = data.accepting ?? { on: true, text: '鸣潮 · 托管进行中' };

  return (
    <div className="paper-card flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300"
        style={acc.on ? { background: '#d9f3e6', color: '#1d9e74' } : { background: '#ffe8c2', color: '#b06f0e' }}
      >
        {acc.on ? <BellRing size={18} /> : <PauseIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold" style={{ color: '#22405c' }}>接单状态</p>
        <p className="mt-0.5 text-[11px]" style={{ color: '#8aa2b8' }}>
          首页顶部现在显示「{acc.text}」
        </p>
      </div>
      <button
        type="button"
        onClick={() => setAccepting(!acc.on)}
        className="btn-ghost !px-4 !py-2 text-xs"
        style={acc.on ? undefined : { background: '#d9f3e6', borderColor: '#b5e6cf', color: '#1d9e74' }}
      >
        {acc.on ? '暂停接单' : '恢复接单'}
      </button>
    </div>
  );
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="9" y1="5" x2="9" y2="19" />
      <line x1="15" y1="5" x2="15" y2="19" />
    </svg>
  );
}

/* ---------- 游戏版本更新：与老板的托管周期相互独立 ---------- */
function VersionResetCard() {
  const { data, resetVersionProgress, serverMode, adminKey, save } = useStore();
  const [resetting, setResetting] = useState(false);
  const activeCount = data.bosses.filter((b) => !b.archived && cycleEndDate(b) >= todayStr()).length;

  const reset = async () => {
    if (activeCount === 0) return;
    const versionName = prompt('输入新游戏版本名称（例如 2.6）', data.gameVersion?.name || '');
    if (versionName === null) return;
    const daysInput = prompt('预计版本天数（通常42，也可以填28、30或留空）', String(data.gameVersion?.expectedDays || 42));
    if (daysInput === null) return;
    const expectedDays = daysInput.trim() ? Number(daysInput) : undefined;
    if (expectedDays !== undefined && (!Number.isInteger(expectedDays) || expectedDays < 1 || expectedDays > 100)) {
      alert('版本天数请填写 1～100 的整数');
      return;
    }
    const ok = confirm(
      `确定更新到「${versionName || '未命名版本'}」并重置吗？\n\n将影响 ${activeCount} 位当前仍在托管的老板（包括版本中途加入的老板）。\n会清空：大活动、小活动的名称、图片、日期和完成状态。\n会重置：矩阵、全息、兑换码、抽卡道具、角色试用。\n会保留：日常、周常、海墟、深塔。\n服务器版保存成功后会自动清理未使用的活动图片。`
    );
    if (!ok) return;

    setResetting(true);
    try {
      resetVersionProgress({ name: versionName, expectedDays });
      if (serverMode && adminKey) {
        const saved = await save();
        if (!saved) {
          alert('版本重置已经暂存在当前页面，但保存到服务器失败，因此没有清理图片。请先处理顶部的保存错误后重试。');
          return;
        }
        try {
          const removed = await cleanupServerImages(adminKey);
          alert(`版本重置完成，已清理 ${removed} 张未使用的活动图片。`);
        } catch (error) {
          alert(`版本数据已保存，但图片自动清理失败：${error instanceof Error ? error.message : '未知错误'}。可以稍后在“数据备份 / 恢复”中点击“清理旧图片”。`);
        }
      }
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="paper-card flex items-center gap-4 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: '#efe9fb', color: '#7c5cc9' }}>
        <RotateCcw size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold" style={{ color: '#22405c' }}>游戏版本更新</p>
        <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: '#8aa2b8' }}>
          当前：{data.gameVersion?.name || '未设置'}；日期不固定，由你更新当天手动重置
        </p>
      </div>
      <button type="button" disabled={activeCount === 0 || resetting} onClick={() => void reset()} className="btn-ghost !px-4 !py-2 text-xs shrink-0">
        {resetting ? '正在重置…' : `重置 ${activeCount} 位`}
      </button>
    </div>
  );
}

/* ---------- 数据备份 / 恢复 ---------- */
function BackupCard() {
  const { data, importData, serverMode, github, adminKey } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const backup = () => {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `托管数据备份-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('已下载备份文件，收好它就能随时恢复');
    setTimeout(() => setMsg(''), 4000);
  };

  const exportCsv = () => {
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [['称呼', '账号', '套餐', '开始日期', '周期天数', '结束日期', '日常完成', '周常完成', '异常状态', '续费状态', '标签', '是否归档']];
    data.bosses.forEach((boss) => rows.push([
      boss.name, boss.account, TIER_LABEL[boss.tier], boss.startDate, String(boss.cycleDays), cycleEndDate(boss),
      String(boss.daily.length), String(boss.weekly.length), boss.issue.kind, boss.renewalState, boss.tags.join('|'), boss.archived ? '是' : '否',
    ]));
    const blob = new Blob(['\ufeff' + rows.map((row) => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `托管统计-${todayStr()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const restore = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as SiteData;
      if (!parsed || !Array.isArray(parsed.bosses)) throw new Error('bad');
      const normalized = normalizeSiteData(parsed);
      const ids = new Set<string>();
      const passcodes = new Set<string>();
      for (const boss of normalized.bosses) {
        if (!boss.id || ids.has(boss.id) || boss.passcode.length < 4 || passcodes.has(boss.passcode) || boss.cycleDays < 1 || boss.cycleDays > 365) throw new Error('bad');
        ids.add(boss.id);
        passcodes.add(boss.passcode);
      }
      const count = normalized.bosses.length;
      if (!confirm(`备份里有 ${count} 位老板，恢复会覆盖当前全部数据。${serverMode || github ? '记得点底部「保存」让线上也生效。' : '现在是本地模式，恢复内容只存在这个浏览器。'}\n\n确定恢复吗？`)) return;
      importData(normalized);
      setMsg('已恢复到页面，点底部「保存」让它正式生效');
    } catch {
      setMsg('这个文件不是有效的备份，换一个试试');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => setMsg(''), 5000);
    }
  };

  return (
    <div className="paper-card flex items-center gap-4 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: '#e7f3ff', color: '#2a7fd4' }}>
        <Download size={18} />
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold" style={{ color: '#22405c' }}>数据备份 / 恢复</p>
        <p className="mt-0.5 text-[11px]" style={{ color: '#8aa2b8' }}>
          {msg || (serverMode ? '把服务器上的数据存到本地，或从本地备份一键恢复' : github ? '把 GitHub 上的数据存到本地，或从本地备份一键恢复' : '本地模式下也可以先备份一份防丢')}
        </p>
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
        {serverMode && adminKey && <button type="button" className="btn-ghost !px-4 !py-2 text-xs" onClick={async () => {
          if (!confirm('清理所有已不再被当前记录或历史周期引用的活动图片吗？')) return;
          try {
            const removed = await cleanupServerImages(adminKey);
            setMsg(`已清理 ${removed} 张未使用图片`);
          } catch (error) {
            setMsg(error instanceof Error ? error.message : '清理失败');
          }
        }}>清理旧图片</button>}
        <button type="button" onClick={exportCsv} className="btn-ghost !px-4 !py-2 text-xs">
          导出 CSV
        </button>
        <button type="button" onClick={backup} className="btn-ghost !px-4 !py-2 text-xs">
          <Download size={13} /> 备份到本地
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost !px-4 !py-2 text-xs">
          <Upload size={13} /> 从本地恢复
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
      </div>
    </div>
  );
}

/* ---------- 新增老板：三步小流程 ---------- */
function NewBossModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { data, addBoss } = useStore();
  const [form, setForm] = useState({
    name: '',
    account: '',
    phone: '',
    passcode: '',
    tier: 4 as Boss['tier'],
    cycleDays: 30 as number,
    startDate: todayStr(),
  });
  // 手动改过口令后，不再用手机号自动覆盖
  const [codeTouched, setCodeTouched] = useState(false);

  const phoneDigits = form.phone.replace(/\D/g, '');
  const tail4 = phoneDigits.slice(-4);
  const autoCode = tail4.length === 4 ? makePasscode(tail4, data.bosses) : '';
  const passcode = form.passcode.trim();
  const autoDuplicated = !codeTouched && autoCode.length > 4;
  const manualDuplicated = !!passcode && data.bosses.some((b) => b.passcode === passcode);
  const canCreate = form.name.trim() && phoneDigits.length === 11 && passcode.length >= 4 && !manualDuplicated && form.startDate;

  const onPhoneChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    const tail = digits.slice(-4);
    setForm({
      ...form,
      phone: digits,
      passcode: !codeTouched && tail.length === 4 ? makePasscode(tail, data.bosses) : form.passcode,
    });
  };

  const create = () => {
    const b = emptyBoss(`boss-${Date.now()}`);
    b.name = form.name.trim();
    b.account = form.account.trim() || (phoneDigits ? phoneDigits.replace(/^(\d{3})\d{4}(\d{4})$/, '$1……$2') : '');
    b.passcode = passcode;
    b.tier = form.tier;
    b.services = tierServices(form.tier);
    if (form.tier === 4 || form.tier === 5) {
      b.challenges = Object.fromEntries(Object.entries(b.challenges).map(([key, value]) => [key, { ...value, enabled: true }])) as Boss['challenges'];
    }
    b.cycleDays = form.cycleDays;
    b.startDate = form.startDate;
    // 同一版本的活动全服一样：新老板直接继承现有活动名称和图片
    const src = data.bosses.find((boss) => !boss.archived && cycleEndDate(boss) >= todayStr()) ?? data.bosses.find((boss) => !boss.archived);
    if (src) {
      b.bigEvent = { name: src.bigEvent.name, image: src.bigEvent.image, done: false };
      b.smallEvents = src.smallEvents.map((e) => ({ name: e.name, image: e.image, done: false }));
    }
    addBoss(b);
    onCreated(b.id);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#22405c]/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="paper-card view-swap w-full max-w-md px-6 py-6" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-display text-lg" style={{ color: '#22405c' }}>新增老板</h4>
        <p className="mt-1 text-xs" style={{ color: '#8aa2b8' }}>填完这几项就能开始登记，其他细节之后随时改</p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>老板称呼 *</span>
            <input className="input-soft" placeholder="平时怎么称呼TA" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>账号（可打码，可空）</span>
            <input className="input-soft" placeholder="留空会自动用手机号打码" value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>老板手机号 *（自动取后四位生成口令）</span>
            <input
              className="input-soft font-bold tracking-[0.15em]"
              placeholder="11 位手机号"
              maxLength={11}
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>
              登录口令 *（已按手机号后四位自动填好，可以直接改）
            </span>
            <input
              className="input-soft font-bold tracking-[0.3em]"
              placeholder="4~16 位"
              maxLength={16}
              value={form.passcode}
              onChange={(e) => {
                setCodeTouched(true);
                setForm({ ...form, passcode: e.target.value.trim() });
              }}
            />
            {autoDuplicated && (
              <span className="mt-1.5 block text-xs font-semibold" style={{ color: '#d18d1f' }}>
                后四位和别的老板重复了，口令自动补位成「{autoCode}」——记得告诉这位老板
              </span>
            )}
            {manualDuplicated && (
              <span className="mt-1.5 block text-xs font-semibold" style={{ color: '#d18d1f' }}>
                这个口令和现有老板重复了，建议换一个，不然两位老板会撞车
              </span>
            )}
            <span className="mt-1.5 block text-[11px]" style={{ color: '#9db4c9' }}>
              老板自己也能在进度页改口令（服务器版会自动同步到你这边）
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>托管套餐</span>
              <select className="input-soft" value={form.tier} onChange={(e) => {
                const tier = Number(e.target.value) as Boss['tier'];
                setForm({ ...form, tier, cycleDays: tier === 5 ? 30 : form.cycleDays });
              }}>
                <option value={1}>日体（3r/天）</option>
                <option value={2}>日体 + 周常（90r/月）</option>
                <option value={3}>日体 + 周常 + 大活动（145r/月）</option>
                <option value={4}>全托（235r/月）</option>
                <option value={5}>舰长（日体 + 周常 + 高难 · 30天）</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>托管周期</span>
              <CycleDaysField value={form.cycleDays} onChange={(days) => setForm({ ...form, cycleDays: days })} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>开始日期</span>
            <input type="date" className="input-soft" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>取消</button>
          <button type="button" disabled={!canCreate} className="btn-primary !px-5 !py-2 text-sm" onClick={create}>
            创建并开始登记
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BossEditorLoader({ bossId }: { bossId: string }) {
  const { data } = useStore();
  const boss = data.bosses.find((b) => b.id === bossId);
  if (!boss) return null;
  return <BossEditor boss={boss} />;
}

/* ---------- 底部保存栏 ---------- */
function SaveBar() {
  const { dirty, save, saveState, saveError, github, serverMode, adminKey, data, undo, canUndo, online } = useStore();
  const label = useMemo(() => {
    if (saveState === 'saving') return '保存中…';
    if (saveState === 'saved') {
      if (serverMode && adminKey) return '已保存到服务器，老板刷新即可看到 ✓';
      return github ? '已保存，约1~2分钟后全网生效 ✓' : '已保存到本浏览器 ✓';
    }
    if (saveState === 'error') return '保存失败，点我重试';
    if (serverMode) return adminKey ? '自动保存到服务器' : '保存到本浏览器';
    return github ? '保存并同步到 GitHub' : '保存到本浏览器';
  }, [saveState, github, serverMode, adminKey]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="paper-card flex w-full max-w-3xl items-center gap-2 !rounded-2xl px-3 py-2.5 sm:gap-3 sm:!rounded-full sm:px-5 sm:py-3" style={{ boxShadow: 'var(--shadow-md)' }}>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dirty ? 'bg-[#f2a93b]' : 'bg-[#2fbf8f]'}`} />
        <span className="hidden flex-1 truncate text-xs font-semibold text-[var(--ink-soft)] sm:block">
          {!online ? '当前离线，改动已暂存在本机，联网后会自动同步' : dirty ? '有未保存的改动' : `所有改动已保存 · 更新于 ${new Date(data.updatedAt).toLocaleString('zh-CN')}`}
          {saveState === 'error' && <span style={{ color: '#e05548' }}>（{saveError}）</span>}
        </span>
        {canUndo && <button type="button" onClick={undo} disabled={saveState === 'saving'} className="btn-ghost !px-3 !py-2 text-xs sm:!px-4"><RotateCcw size={14} /> <span className="hidden sm:inline">撤销上一步</span></button>}
        <button type="button" onClick={save} disabled={saveState === 'saving'} className="btn-primary flex-1 !px-4 !py-2 text-sm sm:flex-none sm:!px-5">
          <CloudUpload size={15} /> <span className="sm:hidden">{saveState === 'saving' ? '保存中…' : saveState === 'error' ? '重试' : '保存'}</span><span className="hidden sm:inline">{label}</span>
        </button>
      </div>
    </div>
  );
}

/* ---------- 登录门：服务器密码 / GitHub 连接 / 本地模式 ---------- */
function LoginGate({ onBack, onConnected, onKey }: { onBack: () => void; onConnected: (c: GithubConfig) => void; onKey: (key: string) => Promise<void> }) {
  const { serverMode } = useStore();
  const [form, setForm] = useState<GithubConfig>({ token: '', owner: '', repo: '', branch: 'main' });
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const enterServer = async () => {
    setBusy(true);
    setErr('');
    const ok = await checkAdminKey(key.trim());
    setBusy(false);
    if (ok) {
      try {
        await onKey(key.trim());
      } catch {
        setErr('密码正确，但读取后台数据失败，请刷新后重试');
      }
    } else setErr('管理密码不对，想想 docker run 时设的 ADMIN_PASSWORD');
  };

  if (serverMode) {
    return (
      <div className="admin-shell view-swap mx-auto flex min-h-[85vh] max-w-lg flex-col justify-center px-5 pb-24">
        <div className="paper-card rise-in px-7 py-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md" style={{ background: 'linear-gradient(135deg,#45a9ff,#1e8bf0)' }}>
            <KeyRound size={26} />
          </span>
          <h2 className="font-display mt-4 text-center text-2xl" style={{ color: '#22405c' }}>托管小哥，输密码上岗</h2>
          <p className="mt-2 text-center text-sm leading-relaxed" style={{ color: '#7e96ad' }}>
            这是服务器版，数据都存在服务器上，不需要 GitHub。
            输入启动容器时设置的管理密码（ADMIN_PASSWORD）即可进入后台。
          </p>
          <label className="mt-6 block">
            <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>管理密码</span>
            <input
              className="input-soft"
              type="password"
              placeholder="输入部署时设置的管理密码"
              value={key}
              autoFocus
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && key.trim() && enterServer()}
            />
          </label>
          {err && <p className="mt-3 text-sm font-semibold" style={{ color: '#e05548' }}>{err}</p>}
          <button type="button" disabled={busy || !key.trim()} onClick={enterServer} className="btn-primary mt-6 w-full">
            {busy ? '验证中…' : '进入后台'}
          </button>
          <button type="button" onClick={onBack} className="mt-4 w-full text-center text-xs font-semibold" style={{ color: '#8aa2b8' }}>
            <ArrowLeft size={12} className="mr-1 inline" />返回首页
          </button>
        </div>
      </div>
    );
  }

  const connect = async () => {
    setBusy(true);
    setErr('');
    try {
      const full = await testConnection(form);
      onConnected(form);
      void full;
    } catch (e) {
      setErr(e instanceof Error ? e.message : '连接失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-shell view-swap mx-auto flex min-h-[85vh] max-w-lg flex-col justify-center px-5 pb-24">
      <div className="paper-card rise-in px-7 py-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md" style={{ background: 'linear-gradient(135deg,#45a9ff,#1e8bf0)' }}>
          <Github size={26} />
        </span>
        <h2 className="font-display mt-4 text-center text-2xl" style={{ color: '#22405c' }}>托管小哥，连接仓库</h2>
        <p className="mt-2 text-center text-sm leading-relaxed" style={{ color: '#7e96ad' }}>
          填入 GitHub 令牌后，你登记的数据会写回仓库，老板刷新网页就能看到。
          只需配置一次，浏览器会记住。
        </p>
        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>GitHub 令牌（Token，需 Contents 读写权限）</span>
            <input className="input-soft" type="password" placeholder="ghp_… 或 github_pat_…" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value.trim() })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>你的用户名</span>
              <input className="input-soft" placeholder="例如 zhubai" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value.trim() })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>仓库名</span>
              <input className="input-soft" placeholder="例如 wuwa-ght" value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value.trim() })} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>分支</span>
            <input className="input-soft" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value.trim() || 'main' })} />
          </label>
        </div>
        {err && <p className="mt-3 text-sm font-semibold" style={{ color: '#e05548' }}>{err}</p>}
        <button type="button" disabled={busy || !form.token || !form.owner || !form.repo} onClick={connect} className="btn-primary mt-6 w-full">
          {busy ? '连接中…' : '连接并进入后台'}
        </button>
        <button type="button" onClick={onBack} className="mt-4 w-full text-center text-xs font-semibold" style={{ color: '#8aa2b8' }}>
          <ArrowLeft size={12} className="mr-1 inline" />返回首页
        </button>
      </div>
    </div>
  );
}
