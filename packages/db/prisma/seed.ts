/**
 * Seeds a starter food list and exercise library.
 * Values are APPROXIMATE placeholders for development. Replace with IFCT 2017 / INDB data
 * (check their licence terms) before launch.
 */
import { config } from "dotenv";
config({ path: "../../.env" });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { EXERCISES } from "@fitlens/domain/training";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Seed = {
  name: string;
  aliases?: string[];
  kcal: number;
  p: number;
  c: number;
  f: number;
  veg?: boolean;
  liquid?: boolean;
  units: Record<string, number>;
};

const foods: Seed[] = [
  {
    name: "roti",
    aliases: ["chapati", "phulka"],
    kcal: 264,
    p: 8.9,
    c: 46,
    f: 5,
    units: { piece: 40 },
  },
  {
    name: "plain paratha",
    aliases: ["paratha"],
    kcal: 300,
    p: 7,
    c: 43,
    f: 11,
    units: { piece: 80 },
  },
  {
    name: "white rice",
    aliases: ["rice", "steamed rice", "chawal"],
    kcal: 130,
    p: 2.7,
    c: 28.2,
    f: 0.3,
    units: { katori: 150, cup: 160 },
  },
  { name: "jeera rice", kcal: 150, p: 2.8, c: 28, f: 3, units: { katori: 150, cup: 160 } },
  {
    name: "dal tadka",
    aliases: ["dal", "toor dal", "arhar dal"],
    kcal: 120,
    p: 6,
    c: 15,
    f: 4,
    units: { katori: 150, bowl: 200 },
  },
  {
    name: "rajma curry",
    aliases: ["rajma"],
    kcal: 140,
    p: 6,
    c: 18,
    f: 5,
    units: { katori: 150, bowl: 200 },
  },
  {
    name: "chole",
    aliases: ["chana masala", "chickpea curry"],
    kcal: 160,
    p: 7,
    c: 20,
    f: 6,
    units: { katori: 150, bowl: 200 },
  },
  {
    name: "paneer curry",
    aliases: ["paneer butter masala", "shahi paneer", "kadai paneer"],
    kcal: 200,
    p: 9,
    c: 7,
    f: 15,
    units: { katori: 150 },
  },
  {
    name: "mixed veg sabzi",
    aliases: ["sabzi", "mix veg"],
    kcal: 90,
    p: 2.5,
    c: 9,
    f: 5,
    units: { katori: 150 },
  },
  {
    name: "aloo sabzi",
    aliases: ["aloo", "potato sabzi"],
    kcal: 110,
    p: 2,
    c: 15,
    f: 5,
    units: { katori: 150 },
  },
  {
    name: "curd",
    aliases: ["dahi", "yogurt"],
    kcal: 60,
    p: 3.5,
    c: 4.7,
    f: 3.3,
    units: { katori: 150, bowl: 200 },
  },
  { name: "idli", kcal: 130, p: 4, c: 27, f: 0.5, units: { piece: 40 } },
  { name: "plain dosa", aliases: ["dosa"], kcal: 170, p: 4, c: 28, f: 5, units: { piece: 90 } },
  { name: "sambar", kcal: 65, p: 3, c: 9, f: 2, units: { katori: 150, bowl: 200 } },
  { name: "poha", kcal: 130, p: 2.5, c: 23, f: 3.5, units: { plate: 150, katori: 120 } },
  { name: "upma", kcal: 140, p: 3.5, c: 20, f: 5, units: { plate: 150, katori: 120 } },
  {
    name: "oats porridge",
    aliases: ["oats"],
    kcal: 70,
    p: 2.5,
    c: 12,
    f: 1.4,
    units: { bowl: 250 },
  },
  {
    name: "toned milk",
    liquid: true,
    aliases: ["milk"],
    kcal: 58,
    p: 3.1,
    c: 4.7,
    f: 3,
    units: { glass: 250, cup: 200 },
  },
  { name: "banana", kcal: 89, p: 1.1, c: 23, f: 0.3, units: { piece: 118 } },
  {
    name: "boiled egg",
    aliases: ["egg"],
    kcal: 155,
    p: 13,
    c: 1.1,
    f: 11,
    veg: false,
    units: { piece: 50 },
  },
  {
    name: "chicken curry",
    kcal: 150,
    p: 14,
    c: 4,
    f: 9,
    veg: false,
    units: { katori: 150, bowl: 200 },
  },
  {
    name: "grilled chicken breast",
    aliases: ["chicken breast"],
    kcal: 165,
    p: 31,
    c: 0,
    f: 3.6,
    veg: false,
    units: { piece: 120 },
  },
  {
    name: "chicken biryani",
    aliases: ["biryani"],
    kcal: 190,
    p: 9,
    c: 22,
    f: 7,
    veg: false,
    units: { plate: 300, katori: 150 },
  },
  // Added fat: the confirm screen's "cooked with ghee or oil" switch adds 1 tsp (5 g ≈ 45 kcal).
  {
    name: "ghee",
    aliases: ["desi ghee"],
    kcal: 900,
    p: 0,
    c: 0,
    f: 100,
    units: { tsp: 5, tbsp: 14 },
  },
  {
    name: "cooking oil",
    aliases: ["oil", "sunflower oil", "mustard oil"],
    kcal: 884,
    p: 0,
    c: 0,
    f: 100,
    units: { tsp: 5, tbsp: 14 },
  },
  // Sweeteners and drinks, so "2 sachets sugar" or a coffee can be picked from the list.
  {
    name: "sugar",
    aliases: ["cheeni", "shakkar", "white sugar"],
    kcal: 387,
    p: 0,
    c: 100,
    f: 0,
    units: { sachet: 5, tsp: 4, cube: 4, tbsp: 12 },
  },
  {
    name: "masala chai",
    liquid: true,
    aliases: ["chai", "tea", "milk tea", "cutting chai"],
    kcal: 60,
    p: 1.8,
    c: 8,
    f: 2.2,
    units: { cup: 150, glass: 200 },
  },
  {
    name: "cappuccino",
    liquid: true,
    aliases: ["coffee", "milk coffee"],
    kcal: 45,
    p: 2.4,
    c: 3.6,
    f: 2.3,
    units: { cup: 180, mug: 300 },
  },
  {
    name: "latte",
    liquid: true,
    aliases: ["cafe latte"],
    kcal: 50,
    p: 2.8,
    c: 4.2,
    f: 2.4,
    units: { cup: 240, mug: 350 },
  },
  {
    name: "filter coffee",
    liquid: true,
    aliases: ["south indian filter coffee", "kaapi"],
    kcal: 55,
    p: 2.2,
    c: 6,
    f: 2.4,
    units: { cup: 150, tumbler: 120 },
  },
  {
    name: "black coffee",
    liquid: true,
    aliases: ["americano", "espresso"],
    kcal: 2,
    p: 0.1,
    c: 0,
    f: 0,
    units: { cup: 200, shot: 30 },
  },
  {
    name: "cold coffee",
    liquid: true,
    aliases: ["iced coffee"],
    kcal: 75,
    p: 2.8,
    c: 11,
    f: 2.2,
    units: { glass: 300 },
  },
];

