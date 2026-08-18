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
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))' }}>
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
            className={[
              'group relative flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-bold transition-all duration-300',
              done
                ? 'text-white shadow-sm'
                : future
                  ? 'bg-white/50 text-[#9db4c9] border border-dashed border-[#d4e5f5]'
                  : 'bg-white text-[#7e96ad] border border-[#d9e9f9]',
              isToday ? 'today-breathe ring-2 ring-[#45a9ff]' : '',
              editable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default',
            ].join(' ')}
            style={done ? { background: 'linear-gradient(135deg,#45a9ff,#1e8bf0)' } : undefined}
          >
            {done && (
              <span className="check-pop absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#2fbf8f] text-white shadow">
                <Check size={10} strokeWidth={4} />
              </span>
            )}
            <span className="leading-none">{i + 1}</span>
            <span className={`mt-0.5 text-[9px] font-medium leading-none ${done ? 'text-white/85' : ''}`}>
              {fmtCN(date)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
