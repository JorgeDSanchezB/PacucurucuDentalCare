// Helpers para API routes: guard de sesión, errores y paginación.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { ZodIssue } from "zod";
import { authOptions } from "@/lib/auth";

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}

export function jsonError(message: string, status = 400, issues?: ZodIssue[]) {
  return NextResponse.json({ ok: false, error: message, issues }, { status });
}

export function jsonOk<T extends object>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function pageParams(url: URL): { page: number; pageSize: number } {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = 20;
  return { page, pageSize };
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// Manejo centralizado de errores de dominio vs inesperados (nunca filtrar stack)
export function handleError(e: unknown) {
  if (e && typeof e === "object" && "status" in e && e instanceof Error) {
    return jsonError(e.message, (e as { status: number }).status);
  }
  console.error("[api] error:", e);
  return NextResponse.json(
    { ok: false, error: "Error interno. Intenta de nuevo en unos minutos." },
    { status: 500 }
  );
}
