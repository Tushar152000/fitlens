import { requireUserId, route } from "@/lib/api";
import { prisma } from "@/lib/db";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Design 13 "Export CSV": every confirmed meal item plus weigh-ins, one CSV download. */
export const GET = route(async () => {
  const userId = await requireUserId();
  const [meals, metrics] = await Promise.all([
    prisma.mealLog.findMany({
      where: { userId, status: "CONFIRMED" },
      include: { items: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.bodyMetric.findMany({ where: { userId }, orderBy: { date: "asc" } }),
  ]);

  const rows = [
    [
      "type",
      "date",
      "meal",
      "item",
      "quantity",
      "unit",
      "grams",
      "kcal",
      "protein_g",
      "carbs_g",
      "fat_g",
      "note",
    ],
  ];
  for (const m of meals) {
    for (const i of m.items) {
      rows.push([
        "meal_item",
        m.date.toISOString().slice(0, 10),
        m.mealType.toLowerCase(),
        i.name,
        String(i.quantity),
        i.unit,
        String(Math.round(i.grams)),
        String(Math.round(i.kcal)),
        String(Math.round(i.proteinG * 10) / 10),
        String(Math.round(i.carbsG * 10) / 10),
        String(Math.round(i.fatG * 10) / 10),
        m.note ?? "",
      ]);
    }
  }
  for (const b of metrics) {
    rows.push([
      "weigh_in",
      b.date.toISOString().slice(0, 10),
      "",
      "weight_kg",
      String(b.weightKg),
      "kg",
      "",
      "",
      "",
      "",
      "",
      b.waistCm != null ? `waist ${b.waistCm} cm` : "",
    ]);
  }

  const csv = rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fitlens-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
