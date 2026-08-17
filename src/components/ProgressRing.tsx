interface Props {
  percent: number;
  size?: number;
  stroke?: number;
  label?: string;
}

/** 圆环进度（带填充动画） */
export default function ProgressRing({ percent, size = 120, stroke = 11, label }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#dcecfb" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,0.9,0.28,1)' }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#45a9ff" />
            <stop offset="100%" stopColor="#1e8bf0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl leading-none" style={{ color: '#1e8bf0' }}>
          {p}%
        </span>
        {label && <span className="mt-1 text-[11px] font-semibold" style={{ color: '#6b86a1' }}>{label}</span>}
      </div>
    </div>
  );
}
