import { tierServices, type Boss, type EventItem } from '@/types';
import { useStore } from '@/lib/store';
import DayGrid from '@/components/DayGrid';
import EventCard from '@/components/EventCard';
import { addDays, cycleWeeks, currentWeekIndex, fmtCN, todayStr, weekRange } from '@/lib/dates';
import { uploadRemoteImage } from '@/lib/github';
import { uploadServerImage } from '@/lib/server';
import { CheckCircle2, Circle, ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  boss: Boss;
}

/** 后台：单个老板的完整编辑器 */
export default function BossEditor({ boss }: Props) {
  const { data, mutateBoss, renewBoss, github } = useStore();
  const [eventEdit, setEventEdit] = useState<null | { kind: 'big' | number }>(null);
  const [newTaskName, setNewTaskName] = useState('');

  const toggleDaily = (date: string) =>
    mutateBoss(boss.id, (b) => ({
      ...b,
      daily: b.daily.includes(date) ? b.daily.filter((d) => d !== date) : [...b.daily, date].sort(),
    }), { action: boss.daily.includes(date) ? '撤销日常打卡' : '完成日常打卡', detail: date });

  const toggleWeek = (i: number) =>
    mutateBoss(boss.id, (b) => {
      const key = weekRange(b, i).from;
      return {
        ...b,
        weekly: b.weekly.includes(key) ? b.weekly.filter((w) => w !== key) : [...b.weekly, key].sort(),
      };
    }, { action: boss.weekly.includes(weekRange(boss, i).from) ? '撤销周常打卡' : '完成周常打卡', detail: weekRange(boss, i).from });

  const setChallenge = (key: 'matrix' | 'sea' | 'tower' | 'holo', patch: Partial<{ enabled: boolean; done: boolean }>) =>
    mutateBoss(boss.id, (b) => ({ ...b, challenges: { ...b.challenges, [key]: { ...b.challenges[key], ...patch } } }));

  const today = todayStr();
  const todayDone = boss.daily.includes(today);
  const weeks = cycleWeeks(boss);
  const curWeekIdx = currentWeekIndex(boss);
  const currentWeekKey = curWeekIdx >= 0 ? weekRange(boss, curWeekIdx).from : '';
  const weekDone = !!currentWeekKey && boss.weekly.includes(currentWeekKey);
  const ended = today > addDays(boss.startDate, boss.cycleDays - 1);
  const notStarted = today < boss.startDate;
  const canQuickLog = !ended && !notStarted && boss.issue.kind !== 'paused';
  const duplicatePasscode = data.bosses.some((item) => item.id !== boss.id && item.passcode === boss.passcode);

  return (
    <div className="space-y-5">
      {/* 已到期提示 + 同版本续期 */}
      {ended && (
        <div className="paper-card flex flex-wrap items-center gap-3 px-6 py-5" style={{ background: 'rgba(250,246,255,0.92)', borderColor: '#e2d5f8' }}>
          <div className="mr-auto">
            <p className="font-display text-lg" style={{ color: '#5b3f8f' }}>本周期已到期</p>
            <p className="text-xs" style={{ color: '#9a86bd' }}>同一版本内续费时，从今天开始新的日常周期；只清空日常打卡，本周周常、活动和挑战状态全部保留</p>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg,#a78bfa,#7c5cc9)', boxShadow: '0 8px 24px -8px rgba(124,92,201,0.55)' }}
            onClick={() => {
              if (confirm(`确定从 today 开始为「${boss.name}」续期吗？只会清空日常打卡，本周周常、活动和挑战状态都会保留。`.replace('today', fmtCN(today)))) {
                renewBoss(boss.id);
              }
            }}
          >
            <RotateCcw size={16} /> 同版本续期（{fmtCN(today)} 起）
          </button>
        </div>
      )}

      {/* 今日快捷登记 */}
      <div className="paper-card flex flex-wrap items-center gap-3 px-6 py-5">
        <div className="mr-auto">
          <p className="font-display text-lg" style={{ color: '#22405c' }}>今日快捷登记</p>
          <p className="text-xs" style={{ color: '#8aa2b8' }}>每天点这两下就完事；每日记录按北京时间凌晨 4 点刷新</p>
        </div>
        <button
          type="button"
          disabled={!canQuickLog}
          onClick={() => toggleDaily(today)}
          className={todayDone ? 'btn-ghost' : 'btn-primary'}
        >
          {todayDone ? <CheckCircle2 size={17} /> : <Circle size={17} />}
          {todayDone ? '今日体力已清 ✓ 点我撤销' : `打卡：今日体力已清（${fmtCN(today)}）`}
        </button>
        {boss.services.weekly && curWeekIdx >= 0 && (
          <button
            type="button"
            disabled={!canQuickLog}
            onClick={() => toggleWeek(curWeekIdx)}
            className={weekDone ? 'btn-ghost' : 'btn-primary'}
            style={weekDone ? undefined : { background: 'linear-gradient(135deg,#45c6a5,#2fbf8f)', boxShadow: '0 8px 24px -8px rgba(47,191,143,0.55)' }}
          >
            {weekDone ? <CheckCircle2 size={17} /> : <Circle size={17} />}
            {weekDone ? '本周周常已清 ✓ 点我撤销' : `打卡：本周周常已清（第 ${curWeekIdx + 1} 周）`}
          </button>
        )}
        {!canQuickLog && <p className="w-full text-right text-[11px] font-semibold text-[#d18d1f]">{boss.issue.kind === 'paused' ? '当前已暂停托管，快捷登记已锁定' : notStarted ? '托管周期尚未开始' : '周期已结束，请先续期再登记'}</p>}
      </div>

      {/* 基本设置 */}
      <section className="paper-card px-6 py-6">
        <h3 className="font-display text-lg" style={{ color: '#22405c' }}>老板信息与套餐</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="老板称呼">
            <input className="input-soft" value={boss.name} onChange={(e) => mutateBoss(boss.id, (b) => ({ ...b, name: e.target.value }))} />
          </Field>
          <Field label="账号（可打码）">
            <input className="input-soft" value={boss.account} onChange={(e) => mutateBoss(boss.id, (b) => ({ ...b, account: e.target.value }))} />
          </Field>
          <Field label="查看口令（默认手机后四位，老板想要自定义就直接改）">
            <input className="input-soft font-bold tracking-widest" value={boss.passcode} onChange={(e) => mutateBoss(boss.id, (b) => ({ ...b, passcode: e.target.value.trim() }))} />
            {duplicatePasscode && <span className="mt-1 block text-xs font-bold text-[#e05548]">口令与其他老板重复，保存会被阻止</span>}
          </Field>
          <Field label="托管套餐">
            <select className="input-soft" value={boss.tier} onChange={(e) => mutateBoss(boss.id, (b) => {
              const tier = Number(e.target.value) as Boss['tier'];
              return { ...b, tier, services: tierServices(tier) };
            })}>
              <option value={1}>日体（3r/天）</option>
              <option value={2}>日体 + 周常（90r/月）</option>
              <option value={3}>日体 + 周常 + 大活动（145r/月）</option>
              <option value={4}>全托（235r/月）</option>
              <option value={5}>舰长（日体 + 周常 + 高难 · 30天）</option>
            </select>
          </Field>
          <Field label="托管周期">
            <CycleDaysPicker
              value={boss.cycleDays}
              onChange={(days) => mutateBoss(boss.id, (b) => ({ ...b, cycleDays: days }))}
            />
          </Field>
          <Field label="开始日期">
            <input type="date" className="input-soft" value={boss.startDate} onChange={(e) => e.target.value && mutateBoss(boss.id, (b) => ({ ...b, startDate: e.target.value }))} />
          </Field>
        </div>
        <Field label="备注（老板可见）" className="mt-3">
          <input className="input-soft" placeholder="例如：体力优先刷XX本" value={boss.note} onChange={(e) => mutateBoss(boss.id, (b) => ({ ...b, note: e.target.value }))} />
        </Field>
        <Field label="内部备注（仅后台可见）" className="mt-3">
          <textarea className="input-soft min-h-20 resize-y" placeholder="例如：登录注意事项、沟通记录，不会展示给老板" value={boss.internalNote} onChange={(e) => mutateBoss(boss.id, (b) => ({ ...b, internalNote: e.target.value }))} />
        </Field>
        <Field label="标签（用逗号分隔）" className="mt-3">
          <input className="input-soft" placeholder="长期客户, 材料优先, 需要验证码" value={boss.tags.join(', ')} onChange={(e) => mutateBoss(boss.id, (b) => ({ ...b, tags: e.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) }))} />
        </Field>
        <div className="mt-4 rounded-2xl border border-[#d9e9f9] bg-[#f8fbff] p-4">
          <p className="text-sm font-bold" style={{ color: '#22405c' }}>实际服务项目</p>
          <p className="mt-1 text-[11px]" style={{ color: '#8aa2b8' }}>套餐只是模板，这里可以按老板的真实订单单独增减</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ['daily', '每日体力'], ['weekly', '每周周常'], ['bigEvent', '版本大活动'], ['smallEvents', '版本小活动'],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => mutateBoss(boss.id, (b) => ({ ...b, services: { ...b.services, [key]: !b.services[key] } }))}
                className="chip" style={boss.services[key] ? { background: '#d6f4e7', color: '#1d9e74' } : { background: '#eef3f9', color: '#8aa2b8' }}>
                {boss.services[key] ? '✓ ' : ''}{label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
          <Field label="当前异常状态">
            <select className="input-soft" value={boss.issue.kind} onChange={(e) => mutateBoss(boss.id, (b) => ({ ...b, issue: { ...b.issue, kind: e.target.value as Boss['issue']['kind'], updatedAt: new Date().toISOString() } }))}>
              <option value="none">正常</option>
              <option value="login">登录失败</option>
              <option value="verification">需要验证码</option>
              <option value="maintenance">服务器维护</option>
              <option value="waiting">等待老板操作</option>
              <option value="paused">暂停托管</option>
            </select>
          </Field>
          <Field label="异常说明（老板可见）">
            <input className="input-soft" disabled={boss.issue.kind === 'none'} placeholder="说明原因或需要老板做什么" value={boss.issue.message} onChange={(e) => mutateBoss(boss.id, (b) => ({ ...b, issue: { ...b.issue, message: e.target.value, updatedAt: new Date().toISOString() } }))} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost !px-4 !py-2 text-xs" disabled={boss.excludedDays.some((item) => item.date === today)} onClick={() => mutateBoss(boss.id, (b) => ({
            ...b,
            daily: b.daily.filter((date) => date !== today),
            excludedDays: [...b.excludedDays, { date: today, reason: b.issue.message || '暂停托管' }],
            issue: { ...b.issue, kind: 'paused', updatedAt: new Date().toISOString() },
          }), { action: '暂停并顺延一天', detail: today })}>{boss.excludedDays.some((item) => item.date === today) ? '今天已暂停并顺延' : '今天暂停并顺延1天'}</button>
          {[1, 3].map((days) => <button key={days} type="button" className="btn-ghost !px-4 !py-2 text-xs" onClick={() => mutateBoss(boss.id, (b) => ({ ...b, cycleDays: Math.min(365, b.cycleDays + days) }), { action: '增加补偿天数', detail: `+${days} 天` })}>补偿 +{days} 天</button>)}
        </div>
      </section>

      {/* 每日体力 */}
      <section className="paper-card px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg" style={{ color: '#22405c' }}>每日体力登记</h3>
            <p className="mt-1 text-xs" style={{ color: '#8aa2b8' }}>点格子即可补登 / 撤销，蓝色 = 已清</p>
          </div>
          <ShowSwitch
            on={boss.show.daily}
            onChange={(v) => mutateBoss(boss.id, (b) => ({ ...b, show: { ...b.show, daily: v } }))}
          />
        </div>
        <div className="mt-4">
          <DayGrid boss={boss} editable onToggleDay={toggleDaily} />
        </div>
      </section>

      {/* 临时加项 */}
      <section className="paper-card px-6 py-6">
        <h3 className="font-display text-lg" style={{ color: '#22405c' }}>临时加项</h3>
        <p className="mt-1 text-xs" style={{ color: '#8aa2b8' }}>记录抽卡、临时刷材料等不属于固定套餐的一次性任务</p>
        <div className="mt-4 flex gap-2">
          <input className="input-soft" placeholder="输入任务名称" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} onKeyDown={(e) => {
            if (e.key !== 'Enter' || !newTaskName.trim()) return;
            mutateBoss(boss.id, (b) => ({ ...b, extraTasks: [...b.extraTasks, { id: `task-${Date.now()}`, name: newTaskName.trim(), done: false, visible: true, createdAt: new Date().toISOString() }] }));
            setNewTaskName('');
          }} />
          <button type="button" className="btn-primary shrink-0" disabled={!newTaskName.trim()} onClick={() => {
            mutateBoss(boss.id, (b) => ({ ...b, extraTasks: [...b.extraTasks, { id: `task-${Date.now()}`, name: newTaskName.trim(), done: false, visible: true, createdAt: new Date().toISOString() }] }));
            setNewTaskName('');
          }}>添加</button>
        </div>
        <div className="mt-3 space-y-2">
          {boss.extraTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 rounded-xl border border-[#d9e9f9] bg-white px-4 py-3">
              <button type="button" onClick={() => mutateBoss(boss.id, (b) => ({ ...b, extraTasks: b.extraTasks.map((item) => item.id === task.id ? { ...item, done: !item.done, doneAt: !item.done ? new Date().toISOString() : undefined } : item) }))}>
                {task.done ? <CheckCircle2 size={20} className="text-[#2fbf8f]" /> : <Circle size={20} className="text-[#b9d2e8]" />}
              </button>
              <span className={`flex-1 text-sm font-bold ${task.done ? 'line-through text-[#8aa2b8]' : 'text-[#2b3f54]'}`}>{task.name}</span>
              <button type="button" className="text-xs font-bold text-[#7e96ad]" onClick={() => mutateBoss(boss.id, (b) => ({ ...b, extraTasks: b.extraTasks.map((item) => item.id === task.id ? { ...item, visible: !item.visible } : item) }))}>{task.visible ? '老板可见' : '仅后台'}</button>
              <button type="button" aria-label="删除临时任务" className="text-[#e05548]" onClick={() => mutateBoss(boss.id, (b) => ({ ...b, extraTasks: b.extraTasks.filter((item) => item.id !== task.id) }))}><Trash2 size={15} /></button>
            </div>
          ))}
          {boss.extraTasks.length === 0 && <p className="py-3 text-center text-xs text-[#9db4c9]">暂无临时加项</p>}
        </div>
      </section>

      {boss.cycleHistory.length > 0 && (
        <section className="paper-card px-6 py-6">
          <h3 className="font-display text-lg" style={{ color: '#22405c' }}>历史托管周期</h3>
          <div className="mt-4 space-y-2">
            {[...boss.cycleHistory].reverse().map((cycle) => (
              <details key={cycle.id} className="rounded-xl border border-[#d9e9f9] bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-bold text-[#2b3f54]">{fmtCN(cycle.startDate)} 起 · {cycle.cycleDays} 天 · 日常 {cycle.daily.length}/{cycle.cycleDays}</summary>
                <p className="mt-2 text-xs text-[#7e96ad]">周常完成 {cycle.weekly.length} 周 · 归档于 {new Date(cycle.endedAt + 'T00:00:00').toLocaleDateString('zh-CN')}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* 周常 */}
      {boss.services.weekly && (
        <section className="paper-card px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg" style={{ color: '#22405c' }}>每周周常登记</h3>
            <ShowSwitch
              on={boss.show.weekly}
              onChange={(v) => mutateBoss(boss.id, (b) => ({ ...b, show: { ...b.show, weekly: v } }))}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: weeks }, (_, i) => {
              const range = weekRange(boss, i);
              const done = boss.weekly.includes(range.from);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleWeek(i)}
                  className={[
                    'rounded-xl border px-3 py-2.5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
                    done ? 'border-transparent text-white' : 'border-[#d9e9f9] bg-white text-[#7e96ad]',
                  ].join(' ')}
                  style={done ? { background: 'linear-gradient(135deg,#45c6a5,#2fbf8f)' } : undefined}
                >
                  <p className="text-sm font-extrabold">第 {i + 1} 周</p>
                  <p className={`mt-0.5 text-[10px] ${done ? 'text-white/85' : 'text-[#9db4c9]'}`}>
                    {fmtCN(range.from)}~{fmtCN(range.to)}
                  </p>
                  <p className={`mt-1 text-[11px] font-bold ${done ? 'text-white' : ''}`}>{done ? '✓ 已清' : '点我打卡'}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 活动 */}
      {boss.services.bigEvent && (
        <section className="paper-card px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg" style={{ color: '#22405c' }}>版本活动登记</h3>
              <p className="mt-1 text-xs" style={{ color: '#8aa2b8' }}>点「编辑」可改活动名称和图片；不上传图片时老板端不会留空白框</p>
            </div>
            <ShowSwitch
              on={boss.show.bigEvent}
              onChange={(v) => mutateBoss(boss.id, (b) => ({ ...b, show: { ...b.show, bigEvent: v } }))}
            />
          </div>
          <div className="mt-4 space-y-3">
            <EventCard event={boss.bigEvent} badge="版本大活动" editable onToggle={() => mutateBoss(boss.id, (b) => ({ ...b, bigEvent: { ...b.bigEvent, done: !b.bigEvent.done } }))} onEdit={() => setEventEdit({ kind: 'big' })} />
            {boss.services.smallEvents && (
              <div className="grid gap-3 md:grid-cols-3">
                {boss.smallEvents.map((e, i) => (
                  <EventCard
                    key={i}
                    event={e}
                    badge={`小活动 ${i + 1}`}
                    editable
                    onToggle={() =>
                      mutateBoss(boss.id, (b) => {
                        const arr = [...b.smallEvents];
                        arr[i] = { ...arr[i], done: !arr[i].done };
                        return { ...b, smallEvents: arr };
                      })
                    }
                    onEdit={() => setEventEdit({ kind: i })}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 高难挑战：开启后老板才看得见 */}
      <section className="paper-card px-6 py-6">
        <h3 className="font-display text-lg" style={{ color: '#22405c' }}>高难挑战登记</h3>
        <p className="mt-1 text-xs" style={{ color: '#8aa2b8' }}>深塔 / 海墟 / 矩阵 / 全息，开启后才会显示在老板的进度页上</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <OptionalRow
            label="终焉矩阵"
            enabled={boss.challenges.matrix.enabled}
            done={boss.challenges.matrix.done}
            onEnable={(v) => setChallenge('matrix', { enabled: v })}
            onToggle={() => setChallenge('matrix', { done: !boss.challenges.matrix.done })}
          />
          <OptionalRow
            label="冥歌海墟"
            enabled={boss.challenges.sea.enabled}
            done={boss.challenges.sea.done}
            onEnable={(v) => setChallenge('sea', { enabled: v })}
            onToggle={() => setChallenge('sea', { done: !boss.challenges.sea.done })}
          />
          <OptionalRow
            label="逆境深塔"
            enabled={boss.challenges.tower.enabled}
            done={boss.challenges.tower.done}
            onEnable={(v) => setChallenge('tower', { enabled: v })}
            onToggle={() => setChallenge('tower', { done: !boss.challenges.tower.done })}
          />
          <OptionalRow
            label="全息投影"
            enabled={boss.challenges.holo.enabled}
            done={boss.challenges.holo.done}
            onEnable={(v) => setChallenge('holo', { enabled: v })}
            onToggle={() => setChallenge('holo', { done: !boss.challenges.holo.done })}
          />
        </div>
      </section>

      {/* 可选任务 */}
      <section className="paper-card px-6 py-6">
        <h3 className="font-display text-lg" style={{ color: '#22405c' }}>其他小委托</h3>
        <p className="mt-1 text-xs" style={{ color: '#8aa2b8' }}>开启后才会显示在老板的进度页上</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <OptionalRow
            label="兑换前瞻兑换码"
            enabled={boss.optionals.redeem.enabled}
            done={boss.optionals.redeem.done}
            onEnable={(v) => mutateBoss(boss.id, (b) => ({ ...b, optionals: { ...b.optionals, redeem: { ...b.optionals.redeem, enabled: v } } }))}
            onToggle={() => mutateBoss(boss.id, (b) => ({ ...b, optionals: { ...b.optionals, redeem: { ...b.optionals.redeem, done: !b.optionals.redeem.done } } }))}
          />
          <OptionalRow
            label="购买当前版本抽卡道具"
            enabled={boss.optionals.gacha.enabled}
            done={boss.optionals.gacha.done}
            onEnable={(v) => mutateBoss(boss.id, (b) => ({ ...b, optionals: { ...b.optionals, gacha: { ...b.optionals.gacha, enabled: v } } }))}
            onToggle={() => mutateBoss(boss.id, (b) => ({ ...b, optionals: { ...b.optionals, gacha: { ...b.optionals.gacha, done: !b.optionals.gacha.done } } }))}
          />
        </div>
      </section>

      {/* 活动编辑弹层 */}
      {eventEdit && (
        <EventEditor
          boss={boss}
          edit={eventEdit}
          github={github}
          onClose={() => setEventEdit(null)}
        />
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>{label}</span>
      {children}
    </label>
  );
}

/** 老板端「显示 / 隐藏这个模块」的小开关 */
function ShowSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-300"
      style={on ? { background: '#e7f3ff', borderColor: '#b8d8f5', color: '#2a7fd4' } : { background: '#f6fafe', borderColor: '#e3effc', color: '#9db4c9' }}
      title={on ? '老板端现在能看见，点我隐藏' : '老板端现在看不见，点我显示'}
    >
      <span
        className="relative h-4 w-7 rounded-full transition-colors duration-300"
        style={{ background: on ? '#45a9ff' : '#cfdff0' }}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-300"
          style={{ left: on ? '14px' : '2px' }}
        />
      </span>
      {on ? '老板可见' : '老板不可见'}
    </button>
  );
}

function OptionalRow({ label, enabled, done, onEnable, onToggle }: { label: string; enabled: boolean; done: boolean; onEnable: (v: boolean) => void; onToggle: () => void }) {
  return (
    <div className="rounded-2xl border px-4 py-3.5" style={{ background: enabled ? '#fff' : '#f6fafe', borderColor: '#d9e9f9' }}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onEnable(!enabled)}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300"
          style={{ background: enabled ? '#45a9ff' : '#cfdff0' }}
          aria-label="启用开关"
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300"
            style={{ left: enabled ? '22px' : '2px' }}
          />
        </button>
        <span className="flex-1 font-bold" style={{ color: '#2b3f54' }}>{label}</span>
        {enabled && (
          <button type="button" onClick={onToggle} className="chip transition-transform hover:scale-105" style={done ? { background: '#d6f4e7', color: '#1d9e74' } : { background: '#fdf3e3', color: '#d18d1f' }}>
            {done ? '✓ 已完成' : '点我完成'}
          </button>
        )}
        {!enabled && <span className="chip" style={{ background: '#eef3f9', color: '#9db4c9' }}>未开启</span>}
      </div>
    </div>
  );
}

/** 托管周期：常用 30 / 42 天，也可以自定义任意天数 */
function CycleDaysPicker({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const preset = value === 30 || value === 42;
  const [custom, setCustom] = useState(!preset);
  const [draft, setDraft] = useState(preset ? '' : String(value));

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
    <div className="flex gap-2">
      <select className="input-soft" value={custom ? 'custom' : String(value)} onChange={(e) => pick(e.target.value)}>
        <option value={30}>30 天</option>
        <option value={42}>42 天</option>
        <option value="custom">自定义天数</option>
      </select>
      {custom && (
        <span className="flex shrink-0 items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={365}
            className="input-soft !w-24 text-center font-bold"
            placeholder="天数"
            value={draft}
            onChange={(e) => commit(e.target.value)}
          />
          <span className="text-xs font-bold" style={{ color: '#5b7a97' }}>天</span>
        </span>
      )}
    </div>
  );
}

/* ---------- 活动名称 / 图片编辑弹层 ---------- */
function EventEditor({ boss, edit, github, onClose }: { boss: Boss; edit: { kind: 'big' | number }; github: ReturnType<typeof useStore>['github']; onClose: () => void }) {
  const { syncEventMeta, serverMode, adminKey } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const isBig = edit.kind === 'big';
  const idx = typeof edit.kind === 'number' ? edit.kind : -1;
  const event: EventItem = isBig ? boss.bigEvent : boss.smallEvents[idx];

  // 名称/图片是全服共享的（同一版本活动大家都一样），改动会同步到所有老板；完成状态仍各记各的
  const apply = (patch: Partial<Pick<EventItem, 'name' | 'image' | 'openDate' | 'deadline'>>) => syncEventMeta(isBig ? 'big' : idx, patch);

  const pickImage = async (file: File) => {
    setBusy(true);
    setErr('');
    try {
      if (serverMode && adminKey) {
        const url = await uploadServerImage(adminKey, file);
        apply({ image: url });
      } else if (github) {
        const path = await uploadRemoteImage(github, file);
        apply({ image: path });
      } else {
        const dataUrl = await downscaleToDataUrl(file, 960);
        apply({ image: dataUrl });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#22405c]/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="paper-card view-swap w-full max-w-md px-6 py-6" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-display text-lg" style={{ color: '#22405c' }}>
          编辑{isBig ? '大活动' : `小活动 ${idx + 1}`}
        </h4>
        <p className="mt-1 text-xs" style={{ color: '#8aa2b8' }}>同一版本活动全服一样，这里的名称和图片会同步到所有老板</p>
        <Field label="活动名称" className="mt-4">
          <input className="input-soft" value={event.name} placeholder="输入当前版本的活动名" onChange={(e) => apply({ name: e.target.value })} />
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="开放日期（可选）">
            <input type="date" className="input-soft" value={event.openDate || ''} onChange={(e) => apply({ openDate: e.target.value })} />
          </Field>
          <Field label="截止日期（可选）">
            <input type="date" className="input-soft" value={event.deadline || ''} onChange={(e) => apply({ deadline: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4">
          <span className="mb-1.5 block text-xs font-bold" style={{ color: '#5b7a97' }}>活动图片（可选，不传就不显示图片位）</span>
          {event.image ? (
            <div className="relative overflow-hidden rounded-2xl">
              <img src={event.image} alt="活动图" className="h-40 w-full object-cover" />
              <button
                type="button"
                onClick={() => apply({ image: '' })}
                className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#e05548] shadow transition hover:scale-105"
              >
                <Trash2 size={12} /> 移除图片
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-bold transition-all duration-300 hover:border-[#45a9ff] hover:bg-[#f0f7ff]"
              style={{ borderColor: '#cfe3f6', color: '#7e96ad' }}
            >
              <ImagePlus size={26} />
              {busy ? '上传中…' : serverMode ? '点击上传图片（存入服务器）' : github ? '点击上传图片（存入仓库）' : '点击上传图片（仅本地）'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])} />
          {err && <p className="mt-2 text-xs font-semibold" style={{ color: '#e05548' }}>{err}</p>}
          {!github && !serverMode && (
            <p className="mt-2 text-[11px]" style={{ color: '#9db4c9' }}>
              未连接 GitHub，图片只保存在当前浏览器；连接后上传的图片会写入仓库，所有人可见。
            </p>
          )}
          {serverMode && (
            <p className="mt-2 text-[11px]" style={{ color: '#9db4c9' }}>
              图片会存到服务器（数据卷里），上传后所有人可见。
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-primary !px-5 !py-2 text-sm" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** 本地模式下压缩图片，避免 localStorage 爆掉 */
function downscaleToDataUrl(file: File, maxW: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
