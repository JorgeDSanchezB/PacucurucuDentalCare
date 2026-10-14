// POST /api/admin/media — sube una imagen desde el PC del odontólogo.
// multipart/form-data { file }. Valida tipo y tamaño; guarda base64 en la DB
// y devuelve { url } lista para usar en cualquier campo de imagen.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession, jsonError, jsonOk, handleError } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return jsonError("Selecciona un archivo de imagen (PNG, JPG, WebP o GIF).", 400);
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return jsonError("Formato no soportado. Usa PNG, JPG, WebP o GIF.", 415);
    }
    if (file.size > MAX_BYTES) {
      return jsonError("La imagen supera 5 MB. Exporta una versión más liviana e intenta de nuevo.", 413);
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const asset = await db.mediaAsset.create({
      data: { mimeType: file.type, size: file.size, data: base64 },
      select: { id: true },
    });

    return jsonOk({ id: asset.id, url: `/api/media/${asset.id}` }, 201);
  } catch (e) {
    return handleError(e);
  }
}
