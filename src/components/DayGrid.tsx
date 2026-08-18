import type { Boss } from '@/types';
import { cycleDates, fmtCN, todayStr } from '@/lib/dates';
import { Check } from 'lucide-react';

interface Props {
  boss: Boss;
  editable?: boolean;
  onToggleDay?: (date: string) => void;
}

/** 托管周期打卡格：每日体力 */
export default function DayGrid({ boss, editable, onToggleDay }: Props) {
  const today = todayStr();
  const cells = cycleDates(boss);

  return (
    <div className="day-grid grid gap-2">
      {cells.map((date, i) => {
        const done = boss.daily.includes(date);
        const isToday = date === today;
        const future = date > today;
        return (
          <button
            key={date}
            type="button"
            disabled={!editable}
            onClick={() => onToggleDay?.(date)}
            title={`第 ${i + 1} 天 · ${fmtCN(date)}${done ? ' · 已清体力' : ''}`}
            aria-label={`第 ${i + 1} 天，${fmtCN(date)}，${done ? '已完成' : future ? '尚未到达' : '未完成'}`}
            className={[
              'group relative flex min-h-16 flex-col items-center justify-center rounded-xl px-1 py-2 text-xs font-bold transition-transform duration-200',
              done
                ? 'text-white shadow-sm'
                : future
                  ? 'border border-dashed border-[var(--line)] bg-white/45 text-[var(--muted-text)]'
                  : 'border border-[var(--line)] bg-white text-[var(--ink-soft)]',
              isToday ? 'today-breathe ring-2 ring-[var(--signal)]' : '',
              editable ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default',
            ].join(' ')}
            style={done ? { background: 'linear-gradient(135deg,var(--signal),var(--signal-strong))' } : undefined}
          >
            {done && (
              <span className="check-pop absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-white shadow">
                <Check size={10} strokeWidth={4} />
              </span>
            )}
            <span className="leading-none">{i + 1}</span>
            <span className={`mt-0.5 text-[9px] font-medium leading-none ${done ? 'text-white/85' : ''}`}>
              {date.slice(5).replace('-', '/')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
