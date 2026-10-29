// C01 扩展侧端点登记表（G0/N-5）。对齐：Android 侧 C01a 定案（docs/g0_android_contracts_2026-10-21.md）
// + 服务器全量测绘（docs/server_topology_full_2026-10-21.md，8f83b785）。
// 纪律：只登记已验证 host+path 组合；不猜版本互通（app 与 mag1 在已对照 v1 路径行为一致，
// 但不因此互换）；GET 也可能非只读——语义副作用按测绘口径逐端点声明。
import { z } from 'zod';
import * as S from './schemas';

export type SideEffect = 'read-only' | 'read-may-mutate' | 'write';

export interface EndpointDef {
  endpointId: string;
  method: 'GET' | 'POST';
  host: 'app.sdgun.com.cn' | 'mag1.sdgun.net';
  path: string; // 精确路径（不含 query）
  paramLocation: 'query' | 'form'; // E24-07：参数编码位置
  sideEffect: SideEffect;
  auth: 'guest-ok' | 'token-required';
  pagination: 'page' | 'none';
  response: z.ZodTypeAny;
  notes: string;
}

export const ENDPOINTS: Record<string, EndpointDef> = {
  forumView: {
    endpointId: 'forumView',
    method: 'GET',
    paramLocation: 'query' as const,
    host: 'app.sdgun.com.cn',
    path: '/mag/circle/v1/forum/forumView',
    sideEffect: 'read-only',
    auth: 'guest-ok',
    pagination: 'page',
    response: S.ForumViewResp,
    notes: '列表行含 des/pics/is_top/typeid/applaud_count；meta page/total_page/count。游客实测通（R-A0）。',
  },
  commentList: {
    endpointId: 'commentList',
    method: 'GET',
    paramLocation: 'query' as const,
    host: 'app.sdgun.com.cn',
    path: '/mag/circle/v1/Forum/commentList',
    sideEffect: 'read-only',
    auth: 'guest-ok',
    pagination: 'page',
    response: S.CommentListResp,
    notes: '恒从 floor=2 起（主楼由 threadView 独立承载，C01a）；order=2 正序/1 倒序；authorid=只看楼主；step 被服务端忽略。',
  },
  threadView: {
    endpointId: 'threadView',
    method: 'GET',
    paramLocation: 'query' as const,
    host: 'app.sdgun.com.cn',
    path: '/mag/circle/v1/forum/threadView',
    sideEffect: 'read-only',
    auth: 'guest-ok',
    pagination: 'none',
    response: S.ThreadViewResp,
    notes: '主楼独立端点（C01a 定案，title 唯一源，40 字段形态）；夹具为形态采样非全字段。',
  },
  circleTree: {
    endpointId: 'circleTree',
    method: 'GET',
    paramLocation: 'query' as const,
    host: 'app.sdgun.com.cn',
    path: '/mag/circle/v1/Circle/circleTree',
    sideEffect: 'read-only',
    auth: 'guest-ok',
    pagination: 'none',
    response: S.CircleTreeResp,
    notes: '游客全量 5 分组树（8f83b785 修正：树活着）；type_value=论坛 fid，circle id 独立保存。',
  },
  userMessageGroupList: {
    endpointId: 'userMessageGroupList',
    method: 'POST',
    paramLocation: 'query' as const,
    host: 'mag1.sdgun.net',
    path: '/mag/user/v1/UserNotify/userMessageGroupList',
    sideEffect: 'read-may-mutate', // 消息读取可能标已读——读取副作用单列（总设计 §3 F21）
    auth: 'token-required',
    pagination: 'page',
    response: S.MsgGroupResp,
    notes: 'G3 实测当前账号空列表（合法空）；详情端点参数待 G3+ 补测。',
  },
  userNotifyIndex: {
    endpointId: 'userNotifyIndex',
    method: 'POST',
    paramLocation: 'query' as const,
    host: 'mag1.sdgun.net',
    path: '/mag/user/v1/UserNotify/userNotifyIndex',
    sideEffect: 'read-may-mutate',
    auth: 'token-required',
    pagination: 'none',
    response: S.NotifyResp,
    notes: '通知分类索引；同上空容忍。（官 APK 现用 v3 messageIndex——v1 为 G3 实测存活版本，不互换。）',
  },
  notifyList: {
    endpointId: 'notifyList',
    method: 'POST',
    paramLocation: 'query' as const,
    host: 'mag1.sdgun.net',
    path: '/mag/user/v3/UserNotify/notifyList',
    sideEffect: 'read-may-mutate',
    auth: 'token-required',
    pagination: 'page',
    response: S.NotifyListResp,
    notes: '通知历史（C4-1 静态取证 2026-10-25：官 APK API.Chat.notifyList v3 路径 + DataPage 分页参数 p/last_time/step + SystemNotifyDbBean 行字段 15 个；响应整体信封待登录实测）。列表读取可能触发站方已读上报——真数据验证=用户门禁。',
  },
  replyAdd: {
    endpointId: 'replyAdd',
    method: 'POST',
    paramLocation: 'form' as const,
    host: 'mag1.sdgun.net',
    path: '/mag/circle/v1/Forum/replyAdd',
    sideEffect: 'write',
    auth: 'token-required',
    pagination: 'none',
    response: S.WriteResp,
    notes: '回复（批D 静态取证：官 APK FroumFriendsDataView——tid/reply_id(被引楼层,可选)/circle_id/content；真实写入=用户本人 MANUAL，agent 验证止步合成）。',
  },
  threadAdd: {
    endpointId: 'threadAdd',
    method: 'POST',
    paramLocation: 'form' as const,
    host: 'mag1.sdgun.net',
    path: '/mag/circle/v1/Forum/threadAdd',
    sideEffect: 'write',
    auth: 'token-required',
    pagination: 'none',
    response: S.WriteResp,
    notes: '发帖（批D 静态取证：官 APK ThreadPostActivity——title/content/fid/circle_id[+tid/modthreadkey=编辑]；同盾 auth 仅在 partner_key 非空时需要）。',
  },
  contentAddApplaud: {
    endpointId: 'contentAddApplaud',
    method: 'POST',
    paramLocation: 'form' as const,
    host: 'mag1.sdgun.net',
    path: '/mag/circle/v1/Forum/contentAddApplaud',
    sideEffect: 'write',
    auth: 'token-required',
    pagination: 'none',
    response: S.WriteResp,
    notes: '楼层点赞（批D 静态取证：官 APK FroumDataView.addApplaud——content_id=楼层 pid）。',
  },
  userCircleList: {
    endpointId: 'userCircleList',
    method: 'GET',
    paramLocation: 'query' as const,
    host: 'mag1.sdgun.net',
    path: '/mag/circle/v1/circle/userCircleList',
    sideEffect: 'read-only',
    auth: 'token-required',
    pagination: 'none',
    response: S.UserCircleListResp,
    notes: '我的板块（C4-2）。2026-10-21 登录态实采 3 行（api_survey §L60：isjoined/new_content/p_circle/simple_des；行=circle 对象同树形态）+ 官 APK uid 参数（UserGroupJoinedListFragment，singlePage=无分页）。',
  },
  userCollectList: {
    endpointId: 'userCollectList',
    method: 'GET',
    paramLocation: 'query' as const,
    host: 'mag1.sdgun.net',
    path: '/mag/user/v1/User/userCollectList',
    sideEffect: 'read-only',
    auth: 'token-required',
    pagination: 'page',
    response: S.UserCollectListResp,
    notes: '收藏列表（C4-3 静态取证 2026-10-25：官 APK UserCollectActivity + UserCollectItem——DataPage GET 分页 p；行字段 id/userId/title/pic/catName/key/link/toUserId/createTimeStr/name。信封待登录实测）。',
  },
  userMessageList: {
    endpointId: 'userMessageList',
    method: 'GET',
    paramLocation: 'query' as const,
    host: 'mag1.sdgun.net',
    path: '/mag/user/v1/UserNotify/userMessageList',
    sideEffect: 'read-may-mutate', // 消息族：读取会话可能标已读（同 family 口径）
    auth: 'token-required',
    pagination: 'page',
    response: S.UserMessageListResp,
    notes: '私信会话历史（C4-4 静态取证 2026-10-25：官 APK LetterChatActivity=API.Chat.letterMessage，参数 uid+page；行=LetterChatBean mid/uid/name/head/title/content/dateline。读取副作用如实披露；真探参=凭据批）。',
  },
  infoListByCatId: {
    endpointId: 'infoListByCatId',
    method: 'GET',
    paramLocation: 'query' as const,
    host: 'mag1.sdgun.net',
    path: '/mag/info/v2/channel/infoListByCatId',
    sideEffect: 'read-only',
    auth: 'guest-ok',
    pagination: 'page',
    response: S.InfoListResp,
    notes: 'mag1 资讯流（游客全开，R-A0 既有）；mag1 域与 app 域不互换版本/路径。',
  },
};

// ID 命名空间（总设计 §4）：fid/circleId/tid/pid/ShowContentId/InfoId 互不混用
export type IdNamespace = 'fid' | 'circleId' | 'tid' | 'pid' | 'showContentId' | 'infoId';
