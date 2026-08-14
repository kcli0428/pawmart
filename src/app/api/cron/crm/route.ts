import { NextResponse } from "next/server";
import { generateCampaigns } from "@/lib/campaigns";
import { fulfillSubscriptionOrder } from "@/lib/checkout";
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
  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", nextDeliveryAt: { lte: new Date() } },
  });
  let subscriptionsProcessed = 0;
  for (const sub of due) {
    await fulfillSubscriptionOrder(sub.id);
    subscriptionsProcessed += 1;
  }

  return NextResponse.json({ campaignsCreated, subscriptionsProcessed });
}
