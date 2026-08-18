export type PackageTier = 1 | 2 | 3 | 4 | 5;

export interface EventItem {
  name: string;
  /** 图片路径（uploads/xxx）或 data URL；空字符串 = 未上传，界面不显示图片位 */
  image: string;
  done: boolean;
}

/** 可开关 + 完成状态 的小项（开了老板才看得见） */
export interface ToggleItem {
  enabled: boolean;
  done: boolean;
}

export interface Boss {
  id: string;
  name: string;
  account: string;
  /** 老板查看口令 */
  passcode: string;
  /** 1 日体 | 2 日体+周常 | 3 日体+周常+大活动 | 4 全托 | 5 舰长（日体+周常+高难） */
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
  /** 高难挑战：开了老板才看得见 */
  challenges: { matrix: ToggleItem; sea: ToggleItem; tower: ToggleItem; holo: ToggleItem };
  optionals: {
    redeem: ToggleItem;
    gacha: ToggleItem;
  };
  /** 老板端各模块可见开关：开了老板才能看见，不开看不见 */
  show: {
    daily: boolean;
    weekly: boolean;
    bigEvent: boolean;
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
  5: '舰长',
};

export const TIER_PRICE: Record<PackageTier, string> = {
  1: '3r / 天',
  2: '90r / 月',
  3: '145r / 月',
  4: '235r / 月',
  5: '舰长专属',
};
