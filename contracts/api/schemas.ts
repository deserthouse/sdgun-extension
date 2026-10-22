// C01 响应 schema（zod）。字段=实测形态（2026-10-22 E1-5 实采修正：三读端点均为
// 顶层 list 信封——{success, code:100, msg, list, ...}，无 data 包装页 meta，
// 翻页以 p+step 迭代、列表短于 step 即尾页）。未知字段透传。
import { z } from 'zod';

const okCode = z.number().int();

const ForumRow = z.object({
  tid: z.union([z.number(), z.string()]),
  subject: z.string(),
  des: z.string().optional(),
  pics: z.unknown().optional(),
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
