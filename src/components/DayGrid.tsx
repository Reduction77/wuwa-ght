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
              'day-cell group relative flex flex-col items-center justify-center rounded-xl px-1 text-xs font-bold transition-transform duration-200',
              done
                ? 'border border-[#45a9ff] bg-[#45a9ff] text-white shadow-sm'
                : future
                  ? 'border border-dashed border-[#b8d8f5] bg-white text-[#2a7fd4]'
                  : 'border border-[#b8d8f5] bg-white text-[#2a7fd4]',
              isToday ? 'today-breathe ring-2 ring-[var(--signal)]' : '',
              editable ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default',
            ].join(' ')}
          >
            {done && (
              <span className="check-pop absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-white shadow">
                <Check size={10} strokeWidth={4} />
              </span>
            )}
            <span className="flex h-[80%] w-[80%] flex-col items-center justify-center">
              <span className="day-cell-number">{i + 1}</span>
              <span className={`day-cell-date ${done ? 'text-white/95' : 'text-[#2a7fd4]'}`}>
                {date.slice(5).replace('-', '/')}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
