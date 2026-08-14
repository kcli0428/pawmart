import type { PointsTier } from "@/generated/prisma/client";

export const POINTS_TIER_THRESHOLDS: { tier: PointsTier; minBalance: number }[] =
  [
    { tier: "PLATINUM", minBalance: 5000 },
    { tier: "GOLD", minBalance: 2000 },
    { tier: "SILVER", minBalance: 500 },
    { tier: "BRONZE", minBalance: 0 },
  ];

/** 1 pet point per HKD spent (prices are stored in cents). */
export function pointsFromCents(cents: number): number {
  if (cents <= 0) return 0;
  return Math.floor(cents / 100);
}

export function tierFromBalance(balance: number): PointsTier {
  if (balance >= 5000) return "PLATINUM";
  if (balance >= 2000) return "GOLD";
  if (balance >= 500) return "SILVER";
  return "BRONZE";
}

export function nextTier(balance: number): {
  tier: PointsTier;
  remaining: number;
} | null {
  if (balance < 500) return { tier: "SILVER", remaining: 500 - balance };
  if (balance < 2000) return { tier: "GOLD", remaining: 2000 - balance };
  if (balance < 5000) return { tier: "PLATINUM", remaining: 5000 - balance };
  return null;
}
