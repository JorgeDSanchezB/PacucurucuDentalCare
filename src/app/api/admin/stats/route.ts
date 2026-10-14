// GET /api/admin/stats — dashboard del panel.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession, handleError } from "@/lib/api";
import { clinicToday } from "@/lib/validators";
import type { AdminStats } from "@/types";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  try {
    const today = clinicToday();
    const now = new Date();

    // Rango de los últimos 14 días (gráfico)
    const days14: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days14.push(d.toISOString().slice(0, 10));
    }

    const monthStart = `${today.slice(0, 7)}-01`;

    const [
      todayAppts, weekCount, newPatients, monthInvoices, pendingCount, unreadCount,
      byDayRaw, recentMessages,
    ] = await Promise.all([
      db.appointment.findMany({
        where: { date: today, status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] } },
        include: { patient: true, services: true, invoice: { select: { id: true } } },
        orderBy: { startTime: "asc" },
      }),
      db.appointment.count({
        where: {
          date: { gte: today, lte: days14WeekEnd() },
          status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
        },
      }),
      db.patient.count({ where: { createdAt: { gte: new Date(monthStart + "T00:00:00") } } }),
      db.invoice.findMany({
        where: { date: { gte: monthStart } },
        select: { total: true },
      }),
      db.appointment.count({ where: { status: "PENDING" } }),
      db.contactMessage.count({ where: { read: false } }),
      db.appointment.groupBy({
        by: ["date"],
        where: { date: { gte: days14[0] }, status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] } },
        _count: { id: true },
      }),
      db.contactMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]);

    const countByDate = new Map<string, number>();
    for (const row of byDayRaw) countByDate.set(row.date, row._count.id);

    const stats: AdminStats = {
      todayCount: todayAppts.length,
      weekCount,
      newPatientsThisMonth: newPatients,
      monthRevenue: monthInvoices.reduce((s, i) => s + i.total, 0),
      pendingRequests: pendingCount,
      unreadMessages: unreadCount,
      appointmentsByDay: days14.map((date) => ({ date, count: countByDate.get(date) ?? 0 })),
      todayAppointments: todayAppts.map((a) => ({
        id: a.id,
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status as AdminStats["todayAppointments"][number]["status"],
        source: a.source,
        notes: a.notes,
        adminNotes: a.adminNotes,
        createdAt: a.createdAt.toISOString(),
        patient: {
          id: a.patient.id,
          firstName: a.patient.firstName,
          lastName: a.patient.lastName,
          phone: a.patient.phone,
          email: a.patient.email,
        },
        services: a.services.map((s) => ({ id: s.id, name: s.name, price: s.price, duration: s.duration })),
        hasInvoice: !!a.invoice,
      })),
      recentMessages: recentMessages.map((m) => ({
        id: m.id, name: m.name, email: m.email, phone: m.phone,
        message: m.message, read: m.read, createdAt: m.createdAt.toISOString(),
      })),
    };

    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    return handleError(e);
  }
}

function days14WeekEnd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}
