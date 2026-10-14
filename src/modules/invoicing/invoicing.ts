// Facturación interna: numeración secuencial + generación desde cita completada.
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { clinicToday } from "@/lib/validators";
import type { InvoiceRow } from "@/types";

export async function createInvoiceFromAppointment(appointmentId: string): Promise<InvoiceRow> {
  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { services: true, patient: true, invoice: true },
  });
  if (!appt) throw new DomainError("Cita no encontrada.", 404);
  if (appt.status !== "COMPLETED") {
    throw new DomainError("Solo se puede facturar una cita completada.", 400);
  }
  if (appt.invoice) {
    throw new DomainError("Esta cita ya tiene factura generada.", 409);
  }
  if (appt.services.length === 0) {
    throw new DomainError("La cita no tiene servicios asociados.", 400);
  }

  const items = appt.services.map((s) => ({ name: s.name, price: s.price, quantity: 1 }));
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = subtotal; // v1: sin impuestos desglosados (documentado en roadmap)

  // Numeración secuencial: max(number)+1 con UNIQUE de respaldo ante carrera
  const maxNumber = await db.invoice.aggregate({ _max: { number: true } });
  const number = (maxNumber._max.number ?? 0) + 1;

  const invoice = await db.invoice.create({
    data: {
      number,
      appointmentId: appt.id,
      patientId: appt.patientId,
      date: clinicToday(),
      itemsJson: JSON.stringify(items),
      subtotal,
      total,
      paymentMethod: "EFECTIVO",
      status: "ISSUED",
    },
  });

  return serializeInvoice(invoice.id);
}

export async function serializeInvoice(id: string): Promise<InvoiceRow> {
  const inv = await db.invoice.findUniqueOrThrow({
    where: { id },
    include: { patient: true },
  });
  return {
    id: inv.id,
    number: inv.number,
    date: inv.date,
    patientId: inv.patientId,
    patientName: `${inv.patient.firstName} ${inv.patient.lastName}`,
    total: inv.total,
    subtotal: inv.subtotal,
    paymentMethod: inv.paymentMethod,
    appointmentId: inv.appointmentId,
  };
}
