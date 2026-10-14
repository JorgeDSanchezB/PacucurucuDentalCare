// GET/PUT /api/admin/settings — configuración de la clínica + flags.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settingsSchema } from "@/lib/validators";
import { getSettings } from "@/modules/settings/settings";
import { getAllFlags } from "@/modules/settings/flags";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const [settings, flags] = await Promise.all([getSettings(), getAllFlags()]);
    return jsonOk({ settings, flags });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa la configuración.", 400);
    }

    const settings = parsed.data;
    const entries: [string, unknown][] = [
      ["clinic", settings.clinic],
      ["social", settings.social],
      ["doctor", { ...settings.doctor, credentials: settings.doctor.credentials.filter(Boolean) }],
      ["hero", settings.hero],
      ["about", settings.about],
      ["theme", settings.theme],
    ];

    for (const [key, value] of entries) {
      await db.clinicSetting.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      });
    }

    return jsonOk({});
  } catch (e) {
    return handleError(e);
  }
}