// The workout library lives with the coach engine; the table mirrors it.
const exercises = EXERCISES.map((e) => ({
  slug: e.slug,
  name: e.name,
  muscleGroup: e.muscleGroup,
  equipment: e.equipment,
  slot: e.slot,
  isMain: e.isMain,
  avoidIf: e.avoidIf,
  loadStepKg: e.loadStepKg,
  timed: Boolean(e.timed),
}));

async function main() {
  for (const f of foods) {
    const data = {
      aliases: f.aliases ?? [],
      source: "CUSTOM" as const,
      kcalPer100g: f.kcal,
      proteinPer100g: f.p,
      carbsPer100g: f.c,
      fatPer100g: f.f,
      isVeg: f.veg ?? true,
      isLiquid: f.liquid ?? false,
    };
    const food = await prisma.food.upsert({
      where: { name: f.name },
      create: { name: f.name, ...data },
      update: data,
    });
    for (const [unit, grams] of Object.entries(f.units)) {
      await prisma.foodUnit.upsert({
        where: { foodId_unit: { foodId: food.id, unit } },
        create: { foodId: food.id, unit, grams },
        update: { grams },
      });
    }
  }
  for (const e of exercises) {
    await prisma.exercise.upsert({ where: { slug: e.slug }, create: e, update: e });
  }
  console.log(`Seeded ${foods.length} foods and ${exercises.length} exercises`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
