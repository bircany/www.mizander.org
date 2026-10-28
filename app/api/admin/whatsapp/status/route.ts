import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/admin/data";
import { PANEL_ROUTE_ACCESS } from "@/lib/auth/panel-access";
import {
  getEvolutionConnectionStatus,
  getEvolutionWebhookStatus,
} from "@/lib/qurbani/evolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdminUser(PANEL_ROUTE_ACCESS.whatsapp);
  const [status, webhook] = await Promise.all([
    getEvolutionConnectionStatus(),
    getEvolutionWebhookStatus(),
  ]);
  let sourceHost = "yapılandırılmadı";
  try {
    sourceHost = new URL(process.env.EVOLUTION_API_URL || "").host;
  } catch {
    // Status already reports a missing or invalid provider configuration.
  }

  return NextResponse.json(
    { status, webhook, sourceHost, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
