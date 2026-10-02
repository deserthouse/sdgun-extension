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
    // ul.byg_threadlist_ul > li.cl rows; title in a.over_two
    threadRow: 'ul.byg_threadlist_ul > li.cl',
    threadTitle: 'a.over_two',
    threadPreview: 'ul.list_img3 a',
    bottom: '.list_bottom',
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

  viewThread: {
    // div.postlist > div[id^="pid"] floors; content in .message
    floor: 'div[id^="pid"]',
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
