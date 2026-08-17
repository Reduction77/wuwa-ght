import type { Boss } from '@/types';
import { TIER_LABEL } from '@/types';
import { bossStats, currentWeekIndex, cycleDayIndex, cycleEndDate, cycleWeeks, fmtCN, todayStr, weekRange } from '@/lib/dates';
import DayGrid from '@/components/DayGrid';
import EventCard from '@/components/EventCard';
import ProgressRing from '@/components/ProgressRing';
import { BatteryCharging, CalendarCheck2, Gift, Sparkles, Swords, Ticket } from 'lucide-react';

interface Props {
  boss: Boss;
}

/** 老板视角的托管进度（只读） */
export default function BossProgress({ boss }: Props) {
  const stats = bossStats(boss);
  const dayNow = cycleDayIndex(boss);
  const weeks = cycleWeeks(boss);
  const curWeek = currentWeekIndex(boss);
  const ended = todayStr() > cycleEndDate(boss);
  const notStarted = dayNow <= 0;

  return (
    <div className="space-y-5">
      {/* 总览 */}
      <div className="paper-card rise-in rise-in-1 flex flex-wrap items-center gap-6 px-6 py-6">
        <ProgressRing percent={stats.overall} label="总体进度" />
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl" style={{ color: '#22405c' }}>
              {boss.name}
            </h2>
            <span className="chip" style={{ background: '#e7f3ff', color: '#2a7fd4' }}>
              {TIER_LABEL[boss.tier]}
            </span>
            <span className="chip" style={{ background: '#eef9f3', color: '#1d9e74' }}>
              {boss.cycleDays === 42 ? '一个版本 · 42天' : boss.cycleDays === 30 ? '30天周期' : `${boss.cycleDays}天周期`}
            </span>
            {ended && (
              <span className="chip" style={{ background: '#efe9fb', color: '#7c5cc9' }}>本周期已结束</span>
            )}
          </div>
          <p className="mt-2 text-sm" style={{ color: '#6b86a1' }}>
            托管时间：{fmtCN(boss.startDate)} ~ {fmtCN(cycleEndDate(boss))}
            {ended ? '' : notStarted ? ' · 尚未开始' : ` · 今天是第 ${dayNow} 天`}
          </p>
          {boss.note && (
            <p className="mt-2 rounded-xl px-3 py-2 text-sm" style={{ background: '#f0f7ff', color: '#5b7a97' }}>
              备注：{boss.note}
            </p>
          )}
        </div>
      </div>

      {/* 每日体力 */}
      <section className="paper-card rise-in rise-in-2 px-6 py-6">
        <SectionHead
          icon={<BatteryCharging size={20} />}
          title="每日体力"
          desc={`每天清一次 · 已完成 ${stats.dailyDone} / ${boss.cycleDays} 天`}
        />
        <MiniBar percent={(stats.dailyDone / boss.cycleDays) * 100} />
        <div className="mt-4">
          <DayGrid boss={boss} />
        </div>
      </section>

      {/* 每周周常 */}
      {boss.tier >= 2 && (
        <section className="paper-card rise-in rise-in-3 px-6 py-6">
          <SectionHead
            icon={<CalendarCheck2 size={20} />}
            title="每周周常"
            desc={`每周清一次 · 已完成 ${stats.weeklyDone} / ${weeks} 周`}
          />
          <MiniBar percent={(stats.weeklyDone / weeks) * 100} />
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: weeks }, (_, i) => {
              const done = boss.weekly.includes(i);
              const range = weekRange(boss, i);
              const isCur = i === curWeek && !ended;
              return (
                <div
                  key={i}
                  className={[
                    'rounded-xl border px-3 py-2.5 text-center transition-all duration-300',
                    done
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-[#d9e9f9] bg-white text-[#7e96ad]',
                    isCur && !done ? 'today-breathe ring-2 ring-[#45a9ff]' : '',
                  ].join(' ')}
                  style={done ? { background: 'linear-gradient(135deg,#45c6a5,#2fbf8f)' } : undefined}
                >
                  <p className="text-sm font-extrabold">第 {i + 1} 周</p>
                  <p className={`mt-0.5 text-[10px] ${done ? 'text-white/85' : 'text-[#9db4c9]'}`}>
                    {fmtCN(range.from)}~{fmtCN(range.to)}
                  </p>
                  <p className={`mt-1 text-[11px] font-bold ${done ? 'text-white' : isCur ? 'text-[#1e8bf0]' : ''}`}>
                    {done ? '✓ 已清' : isCur ? '本周进行中' : '未完成'}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 版本活动 */}
      {boss.tier >= 3 && (
        <section className="paper-card rise-in rise-in-3 px-6 py-6">
          <SectionHead
            icon={<Sparkles size={20} />}
            title="版本活动"
            desc={boss.tier >= 4 ? '每个托管周期 1 个大活动 + 3 个小活动' : '每个托管周期 1 个大活动'}
          />
          <div className="mt-4 space-y-3">
            <EventCard event={boss.bigEvent} badge="版本大活动" />
            {boss.tier >= 4 && (
              <div className="grid gap-3 md:grid-cols-3">
                {boss.smallEvents.map((e, i) => (
                  <EventCard key={i} event={e} badge={`小活动 ${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 挑战任务 */}
      {boss.tier >= 4 && (
        <section className="paper-card rise-in rise-in-4 px-6 py-6">
          <SectionHead icon={<Swords size={20} />} title="周期挑战" desc="每个托管周期各完成一次" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ChallengeRow label="终焉矩阵" done={boss.challenges.matrix} />
            <ChallengeRow label="冥歌海城" done={boss.challenges.sea} />
            <ChallengeRow label="逆境深塔" done={boss.challenges.tower} />
          </div>
        </section>
      )}

      {/* 可选任务 */}
      {(boss.optionals.redeem.enabled || boss.optionals.gacha.enabled) && (
        <section className="paper-card rise-in rise-in-5 px-6 py-6">
          <SectionHead icon={<Gift size={20} />} title="其他小委托" desc="按需要开启的额外委托" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {boss.optionals.redeem.enabled && (
              <ChallengeRow label="兑换前瞻兑换码" done={boss.optionals.redeem.done} icon={<Ticket size={18} />} />
            )}
            {boss.optionals.gacha.enabled && (
              <ChallengeRow label="购买当前版本抽卡道具" done={boss.optionals.gacha.done} icon={<Gift size={18} />} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHead({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg,#45a9ff,#1e8bf0)' }}>
        {icon}
      </span>
      <h3 className="font-display text-xl" style={{ color: '#22405c' }}>
        {title}
      </h3>
      {desc && <span className="text-xs font-semibold" style={{ color: '#8aa2b8' }}>{desc}</span>}
    </div>
  );
}

function MiniBar({ percent }: { percent: number }) {
  const p = Math.min(percent, 100);
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: '#e3effc' }}>
      <div className="bar-fill h-full rounded-full" style={{ width: `${p}%`, background: 'linear-gradient(90deg,#45a9ff,#1e8bf0)' }} />
    </div>
  );
}

function ChallengeRow({ label, done, icon }: { label: string; done: boolean; icon?: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-300"
      style={
        done
          ? { background: '#eef9f3', borderColor: '#bfe9d8' }
          : { background: '#fff', borderColor: '#d9e9f9' }
      }
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={done ? { background: '#2fbf8f', color: '#fff' } : { background: '#eef5fc', color: '#8aa2b8' }}
      >
        {icon ?? <Swords size={18} />}
      </span>
      <span className={`flex-1 font-bold ${done ? 'text-[#1d9e74]' : 'text-[#2b3f54]'}`}>{label}</span>
      <span
        className="chip"
        style={done ? { background: '#d6f4e7', color: '#1d9e74' } : { background: '#fdf3e3', color: '#d18d1f' }}
      >
        {done ? '已完成' : '未完成'}
      </span>
    </div>
  );
}
