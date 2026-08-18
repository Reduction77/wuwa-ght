import type { Boss } from '@/types';
import { TIER_LABEL } from '@/types';
import { bossStats, currentWeekIndex, cycleDayIndex, cycleEndDate, cycleWeeks, fmtCN, todayStr, weekRange } from '@/lib/dates';
import DayGrid from '@/components/DayGrid';
import {
  AlertTriangle,
  BatteryCharging,
  CalendarCheck2,
  Check,
  Circle,
  Clock3,
  Gift,
  History,
  Sparkles,
  Swords,
  Ticket,
} from 'lucide-react';

interface Props {
  boss: Boss;
}

interface DisplayTask {
  id: string;
  label: string;
  meta?: string;
  done: boolean;
  image?: string;
  icon: React.ReactNode;
}

/** 老板视角：先回答今天、本周、本版本，再按需展开详细记录。 */
export default function BossProgress({ boss }: Props) {
  const stats = bossStats(boss);
  const today = todayStr();
  const dayNow = cycleDayIndex(boss);
  const weeks = cycleWeeks(boss);
  const curWeek = currentWeekIndex(boss);
  const endDate = cycleEndDate(boss);
  const ended = today > endDate;
  const notStarted = dayNow <= 0;
  const dailyDone = boss.daily.includes(today);
  const currentWeekKey = curWeek >= 0 ? weekRange(boss, curWeek).from : '';
  const weeklyDone = !!currentWeekKey && boss.weekly.includes(currentWeekKey);
  const cyclePercent = notStarted ? 0 : Math.min(100, Math.round((dayNow / boss.cycleDays) * 100));
  const versionTasks = buildVersionTasks(boss);
  const versionDone = versionTasks.filter((task) => task.done).length;

  const todayState = !boss.services.daily
    ? { value: '无需日常', meta: '本次套餐未包含每日体力', done: true }
    : notStarted
      ? { value: '尚未开始', meta: `${fmtCN(boss.startDate)}开始托管`, done: true }
      : ended
        ? { value: '周期已结束', meta: `结束于${fmtCN(endDate)}`, done: true }
        : dailyDone
          ? { value: '今日已完成', meta: '记录已更新，放心游玩', done: true }
          : { value: '等待今日登记', meta: '每日凌晨4点刷新', done: false };

  const weekState = !boss.services.weekly
    ? { value: '无需周常', meta: '本次套餐未包含周常', done: true }
    : curWeek < 0
      ? { value: ended ? '周期已结束' : '尚未开始', meta: `${stats.weeklyDone}/${weeks}周已完成`, done: true }
      : weeklyDone
        ? { value: '本周已完成', meta: `${stats.weeklyDone}/${weeks}周已完成`, done: true }
        : { value: '本周进行中', meta: `${stats.weeklyDone}/${weeks}周已完成`, done: false };

  return (
    <div className="space-y-4">
      <section className="resonance-panel rise-in px-5 py-5 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow text-[#4f8fbe]">WUTHERING WAVES · 托管进度</p>
            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
              <h2 className="font-display text-3xl text-[var(--ink)] sm:text-4xl">{boss.name}</h2>
              <span className="mb-1 rounded-full border border-[#bedaf0] bg-white/65 px-3 py-1 text-xs font-bold text-[#367caf]">
                {TIER_LABEL[boss.tier]}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              {fmtCN(boss.startDate)}—{fmtCN(endDate)}
              {ended ? ' · 本周期已结束' : notStarted ? ' · 尚未开始' : ` · 第${dayNow}/${boss.cycleDays}天`}
              {boss.excludedDays.length > 0 ? ` · 已暂停顺延${boss.excludedDays.length}天` : ''}
            </p>
          </div>
          <div className="flex items-baseline gap-2 lg:text-right">
            <strong className="font-display text-5xl leading-none text-[var(--signal-strong)] sm:text-6xl">{stats.overall}%</strong>
            <span className="text-xs font-bold text-[var(--muted-text)]">总体完成</span>
          </div>
        </div>

        <div className="mt-5 cycle-rail" aria-label={`托管周期已进行${cyclePercent}%`}>
          <span style={{ width: `${cyclePercent}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold text-[var(--muted-text)]">
          <span>开始 · {fmtCN(boss.startDate)}</span>
          <span>{ended ? '已结束' : `周期 ${cyclePercent}%`} · {fmtCN(endDate)}</span>
        </div>

        <div className="signal-grid mt-6">
          <SummarySignal label="今天" value={todayState.value} meta={todayState.meta} done={todayState.done} />
          <SummarySignal label="本周" value={weekState.value} meta={weekState.meta} done={weekState.done} />
          <SummarySignal
            label="本版本 / 任务"
            value={versionTasks.length ? `${versionDone}/${versionTasks.length}项完成` : '暂无版本任务'}
            meta={versionTasks.length ? `总体完成度 ${stats.overall}%` : '当前无需额外处理'}
            done={!versionTasks.length || versionDone === versionTasks.length}
          />
        </div>

        {boss.note && <p className="mt-5 rounded-xl border border-[#c8dff2] bg-white/55 px-4 py-3 text-sm leading-relaxed text-[var(--ink-soft)]">托管备注：{boss.note}</p>}
      </section>

      {boss.issue.kind !== 'none' && (
        <div className="rise-in flex items-start gap-3 rounded-2xl border border-[#ead39d] bg-[#fff8e8] px-5 py-4">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[var(--warning)]" />
          <div>
            <p className="font-bold text-[#845814]">当前托管遇到情况</p>
            <p className="mt-1 text-sm text-[#8e713e]">{boss.issue.message || '托管小哥正在处理中，有进展会及时更新。'}</p>
          </div>
        </div>
      )}

      {boss.services.daily && boss.show.daily && (
        <ProgressSection
          icon={<BatteryCharging size={19} />}
          title="每日体力记录"
          summary={`${stats.dailyDone}/${boss.cycleDays}天 · 凌晨4点刷新`}
          defaultOpen
        >
          <ProgressBar percent={(stats.dailyDone / boss.cycleDays) * 100} />
          <p className="mb-4 mt-2 text-xs text-[var(--ink-soft)]">
            截至今天应完成 {stats.dailyElapsed} 天，实际记录 {stats.dailyDone} 天
          </p>
          <DayGrid boss={boss} />
        </ProgressSection>
      )}

      {boss.services.weekly && boss.show.weekly && (
        <ProgressSection
          icon={<CalendarCheck2 size={19} />}
          title="每周周常记录"
          summary={`${stats.weeklyDone}/${weeks}周完成`}
        >
          <ProgressBar percent={(stats.weeklyDone / weeks) * 100} />
          <div className="task-list mt-4">
            {Array.from({ length: weeks }, (_, index) => {
              const range = weekRange(boss, index);
              const done = boss.weekly.includes(range.from);
              const isCurrent = index === curWeek && !ended;
              return (
                <TaskRow
                  key={range.from}
                  label={`第 ${index + 1} 周`}
                  meta={`${fmtCN(range.from)}—${fmtCN(range.to)}${isCurrent ? ' · 本周' : ''}`}
                  done={done}
                  icon={<CalendarCheck2 size={14} />}
                />
              );
            })}
          </div>
        </ProgressSection>
      )}

      {versionTasks.length > 0 && (
        <ProgressSection
          icon={<Sparkles size={19} />}
          title="版本与委托任务"
          summary={`${versionDone}/${versionTasks.length}项完成`}
          defaultOpen={versionDone < versionTasks.length}
        >
          <ProgressBar percent={(versionDone / versionTasks.length) * 100} />
          <div className="task-list mt-4">
            {versionTasks.map((task) => <TaskRow key={task.id} {...task} />)}
          </div>
        </ProgressSection>
      )}

      {boss.cycleHistory.length > 0 && (
        <ProgressSection icon={<History size={19} />} title="历史托管周期" summary={`${boss.cycleHistory.length}个历史周期`}>
          <div className="task-list">
            {[...boss.cycleHistory].reverse().map((cycle) => (
              <div key={cycle.id} className="task-row items-start">
                <span className="task-check"><Clock3 size={14} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--ink)]">{fmtCN(cycle.startDate)}起 · {cycle.cycleDays}天</p>
                  <p className="mt-1 text-xs text-[var(--muted-text)]">日常 {cycle.daily.length}/{cycle.cycleDays}天 · 周常 {cycle.weekly.length}周</p>
                </div>
              </div>
            ))}
          </div>
        </ProgressSection>
      )}
    </div>
  );
}

function SummarySignal({ label, value, meta, done }: { label: string; value: string; meta: string; done: boolean }) {
  return (
    <div className="signal-stat">
      <div className="flex items-center gap-2">
        <span className={`signal-dot ${done ? '' : 'pending'}`} />
        <span className="signal-stat__label">{label}</span>
      </div>
      <p className="signal-stat__value">{value}</p>
      <p className="signal-stat__meta">{meta}</p>
    </div>
  );
}

function ProgressSection({
  icon,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="progress-section rise-in" open={defaultOpen}>
      <summary>
        <span className="section-icon">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-[var(--ink)]">{title}</span>
          <span className="mt-0.5 block text-xs text-[var(--muted-text)]">{summary}</span>
        </span>
      </summary>
      <div className="progress-section__body">{children}</div>
    </details>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const value = Math.min(100, Math.max(0, percent));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill h-full rounded-full bg-gradient-to-r from-[#45a9ff] to-[#1e8bf0]" style={{ width: `${value}%` }} />
    </div>
  );
}

function TaskRow({ label, meta, done, image, icon }: Omit<DisplayTask, 'id'>) {
  return (
    <div className={`task-row ${done ? 'is-done' : ''}`}>
      {image ? <img src={image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy" /> : <span className="task-check">{done ? <Check size={15} strokeWidth={3} /> : icon}</span>}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-bold ${done ? 'text-[var(--success)]' : 'text-[var(--ink)]'}`}>{label}</p>
        {meta && <p className="mt-0.5 truncate text-[11px] text-[var(--muted-text)]">{meta}</p>}
      </div>
      <span className={`shrink-0 text-xs font-bold ${done ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>{done ? '已完成' : '待完成'}</span>
    </div>
  );
}

function buildVersionTasks(boss: Boss): DisplayTask[] {
  const tasks: DisplayTask[] = [];
  const eventMeta = (openDate?: string, deadline?: string) => [openDate && `${fmtCN(openDate)}开放`, deadline && `${fmtCN(deadline)}截止`].filter(Boolean).join(' · ') || undefined;

  if (boss.services.bigEvent && boss.show.bigEvent) {
    tasks.push({ id: 'big-event', label: boss.bigEvent.name || '版本大活动', meta: eventMeta(boss.bigEvent.openDate, boss.bigEvent.deadline), done: boss.bigEvent.done, image: boss.bigEvent.image, icon: <Sparkles size={14} /> });
  }
  if (boss.services.smallEvents && boss.show.bigEvent) {
    boss.smallEvents.forEach((event, index) => tasks.push({ id: `small-event-${index}`, label: event.name || `版本小活动 ${index + 1}`, meta: eventMeta(event.openDate, event.deadline), done: event.done, image: event.image, icon: <Sparkles size={14} /> }));
  }
  const challenges: Array<[keyof Boss['challenges'], string]> = [
    ['matrix', '终焉矩阵'],
    ['sea', '冥歌海墟'],
    ['tower', '逆境深塔'],
    ['holo', '全息投影'],
  ];
  challenges.forEach(([key, label]) => {
    const task = boss.challenges[key];
    if (task.enabled) tasks.push({ id: `challenge-${key}`, label, meta: '高难挑战', done: task.done, icon: <Swords size={14} /> });
  });
  if (boss.optionals.redeem.enabled) tasks.push({ id: 'redeem', label: '兑换前瞻兑换码', meta: '其他小委托', done: boss.optionals.redeem.done, icon: <Ticket size={14} /> });
  if (boss.optionals.gacha.enabled) tasks.push({ id: 'gacha', label: '购买当前版本抽卡道具', meta: '其他小委托', done: boss.optionals.gacha.done, icon: <Gift size={14} /> });
  boss.extraTasks.filter((task) => task.visible).forEach((task) => tasks.push({ id: `extra-${task.id}`, label: task.name, meta: '临时加项', done: task.done, icon: <Circle size={14} /> }));
  return tasks;
}
