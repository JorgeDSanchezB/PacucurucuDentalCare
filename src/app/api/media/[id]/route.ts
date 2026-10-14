// GET /api/media/[id] — sirve una imagen subida (público, cache inmutable).
// Cada id es único e inmutable, por lo que se cachea fuerte sin invalidar.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  try {
    const asset = await db.mediaAsset.findUnique({
      where: { id },
      select: { mimeType: true, data: true },
    });
    if (!asset) {
      return NextResponse.json({ ok: false, error: "Imagen no encontrada" }, { status: 404 });
    }

    const bytes = Buffer.from(asset.data, "base64");
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    // Tolerancia a fallos: sin imagen, el sitio sigue funcionando
    return NextResponse.json({ ok: false, error: "Imagen no disponible" }, { status: 404 });
  }
}
