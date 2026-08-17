import { Suspense, lazy, useState } from 'react';
import Decor from '@/components/Decor';
import { DataProvider } from '@/lib/store';
import Landing from '@/pages/Landing';
import BossPortal from '@/pages/BossPortal';

/* 后台代码较大且仅托管小哥使用，按需加载以加快老板端打开速度 */
const Admin = lazy(() => import('@/pages/admin'));

type View = 'home' | 'boss' | 'admin';

export default function App() {
  const [view, setView] = useState<View>('home');

  const go = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  return (
    <DataProvider>
      <Decor />
      {view === 'home' && <Landing onGoBoss={() => go('boss')} onGoAdmin={() => go('admin')} />}
      {view === 'boss' && <BossPortal onBack={() => go('home')} />}
      {view === 'admin' && (
        <Suspense fallback={<AdminFallback />}>
          <Admin onBack={() => go('home')} />
        </Suspense>
      )}
    </DataProvider>
  );
}

function AdminFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="font-display animate-pulse text-lg" style={{ color: '#5b7a97' }}>后台加载中…</p>
    </div>
  );
}

