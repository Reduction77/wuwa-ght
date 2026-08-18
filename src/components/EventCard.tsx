import type { EventItem } from '@/types';
import { CheckCircle2, Circle } from 'lucide-react';

interface Props {
  event: EventItem;
  badge?: string;
  editable?: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
}

/** 活动卡片：未上传图片时完全不显示图片位 */
export default function EventCard({ event, badge, editable, onToggle, onEdit }: Props) {
  return (
    <div
      className={[
        'paper-card overflow-hidden transition-all duration-300',
        editable ? 'hover:-translate-y-1 hover:shadow-xl' : '',
        event.done ? 'ring-1 ring-[#2fbf8f]/40' : '',
      ].join(' ')}
    >
      {event.image && (
        <div className="relative h-36 w-full overflow-hidden">
          <img src={event.image} alt={event.name} className="h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(255,255,255,0.9))' }} />
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          disabled={!editable}
          onClick={editable ? onToggle : undefined}
          className={`shrink-0 transition-transform duration-300 ${editable ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'}`}
          aria-label={editable ? (event.done ? '标记未完成' : '标记完成') : undefined}
        >
          {event.done ? (
            <CheckCircle2 className="check-pop text-[#2fbf8f]" size={26} />
          ) : (
            <Circle className="text-[#b9d2e8]" size={26} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          {badge && (
            <span className="chip mb-1" style={{ background: '#e7f3ff', color: '#2a7fd4' }}>
              {badge}
            </span>
          )}
          <p
            className={`truncate font-bold transition-colors duration-300 ${event.done ? 'text-[#7e96ad] line-through' : 'text-[#2b3f54]'}`}
          >
            {event.name || '未命名活动'}
          </p>
          {(event.openDate || event.deadline) && <p className="mt-1 text-[10px] font-semibold text-[#8aa2b8]">{event.openDate ? `${event.openDate} 开放` : ''}{event.openDate && event.deadline ? ' · ' : ''}{event.deadline ? `${event.deadline} 截止` : ''}</p>}
        </div>
        <span
          className="chip shrink-0"
          style={event.done ? { background: '#e2f7ef', color: '#1d9e74' } : { background: '#fdf3e3', color: '#d18d1f' }}
        >
          {event.done ? '已完成' : '未完成'}
        </span>
        {editable && onEdit && (
          <button type="button" onClick={onEdit} className="btn-ghost !px-3.5 !py-1.5 text-xs shrink-0">
            编辑
          </button>
        )}
      </div>
    </div>
  );
}
