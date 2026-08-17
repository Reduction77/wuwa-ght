/**
 * 站点内容配置 —— 部署前可按需修改这里的文字与价格。
 */
export const siteConfig = {
  brand: '朱朱白白',
  brandSuffix: '鸣潮托管小站',
  heroTitle: '鸣潮托管，交给朱朱白白',
  heroSubtitle:
    '每天清体力、每周清周常、版本活动全包，进度随时上网查。你安心摸鱼，号交给我来养。',
  bilibili: {
    name: '朱朱白白',
    spaceUrl: 'https://space.bilibili.com/102600123',
    liveUrl: 'https://live.bilibili.com/27665992',
  },
  wechatQr: './wechat-qr.jpg',
  /** 托管价格（参考价格表托管部分） */
  plans: [
    { name: '日体', content: '每天清一次体力', price: '3r / 天', note: '' },
    { name: '日体 + 周常', content: '每日体力 + 每周周常', price: '90r / 月', note: '' },
    { name: '日体 + 周常 + 大活动', content: '再加版本大活动', price: '130r / 月', note: '探索活动不打' },
    { name: '全托', content: '日体 + 全活动 + 深塔海墟矩阵', price: '235r / 月', note: '同上，且会帮打全息，帮养2个角色小毕业' },
  ],
  planExtra: '非全托套餐 + 深塔 + 海墟 + 矩阵 = 非全托套餐 + 55r / 月',
  cycleInfo: [
    '托管周期默认按 30 天计算，也可以按一个游戏版本（42 天）计算',
    '每天清一次体力，每周清一次周常',
    '每个托管周期完成 1 个版本大活动 + 3 个版本小活动',
    '终焉矩阵、冥歌海城、逆境深塔 各打一次',
    '可选项：兑换一次前瞻兑换码、购买当前版本抽卡道具',
  ],
};
