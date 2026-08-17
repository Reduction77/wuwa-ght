export type PackageTier = 1 | 2 | 3 | 4;

export interface EventItem {
  name: string;
  /** 图片路径（uploads/xxx）或 data URL；空字符串 = 未上传，界面不显示图片位 */
  image: string;
  done: boolean;
}

export interface Boss {
  id: string;
  name: string;
  account: string;
  /** 老板查看口令 */
  passcode: string;
  /** 1 日体 | 2 日体+周常 | 3 日体+周常+大活动 | 4 全托 */
  tier: PackageTier;
  /** 周期天数：默认 30，一个版本 42，也可自定义任意天数 */
  cycleDays: number;
  /** YYYY-MM-DD */
  startDate: string;
  note: string;
  /** 已清体力的日期 YYYY-MM-DD 列表 */
  daily: string[];
  /** 已清周常的“周期内第几周”序号（0 起） */
  weekly: number[];
  bigEvent: EventItem;
  smallEvents: EventItem[];
  challenges: { matrix: boolean; sea: boolean; tower: boolean };
  optionals: {
    redeem: { enabled: boolean; done: boolean };
    gacha: { enabled: boolean; done: boolean };
  };
}

export interface SiteData {
  version: number;
  updatedAt: string;
  /** 接单状态（后台可一键切换），首页顶部徽章跟随变化 */
  accepting?: {
    on: boolean;
    text: string;
  };
  bosses: Boss[];
}

export const TIER_LABEL: Record<PackageTier, string> = {
  1: '日体',
  2: '日体 + 周常',
  3: '日体 + 周常 + 大活动',
  4: '全托',
};

export const TIER_PRICE: Record<PackageTier, string> = {
  1: '3r / 天',
  2: '90r / 月',
  3: '130r / 月',
  4: '235r / 月',
};
