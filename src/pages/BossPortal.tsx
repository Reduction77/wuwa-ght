import { useEffect, useMemo, useState } from 'react';
import { normalizeSiteData, useStore } from '@/lib/store';
import { changePasscode, loginBoss, logoutBoss, readBossSession } from '@/lib/server';
import { siteConfig } from '@/siteConfig';
import BossProgress from '@/components/BossProgress';
import type { Boss } from '@/types';
import { ArrowLeft, KeyRound, LogOut, RefreshCw } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const SESSION_KEY = 'zzbb-boss-id';

export default function BossPortal({ onBack }: Props) {
  const { data, loading, reload, serverMode } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [bossId, setBossId] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [shake, setShake] = useState(false);
  const [serverBoss, setServerBoss] = useState<Boss | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState('');
  const [busy, setBusy] = useState(false);

  const boss = useMemo(() => serverMode ? serverBoss : data.bosses.find((b) => b.id === bossId) ?? null, [data, bossId, serverBoss, serverMode]);

  const acceptServerBoss = (raw: unknown, updatedAt: string) => {
    const normalized = normalizeSiteData({ version: 1, updatedAt, bosses: [raw as Boss] });
    setServerBoss(normalized.bosses[0] ?? null);
    setServerUpdatedAt(updatedAt);
  };

  useEffect(() => {
    if (!serverMode) return;
    readBossSession()
      .then((result) => acceptServerBoss(result.boss, result.updatedAt))
      .catch(() => setServerBoss(null));
  }, [serverMode]);

  const tryLogin = async () => {
    const input = code.trim();
    if (!input) return;
    if (serverMode) {
      setBusy(true);
      try {
        const result = await loginBoss(input);
        acceptServerBoss(result.boss, result.updatedAt);
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : '登录失败，请稍后再试');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } finally {
        setBusy(false);
      }
      return;
    }
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

  const refreshBoss = async () => {
    if (!serverMode) return reload();
    setBusy(true);
    try {
      const result = await readBossSession();
      acceptServerBoss(result.boss, result.updatedAt);
    } catch {
      setServerBoss(null);
      setError('登录已过期，请重新输入口令');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (serverMode) await logoutBoss();
    sessionStorage.removeItem(SESSION_KEY);
    setBossId(null);
    setServerBoss(null);
    setCode('');
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
            <button type="button" onClick={refreshBoss} className="btn-ghost !px-4 !py-2 text-xs" title="刷新最新进度">
              <RefreshCw size={14} className={loading || busy ? 'animate-spin' : ''} /> 刷新
            </button>
            <button
              type="button"
              onClick={signOut}
              className="btn-ghost !px-4 !py-2 text-xs"
            >
              <LogOut size={14} /> 退出
            </button>
          </div>
        </header>
        <BossProgress boss={boss} />
        <ChangePasscodeCard
          onChanged={() => {
            sessionStorage.removeItem(SESSION_KEY);
            setBossId(null);
            setCode('');
          }}
        />
        <p className="mt-8 text-center text-xs" style={{ color: '#9db4c9' }}>
          数据更新于 {new Date(serverMode ? serverUpdatedAt : data.updatedAt).toLocaleString('zh-CN')} · 有疑问随时<WeChatTip />戳我
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
          onKeyDown={(e) => e.key === 'Enter' && !busy && void tryLogin()}
          autoFocus
        />
        {error && <p className="mt-2 text-sm font-semibold" style={{ color: '#e05548' }}>{error}</p>}
        <button type="button" disabled={busy} onClick={() => void tryLogin()} className="btn-primary mt-5 w-full">
          {busy ? '正在验证…' : '查看我的托管进度'}
        </button>
        <button type="button" onClick={onBack} className="mt-4 text-xs font-semibold" style={{ color: '#8aa2b8' }}>
          <ArrowLeft size={12} className="mr-1 inline" />返回首页
        </button>
      </div>
    </div>
  );
}

/** 修改口令卡片：服务器版直接改并同步到后台；纯静态版提示找托管小哥 */
function ChangePasscodeCard({ onChanged }: { onChanged: () => void }) {
  const { serverMode } = useStore();
  const [open, setOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newCode2, setNewCode2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    const n1 = newCode.trim();
    if (n1.length < 4 || n1.length > 16) {
      setMsg({ ok: false, text: '新口令要 4~16 位，别带空格' });
      return;
    }
    if (n1 !== newCode2.trim()) {
      setMsg({ ok: false, text: '两次输入的新口令不一样' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await changePasscode(n1);
      await logoutBoss();
      setMsg({ ok: true, text: '口令改好啦！3 秒后退出，请用新口令重新登录' });
      setTimeout(onChanged, 3000);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '改口令失败，稍后再试' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="paper-card mt-6 px-5 py-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 text-xs font-bold"
          style={{ color: '#2a7fd4' }}
        >
          <KeyRound size={14} /> 想换个好记的口令？点这里修改
        </button>
      ) : !serverMode ? (
        <div className="text-center">
          <p className="text-sm font-bold" style={{ color: '#22405c' }}>修改口令</p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: '#7e96ad' }}>
            这个版本改不了口令哦——想换口令的话<WeChatTip />跟我说一声，我帮你改好。
          </p>
          <button type="button" onClick={() => setOpen(false)} className="mt-3 text-xs font-semibold" style={{ color: '#8aa2b8' }}>
            收起
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm font-bold" style={{ color: '#22405c' }}>修改口令</p>
          <p className="mt-1 text-[11px]" style={{ color: '#9db4c9' }}>
            改好后这边和托管小哥的后台会同步生效，下次登录用新口令
          </p>
          <div className="mt-3 space-y-2.5">
            <input
              className="input-soft text-center font-bold tracking-[0.2em]"
              placeholder="新口令（4~16 位）"
              value={newCode}
              maxLength={16}
              onChange={(e) => setNewCode(e.target.value)}
            />
            <input
              className="input-soft text-center font-bold tracking-[0.2em]"
              placeholder="再输一遍新口令"
              value={newCode2}
              maxLength={16}
              onChange={(e) => setNewCode2(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
            />
          </div>
          {msg && (
            <p className="mt-2.5 text-center text-xs font-semibold" style={{ color: msg.ok ? '#1d9e74' : '#e05548' }}>
              {msg.text}
            </p>
          )}
          <div className="mt-3.5 flex justify-center gap-2">
            <button type="button" className="btn-ghost !px-4 !py-2 text-xs" onClick={() => setOpen(false)}>
              取消
            </button>
            <button
              type="button"
              disabled={busy || !newCode.trim()}
              onClick={submit}
              className="btn-primary !px-5 !py-2 text-xs"
            >
              {busy ? '提交中…' : '确认修改'}
            </button>
          </div>
        </div>
      )}
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
