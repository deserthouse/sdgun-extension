// 会话上下文（M2/E70-05）：身份与 epoch 统一供给。
// 语义：私有查询键含 epoch（换会话=键空间隔离）；退出=取消在途+清缓存+规则撤除+
// auth 清除；迟到回填防护在 queries.ts（回填前校验 epoch 仍是发起时的值）。
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { browser } from 'wxt/browser';
import { epochProbe, epochStart, epochStop } from './epoch';
import { getAuth, logout as authLogout, type AuthInfo } from './auth';

export interface Session {
  epoch: string | null;
  auth: AuthInfo | null;
}

interface SessionCtx {
  session: Session | 'loading';
  logout: () => Promise<void>;
  /** 回填守卫：调用方在 await 后核对 epoch 是否仍是发起时的值 */
  epochRef: React.MutableRefObject<string | null>;
}

const Ctx = createContext<SessionCtx>({
  session: 'loading',
  logout: async () => {},
  epochRef: { current: null },
});

export function useSession(): SessionCtx {
  return useContext(Ctx);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | 'loading'>('loading');
  const epochRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const auth = await getAuth().catch(() => null);
      // C3-4 ready 守卫：首开时无 epoch → 先 epochStart（SW 装游客 UA 规则）
      // 再放开 session——查询（queries.ts enabled 门）在规则就绪前不点火，
      // 消灭「首请求裸发被 WAF 偶发拦截」竞速（E70-09/B4 根因，2026-10-25 实锤）
      let pr = await epochProbe().catch(() => null);
      if (!pr?.epoch) {
        pr = await epochStart(`guest-${Date.now().toString(36)}`).catch(() => null) as typeof pr;
      }
      const epoch = pr?.epoch ?? null;
      epochRef.current = epoch;
      setSession({ epoch, auth });
    })();
  }, []);

  const logout = async (): Promise<void> => {
    // 顺序（E70-05）：先取消在途，再撤身份，再清私有缓存，最后清规则/记账
    await qc.cancelQueries();
    await authLogout(); // storage.session auth 清除 + auth:deactivate（游客 UA）
    await epochStop();
    qc.removeQueries(); // 私有缓存全清（无跨账号复用）
    epochRef.current = null;
    setSession({ epoch: null, auth: null });
  };

  // 登录成功后由调用方（lib/auth 层）同步上下文：轮询 auth 变化即可
  // （storage.session 是事件源；这里以轻量对拍保持 session 新鲜）
  useEffect(() => {
    const t = setInterval(async () => {
      if (session === 'loading') return;
      const auth = await getAuth().catch(() => null);
      const pr = await epochProbe().catch(() => null);
      const epoch = pr?.epoch ?? null;
      epochRef.current = epoch;
      const cur = session as Session;
      if (cur.auth?.token !== (auth?.token ?? null) || cur.epoch !== epoch) {
        setSession({ epoch, auth });
      }
    }, 3000);
    return () => clearInterval(t);
  }, [session]);

  return <Ctx.Provider value={{ session, logout, epochRef }}>{children}</Ctx.Provider>;
}

/** storage.session → 供 queries 回填守卫读取的当前 epoch（轻量同步副本） */
export async function readAuthForTests(): Promise<AuthInfo | null> {
  const st = await browser.storage.session.get({ 'auth.current': null });
  return (st['auth.current'] as AuthInfo | null) ?? null;
}
