// Centralized selector table for the SDGun touch template (bygsjw_3sjw skin).
// Every DOM dependency lives here: when the forum re-skins, fix these and
// nothing else. Verified against live pages on 2026-09-30.
//
// Fail-open contract: if a selector stops matching, the corresponding feature
// silently does nothing - the original page keeps working.

const SDG = {
  page: {
    // URL-based page type detection (touch version always carries mobile=2)
    // forumlist=1（bygsjw 触屏版）或 forum.php?mobile=N 无 mod 参数（简易版论坛首页）
    isForumList: () => /forum\.php\?(.*&)?forumlist=1/.test(location.search)
      || (/forum\.php/.test(location.pathname + location.search)
          && /mobile=\d/.test(location.search)
          && !/(?:^|&)mod=/.test(location.search)),
    isForumDisplay: () => /mod=forumdisplay/.test(location.search),
    isViewThread: () => /mod=viewthread/.test(location.search),
    isLoginPage: () => /mod=logging/.test(location.search) && /action=login/.test(location.search),
  },

  forumDisplay: {
    // ul.bygsjw threadlist_ul > li.cl rows; title in a.over_two
    threadRow: 'ul.byg_threadlist_ul > li.cl',
    threadTitle: 'a.over_two',
    threadPreview: 'ul.list_img3 a',
    bottom: '.list_bottom',
    // 行级字段（2026-10-08 补齐——此前三键从未迁入，querySelector(undefined) 静默匹配空，
    // 作者/日期/统计自模块拆分日起从未显示。富形态行结构实证见 roadmap 勘误）
    rowAuthor: '.list_bottom a.z[href*="space"]',
    rowDate: '.list_bottom em.z',
    rowStats: '.list_bottom span.y',
    rowType: 'span.list_typename',
    rowPin: 'img[alt*="置顶"]',
    // 子版块行（同一 li.cl 容器：a.forum_img + .forum_names + 双计数 span）
    subforumRow: 'li.cl a.forum_img',
    subforumName: '.forum_names',
    subforumThreads: '.forum_threads',
    subforumPosts: '.forum_posts',
    // 板块头统计与收藏（今日/主题 + 收藏本版真实链接）
    favLink: 'a[href*="action=fav"], a[href*="favthread"]',
    // pager anchors (real navigation targets)
    nextLink: 'a.nxt',
    prevLink: 'a.prev',
  },

  forumList: {
    // <div data-byginto class="bm bmw fl"> group > h2 > a (group name)
    //     div.sub_forum > ul > li.cl > .forum_img (icon link w/ alt) + name + counts
    group: 'div[data-byginto], div.subforumshow',
    groupName: 'h2 a',
    sectionRow: 'div.sub_forum li.cl, .sub_forum li.cl',
    sectionLink: 'a[href*="mod=forumdisplay"]',
    sectionIcon: 'img',
    sectionCounts: '.forum_num, li.cl',
  },

  // profile 3 兜底（h2 分组走查）：此前 forumlist.js 引用此键但表内缺失——
  // 壳响应（profile 1/2 无数据）时 mount 直接 EXC，旁路壳重试/缓存/覆盖层全套机制（2026-10-08 定位）
  h2walk: {
    groupHeader: 'h2',
    sectionLink: 'a[href*="mod=forumdisplay"]',
  },

  // 简易模板（mobile=1）的原列表容器 id——渲染后隐藏用（2026-10-08 补：此前为静默死引用，
  // getElementById(undefined) 不炸但简易列表容器从未被隐藏）
  legacyListId: 'forumlist',

  viewThread: {
    // div.postlist > div[id^="pid"] floors; content in .message
    floor: 'div[id^="pid"]',
    // 每楼真实回复链接（v1.16 子键门禁首秀抓出的静默死键——此前一直走兜底构造 URL）
    replyAnchor: 'a[href*="action=reply"]',
    author: '.post_author .authi a, .authi a',
    authorAvatar: '.avatar img',
    postNumber: '.post_number',
    content: '.message',
    date: '.grey, .authi .grey',
    container: '.postlist',
    toolbar: '.postlist_title',
  },

  // 重绘激活时需隐藏的模板脚手架（逐变体枚举；白名单化替代霰弹枪隐藏）
  scaffold: {
    // Discuz 标准移动模板（mobile=1 简易首页）
    standard: ['.hd', '.pd2', '.bm', '.footer'],
    // bygsjw 富模板（版块列表 + 帖子列表 + 帖子页共通头部/页脚）
    bygsjw: ['.header_z', '.header_c', '.header_y', '.hdc_xin', '.forumdisplay_top',
             '.bm_xin', '.subforumshow', '.footer', '.pg', '.return_xin', '.byg_return',
             '.postlist_title', '#mask'],
    // 壳+AJAX 骨架变体
    shell: ['.hd', '.ft', '.footer'],
  },

  util: {
    contentAnchor: '#wp',
    boardHeaderFont: '.header_font',
    boardBreadcrumb: '论坛\\s*>\\s*([^>\\n]{2,20})',
    pagerNextByClass: 'a.nxt',
    pagerPrevByClass: 'a.prev',
    pagerNextByText: '下一页',
    pagerPrevByText: '上一页',
    filterLinks: 'a[href*="filter="], a[href*="orderby="]',
    viewthreadAnchor: 'a[href*="mod=viewthread"]',
  },

  common: {
    // page scaffolding
    body: 'body',
    contentRoot: '#wp, .wp, body',
    header: '.header_z, .header_z cl',
    contentImages: '.message img, .list_img3 img, img[src*="forum.php?mod=image"], img[src*="data/attachment"]',
  },
};

// Export for boot.js (same content-script world, plain global)
if (typeof window !== 'undefined') {
  window.SDG = SDG;
}
