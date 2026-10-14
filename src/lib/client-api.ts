"use client";

// Fetch helpers para el cliente: siempre rutas relativas, errores amables.
export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error ?? "No se pudo cargar la información. Revisa tu conexión e intenta de nuevo.");
  }
  return json as T;
}

export async function apiPost<T>(url: string, body: unknown, method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "DELETE" ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error ?? "La operación falló. Intenta de nuevo.");
  }
  return json as T;
}
