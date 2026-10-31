// MutationGateway（M6-B/E70-01）：写面状态机 Draft→Validating→Submitting→
// Confirmed/Rejected/OutcomeUnknown。产品构建端点不接（写面封存）；测试经
// host override 指向合成后端（lib/broker 同一 localStorage 源）。
// 语义（总设计 §4）：retry=0；超时/无响应=OutcomeUnknown（不自动重发，显示"结果待确认"）；
// 失败保草稿；UI 防双击不冒充服务器幂等。
import { callEndpoint, type Fail } from './broker';

export type MutationState =
  | 'Draft' | 'Validating' | 'Submitting' | 'Confirmed' | 'Rejected' | 'OutcomeUnknown';

export interface MutationResult {
  state: MutationState;
  msg?: string;
  serverData?: unknown;
}

export interface SubmitSpec {
  endpointId: string;
  params?: Record<string, string | number>;
  /** 提交前本地校验（Validating 阶段）；抛错=Rejected(msg) */
  validate?: () => void;
  timeoutMs?: number;
}

export async function runMutation(spec: SubmitSpec): Promise<MutationResult> {
  if (spec.validate) {
    try {
      spec.validate();
    } catch (e) {
      return { state: 'Rejected', msg: String((e as Error).message ?? e).slice(0, 120) };
    }
  }
  try {
    const data = await callEndpoint<Record<string, unknown>>(spec.endpointId, {
      params: spec.params,
      timeoutMs: spec.timeoutMs ?? 20000,
    });
    // 服务器 success=false（非 1001/1003 的业务驳回）→ Rejected
    if (data && typeof data === 'object' && data['success'] === false) {
      const msg = typeof data['msg'] === 'string' ? data['msg'] : '服务器驳回';
      return { state: 'Rejected', msg };
    }
    return { state: 'Confirmed', serverData: data };
  } catch (e) {
    const fail = e as Fail;
    // E31-03：已送达但响应不可辨=服务器可能已执行——绝不断言未发生（不自动重发）
    if (fail?.kind === 'NetworkError' || fail?.kind === 'ResponseUnverified') {
      return { state: 'OutcomeUnknown', msg: (fail?.msg ? fail.msg + '——' : '')
        + '结果未知，请勿重复提交' };
    }
    return { state: 'Rejected', msg: fail?.msg ?? String(e).slice(0, 120) };
  }
}
