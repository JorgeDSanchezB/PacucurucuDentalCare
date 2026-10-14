// Lógica de disponibilidad de citas.
// Fuente de verdad server-side: Schedule + DateBlock + Appointment.
import { db } from "@/lib/db";
import { clinicToday, toMinutes, fromMinutes } from "@/lib/validators";

export interface AvailabilityResult {
  closed: boolean;
  slots: string[];
  reason?: string;
}

const SLOT_STEP = 30; // rejilla de 30 minutos
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;

export async function getAvailability(date: string, durationMin: number): Promise<AvailabilityResult> {
  // 1. Fecha válida y futura
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00`))) {
    return { closed: true, slots: [], reason: "Fecha inválida." };
  }
  if (date < clinicToday()) {
    return { closed: true, slots: [], reason: "La fecha ya pasó. Selecciona una fecha futura." };
  }

  // 2. Horario del día de la semana
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const schedule = await db.schedule.findUnique({ where: { dayOfWeek } });
  if (!schedule || !schedule.isActive) {
    return { closed: true, slots: [], reason: "La clínica no atiende este día." };
  }

  // 3. Fecha bloqueada
  const block = await db.dateBlock.findUnique({ where: { date } });
  if (block) {
    return { closed: true, slots: [], reason: `Día bloqueado: ${block.reason}.` };
  }

  // 4. Citas existentes
  const appointments = await db.appointment.findMany({
    where: { date, status: { in: [...ACTIVE_STATUSES] } },
    select: { startTime: true, endTime: true },
  });

  const openMin = toMinutes(schedule.startTime);
  const closeMin = toMinutes(schedule.endTime);
  const busy = appointments.map((a) => ({
    start: toMinutes(a.startTime),
    end: toMinutes(a.endTime),
  }));

  const slots: string[] = [];
  for (let start = openMin; start + durationMin <= closeMin; start += SLOT_STEP) {
    const end = start + durationMin;
    const overlaps = busy.some((b) => b.start < end && b.end > start);
    if (!overlaps) slots.push(fromMinutes(start));
  }

  return {
    closed: false,
    slots,
    reason: slots.length === 0 ? "No hay horarios disponibles para esta fecha. Prueba otra fecha." : undefined,
  };
}

/** Valida que una franja concreta esté disponible (revalidación server-side). */
export async function isSlotAvailable(date: string, startTime: string, durationMin: number): Promise<boolean> {
  const availability = await getAvailability(date, durationMin);
  return availability.slots.includes(startTime);
}
