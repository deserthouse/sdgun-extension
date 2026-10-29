// G3/M6-A 消息真实路由：游客=登录提示；登录态=通知摘要+会话组列表+详情面板。
// C4-4：详情面板接 userMessageList 会话历史（静态取证；read-may-mutate 如实披露）。
import { useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { StateBlock, StateBadge } from './StateBlock';
import { useSession } from '../../lib/session';
import { Avatar } from './Avatar';
import { formatTime } from '../../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */

// C4-4 会话历史（userMessageList，静态取证 LetterChatActivity：参数 uid+page）。
// peer uid 键名以真实分组行形态为准前取三兜底；read-may-mutate 披露在面板内。
function MsgHistory({ peer, myId }: { peer: any; myId: string }) {
  const uid = String(peer.uid ?? peer.user_id ?? peer.id ?? '');
  const q = useEndpoint('userMessageList', uid ? { uid, p: 1 } : { p: 1 });
  const rows = (q.data as any)?.list ?? [];
  return (
    <div data-test="msg-history" style={{ marginTop: 12 }}>
      <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} skeletonRows={2} />
      {q.state !== 'InitialLoading' && rows.length === 0 && (
        <div className="state-card" data-test="msg-history-empty">无更多历史消息</div>
      )}
      {rows.filter((m: any) => String(m.content ?? '').trim()).map((m: any, i: number) => (
        <div key={String(m.mid ?? i)} data-test="msg-row"
          className={'msg-bubble-row' + (String(m.uid) === myId ? ' mine' : '')}>
          <div className="msg-bubble">
            {String(m.uid) !== myId && (
              <div className="card-meta" style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text)' }}>{m.name ?? uid}</strong>
              </div>
            )}
            <div style={{ fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-sm)' }}>
              {String(m.content ?? '')}
            </div>
          </div>
        </div>
      ))}
      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
        读取会话历史可能触发站方已读上报（消息族端点副作用如实披露）。
      </p>
    </div>
  );
}

export function MessagesPage() {
  // W1/E28-01：身份走 SessionProvider（onChanged 跨标签广播），不再单次读取
  const { session } = useSession();
  const auth = session === 'loading' ? 'loading' : session.auth;

  if (auth === 'loading') return <p style={{ color: 'var(--text3)' }}>…</p>;
  if (!auth) {
    return (
      <div data-test="messages-guest">
        <div className="state-card" data-test="messages-guest-prompt">
          消息需登录后查看。
          <div style={{ marginTop: 10 }}>
            <a className="btn" href="#/my" data-test="messages-goto-login">前往登录 ›</a>
          </div>
        </div>
      </div>
    );
  }
  return <MessagesAuthed />;
}

function MessagesAuthed() {
  const { session } = useSession();
  const myId = session === 'loading' ? '' : String(session.auth?.userId ?? '');
  const [tab, setTab] = useState<'msg' | 'notify'>('msg');
  const [openGroup, setOpenGroup] = useState<any | null>(null);
  const msg = useEndpoint(tab === 'msg' ? 'userMessageGroupList' : 'userNotifyIndex',
    tab === 'msg' ? { p: 1 } : {});
  const items = (msg.data as any)?.list ?? [];
  const notify = (msg.data as any)?.data ?? null;

  return (
    <div data-test="messages-authed">
      <div className="chiprow">
        <button className={'btn' + (tab === 'msg' ? ' on' : '')} data-test="tab-msg"
          style={tab === 'msg' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
          onClick={() => { setTab('msg'); setOpenGroup(null); }}>消息</button>
        <button className={'btn' + (tab === 'notify' ? ' on' : '')} data-test="tab-notify"
          style={tab === 'notify' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
          onClick={() => { setTab('notify'); setOpenGroup(null); }}>通知</button>
      </div>
      <StateBlock state={msg.state} fail={msg.fail} onRetry={() => msg.refetch()} skeletonRows={3} />

      {tab === 'msg' && msg.state === 'Empty' && !openGroup && (
        <div className="state-card" data-test="empty">暂无消息会话</div>
      )}
      {tab === 'msg' && !openGroup && items.map((m: any) => (
        <button key={String(m.id)} className="card msg-group" data-test="msg-group"
          onClick={() => setOpenGroup(m)}>
          <Avatar src={m.user_head ?? m.head} name={m.name ?? m.title ?? m.user_name} size={40} />
          <span className="msg-main">
            <span className="card-title">{m.name ?? m.title ?? m.user_name ?? '(会话)'}</span>
            {m.last_summary ?? m.content ? (
              <span className="card-sub">{String(m.last_summary ?? m.content ?? '').slice(0, 60)}</span>
            ) : null}
          </span>
          {m.time ? <span className="card-meta">{formatTime(m.time)}</span> : null}
        </button>
      ))}
      {tab === 'msg' && openGroup && (
        <div className="card" data-test="msg-detail">
          <div className="card-meta">
            <button className="btn" data-test="detail-back"
              onClick={() => setOpenGroup(null)}>‹ 返回列表</button>
          </div>
          <div className="card-title" style={{ marginTop: 8 }}>
            {openGroup.name ?? openGroup.title ?? '(会话)'}
          </div>
          {openGroup.last_summary ?? openGroup.content ? (
            <div className="card-sub">{String(openGroup.last_summary ?? openGroup.content ?? '')}</div>
          ) : null}
          <MsgHistory peer={openGroup} myId={myId} />
        </div>
      )}

      {tab === 'notify' && msg.state !== 'InitialLoading' && notify && (
        <div data-test="notify-summary">
          {(() => {
            const rows = [
              ['私信', notify.has_letter ? '有新私信' : '暂无新私信'],
              ['系统通知', String(notify.system_notify_count ?? 0)],
              ['好友申请', String(notify.friend_apply_count ?? 0)],
            ];
            return rows.map(([k, v]) => (
              <div key={k} className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="card-title">{k}</span>
                <span className="card-meta">{v}</span>
              </div>
            ));
          })()}
          {notify.service ? (
            <div className="card">
              <div className="card-title">{String(notify.service.name ?? '官方客服')}</div>
              <div className="card-sub">{String(notify.service.content ?? '')}</div>
            </div>
          ) : null}
          <NotifyHistory />
        </div>
      )}
    </div>
  );
}

// C4-1 通知历史（notifyList v3）：端点为 read-may-mutate——读取可能触发站方已读
// 上报（如实披露）；响应整体信封待真数据验证（C4 凭据批），当前渲染行公共字段。
function NotifyHistory() {
  const nl = useEndpoint('notifyList', { p: 1 });
  const rows = ((nl.data as any)?.list ?? []) as any[];
  return (
    <div data-test="notify-history" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 15, color: 'var(--text2)', margin: '0 0 8px' }}>
        通知历史 <StateBadge state={nl.state} />
      </h2>
      <StateBlock state={nl.state} fail={nl.fail} onRetry={() => nl.refetch()} skeletonRows={3} />
      {nl.state !== 'InitialLoading' && rows.map((n, i) => (
        <div key={String(n.id ?? n.notifyId ?? i)} className="card" data-test="notify-row">
          <div className="card-title">{String(n.title ?? '(通知)')}</div>
          {n.content ? <div className="card-sub">{String(n.content).slice(0, 80)}</div> : null}
          <div className="card-meta">{String(n.time ?? '')}</div>
        </div>
      ))}
      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
        读取通知列表可能触发站方已读上报（消息族端点副作用如实披露）。
      </p>
    </div>
  );
}
