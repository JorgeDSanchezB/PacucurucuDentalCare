// POST /api/public/contact — formulario de contacto (bandeja del panel).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSchema } from "@/lib/validators";
import { jsonError, jsonOk, handleError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Cuerpo de la solicitud inválido.", 400);

    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(issue?.message ?? "Revisa los datos del formulario.", 400);
    }

    await db.contactMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone || null,
        message: parsed.data.message,
      },
    });

    return jsonOk(
      { message: "Mensaje enviado. Te responderemos a la brevedad en horario de atención." },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
