import { siteConfig } from '@/siteConfig';
import { useStore } from '@/lib/store';
import {
  ArrowRight,
  BatteryCharging,
  CalendarCheck2,
  Check,
  CheckCircle2,
  KeyRound,
  MessageCircleHeart,
  PauseCircle,
  Sparkles,
  Swords,
  Tv,
} from 'lucide-react';

interface Props {
  onGoBoss: () => void;
  onGoAdmin: () => void;
}

const serviceSteps = [
  { icon: <BatteryCharging size={20} />, title: '每日托管', desc: '凌晨4点刷新，完成状态按天记录' },
  { icon: <CalendarCheck2 size={20} />, title: '每周整理', desc: '周常按自然周记录，不遗漏进度' },
  { icon: <Sparkles size={20} />, title: '版本活动', desc: '大小活动与开放、截止时间清楚可查' },
  { icon: <Swords size={20} />, title: '高难与加项', desc: '深塔、海墟、矩阵及临时委托集中展示' },
];

export default function Landing({ onGoBoss, onGoAdmin }: Props) {
  const { data } = useStore();
  const accepting = data.accepting ?? { on: true, text: '鸣潮 · 托管进行中' };
  const featuredPlan = siteConfig.plans.find((plan) => plan.name === '全托') ?? siteConfig.plans[0];
  const otherPlans = siteConfig.plans.filter((plan) => plan !== featuredPlan);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-20">
      <header className="rise-in flex items-center justify-between py-5 sm:py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#79c5ff] to-[#45a9ff] text-xl text-white shadow-md">🍓</span>
          <div>
            <p className="font-display text-lg leading-none text-[var(--ink)]">{siteConfig.brand}</p>
            <p className="mt-0.5 text-[10px] font-bold tracking-[0.16em] text-[var(--muted-text)]">{siteConfig.brandSuffix}</p>
          </div>
        </div>
        <button type="button" onClick={onGoAdmin} className="btn-ghost !px-4 !py-2 text-xs">托管后台</button>
      </header>

      <section className="resonance-panel rise-in rise-in-1 mt-4 grid gap-8 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-12 lg:py-12">
        <div>
          <span className={`chip ${accepting.on ? 'bg-[#d9edff] text-[#2a7fc0]' : 'bg-[#fff1dc] text-[#b7791f]'}`}>
            {accepting.on ? <Sparkles size={13} /> : <PauseCircle size={13} />} {accepting.text}
          </span>
          <p className="eyebrow mt-6 text-[#4f8fbe]">WUTHERING WAVES ACCOUNT CARE</p>
          <h1 className="font-display mt-3 max-w-2xl text-4xl leading-[1.16] text-[var(--ink)] sm:text-5xl lg:text-[3.4rem]">{siteConfig.heroTitle}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">{siteConfig.heroSubtitle}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onGoBoss} className="btn-primary mobile-full text-base">
              <KeyRound size={18} /> 查看我的托管进度 <ArrowRight size={16} />
            </button>
            <a href="#pricing" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#bedaf0] bg-white/65 px-6 text-sm font-bold text-[#367caf] transition-colors hover:bg-white">了解套餐</a>
          </div>
        </div>

        <div className="rounded-2xl border border-[#c8dff2] bg-white/45 p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#c8dff2] pb-3">
            <div>
              <p className="text-xs font-bold text-[var(--muted-text)]">老板端一眼看懂</p>
              <p className="mt-1 font-display text-xl text-[var(--ink)]">今日托管概览</p>
            </div>
            <span className="font-display text-3xl text-[var(--signal-strong)]">86%</span>
          </div>
          <div className="mt-2 divide-y divide-[#c8dff2]">
            <HeroStatus label="今天" value="已完成" done />
            <HeroStatus label="本周" value="进行中" />
            <HeroStatus label="本版本" value="6 / 8 项" />
          </div>
          <p className="mt-3 text-[11px] text-[var(--muted-text)]">每次登记都会同步更新，老板无需反复询问。</p>
        </div>
      </section>

      <section className="mt-20 sm:mt-24">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
          <div>
            <p className="eyebrow text-[var(--signal-strong)]">HOW IT WORKS</p>
            <h2 className="font-display mt-3 text-3xl text-[var(--ink)]">不只是“做完了”<br className="hidden lg:block" />每一步都有记录</h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-[var(--ink-soft)]">老板先看结论，需要时再展开每日、每周和版本任务明细；信息清楚，但不会被大量卡片淹没。</p>
          </div>
          <div className="border-y border-[var(--line)]">
            {serviceSteps.map((step, index) => (
              <div key={step.title} className="flex items-center gap-4 border-b border-[var(--line)] py-4 last:border-b-0 sm:py-5">
                <span className="text-xs font-extrabold text-[var(--muted-text)]">0{index + 1}</span>
                <span className="section-icon">{step.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[var(--ink)]">{step.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{step.desc}</p>
                </div>
                <CheckCircle2 size={18} className="hidden text-[var(--signal)] sm:block" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mt-20 scroll-mt-8 sm:mt-24">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-[var(--signal-strong)]">SERVICE PLAN</p>
            <h2 className="font-display mt-3 text-3xl text-[var(--ink)]">按需要选择托管范围</h2>
          </div>
          <p className="text-sm text-[var(--muted-text)]">套餐能力可以在后台按实际约定调整</p>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[1.05fr_1.95fr]">
          <div className="resonance-panel px-6 py-6 sm:px-7 sm:py-7">
            <span className="chip bg-[#d9edff] text-[#2a7fc0]">推荐 · 最省心</span>
            <p className="font-display mt-5 text-2xl text-[var(--ink)]">{featuredPlan.name}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{featuredPlan.content}</p>
            <p className="font-display mt-6 text-4xl text-[var(--signal-strong)]">{featuredPlan.price}</p>
            {featuredPlan.note && <p className="mt-2 text-xs leading-5 text-[var(--muted-text)]">{featuredPlan.note}</p>}
            <div className="mt-6 space-y-2 border-t border-[#c8dff2] pt-5 text-sm text-[var(--ink-soft)]">
              <p className="flex items-center gap-2"><Check size={15} className="text-[var(--signal-strong)]" />每日、每周及版本活动</p>
              <p className="flex items-center gap-2"><Check size={15} className="text-[var(--signal-strong)]" />高难任务集中处理</p>
              <p className="flex items-center gap-2"><Check size={15} className="text-[var(--signal-strong)]" />老板端随时查询进度</p>
            </div>
          </div>

          <div className="task-list bg-white">
            {otherPlans.map((plan) => (
              <div key={plan.name} className="grid gap-2 border-b border-[var(--line)] px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_1.6fr_auto] sm:items-center sm:gap-5">
                <p className="font-bold text-[var(--ink)]">{plan.name}</p>
                <div>
                  <p className="text-sm text-[var(--ink-soft)]">{plan.content}</p>
                  {plan.note && <p className="mt-1 text-[11px] text-[var(--muted-text)]">{plan.note}</p>}
                </div>
                <p className="font-display text-xl text-[var(--signal-strong)] sm:text-right">{plan.price}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold text-[var(--ink-soft)]">补充：{siteConfig.planExtra}</p>
      </section>

      <section className="mt-20 sm:mt-24">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-[var(--signal-strong)]">CONTACT &amp; FOLLOW</p>
            <h2 className="font-display mt-3 text-3xl text-[var(--ink)]">想聊托管OR来看看我</h2>
          </div>
          <p className="text-sm text-[var(--muted-text)]">托管咨询请联系微信，日常动态与直播可以在哔哩哔哩找到我</p>
        </div>

        <div className="paper-card mt-7 grid overflow-hidden sm:grid-cols-2">
          <div className="flex flex-col items-center px-6 py-7 text-center sm:border-r sm:border-[var(--line)]">
            <span className="section-icon"><MessageCircleHeart size={20} /></span>
            <p className="font-display mt-3 text-xl text-[var(--ink)]">微信咨询</p>
            <p className="mt-1 text-xs text-[var(--muted-text)]">扫码加我好友，备注“托管”</p>
            <img src={siteConfig.wechatQr} alt="微信二维码" className="mt-4 w-40 rounded-xl border border-[var(--line)]" loading="lazy" />
          </div>
          <div className="flex flex-col items-center border-t border-[var(--line)] px-6 py-7 text-center sm:border-t-0">
            <span className="section-icon"><Tv size={20} /></span>
            <p className="font-display mt-3 text-xl text-[var(--ink)]">哔哩哔哩</p>
            <p className="mt-1 text-xs text-[var(--muted-text)]">欢迎来直播间看我打号</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <a href={siteConfig.bilibili.spaceUrl} target="_blank" rel="noreferrer" className="btn-primary !px-5 !py-2 text-sm">我的主页</a>
              <a href={siteConfig.bilibili.liveUrl} target="_blank" rel="noreferrer" className="btn-ghost text-sm">进入直播间</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-16 text-center text-xs text-[var(--muted-text)]">
        <hr className="divider-soft mx-auto mb-5 max-w-xs" />
        <p>{siteConfig.brand} · {siteConfig.brandSuffix} —— 用心养号，快乐游戏</p>
      </footer>
    </div>
  );
}

function HeroStatus({ label, value, done = false }: { label: string; value: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className={`signal-dot ${done ? '' : 'pending'}`} />
      <span className="flex-1 text-sm font-bold text-[var(--ink-soft)]">{label}</span>
      <span className="text-sm font-extrabold text-[var(--ink)]">{value}</span>
    </div>
  );
}
