// G4→N-B1 搜索页：双通道（板块/圈子 | 用户）。行键=soak3 实测（圈子 id/name/icon_tburl/link；用户 id/name/cert_des）。
// 帖子内容搜索：站方无内容搜索 API（soak 实测与 2026-10-21 测绘互证）→ H5 承载显式标注。
import { useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { StateBlock, StateBadge } from './StateBlock';
import { internalRouteFromUrl } from '../../lib/linkmap';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function SearchPage() {
  const [text, setText] = useState('');
  const [fired, setFired] = useState('');
  const [tab, setTab] = useState<'circle' | 'user'>('circle');
  const circleQ = useEndpoint('allTopicSearch', { keyword: fired, p: 1, step: 20 },
    { enabled: fired !== '' && tab === 'circle' });
  const userQ = useEndpoint('userSearch', { name: fired, p: 1, step: 20 },
    { enabled: fired !== '' && tab === 'user' });
  const q = tab === 'circle' ? circleQ : userQ;
  const rows = ((q.data as any)?.list ?? []) as any[];
  return (
    <section>
      <div className="page-header">
        <h1 className="page-title" data-test="page-title">搜索</h1>
      </div>
      <form className="composer" data-test="search-form" onSubmit={(e) => {
        e.preventDefault();
        setFired(text.trim());
      }}>
        <div className="composer-field">
          <label className="composer-label" htmlFor="search-input">搜索板块/圈子/用户（帖子内容请用 H5 搜索）</label>
          <input id="search-input" className="composer-input" data-test="search-input"
            value={text} placeholder="输入关键词，回车搜索"
            onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="chiprow" style={{ alignItems: 'center' }}>
          <button className="btn btn-primary" data-test="search-go" type="submit"
            disabled={!text.trim()}>搜索</button>
          <StateBadge state={fired ? q.state : 'Data'} />
          <a className="chip" target="_blank" rel="noreferrer" data-test="search-h5"
            href={`https://bbs.sdgun.com.cn/search.php?mod=forum&mobile=2&srchtxt=${encodeURIComponent(fired || text)}`}>
            H5 内容搜索 ↗</a>
        </div>
      </form>
      {fired && (
        <div className="chiprow" data-test="search-tabs">
          <button className={'chip' + (tab === 'circle' ? ' on' : '')} data-test="search-tab-circle"
            aria-pressed={tab === 'circle'}
            onClick={() => setTab('circle')}>板块/圈子</button>
          <button className={'chip' + (tab === 'user' ? ' on' : '')} data-test="search-tab-user"
            aria-pressed={tab === 'user'}
            onClick={() => setTab('user')}>用户</button>
        </div>
      )}
      {fired && <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} skeletonRows={3} />}
      {fired && q.state === 'Empty' && (
        <div className="state-card" data-test="search-empty">
          {tab === 'circle' ? '没有匹配的板块/圈子。帖子内容搜索请用 H5 搜索（站方无内容搜索 API）。'
            : '没有匹配的用户。'}
        </div>
      )}
      {tab === 'circle' && rows.map((r, i) => {
        const href = typeof r.link === 'string' && r.link
          ? internalRouteFromUrl(r.link) ?? r.link : null;
        const inner = (
          <>
            <div className="card-title">{String(r.name ?? `(圈子 ${r.id ?? ''})`)}</div>
            {r.info ? <div className="card-sub">{String(r.info).slice(0, 80)}</div> : null}
          </>
        );
        return href
          ? <a key={String(r.id ?? i)} className="card" data-test="search-row"
              {...(href.startsWith('#') ? { href } : { href, target: '_blank', rel: 'noreferrer' })}>{inner}</a>
          : <div key={String(r.id ?? i)} className="card" data-test="search-row">{inner}</div>;
      })}
      {tab === 'user' && rows.map((u, i) => {
        const uid = String(u.user_id ?? u.id ?? '');
        return uid
          ? <a key={uid + i} className="card" data-test="search-row" data-user-row="1"
              href={`#/user/${uid}`}>
              <div className="card-title">{String(u.name ?? `(用户 ${uid})`)}</div>
              {u.cert_des ? <div className="card-sub">{String(u.cert_des)}</div> : null}
            </a>
          : null;
      })}
    </section>
  );
}
