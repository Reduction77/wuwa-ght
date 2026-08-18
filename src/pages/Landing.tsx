import { siteConfig } from '@/siteConfig';
import { useStore } from '@/lib/store';
import { ArrowRight, BatteryCharging, CalendarCheck2, Gift, KeyRound, PauseCircle, Sparkles, Swords, Tv, MessageCircleHeart } from 'lucide-react';

interface Props {
  onGoBoss: () => void;
  onGoAdmin: () => void;
}

export default function Landing({ onGoBoss, onGoAdmin }: Props) {
  const { data } = useStore();
  return (
    <div className="mx-auto max-w-5xl px-5 pb-24">
      {/* 顶部导航 */}
      <header className="rise-in flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl text-white shadow-md" style={{ background: 'linear-gradient(135deg,#45a9ff,#1e8bf0)' }}>
            🍓
          </span>
          <div>
            <p className="font-display text-lg leading-none" style={{ color: '#22405c' }}>{siteConfig.brand}</p>
            <p className="text-[11px] font-semibold tracking-wide" style={{ color: '#8aa2b8' }}>{siteConfig.brandSuffix}</p>
          </div>
        </div>
        <button type="button" onClick={onGoAdmin} className="btn-ghost !px-4 !py-2 text-xs">
          托管小哥入口
        </button>
      </header>

      {/* Hero */}
      <section className="rise-in rise-in-1 mt-8 text-center">
        {(() => {
          const acc = data.accepting ?? { on: true, text: '鸣潮 · 托管进行中' };
          return (
            <span
              className="chip mx-auto"
              style={acc.on ? { background: '#e7f3ff', color: '#2a7fd4' } : { background: '#fff1dc', color: '#c07f16' }}
            >
              {acc.on ? <Sparkles size={13} /> : <PauseCircle size={13} />} {acc.text}
            </span>
          );
        })()}
        <h1 className="font-display mx-auto mt-5 max-w-2xl text-4xl leading-snug sm:text-5xl" style={{ color: '#22405c' }}>
          {siteConfig.heroTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed" style={{ color: '#5b7a97' }}>
          {siteConfig.heroSubtitle}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={onGoBoss} className="btn-primary text-base">
            <KeyRound size={18} /> 老板查进度 <ArrowRight size={16} />
          </button>
          <a href="#pricing" className="btn-ghost">看看价格</a>
        </div>
      </section>

      {/* 服务内容 */}
      <section className="mt-20">
        <h2 className="font-display rise-in text-center text-2xl" style={{ color: '#22405c' }}>每个托管周期，我都会做这些</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ServiceCard
            icon={<BatteryCharging size={22} />}
            title="每天清体力"
            desc="一天不落，体力绝不满溢"
            className="rise-in rise-in-1"
          />
          <ServiceCard
            icon={<CalendarCheck2 size={22} />}
            title="每周清周常"
            desc="每周任务按时清空"
            className="rise-in rise-in-2"
          />
          <ServiceCard
            icon={<Sparkles size={22} />}
            title="版本活动全包"
            desc="1 个大活动 + 3 个小活动"
            className="rise-in rise-in-3"
          />
          <ServiceCard
            icon={<Swords size={22} />}
            title="周期挑战"
            desc="终焉矩阵 / 冥歌海城 / 逆境深塔 各一次"
            className="rise-in rise-in-3"
          />
          <ServiceCard
            icon={<Gift size={22} />}
            title="其他小委托"
            desc="前瞻兑换码、购买抽卡道具（有需要才开启）"
            className="rise-in rise-in-4"
          />
          <ServiceCard
            icon={<Tv size={22} />}
            title="周期灵活"
            desc="托管天数按实际订单设置，与游戏版本更新时间分开"
            className="rise-in rise-in-4"
          />
        </div>
      </section>

      {/* 价格表 */}
      <section id="pricing" className="mt-20 scroll-mt-8">
        <h2 className="font-display rise-in text-center text-2xl" style={{ color: '#22405c' }}>托管价格</h2>
        <p className="rise-in mt-2 text-center text-sm" style={{ color: '#8aa2b8' }}>明码标价，童叟无欺</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {siteConfig.plans.map((p, i) => (
            <div
              key={p.name}
              className={`paper-card rise-in rise-in-${Math.min(i + 1, 5)} relative overflow-hidden px-6 py-5 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl ${i === 3 ? 'ring-2 ring-[#45a9ff]/50' : ''}`}
            >
              {i === 3 && (
                <span className="chip absolute right-4 top-4" style={{ background: 'linear-gradient(135deg,#45a9ff,#1e8bf0)', color: '#fff' }}>
                  最省心
                </span>
              )}
              <p className="font-display text-lg" style={{ color: '#22405c' }}>{p.name}</p>
              <p className="mt-1 text-sm" style={{ color: '#6b86a1' }}>{p.content}</p>
              <p className="font-display mt-3 text-3xl" style={{ color: '#1e8bf0' }}>{p.price}</p>
              {p.note && <p className="mt-1 text-xs" style={{ color: '#9db4c9' }}>{p.note}</p>}
            </div>
          ))}
        </div>
        <p className="rise-in mt-4 text-center text-sm font-semibold" style={{ color: '#5b7a97' }}>
          💡 {siteConfig.planExtra}
        </p>
      </section>

      {/* 联系方式 */}
      <section className="mt-20">
        <h2 className="font-display rise-in text-center text-2xl" style={{ color: '#22405c' }}>来找我玩</h2>
        <div className="rise-in rise-in-2 mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="paper-card flex flex-col items-center px-6 py-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg,#45c6a5,#2fbf8f)' }}>
              <MessageCircleHeart size={22} />
            </span>
            <p className="font-display mt-3 text-lg" style={{ color: '#22405c' }}>微信咨询</p>
            <p className="mt-1 text-xs" style={{ color: '#8aa2b8' }}>扫码加我好友，备注“托管”</p>
            <img
              src={siteConfig.wechatQr}
              alt="微信二维码"
              className="mt-4 w-44 rounded-2xl border-4 border-white shadow-lg transition-transform duration-500 hover:scale-[1.04]"
              loading="lazy"
            />
          </div>
          <div className="paper-card flex flex-col items-center px-6 py-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg,#ff8fc7,#f06292)' }}>
              <Tv size={22} />
            </span>
            <p className="font-display mt-3 text-lg" style={{ color: '#22405c' }}>哔哩哔哩</p>
            <p className="mt-1 text-xs" style={{ color: '#8aa2b8' }}>欢迎来直播间看我打号</p>
            <div className="mt-4 flex flex-col gap-2.5">
              <a href={siteConfig.bilibili.spaceUrl} target="_blank" rel="noreferrer" className="btn-primary !px-5 !py-2.5 text-sm">
                我的 B 站主页
              </a>
              <a href={siteConfig.bilibili.liveUrl} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
                进入直播间
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-20 text-center text-xs" style={{ color: '#9db4c9' }}>
        <hr className="divider-soft mx-auto mb-6 max-w-xs" />
        <p>{siteConfig.brand} · {siteConfig.brandSuffix} —— 用心养号，快乐游戏</p>
      </footer>
    </div>
  );
}

function ServiceCard({ icon, title, desc, className }: { icon: React.ReactNode; title: string; desc: string; className?: string }) {
  return (
    <div className={`paper-card flex items-start gap-3.5 px-5 py-4 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl ${className ?? ''}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg,#45a9ff,#1e8bf0)' }}>
        {icon}
      </span>
      <div>
        <p className="font-bold" style={{ color: '#2b3f54' }}>{title}</p>
        <p className="mt-0.5 text-sm" style={{ color: '#7e96ad' }}>{desc}</p>
      </div>
    </div>
  );
}
