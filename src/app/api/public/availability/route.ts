// GET /api/public/availability?date=YYYY-MM-DD&duration=90
import { NextRequest, NextResponse } from "next/server";
import { getAvailability } from "@/modules/appointments/availability";
import { jsonError, handleError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? "";
    const duration = Math.max(15, Number(url.searchParams.get("duration")) || 30);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError("Parámetro date inválido (formato YYYY-MM-DD).", 400);
    }

    const result = await getAvailability(date, duration);
    return NextResponse.json({ ok: true, date, ...result });
  } catch (e) {
    return handleError(e);
  }
}
