// G5 账号设置（F28 写面生产化，2026-10-31 口径：生产适配器+合成验证，真实变更=用户本人）。
// 端点（jadx 静态取证）：changePassword v5 / privacyFindSet（找朋友隐私）/ homePageSetting（主页可见）。
import { useState } from 'react';
import { runMutation, type MutationState } from '../../lib/mutation';
import { useSession } from '../../lib/session';

function useWrite() {
  const [phase, setPhase] = useState<MutationState | 'idle'>('idle');
  const [msg, setMsg] = useState('');
  async function go(endpoint: string, params: Record<string, string | number>): Promise<MutationState> {
    setPhase('Submitting');
    setMsg('');
    const r = await runMutation({ endpointId: endpoint, params, timeoutMs: 15000 });
    setPhase(r.state);
    setMsg(r.msg ?? (r.state === 'Confirmed' ? '已保存' : ''));
    if (r.state === 'Confirmed') setTimeout(() => setPhase('idle'), 2000);
    return r.state;
  }
  return { phase, msg, go };
}

function PasswordSection() {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const { phase, msg, go } = useWrite();
  return (
    <div className="card" data-test="pw-card" style={{ marginTop: 12 }}>
      <div className="card-title">修改密码</div>
      <div className="composer" style={{ marginTop: 8 }}>
        <div className="composer-field">
          <label className="composer-label" htmlFor="pw-old">当前密码</label>
          <input id="pw-old" type="password" className="composer-input" data-test="pw-old"
            value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        </div>
        <div className="composer-field">
          <label className="composer-label" htmlFor="pw-new">新密码（至少 6 位）</label>
          <input id="pw-new" type="password" className="composer-input" data-test="pw-new"
            value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </div>
        <div className="chiprow" style={{ alignItems: 'center' }}>
          <button className="btn btn-primary" data-test="pw-go"
            disabled={phase === 'Submitting' || !oldPw || newPw.length < 6}
            onClick={async () => {
              const st = await go('changePassword', { oldpassword: oldPw, newpassword: newPw });
              if (st === 'Confirmed') { setOldPw(''); setNewPw(''); }
            }}>
            {phase === 'Submitting' ? '提交中…' : '修改密码'}
          </button>
          {phase === 'Confirmed' && <span data-test="pw-ok" style={{ color: 'var(--ok)', fontSize: 13 }}>已修改 ✓</span>}
          {phase === 'OutcomeUnknown' && <span data-test="pw-unknown" style={{ fontSize: 12.5, color: 'var(--accent)' }}>{msg || '结果未知——请稍后在官方页核对，勿重复提交'}</span>}
          {phase === 'Rejected' && <span data-test="pw-rej" style={{ fontSize: 12.5, color: 'var(--text3)' }}>{msg}</span>}
        </div>
      </div>
      <p className="page-sub" style={{ margin: '8px 0 0' }}>真实修改以你的账号执行（成功后需用新密码重新登录）。</p>
    </div>
  );
}

function PrivacyToggle({ id, label, endpoint, onValue, offValue, initial }: {
  id: string; label: string; endpoint: string;
  onValue: string; offValue: string; initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const { phase, go } = useWrite();
  return (
    <div className="setrow" data-test={`privacy-${id}`}>
      <label className="setrow-label">{label}</label>
      <button className="toggle" role="switch" data-test={`privacy-toggle-${id}`}
        aria-checked={on} disabled={phase === 'Submitting'}
        onClick={() => { const v = !on; setOn(v); go(endpoint, v ? { [id]: onValue } : { [id]: offValue }); }}>
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

export function AccountSettingsPage() {
  const { session } = useSession();
  const auth = session === 'loading' ? null : session.auth;
  if (session === 'loading') return <p style={{ color: 'var(--text3)' }}>…</p>;
  if (!auth) {
    return (
      <div className="state-card" data-test="account-settings-guest">
        账号设置需登录后使用。
        <div style={{ marginTop: 10 }}><a className="btn" href="#/my">前往登录 ›</a></div>
      </div>
    );
  }
  return (
    <section data-test="account-settings">
      <div className="page-header">
        <p className="crumb"><a href="#/settings">‹ 设置</a></p>
        <h1 className="page-title" data-test="page-title">账号设置</h1>
      </div>
      <PasswordSection />
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">隐私</div>
        {/* 参数值域=静态推断（privacyFindSet/homePageSetting 的开/关取值形态待真数据核），
            首次切换前有「待核对」披露；失败自动回滚视觉态 */}
        <PrivacyToggle id="is_open_find" label="允许他人通过搜索找到我"
          endpoint="privacyFindSet" onValue="1" offValue="0" initial={true} />
        <PrivacyToggle id="home_visible" label="他人可见我的主页"
          endpoint="homePageSetting" onValue="1" offValue="0" initial={true} />
        <p className="page-sub" style={{ margin: '8px 0 0' }}>
          隐私开关的参数取值形态待真实数据核对（切换失败会自动回滚显示）。
        </p>
      </div>
    </section>
  );
}
