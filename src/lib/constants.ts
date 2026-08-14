export const SITE_NAME = "PawMart";
export const SITE_DESCRIPTION = "香港寵物用品零售平台 — 為你的毛孩提供個人化購物體驗";

export const FOOD_CATEGORY_SLUG_ORDER = [
  "cat-dry-food",
  "cat-wet-food",
  "dog-dry-food",
  "dog-wet-food",
] as const;

export function sortCategories<T extends { slug: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const ia = FOOD_CATEGORY_SLUG_ORDER.indexOf(
      a.slug as (typeof FOOD_CATEGORY_SLUG_ORDER)[number],
    );
    const ib = FOOD_CATEGORY_SLUG_ORDER.indexOf(
      b.slug as (typeof FOOD_CATEGORY_SLUG_ORDER)[number],
    );
    return (ia === -1 ? 100 : ia) - (ib === -1 ? 100 : ib);
  });
}

export const PET_SPECIES_LABELS: Record<string, string> = {
  DOG: "狗",
  CAT: "貓",
  BIRD: "雀鳥",
  RABBIT: "兔",
  OTHER: "其他",
};

export const LIFE_STAGE_LABELS: Record<string, string> = {
  PUPPY: "幼犬",
  KITTEN: "幼貓",
  ADULT_DOG: "成犬",
  ADULT_CAT: "成貓",
  SENIOR_DOG: "老犬",
  SENIOR_CAT: "老貓",
};

export const LIFE_STAGE_VALUES = [
  "PUPPY",
  "KITTEN",
  "ADULT_DOG",
  "ADULT_CAT",
  "SENIOR_DOG",
  "SENIOR_CAT",
] as const;

export const LIFE_STAGE_GROUPS = [
  {
    species: "CAT",
    label: "貓",
    stages: [
      { value: "KITTEN", label: "幼貓" },
      { value: "ADULT_CAT", label: "成貓" },
      { value: "SENIOR_CAT", label: "老貓" },
    ],
  },
  {
    species: "DOG",
    label: "狗",
    stages: [
      { value: "PUPPY", label: "幼犬" },
      { value: "ADULT_DOG", label: "成犬" },
      { value: "SENIOR_DOG", label: "老犬" },
    ],
  },
] as const;

export const UNIT_TYPE_LABELS: Record<string, string> = {
  SINGLE: "單件",
  CASE: "整箱",
  BUNDLE: "組合包",
};

export const POINTS_TIER_LABELS: Record<string, string> = {
  BRONZE: "青銅",
  SILVER: "白銀",
  GOLD: "黃金",
  PLATINUM: "白金",
};

export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  REORDER: "快吃完了",
  BIRTHDAY: "生日行銷",
  LIFE_STAGE: "生命階段",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "待付款",
  PAID: "已付款",
  PROCESSING: "處理中",
  SHIPPED: "已出貨",
  DELIVERED: "已送達",
  CANCELLED: "已取消",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "進行中",
  PAUSED: "已暫停",
  CANCELLED: "已取消",
};

export const HK_DISTRICTS = [
  "中西區",
  "灣仔",
  "東區",
  "南區",
  "油尖旺",
  "深水埗",
  "九龍城",
  "黃大仙",
  "觀塘",
  "葵青",
  "荃灣",
  "屯門",
  "元朗",
  "北區",
  "大埔",
  "沙田",
  "西貢",
  "離島",
] as const;
