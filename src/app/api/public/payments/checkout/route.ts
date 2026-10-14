// POST /api/public/payments/checkout — módulo Stripe (feature flag OFF en v1).
import { NextResponse } from "next/server";
import { getEffectiveFlag } from "@/modules/settings/flags";

export async function POST() {
  const enabled = await getEffectiveFlag("STRIPE_ENABLED");
  if (!enabled) {
    return NextResponse.json(
      { ok: false, error: "El pago online no está activo. La clínica recibe efectivo y transferencia." },
      { status: 501 }
    );
  }
  // STRIPE_ENABLED=true → ROADMAP: crear Checkout Session con stripe sdk
  // (requiere STRIPE_SECRET_KEY). El flag se activa sin tocar este flujo.
  return NextResponse.json(
    { ok: false, error: "Pago online activo pero no configurado. Falta STRIPE_SECRET_KEY." },
    { status: 501 }
  );
}
