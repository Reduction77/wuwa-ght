export type PackageTier = 1 | 2 | 3 | 4 | 5;

export interface EventItem {
  name: string;
  /** 图片路径（uploads/xxx）或 data URL；空字符串 = 未上传，界面不显示图片位 */
  image: string;
  done: boolean;
  openDate?: string;
  deadline?: string;
}

/** 可开关 + 完成状态 的小项（开了老板才看得见） */
export interface ToggleItem {
  enabled: boolean;
  done: boolean;
}

export type BossIssueKind = 'none' | 'login' | 'verification' | 'maintenance' | 'waiting' | 'paused';
export type RenewalState = 'none' | 'reminded' | 'pending' | 'renewed' | 'ending';

export interface ExtraTask {
  id: string;
  name: string;
  done: boolean;
  visible: boolean;
  createdAt: string;
  doneAt?: string;
}

export interface CycleSnapshot {
  id: string;
  startDate: string;
  cycleDays: number;
  endedAt: string;
  daily: string[];
  weekly: string[];
  bigEvent: EventItem;
  smallEvents: EventItem[];
  challenges: Boss['challenges'];
  optionals: Boss['optionals'];
  extraTasks: ExtraTask[];
  excludedDays: Array<{ date: string; reason: string }>;
}

export interface Boss {
  id: string;
  name: string;
  account: string;
  /** 老板查看口令 */
  passcode: string;
  /** 1 日体 | 2 日体+周常 | 3 日体+周常+大活动 | 4 全托 | 5 舰长（日体+周常+高难） */
  tier: PackageTier;
  /** 本次老板托管周期天数，与游戏版本周期无关 */
  cycleDays: number;
  /** YYYY-MM-DD */
  startDate: string;
  note: string;
  /** 仅后台可见 */
  internalNote: string;
  tags: string[];
  archived: boolean;
  renewalState: RenewalState;
  issue: { kind: BossIssueKind; message: string; updatedAt: string };
  excludedDays: Array<{ date: string; reason: string }>;
  /** 套餐能力使用明确开关，不再依赖 tier 数字大小判断 */
  services: { daily: boolean; weekly: boolean; bigEvent: boolean; smallEvents: boolean };
  /** 已清体力的日期 YYYY-MM-DD 列表 */
  daily: string[];
  /** 已清周常所在日历周的周一日期（YYYY-MM-DD），不随老板续期错位 */
  weekly: string[];
  bigEvent: EventItem;
  smallEvents: EventItem[];
  /** 高难挑战：开了老板才看得见 */
  challenges: { matrix: ToggleItem; sea: ToggleItem; tower: ToggleItem; holo: ToggleItem };
  optionals: {
    redeem: ToggleItem;
    gacha: ToggleItem;
  };
  extraTasks: ExtraTask[];
  cycleHistory: CycleSnapshot[];
  /** 老板端各模块可见开关：开了老板才能看见，不开看不见 */
  show: {
    daily: boolean;
    weekly: boolean;
    bigEvent: boolean;
  };
}

export interface SiteData {
  version: number;
  /** 服务器保存修订号，用于避免多个页面互相覆盖 */
  revision?: number;
  updatedAt: string;
  /** 接单状态（后台可一键切换），首页顶部徽章跟随变化 */
  accepting?: {
    on: boolean;
    text: string;
  };
  gameVersion?: { name: string; startedAt: string; expectedDays?: number; updatedAt: string };
  bosses: Boss[];
  audit?: AuditEntry[];
}

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  bossId?: string;
  detail?: string;
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

export function tierServices(tier: PackageTier): Boss['services'] {
  if (tier === 1) return { daily: true, weekly: false, bigEvent: false, smallEvents: false };
  if (tier === 2) return { daily: true, weekly: true, bigEvent: false, smallEvents: false };
  if (tier === 3) return { daily: true, weekly: true, bigEvent: true, smallEvents: false };
  if (tier === 4) return { daily: true, weekly: true, bigEvent: true, smallEvents: true };
  return { daily: true, weekly: true, bigEvent: false, smallEvents: false };
}
