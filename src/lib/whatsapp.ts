// Wrapper de WhatsApp Business Cloud API (Meta).
//
// HONESTIDAD EPISTÉMICA:
//  - Implementado con feature flag WHATSAPP_ENABLED (default OFF).
//  - NO se ha probado contra la API real (sin credenciales en el sandbox).
//  - El flujo v1 registra solicitudes en DB y notifica en modo SIMULATED.
//
// Tolerancia a fallos: si el envío falla, la cita/solicitud YA está en DB.
// Cada intento queda en NotificationLog con su estado.

import { db } from "@/lib/db";
import { getEffectiveFlag } from "@/modules/settings/flags";
import { getSettings } from "@/modules/settings/settings";
import type { AppointmentRow } from "@/types";
import { formatDateLong } from "@/lib/validators";

type SendResult = { status: "SENT" | "SIMULATED" | "FAILED"; error?: string };

async function sendWhatsAppMessage(to: string, body: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { status: "FAILED", error: "Faltan credenciales (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)" };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^0-9]/g, ""),
        type: "text",
        text: { body },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { status: "FAILED", error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { status: "SENT" };
  } catch (e) {
    return { status: "FAILED", error: e instanceof Error ? e.message : String(e) };
  }
}

async function logNotification(
  type: "WHATSAPP_DOCTOR" | "WHATSAPP_PATIENT",
  toAddress: string,
  status: string,
  payload: Record<string, unknown>,
  error?: string
) {
  try {
    await db.notificationLog.create({
      data: {
        type,
        status,
        toAddress,
        payload: JSON.stringify(payload),
        error: error ?? null,
      },
    });
  } catch {
    // el log de notificación nunca debe romper el flujo principal
  }
}

/** Notifica al odontólogo que llegó una solicitud de reserva. */
export async function notifyDoctorOfBooking(appointment: AppointmentRow): Promise<SendResult> {
  const settings = await getSettings();
  const services = appointment.services.map((s) => s.name).join(", ");
  const message =
    `Nueva solicitud de cita\n` +
    `Paciente: ${appointment.patient.firstName} ${appointment.patient.lastName}\n` +
    `Tel: ${appointment.patient.phone}\n` +
    `Servicios: ${services}\n` +
    `Fecha: ${formatDateLong(appointment.date)} ${appointment.startTime}\n` +
    (appointment.notes ? `Notas: ${appointment.notes}\n` : "") +
    `Confírmala desde el panel de administración.`;

  const flag = await getEffectiveFlag("WHATSAPP_ENABLED");

  if (!flag) {
    await logNotification("WHATSAPP_DOCTOR", settings.clinic.whatsapp, "SIMULATED", {
      appointmentId: appointment.id,
      message,
    });
    return { status: "SIMULATED" }; // v1: modo registrado
  }

  const result = await sendWhatsAppMessage(settings.clinic.whatsapp, message);
  await logNotification("WHATSAPP_DOCTOR", settings.clinic.whatsapp, result.status, {
    appointmentId: appointment.id,
    message,
  }, result.error);
  return result;
}

/** Notifica al paciente que su cita quedó confirmada. */
export async function notifyPatientOfConfirmation(appointment: AppointmentRow): Promise<SendResult> {
  const settings = await getSettings();
  const services = appointment.services.map((s) => s.name).join(", ");
  const message =
    `Hola ${appointment.patient.firstName}, tu cita en ${settings.clinic.name} quedó confirmada.\n` +
    `Fecha: ${formatDateLong(appointment.date)} a las ${appointment.startTime}\n` +
    `Servicios: ${services}\n` +
    `Dirección: ${settings.clinic.address}, ${settings.clinic.city}\n` +
    `Si necesitas reagendar, escríbenos a este número.`;

  const flag = await getEffectiveFlag("WHATSAPP_ENABLED");

  if (!flag) {
    await logNotification("WHATSAPP_PATIENT", appointment.patient.phone, "SIMULATED", {
      appointmentId: appointment.id,
      message,
    });
    return { status: "SIMULATED" }; // v1: modo registrado
  }

  const result = await sendWhatsAppMessage(appointment.patient.phone, message);
  await logNotification("WHATSAPP_PATIENT", appointment.patient.phone, result.status, {
    appointmentId: appointment.id,
    message,
  }, result.error);
  return result;
}
