// Feature flags: valor efectivo = fila DB si existe, si no env, si no false.
// Ver docs/04-feature-flags.md
import { db } from "@/lib/db";

export type FlagKey = "WHATSAPP_ENABLED" | "STRIPE_ENABLED";

const ENV_DEFAULTS: Record<FlagKey, boolean> = {
  WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED === "true",
  STRIPE_ENABLED: process.env.STRIPE_ENABLED === "true",
};

export async function getEffectiveFlag(key: FlagKey): Promise<boolean> {
  try {
    const row = await db.featureFlag.findUnique({ where: { key } });
    if (row) return row.enabled;
  } catch {
    // DB caída → env default
  }
  return ENV_DEFAULTS[key] ?? false;
}

export async function getAllFlags(): Promise<
  { key: string; enabled: boolean; description: string; envDefault: boolean }[]
> {
  const rows = await db.featureFlag.findMany().catch(() => []);
  const keys: FlagKey[] = ["WHATSAPP_ENABLED", "STRIPE_ENABLED"];
  return keys.map((key) => {
    const row = rows.find((r) => r.key === key);
    return {
      key,
      enabled: row ? row.enabled : ENV_DEFAULTS[key],
      description:
        row?.description ??
        (key === "WHATSAPP_ENABLED"
          ? "Envío real de mensajes vía WhatsApp Business Cloud API."
          : "Pago online con Stripe en el flujo de reserva."),
      envDefault: ENV_DEFAULTS[key],
    };
  });
}
