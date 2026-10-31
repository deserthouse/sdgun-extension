// API broker（E1-4）：contracts/ 登记表驱动的受控调用面。
// 纪律（总设计 §4）：按 endpointId 调用、不接受页面传任意 URL；GET 也过 schema；
// 超时 20s 全程（AbortController）；全局普通读取并发先限 3；错误归类九态失败面。
// 认证头不由本模块携带——E1-4 起由 SW 的 DNR session 规则按登记 host+path 注入（E00-1 口径）。
import { ENDPOINTS } from '../../contracts/api/endpoints';

export type FailKind =
  | 'RetryableError' | 'AuthRequired' | 'PermissionDenied' | 'Unsupported' | 'NetworkError'
  // E31-03：请求已送达（HTTP 2xx）但响应不可辨——对写链=结果未知（服务器可能已执行），
  // 对读链按可重试错误呈现（deriveState 同映射）
  | 'ResponseUnverified';

export interface Fail {
  kind: FailKind;
  msg: string;
  code?: number;
}

export function isFail(e: unknown): e is Fail {
  return typeof e === 'object' && e !== null && 'kind' in e && 'msg' in e;
}

// 全局并发闸：普通读取先限 3（缺口：认证/变更通道另计，不占普通读取额度）
let active = 0;
const waiters: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 3) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    waiters.shift()?.();
  }
}

export interface CallOpts {
  params?: Record<string, string | number>;
  timeoutMs?: number;
  /** W1/E28-01：请求信号贯穿——身份切换 cancelQueries 即中止在途旧请求 */
  signal?: AbortSignal;
}

// 测试缝：host 覆盖（离线夹具服务器）。产品代码绝不调用 setter。
// 存 localStorage——reload 存活 + 跨 chunk 实例一致（模块变量/window 都被
// reload 或分包打穿过，E1-4/M1-b 双实证）。
export function setHostOverride(h: string | null): void {
  try {
    if (h === null) localStorage.removeItem('sdg2.hostOverride');
    else localStorage.setItem('sdg2.hostOverride', h);
  } catch { /* 非 extension 页环境忽略 */ }
}

function hostOverride(): string | null {
  try {
    return localStorage.getItem('sdg2.hostOverride');
  } catch {
    return null;
  }
}

// 测试缝：合成端点注册（仅 mutation 离线测试使用；产品构建不调用）。
const syntheticEndpoints: Record<string, typeof ENDPOINTS[string]> = {};

export function registerSyntheticEndpoint(id: string, def: typeof ENDPOINTS[string]): void {
  syntheticEndpoints[id] = def;
}

export async function callEndpoint<T = unknown>(id: string, opts: CallOpts = {}): Promise<T> {
  const def = syntheticEndpoints[id] ?? ENDPOINTS[id];
  if (!def) {
    throw { kind: 'Unsupported', msg: `unregistered endpoint: ${id}` } as Fail;
  }
  const url = new URL((hostOverride() ?? 'https://' + def.host) + def.path);
  // E24-07：form 端点参数不进 query（放 body）；读端点全为 query
  const isForm = def.method === 'POST' && def.paramLocation === 'form';
  const formBody = isForm && opts.params
    ? new URLSearchParams(Object.entries(opts.params).map(([k, v]) => [k, String(v)])).toString()
    : undefined;
  if (!isForm) {
    for (const [k, v] of Object.entries(opts.params ?? {})) {
      url.searchParams.set(k, String(v));
    }
  }
  return withSlot(async () => {
    const ctrl = new AbortController();
    // W1/E28-01：外部 signal（查询取消）与超时组合到同一控制器
    const onOuterAbort = () => ctrl.abort();
    opts.signal?.addEventListener('abort', onOuterAbort);
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
    try {
      const resp = await fetch(url.toString(), {
        method: def.method,
        signal: ctrl.signal,
        headers: def.method === 'POST'
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : undefined,
        ...(formBody !== undefined ? { body: formBody } : {}),
      });
      if (!resp.ok) {
        throw { kind: 'RetryableError', msg: `HTTP ${resp.status}`, code: resp.status } as Fail;
      }
      const body: unknown = await resp.json().catch(() => null);
      if (body && typeof body === 'object' && 'code' in (body as Record<string, unknown>)) {
        const code = (body as { code: unknown }).code;
        if (code === 1001) {
          throw { kind: 'AuthRequired', msg: '请先登录', code: 1001 } as Fail;
        }
        if (code === 1003) {
          throw { kind: 'PermissionDenied', msg: '无权限', code: 1003 } as Fail;
        }
      }
      // W1/E28-03：业务失败信封先于 schema 判定——失败不得被「schema mismatch」
      // 掩盖成解析错误，更不得流入「成功空列表」语义
      if (body && typeof body === 'object'
        && 'success' in (body as Record<string, unknown>)
        && (body as { success: unknown }).success === false) {
        const msg = typeof (body as { msg?: unknown }).msg === 'string'
          ? (body as { msg: string }).msg : '服务器拒绝了该请求';
        throw { kind: 'RetryableError', msg } as Fail;
      }
      const parsed = def.response.safeParse(body);
      if (!parsed.success) {
        throw { kind: 'ResponseUnverified', msg: '响应格式不可识别' } as Fail;
      }
      return parsed.data as T;
    } catch (e) {
      if (isFail(e)) throw e;
      if (e instanceof DOMException && e.name === 'AbortError') {
        // 外部取消（身份切换/组件卸载）与超时同形——网络态 Fail 由上层忽略静默
        throw { kind: 'NetworkError', msg: 'aborted' } as Fail;
      }
      throw { kind: 'NetworkError', msg: String((e as Error)?.message ?? e).slice(0, 120) } as Fail;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onOuterAbort);
    }
  });
}

// ---- 九态推导（纯函数；TanStack Query 状态 → 九态）----
export type NineState =
  | 'InitialLoading' | 'Data' | 'Empty' | 'Refreshing' | 'Stale'
  | 'RetryableError' | 'AuthRequired' | 'PermissionDenied' | 'Unsupported';

export interface QueryShape<T> {
  isPending: boolean;
  isFetching: boolean;
  isStale: boolean;
  data: T | undefined;
  isEmpty?: boolean; // 调用方按业务判空（list 长度）
  error: unknown;
}

export function deriveState<T>(q: QueryShape<T>): NineState {
  if (q.error !== null && q.error !== undefined) {
    if (isFail(q.error) && (q.error.kind === 'AuthRequired'
      || q.error.kind === 'PermissionDenied' || q.error.kind === 'Unsupported')) {
      return q.error.kind;
    }
    return 'RetryableError'; // ResponseUnverified/NetworkError 读链同呈现
  }
  if (q.isPending) return 'InitialLoading';
  if (q.isEmpty) return 'Empty';
  if (q.isFetching) return 'Refreshing';
  if (q.isStale) return 'Stale';
  return 'Data';
}

// 测试缝（rsalab 先例）：离线驱动经 window.__broker 直调
declare global {
  interface Window {
    __broker?: {
      call: typeof callEndpoint;
      deriveState: typeof deriveState;
      setHost: (h: string | null) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      register: (id: string, def: any) => void;
    };
  }
}

export function exposeTestSeam(): void {
  if (typeof window !== 'undefined') {
    window.__broker = {
      call: callEndpoint,
      deriveState,
      setHost: setHostOverride,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      register: registerSyntheticEndpoint as (id: string, def: any) => void,
    };
  }
}
