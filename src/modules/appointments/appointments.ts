// Creación y transiciones de citas (dominio).
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { addMinutes, toMinutes } from "@/lib/validators";
import { isSlotAvailable } from "./availability";
import type { AppointmentRow, AppointmentStatus } from "@/types";

interface BookingInput {
  serviceIds: string[];
  patient: { firstName: string; lastName: string; email: string; phone: string };
  date: string;
  startTime: string;
  notes?: string;
  source: "PUBLIC_FORM" | "ADMIN";
  initialStatus?: AppointmentStatus;
}

/** Serializa una cita (con paciente y servicios) al DTO del cliente. */
export async function serializeAppointment(id: string): Promise<AppointmentRow> {
  const appt = await db.appointment.findUniqueOrThrow({
    where: { id },
    include: {
      patient: true,
      services: true,
      invoice: { select: { id: true } },
    },
  });
  return {
    id: appt.id,
    date: appt.date,
    startTime: appt.startTime,
    endTime: appt.endTime,
    status: appt.status as AppointmentStatus,
    source: appt.source,
    notes: appt.notes,
    adminNotes: appt.adminNotes,
    createdAt: appt.createdAt.toISOString(),
    patient: {
      id: appt.patient.id,
      firstName: appt.patient.firstName,
      lastName: appt.patient.lastName,
      phone: appt.patient.phone,
      email: appt.patient.email,
    },
    services: appt.services.map((s) => ({
      id: s.id,
      name: s.name,
      price: s.price,
      duration: s.duration,
    })),
    hasInvoice: !!appt.invoice,
  };
}

/** Crea una cita con validación de disponibilidad y snapshot de servicios. */
export async function createAppointment(input: BookingInput): Promise<AppointmentRow> {
  // Servicios activos (solo se puede reservar lo publicado)
  const services = await db.service.findMany({
    where: { id: { in: input.serviceIds }, active: true },
  });
  if (services.length !== input.serviceIds.length) {
    throw new DomainError("Uno de los servicios seleccionados ya no está disponible.", 400);
  }
  if (services.length === 0) {
    throw new DomainError("Selecciona al menos un servicio.", 400);
  }

  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

  // Revalidación server-side de la franja
  const available = await isSlotAvailable(input.date, input.startTime, totalDuration);
  if (!available) {
    throw new DomainError(
      "Ese horario acaba de ocuparse o ya no está disponible. Elige otra franja.",
      409
    );
  }

  // Find-or-create paciente por email
  const email = input.patient.email.toLowerCase().trim();
  const patient = await db.patient.upsert({
    where: { email },
    update: {
      // actualizar teléfono si el paciente trae uno más reciente
      phone: input.patient.phone,
      firstName: input.patient.firstName,
      lastName: input.patient.lastName,
    },
    create: {
      firstName: input.patient.firstName,
      lastName: input.patient.lastName,
      email,
      phone: input.patient.phone,
    },
  });

  const endTime = addMinutes(input.startTime, totalDuration);

  const appointment = await db.appointment.create({
    data: {
      patientId: patient.id,
      date: input.date,
      startTime: input.startTime,
      endTime,
      status: input.initialStatus ?? "PENDING",
      source: input.source,
      notes: input.notes ?? null,
      services: {
        create: services.map((s) => ({
          serviceId: s.id,
          name: s.name,
          price: s.price,
          duration: s.duration,
        })),
      },
    },
  });

  if (input.source === "PUBLIC_FORM") {
    await db.bookingRequest.create({
      data: { appointmentId: appointment.id, doctorNotified: "PENDING" },
    });
  }

  return serializeAppointment(appointment.id);
}

/** Transiciones de estado con efectos (notificaciones). Devuelve la cita actualizada. */
export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<AppointmentRow> {
  const appt = await db.appointment.findUnique({ where: { id } });
  if (!appt) throw new DomainError("Cita no encontrada.", 404);

  // Validación de transición simple: no reactivar citas canceladas/completadas
  const terminal = ["CANCELLED", "COMPLETED", "NO_SHOW"];
  if (terminal.includes(appt.status) && status !== appt.status) {
    throw new DomainError(
      "Esta cita ya está cerrada. Crea una nueva cita si necesitas reagendar.",
      400
    );
  }

  await db.appointment.update({ where: { id }, data: { status } });

  // Al confirmar: registrar/enviar aviso al paciente
  if (status === "CONFIRMED") {
    const row = await serializeAppointment(id);
    const { notifyPatientOfConfirmation } = await import("@/lib/whatsapp");
    await notifyPatientOfConfirmation(row);
    return row;
  }

  return serializeAppointment(id);
}

/** Reagenda (fecha/hora) revalidando disponibilidad. */
export async function rescheduleAppointment(
  id: string,
  date: string,
  startTime: string
): Promise<AppointmentRow> {
  const appt = await db.appointment.findUnique({
    where: { id },
    include: { services: true },
  });
  if (!appt) throw new DomainError("Cita no encontrada.", 404);
  if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appt.status)) {
    throw new DomainError("No se puede reagendar una cita cerrada.", 400);
  }

  const totalDuration = appt.services.reduce((sum, s) => sum + s.duration, 0);

  // La nueva franja no debe chocar con OTRAS citas (excluyendo la propia)
  const { getAvailability } = await import("./availability");
  const others = await db.appointment.findMany({
    where: {
      date,
      id: { not: id },
      status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
    },
    select: { startTime: true, endTime: true },
  });
  const openDay = await db.schedule.findUnique({
    where: { dayOfWeek: new Date(`${date}T12:00:00`).getDay() },
  });
  const block = await db.dateBlock.findUnique({ where: { date } });

  if (!openDay?.isActive || block) {
    throw new DomainError("La clínica no atiende esa fecha o está bloqueada.", 400);
  }
  const startMin = toMinutes(startTime);
  const endMin = startMin + totalDuration;
  const closeMin = toMinutes(openDay.endTime);
  if (endMin > closeMin) {
    throw new DomainError("La cita excede el horario de cierre de ese día.", 400);
  }
  const overlaps = others.some((o) => {
    const os = toMinutes(o.startTime);
    const oe = toMinutes(o.endTime);
    return os < endMin && oe > startMin;
  });
  if (overlaps) {
    throw new DomainError("Esa franja ya está ocupada por otra cita.", 409);
  }

  void getAvailability; // disponible para debug; la lógica arriba es equivalente

  await db.appointment.update({
    where: { id },
    data: { date, startTime, endTime: addMinutes(startTime, totalDuration) },
  });
  return serializeAppointment(id);
}
