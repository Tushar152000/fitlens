import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { prisma } from "@/lib/db";

/** Food search for adding a missed item: name or alias, with per-100 g nutrition and household units. */
export const GET = route(async (req) => {
  await requireUserId();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 60);
  const foods = await prisma.food.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { aliases: { has: q } }] }
      : undefined,
    include: { units: { select: { unit: true, grams: true } } },
    orderBy: { name: "asc" },
    take: 12,
  });
  return NextResponse.json({
    foods: foods.map((f) => ({
      id: f.id,
      name: f.name,
      per100g: {
        kcal: f.kcalPer100g,
        protein: f.proteinPer100g,
        carbs: f.carbsPer100g,
        fat: f.fatPer100g,
      },
      units: f.units,
    })),
  });
});
