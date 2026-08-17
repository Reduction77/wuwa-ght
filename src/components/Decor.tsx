/** 浅蓝色云朵 / 光斑背景装饰 */
export default function Decor() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #eaf5ff 0%, #f3f9ff 38%, #f7fbff 70%, #eef7ff 100%)',
        }}
      />
      <div
        className="float-slow absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full opacity-70"
        style={{ background: 'radial-gradient(circle, #cbe6ff 0%, transparent 68%)' }}
      />
      <div
        className="float-slower absolute top-[12%] -right-40 h-[520px] w-[520px] rounded-full opacity-60"
        style={{ background: 'radial-gradient(circle, #d6efff 0%, transparent 66%)' }}
      />
      <div
        className="float-slow absolute bottom-[-180px] left-[18%] h-[480px] w-[480px] rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle, #cfe9ff 0%, transparent 65%)', animationDelay: '-5s' }}
      />
      {/* 小云朵 */}
      <svg className="float-slower absolute top-[9%] left-[8%] w-24 opacity-80" viewBox="0 0 100 60" fill="none">
        <path d="M25 45a15 15 0 1 1 3.5-29.6A20 20 0 0 1 67 12a16 16 0 0 1 14.5 23A13 13 0 0 1 78 45H25z" fill="#ffffff" stroke="#cfe7fb" strokeWidth="2.5" />
      </svg>
      <svg className="float-slow absolute top-[30%] right-[6%] w-16 opacity-70" viewBox="0 0 100 60" fill="none" style={{ animationDelay: '-3s' }}>
        <path d="M25 45a15 15 0 1 1 3.5-29.6A20 20 0 0 1 67 12a16 16 0 0 1 14.5 23A13 13 0 0 1 78 45H25z" fill="#ffffff" stroke="#d9ecfc" strokeWidth="2.5" />
      </svg>
      <svg className="float-slower absolute bottom-[16%] right-[22%] w-20 opacity-60" viewBox="0 0 100 60" fill="none" style={{ animationDelay: '-8s' }}>
        <path d="M25 45a15 15 0 1 1 3.5-29.6A20 20 0 0 1 67 12a16 16 0 0 1 14.5 23A13 13 0 0 1 78 45H25z" fill="#ffffff" stroke="#d9ecfc" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
