import { useState } from 'react';
import type { SiteData, Boss } from '@/types';
import { useStore } from '@/lib/store';
import BossProgress from '@/components/BossProgress';
import WeChatTip from '@/components/WeChatTip';
import { KeyRound, ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
}

/** 老板端：口令 -> 进度 */
export default function BossPortal({ onBack }: Props) {
  const { data } = useStore();
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const [boss, setBoss] = useState<Boss | null>(null);
  const [shake, setShake] = useState(false);

  const submit = () => {
    const c = code.trim();
    if (!c) return;
    const hit = data.bosses.find((b) => b.passcode === c);
    if (hit) {
      setBoss(hit);
      setErr(false);
    } else {
      setErr(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  /* ---------- 进度视图 ---------- */
  if (boss) {
    return (
      <div className="view-swap mx-auto max-w-3xl px-5 pb-24">
        <div className="rise-in flex items-center justify-between py-5">
          <button type="button" onClick={() => { setBoss(null); setCode(''); }} className="btn-ghost !px-4 !py-2 text-xs">
            <ArrowLeft size={13} /> 换个口令
          </button>
          <button type="button" onClick={onBack} className="text-xs font-semibold" style={{ color: '#8aa2b8' }}>
            返回首页
          </button>
        </div>
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
          请出示口令
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: '#7e96ad' }}>
          口令就是你<b style={{ color: '#2a7fd4' }}>手机号的后四位</b>（账号绑定的那个号）。
          如果你和别的老板尾号一样，我会在后面补个数字——比如 0001 重复了就试试 <b style={{ color: '#2a7fd4' }}>00011</b>，还不行就 00012、00013……
          如果你找我设置过自定义口令，直接输你设的那个就行。
        </p>
        <p className="mt-2 text-xs" style={{ color: '#9db4c9' }}>
          实在进不去？<WeChatTip>微信</WeChatTip> 问我就好
        </p>
        <input
          className="input-soft mt-5 text-center !text-lg font-extrabold tracking-[0.4em]"
          style={err ? { borderColor: '#f3b7b1', background: '#fff7f6' } : undefined}
          placeholder="· · · ·"
          value={code}
          maxLength={12}
          onChange={(e) => { setCode(e.target.value); setErr(false); }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {err && <p className="mt-2 text-xs font-bold" style={{ color: '#e05548' }}>口令不对，核对一下再试</p>}
        <button type="button" onClick={submit} className="btn-primary mt-5 w-full">
          查看我的托管进度
        </button>
        <button type="button" onClick={onBack} className="mt-4 text-xs font-semibold" style={{ color: '#8aa2b8' }}>
          <ArrowLeft size={12} className="mr-1 inline" />返回首页
        </button>
      </div>
    </div>
  );
}
