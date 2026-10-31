// C01 响应 schema（zod）。字段=实测形态（2026-10-22 E1-5 实采修正：三读端点均为
// 顶层 list 信封——{success, code:100, msg, list, ...}，无 data 包装页 meta，
// 翻页以 p+step 迭代、列表短于 step 即尾页）。未知字段透传。
import { z } from 'zod';

const okCode = z.number().int();

const ForumRow = z.object({
  tid: z.union([z.number(), z.string()]),
  subject: z.string(),
  des: z.string().optional(),
  // 封面图组（2026-10-29 实采：字符串 URL 数组，picapp 域；可为 '[]'/null）
  pics: z.array(z.string()).nullable().optional(),
  user_name: z.string().optional(),
  reply_count: z.union([z.number(), z.string()]).optional(),
  is_top: z.unknown().optional(),
  typeid: z.unknown().optional(),
}).passthrough();

export const ForumViewResp = z.object({
  success: z.boolean(),
  code: okCode,
  list: z.array(ForumRow),
  toplist: z.unknown().optional(),
}).passthrough();

// 楼层不变量（C01a）：commentList 恒从 floor=2 起，主楼由 threadView 独立承载——
// 契约面直接拒绝 floor=1（业务不变量进 schema，不是注释）
const Floor = z.union([
  z.number().int().gte(2),
  z.string().regex(/^\d+$/).refine((s) => parseInt(s, 10) >= 2, 'floor starts at 2'),
]);

export const CommentListResp = z.object({
  success: z.boolean(),
  list: z.array(z.object({
    id: z.union([z.number(), z.string()]).optional(), // 实测键=id（pid 为旧记，保留可选）
    floor: Floor.optional(),
    content: z.string().optional(), // HTML 串（渲染端 DOMPurify 清洗——清洗在 client，不在 SW）
    user_name: z.string().optional(),
    // C1-2 引用（真实形态样本 tests/probe_out/to_comment_sample_2026-10-25.json）：
    // {id=被引用 pid, user_name, content(HTML 串), floor, time, ...}；被引楼层可能已删
    // → 所有字段 optional，渲染端缺失容忍。
    to_comment: z.object({
      id: z.union([z.number(), z.string()]).optional(),
      user_name: z.string().optional(),
      content: z.string().optional(),
      floor: z.union([z.number(), z.string()]).optional(),
      time: z.string().optional(),
    }).passthrough().optional(),
  }).passthrough()),
  page: z.union([z.number(), z.string()]).optional(),
  total_page: z.union([z.number(), z.string()]).optional(),
  count: z.union([z.number(), z.string()]).optional(),
}).passthrough();

export const ThreadViewResp = z.object({
  success: z.boolean(),
  data: z.object({
    title: z.string(), // 主楼标题唯一源（C01a）
  }).passthrough(),
}).passthrough();

export const CircleTreeResp = z.object({
  success: z.boolean(),
  list: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    name: z.string(),
    circle_list: z.array(z.object({
      type_value: z.string(), // =论坛 fid（circle id 另存；实测恒字符串）
      name: z.string(),
    }).passthrough()),
  }).passthrough()),
}).passthrough();

export const InfoListResp = z.object({
  success: z.boolean(),
  list: z.array(z.object({
    id: z.union([z.number(), z.string()]), // InfoId 命名空间（与 tid 不可混用）
    title: z.string().optional(),
  }).passthrough()),
}).passthrough();

// G3：消息组/通知（登录态；实测当前账号为合法空——空容忍渲染）
export const MsgGroupResp = z.object({
  success: z.boolean(),
  list: z.array(z.object({
    id: z.union([z.number(), z.string()]).optional(),
  }).passthrough()),
  asyn_ask: z.unknown().optional(),
}).passthrough();

// userNotifyIndex 实测形态（E1-5/G3 实采）：分类摘要对象（无 list）——
// has_letter/system_notify_count/friend_apply_count/service(客服卡) 等
export const NotifyResp = z.object({
  success: z.boolean(),
  data: z.object({
    has_letter: z.unknown().optional(),
    system_notify_count: z.unknown().optional(),
    friend_apply_count: z.unknown().optional(),
  }).passthrough(),
  asyn_ask: z.unknown().optional(),
}).passthrough();

