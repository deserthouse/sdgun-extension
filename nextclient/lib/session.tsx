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
  const tokenRef = useRef<string | null | undefined>(undefined); // undefined=未初始化

  // W1/E28-01：身份变更（任意标签登出/换号）→ 取消在途+清全部查询缓存。
  // storage.onChanged 在本扩展全部上下文广播——跨标签即时生效；3s 轮询仅作兜底。
  const refreshIdentity = React.useCallback(async (initial = false) => {
    const auth = await getAuth().catch(() => null);
    const token = auth?.token ?? null;
    if (!initial && token === tokenRef.current) return; // 身份未变
    const switched = !initial && token !== tokenRef.current;
    tokenRef.current = token;
    if (switched) {
      await qc.cancelQueries(); // 旧身份在途请求全部终止（配合 broker signal）
      qc.removeQueries(); // 私有缓存整体作废——E28-01：旧账号内容不得跨标签残留
    }
    const pr = await epochProbe().catch(() => null);
    // C3-4 ready 守卫（首开）：无 epoch → epochStart 装游客 UA 规则后再放行
    let epoch = pr?.epoch ?? null;
    if (initial && !epoch) {
      const started = await epochStart(`guest-${Date.now().toString(36)}`)
        .catch(() => null) as { epoch?: string } | null;
      epoch = started?.epoch ?? null;
    }
    epochRef.current = epoch;
    setSession({ epoch, auth });
  }, [qc]);

  useEffect(() => { refreshIdentity(true); }, [refreshIdentity]);

  // W1/E28-01：跨标签广播订阅（session 区 auth.current 变化即刷新）
  useEffect(() => {
    const lst = (changes: Record<string, unknown>, area: string) => {
      if (area === 'session' && 'auth.current' in changes) {
        void refreshIdentity();
      }
    };
    browser.storage.onChanged.addListener(lst);
    return () => browser.storage.onChanged.removeListener(lst);
  }, [refreshIdentity]);

  const logout = async (): Promise<void> => {
    // 顺序（E70-05）：先取消在途，再撤身份，再清私有缓存，最后清规则/记账
    await qc.cancelQueries();
    await authLogout(); // storage.session auth 清除 + auth:deactivate（游客 UA）
    await epochStop();
    qc.removeQueries(); // 私有缓存全清（无跨账号复用）
    epochRef.current = null;
    setSession({ epoch: null, auth: null });
  };

  // 登录成功后由调用方（lib/auth 层）同步上下文。W1：轮询只作 onChanged 的兜底，
  // 统一走 refreshIdentity（token 去重；变更路径含 cancel+removeQueries）
  useEffect(() => {
    const t = setInterval(() => {
      if (session === 'loading') return;
      void refreshIdentity();
    }, 3000);
    return () => clearInterval(t);
  }, [session, refreshIdentity]);

  return <Ctx.Provider value={{ session, logout, epochRef }}>{children}</Ctx.Provider>;
}

/** storage.session → 供 queries 回填守卫读取的当前 epoch（轻量同步副本） */
export async function readAuthForTests(): Promise<AuthInfo | null> {
  const st = await browser.storage.session.get({ 'auth.current': null });
  return (st['auth.current'] as AuthInfo | null) ?? null;
}
