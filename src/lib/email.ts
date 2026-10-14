// Wrapper de email vía Resend HTTP API (sin dependencias extra).
//
// HONESTIDAD EPISTÉMICA:
//  - Sin RESEND_API_KEY configurada, el envío se SIMULA (se registra y se
//    ofrece la descarga del PDF como fallback). No se envía nada real.
//  - NO se ha probado contra la API real en este sandbox.

export type EmailResult = {
  status: "SENT" | "SIMULATED" | "FAILED";
  message: string;
  error?: string;
};

export async function sendEmailWithAttachment(opts: {
  to: string;
  subject: string;
  text: string;
  pdfBytes: Uint8Array;
  filename: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "citas@pacurucu.dental";

  if (!apiKey) {
    return {
      status: "SIMULATED",
      message:
        "El envío por email no está configurado. El PDF quedó generado y disponible para descargar.",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        attachments: [
          {
            filename: opts.filename,
            content: Buffer.from(opts.pdfBytes).toString("base64"),
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        status: "FAILED",
        message: "El envío por email falló. La descarga del PDF sigue disponible.",
        error: `HTTP ${res.status}: ${detail.slice(0, 200)}`,
      };
    }
    return { status: "SENT", message: `Email enviado a ${opts.to}.` };
  } catch (e) {
    return {
      status: "FAILED",
      message: "El envío por email falló. La descarga del PDF sigue disponible.",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