// notifyList 通知历史（C4-1 静态取证 2026-10-25：官 APK
// net.duohuo.magappx.API.Chat.notifyList=/mag/user/v3/UserNotify/notifyList；
// 分页参数 DataPage p/last_time/step；行字段 SystemNotifyDbBean 15 个）。
// 响应整体信封待登录实测（C4 凭据批）——行字段全 optional、passthrough。
export const NotifyListResp = z.object({
  success: z.boolean(),
  list: z.array(z.object({
    id: z.unknown().optional(),
    notifyId: z.unknown().optional(),
    title: z.string().optional(),
    content: z.string().optional(),
    time: z.string().optional(),
    pic: z.string().optional(),
    link: z.string().optional(),
  }).passthrough()),
}).passthrough();

// R1/E31-07 BoardRef：fid（论坛板块 id，URL/树体系）与 circle_id（服务端在
// threadAddColumnInfoV2 响应中下发的圈子 id）是不同字段——官 APK
// ThreadPostActivity 从该响应 SafeJsonUtil 读 circle_id 后回填 threadAdd。
// 编辑器发帖必须走 column-info 换取 circle_id，不得直接以 fid 冒充。
export interface BoardRef {
  fid: string;
  circleId: string; // 服务端下发；column-info 未返回时为 ''（受限模式）
}

// R1 ReplyTarget：回复目标（tid 必备；replyId=被回复楼层 pid，官方
// FroumFriendsDataView 实证 param reply_id=被回复评论 id；quote 场景传入）
export interface ReplyTarget {
  tid: string;
  replyId?: string;
  circleId: string;
}

// threadAddColumnInfoV2 响应（静态取证：ThreadPostActivity onResult 读
// data.circle_id/title/fid/sortid/classified_id/type_id/circle_name +
// user_publish_privacy——字段全 optional passthrough，服务端形态待真数据核）
export const ThreadAddColumnInfoResp = z.object({
  success: z.boolean(),
  data: z.object({
    circle_id: z.string().optional(),
    fid: z.string().optional(),
    sortid: z.string().optional(),
    classified_id: z.unknown().optional(),
    type_id: z.unknown().optional(),
    circle_name: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

// 写面通用响应（批D）：写端点响应形态未实测（真实写入=用户 MANUAL）——
// 只断言 success 布尔，其余透传；broker 在 success:false 时抛业务失败。
export const WriteResp = z.object({
  success: z.boolean(),
}).passthrough();

// C4-2 我的板块：2026-10-21 登录态实采 3 行（api_survey §L60：
// isjoined/new_content/p_circle/simple_des；行=circle 对象、同树形态 type_value=fid）
export const UserCircleListResp = z.object({
  success: z.boolean(),
  list: z.array(z.object({
    id: z.unknown().optional(),
    type_value: z.string().optional(), // =论坛 fid（circle id 另存；树同款）
    fid: z.unknown().optional(), // 兜底键（形态以实采为准时字段名待登录复核）
    name: z.string().optional(),
    icon_url: z.string().optional(),
    isjoined: z.unknown().optional(),
    new_content: z.unknown().optional(),
    simple_des: z.string().optional(),
  }).passthrough()),
}).passthrough();

// C4-3 收藏列表：静态取证（UserCollectActivity + UserCollectItem getter 集）
// id/userId/title/pic/catName/key/link/toUserId/createTimeStr/name…
export const UserCollectListResp = z.object({
  success: z.boolean(),
  list: z.array(z.object({
    id: z.unknown().optional(),
    title: z.string().optional(),
    catName: z.string().optional(),
    pic: z.string().optional(),
    link: z.string().optional(),
    createTimeStr: z.string().optional(),
    name: z.string().optional(),
  }).passthrough()),
}).passthrough();

// C4-4 消息详情：静态取证（LetterChatActivity + LetterChatBean）
// mid/uid/name/head/title/content/dateline…
export const UserMessageListResp = z.object({
  success: z.boolean(),
  list: z.array(z.object({
    mid: z.unknown().optional(),
    uid: z.unknown().optional(),
    name: z.string().optional(),
    head: z.string().optional(),
    title: z.string().optional(),
    content: z.string().optional(),
    dateline: z.unknown().optional(),
  }).passthrough()),
}).passthrough();
