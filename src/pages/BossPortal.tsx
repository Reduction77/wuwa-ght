import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { siteConfig } from '@/siteConfig';
import BossProgress from '@/components/BossProgress';
import { ArrowLeft, KeyRound, LogOut, RefreshCw } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const SESSION_KEY = 'zzbb-boss-id';

export default function BossPortal({ onBack }: Props) {
  const { data, loading, reload } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [bossId, setBossId] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [shake, setShake] = useState(false);

  const boss = useMemo(() => data.bosses.find((b) => b.id === bossId) ?? null, [data, bossId]);

  const tryLogin = () => {
    const input = code.trim();
    if (!input) return;
    const hit = data.bosses.find((b) => b.passcode === input);
    if (hit) {
      setBossId(hit.id);
      sessionStorage.setItem(SESSION_KEY, hit.id);
      setError('');
    } else {
      setError('口令不对哦，检查一下再试试~');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  /* ---------- 已登录：展示进度 ---------- */
  if (boss) {
    return (
      <div className="view-swap mx-auto max-w-5xl px-5 pb-24">
        <header className="flex flex-wrap items-center justify-between gap-3 py-6">
          <button type="button" onClick={onBack} className="btn-ghost !px-4 !py-2 text-xs">
            <ArrowLeft size={14} /> 返回首页
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => reload()} className="btn-ghost !px-4 !py-2 text-xs" title="刷新最新进度">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 刷新
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem(SESSION_KEY);
                setBossId(null);
                setCode('');
              }}
              className="btn-ghost !px-4 !py-2 text-xs"
            >
              <LogOut size={14} /> 退出
            </button>
          </div>
        </header>
        <BossProgress boss={boss} />
        <p className="mt-8 text-center text-xs" style={{ color: '#9db4c9' }}>
          数据更新于 {new Date(data.updatedAt).toLocaleString('zh-CN')} · 有疑问随时<WeChatTip />戳我
        </p>
      </div>
    );
  }

  /* ---------- 口令输入 ---------- */
  return (
    <div className="view-swap mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-5 pb-24">
      <div className="paper-card rise-in px-7 py-9 text-center" style={shake ? { animation: 'wiggle 0.12s ease-in-out 4' } : undefined}>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md" style={{ background: 'linear-gradient(135deg,#45a9ff,#1e8bf0)' }}>
          <KeyRound size={26} />
        </span>
        <h2 className="font-display mt-4 text-2xl" style={{ color: '#22405c' }}>
          老板，报上口令
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: '#7e96ad' }}>
          口令就是你<b style={{ color: '#2a7fd4' }}>手机号的后四位</b>（账号绑定的那个号）。
          如果你和别的老板尾号一样，我会在后面补个数字——比如 6962 重复了就试试 <b style={{ color: '#2a7fd4' }}>69621</b>，还不行就 69622、69623……
          如果你找我设置过自定义口令，直接输你设的那个就行。
        </p>
        <p className="mt-1.5 text-xs" style={{ color: '#9db4c9' }}>
          实在进不去？<WeChatTip />问我就好
        </p>
        <input
          className="input-soft mt-6 text-center text-lg font-bold tracking-[0.3em]"
          placeholder="· · · ·"
          inputMode="numeric"
          value={code}
          maxLength={20}
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && tryLogin()}
          autoFocus
        />
        {error && <p className="mt-2 text-sm font-semibold" style={{ color: '#e05548' }}>{error}</p>}
        <button type="button" onClick={tryLogin} className="btn-primary mt-5 w-full">
          查看我的托管进度
        </button>
        <button type="button" onClick={onBack} className="mt-4 text-xs font-semibold" style={{ color: '#8aa2b8' }}>
          <ArrowLeft size={12} className="mr-1 inline" />返回首页
        </button>
      </div>
    </div>
  );
}

/** “微信”二字：鼠标悬停 / 手机点按 弹出二维码 */
function WeChatTip() {
  const [show, setShow] = useState(false);
  return (
    <span
      className="group relative mx-0.5 inline-block cursor-pointer font-bold underline decoration-dotted underline-offset-4"
      style={{ color: '#2a7fd4' }}
      onClick={(e) => {
        e.stopPropagation();
        setShow((v) => !v);
      }}
    >
      微信
      <span
        className={[
          'absolute bottom-full left-1/2 z-50 mb-2 w-44 -translate-x-1/2 transition-all duration-300',
          show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100',
        ].join(' ')}
      >
        <img
          src={siteConfig.wechatQr}
          alt="微信加好友二维码"
          className="w-full rounded-2xl border-4 border-white bg-white p-1 shadow-2xl"
        />
      </span>
    </span>
  );
}
