// PUT /api/admin/flags/[key] — override de feature flags desde el panel.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

const bodySchema = z.object({ enabled: z.boolean() });

export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { key } = await ctx.params;
  try {
    if (key !== "WHATSAPP_ENABLED" && key !== "STRIPE_ENABLED") {
      return jsonError("Flag desconocido.", 400);
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError("Valor inválido.", 400);

    const description =
      key === "WHATSAPP_ENABLED"
        ? "Envío real de mensajes vía WhatsApp Business Cloud API."
        : "Pago online con Stripe en el flujo de reserva.";

    const flag = await db.featureFlag.upsert({
      where: { key },
      update: { enabled: parsed.data.enabled },
      create: { key, enabled: parsed.data.enabled, description },
    });

    return jsonOk({ flag });
  } catch (e) {
    return handleError(e);
  }
}
