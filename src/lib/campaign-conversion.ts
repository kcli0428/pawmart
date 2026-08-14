import type { CampaignType, PetSpecies } from "@/generated/prisma/client";

export const CAMPAIGN_CONVERSION_DAYS = 14;

export function campaignWouldConvert(input: {
  sentAt: Date | null;
  convertedAt: Date | null;
  orderedAt: Date;
  type: CampaignType;
  petSpecies?: PetSpecies | null;
  orderProductSpecies: PetSpecies[][];
}): boolean {
  if (input.convertedAt || !input.sentAt) return false;
  if (input.orderedAt.getTime() < input.sentAt.getTime()) return false;
  const days = (input.orderedAt.getTime() - input.sentAt.getTime()) / (24 * 60 * 60 * 1000);
  if (days > CAMPAIGN_CONVERSION_DAYS) return false;
  if (input.type === "REORDER" && input.petSpecies) {
    return input.orderProductSpecies.some((species) => species.includes(input.petSpecies!));
  }
  return true;
}

export function campaignConversionSummary(
  campaigns: { sentAt: Date | null; convertedAt: Date | null }[],
) {
  const sent = campaigns.filter((campaign) => campaign.sentAt).length;
  const converted = campaigns.filter((campaign) => campaign.convertedAt).length;
  return {
    sent,
    converted,
    rate: sent === 0 ? 0 : Math.round((converted / sent) * 100),
  };
}
