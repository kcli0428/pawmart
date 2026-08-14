import { prisma } from "@/lib/prisma";

export type ShippingAddressSnapshot = {
  source: "account" | "demo-checkout" | "subscription";
  label?: string | null;
  recipient?: string;
  phone?: string;
  district?: string;
  address?: string;
  subscriptionId?: string;
};

export async function getDefaultAddress(userId: string) {
  const preferred = await prisma.address.findFirst({
    where: { userId, isDefault: true },
  });
  if (preferred) return preferred;
  return prisma.address.findFirst({
    where: { userId },
    orderBy: { id: "asc" },
  });
}

export function snapshotAddress(
  address: {
    label: string | null;
    recipient: string;
    phone: string;
    district: string;
    address: string;
  } | null,
): ShippingAddressSnapshot {
  if (!address) {
    return { source: "demo-checkout" };
  }
  return {
    source: "account",
    label: address.label,
    recipient: address.recipient,
    phone: address.phone,
    district: address.district,
    address: address.address,
  };
}

export function formatShippingAddress(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const snap = value as ShippingAddressSnapshot;
  if (snap.source !== "account") return null;
  const line = [snap.recipient, snap.phone, snap.district, snap.address]
    .filter(Boolean)
    .join(" · ");
  return line || null;
}
