// 九态渲染组件（E1-5）：所有数据页共用同一状态面——骨架/空/可重试错误/登录/权限。
import type { Fail, NineState } from '../../lib/broker';

export function StateBlock(props: {
  state: NineState;
  fail?: Fail | null;
  onRetry?: () => void;
  skeletonRows?: number;
}) {
  const { state, fail, onRetry, skeletonRows = 5 } = props;
  if (state === 'InitialLoading') {
    return (
      <div data-test="skeleton">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <div key={i} className="skel-row" />
        ))}
      </div>
    );
  }
  if (state === 'Empty') {
    return <div className="state-card" data-test="empty">暂无内容</div>;
  }
  if (state === 'RetryableError') {
    return (
      <div className="state-card" data-test="error">
        加载失败（{fail?.msg ?? '未知错误'}）
        {onRetry && <button className="btn" onClick={onRetry}>重试</button>}
      </div>
    );
  }
  if (state === 'AuthRequired') {
    return <div className="state-card" data-test="auth-required">需要登录后查看</div>;
  }
  if (state === 'PermissionDenied') {
    return <div className="state-card" data-test="denied">当前账号无权限</div>;
  }
  if (state === 'Unsupported') {
    return <div className="state-card" data-test="unsupported">此功能尚未开放</div>;
  }
  return null; // Data/Refreshing/Stale 由页面渲染数据（Refreshing/Stale 可叠角标）
}

export function StateBadge({ state }: { state: NineState }) {
  if (state === 'Refreshing') {
    return <span data-test="stale-badge" style={{ fontSize: 11, color: 'var(--text3)' }}>更新中…</span>;
  }
  if (state === 'Stale') {
    return <span data-test="stale-badge" style={{ fontSize: 11, color: 'var(--text3)' }}>可能已过期</span>;
  }
  return null;
}
