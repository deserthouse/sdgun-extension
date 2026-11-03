// G4 原生搜索（topicSearch/allTopicSearch 勘定登记）：游客恒空=诚实空态（2026-10-21
// 实测口径）；H5 回退保留。行点击→站内路由（tid 可映射）或外开。
import { useState } from 'react';
import { useEndpoint } from '../../lib/queries';
import { StateBlock, StateBadge } from './StateBlock';
import { internalRouteFromUrl } from '../../lib/linkmap';
import { formatTime } from '../../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function SearchPage() {
  const [text, setText] = useState('');
  const [fired, setFired] = useState('');
  const { session } = {} as any; // 占位防误用（本页不读会话——游客即知恒空）
  const q = useEndpoint('allTopicSearch', { keyword: fired, p: 1, step: 20 },
    { enabled: fired !== '' });
  const rows = ((q.data as any)?.list ?? []) as any[];
  const authed = fired !== ''; // 简化：查询即发起；游客结果形态由服务端决定
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
          <label className="composer-label" htmlFor="search-input">搜索板块/圈子（帖子内容请用 H5 搜索）</label>
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
            H5 搜索 ↗</a>
        </div>
      </form>
      {fired && <StateBlock state={q.state} fail={q.fail} onRetry={() => q.refetch()} skeletonRows={3} />}
      {fired && q.state === 'Empty' && (
        <div className="state-card" data-test="search-empty">
          没有匹配的板块/圈子。帖子内容搜索请用 H5 搜索（站方无内容搜索 API——2026-11-03 实测与 2026-10-21 测绘互证）。
        </div>
      )}
      {/* soak 实测定性：allTopicSearch=圈子搜索（行={id,name,info,icon_tburl,link}） */}
      {rows.map((r, i) => {
        const cid = String(r.id ?? '');
        const href = typeof r.link === 'string' && r.link
          ? internalRouteFromUrl(r.link) ?? r.link : null;
        const inner = (
          <>
            <div className="card-title">{String(r.name ?? `(圈子 ${cid})`)}</div>
            {r.info ? <div className="card-sub">{String(r.info).slice(0, 80)}</div> : null}
          </>
        );
        return href
          ? <a key={cid + i} className="card" data-test="search-row"
              {...(href.startsWith('#') ? { href } : { href, target: '_blank', rel: 'noreferrer' })}>{inner}</a>
          : <div key={cid + i} className="card" data-test="search-row">{inner}</div>;
      })}
    </section>
  );
}
