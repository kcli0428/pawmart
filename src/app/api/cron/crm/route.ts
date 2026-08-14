import { NextResponse } from "next/server";
import { generateCampaigns, sendPendingCampaigns } from "@/lib/campaigns";
import { fulfillSubscriptionOrder } from "@/lib/checkout";
import { sendExpiryAlerts } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const campaignsCreated = await generateCampaigns();
  const campaignsSent = await sendPendingCampaigns();
  const expiryAlerts = await sendExpiryAlerts(30);

  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", nextDeliveryAt: { lte: new Date() } },
  });
  let subscriptionsProcessed = 0;
  for (const sub of due) {
    await fulfillSubscriptionOrder(sub.id);
    subscriptionsProcessed += 1;
  }

  return NextResponse.json({
    campaignsCreated,
    campaignsSent,
    subscriptionsProcessed,
    expiryAlerts,
  });
}
