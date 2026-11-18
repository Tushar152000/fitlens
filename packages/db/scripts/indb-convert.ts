/**
 * Converts the Indian Nutrient Databank (INDB) spreadsheets into prisma/data/indb.json, which the
 * seed loads. Run again only when INDB publishes a new release:
 *
 *   # download INDB.xlsx and recipes.xlsx from
 *   # https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- into some folder, then
 *   pnpm --filter @fitr8/db exec tsx scripts/indb-convert.ts <that folder>
 *
 * INDB: Vijayakumar A, et al. "Development of an Indian Food Composition Database (INDB)", Current
 * Developments in Nutrition (2024). 1,014 Indian recipes with nutrients per 100 g and per serving.
 * Licence: open access, no licence file in the repository. Confirm commercial use with the authors
 * before relying on it in production (docs/DEPLOY.md "Food database").
 */
import { readSheet } from "read-excel-file/node";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface IndbFood {
  /** INDB recipe code (ASC001, BFP144, OSR012). */
  code: string;
  name: string;
  aliases: string[];
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number | null;
  sugar: number | null;
  sodiumMg: number | null;
  veg: boolean;
  liquid: boolean;
  /** One INDB serving ("1 bowl" = 250 g), or null when INDB gives none. */
  serving: { label: string; grams: number } | null;
  /** Unit → grams, for the meal parser ("2 katori", "1 piece"). */
  units: Record<string, number>;
}

type Cell = string | number | boolean | Date | null;

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: Cell): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** "mutton biryani/biriyani" → ["mutton biryani", "mutton biriyani"]: each "/" choice in a word. */
function variants(s: string): string[] {
  const words = s.split(" ");
  const i = words.findIndex((w) => w.includes("/"));
  if (i < 0) return [s];
  return words[i]!.split("/")
    .filter(Boolean)
    .flatMap((choice) => variants([...words.slice(0, i), choice, ...words.slice(i + 1)].join(" ")));
}

/**
 * "Plain khitchdi (Plain khichri/khichdi)" → name "plain khitchdi", aliases [plain khichri, khichdi];
 * "Mutton biryani/biriyani" → name "mutton biryani", alias "mutton biriyani".
 */
export function splitName(raw: string): { name: string; aliases: string[] } {
  const inner = [...raw.matchAll(/\(([^)]*)\)/g)].flatMap((m) => m[1]!.split(",")).map(clean);
  // "Lassi (Salted)" is a kind of lassi, not another name for it: "salted lassi". "(with semolina)"
  // goes after the name; "(2 pieces)" is dropped.
  const before = inner.filter((q) => ADJECTIVE.test(q));
  const after = inner.filter((q) => /^(with|without|in) \S/.test(q));
  const names = inner.filter((q) => !before.includes(q) && !after.includes(q) && !/^\d/.test(q));
  const base = clean(`${before.join(" ")} ${raw.replace(/\([^)]*\)/g, " ")} ${after.join(" ")}`);
  const [name = "", ...others] = variants(base);
  const aliases = [...others, ...names.flatMap(variants)];
  return {
    name,
    aliases: [...new Set(aliases)].filter((a) => a.length > 1 && a !== name && !GENERIC.has(a)),
  };
}

/** Words too broad to stand for one dish. */
const GENERIC = new Set([
  "curry",
  "sabzi",
  "sabji",
  "dal",
  "rice",
  "roti",
  "soup",
  "salad",
  "sweet",
  "snack",
  "drink",
]);

/** Bracketed words that describe a variant rather than name the dish. */
const ADJECTIVE =
  /^(salted|sweet|sweetened|unsweetened|plain|spicy|hot|cold|chilled|iced|fried|deep fried|shallow fried|boiled|baked|steamed|roasted|grilled|instant|homemade|thick|thin|dry|gravy|green|red|white|brown|veg|vegetarian|non-?veg|whole|mixed|toasted|stirred|wet|medium|soft|hard|small|large|raw|cooked)$/;

/** Countable serving units: also reachable as "piece" ("2 idli" or "2 pieces"). */
const COUNTABLE = new Set([
  "piece",
  "biscuit",
  "cookie",
  "slice",
  "large slice",
  "egg",
  "sandwich",
  "triangle",
  "toasted triangle",
  "parantha",
  "poori",
  "cutlet",
  "pancake",
  "ladoo",
  "vada",
  "burfi",
  "tart",
  "cheela",
  "dosa",
  "idli",
  "pastry",
  "roti",
  "kabab",
  "samosa",
  "kachori",
  "pakora",
  "chapati",
  "naan",
  "uttapam",
  "momo",
  "roll",
]);
const WEIGHT_UNITS = new Set(["g", "gm", "gms", "gram", "grams", "ml", "kg", "l", "litre"]);
const MAX_SERVING_G = 600;
const LIQUID_UNITS = new Set(["glass", "tall glass", "tea cup"]);

/** The meal-parser units for one INDB serving unit (normalised like the API's unit lookup). */
export function unitsFor(unit: string): string[] {
  const u = clean(unit);
  if (!u) return [];
  if (u === "tablespoon") return ["tbsp"];
  if (u === "teaspoon") return ["tsp"];
  if (u === "tall glass") return ["glass", "tall glass"];
  if (u === "tea cup") return ["cup", "tea cup"];
  if (u === "small bowl") return ["katori", "small bowl"];
  if (u === "soup bowl" || u === "curry bowl") return ["bowl", u];
  if (COUNTABLE.has(u)) return u === "piece" ? ["piece"] : [u, "piece"];
  return [u];
}

/** IFCT food groups M (egg), N (poultry), O (meat), P–S (fish, shellfish, molluscs). */
const NON_VEG_GROUP = /^[MNOPQRS]\d/;
const NON_VEG_WORD =
  /\b(eggs?|chicken|mutton|lamb|goat|beef|pork|ham|bacon|salami|sausages?|meat|mince|keema|fish|prawns?|shrimps?|crab|lobster|tuna|salmon|anchov\w*|gelatine?)\b/i;

export function isNonVegIngredient(code: string, name: string): boolean {
  return NON_VEG_GROUP.test(code.trim()) || NON_VEG_WORD.test(name);
}

/** One INDB row (header → value) to a food, or null when it can't be used. */
export function toFood(row: Record<string, Cell>, nonVeg: Set<string>): IndbFood | null {
  const code = String(row.food_code ?? "").trim();
  const rawName = String(row.food_name ?? "").trim();
  const kcal = num(row.energy_kcal);
  const [p, c, f] = [num(row.protein_g), num(row.carb_g), num(row.fat_g)];
  if (!code || !rawName || kcal == null || p == null || c == null || f == null) return null;
  const { name, aliases } = splitName(rawName);
  if (!name) return null;

  // Serving weight = per-serving value / per-100 g value, from the largest macro (most precise).
  const pairs: [number | null, number][] = [
    [num(row.unit_serving_energy_kcal), kcal],
    [num(row.unit_serving_carb_g), c],
    [num(row.unit_serving_protein_g), p],
    [num(row.unit_serving_fat_g), f],
  ];
  const ratio = pairs.find(([per, per100]) => per != null && per100 > 0.5);
  const grams = ratio ? round1((ratio[0]! / ratio[1]) * 100) : null;
  const unit = clean(String(row.servings_unit ?? ""));
  // A unit is only useful as a portion: "1 gm" isn't one, and a whole dish ("1 lasagne dish",
  // "1 chicken", 1.5 kg) would be a wrong default amount.
  const portion =
    unit && !WEIGHT_UNITS.has(unit) && grams != null && grams >= 5 && grams <= MAX_SERVING_G;
  const serving = portion ? { label: `1 ${unit}`, grams: grams! } : null;

  const units: Record<string, number> = {};
  if (serving) {
    units.serving = serving.grams;
    for (const u of unitsFor(unit)) units[u] = serving.grams;
  }
  return {
    code,
    name,
    aliases,
    kcal: round1(kcal),
    p: round1(p),
    c: round1(c),
    f: round1(f),
    fiber: num(row.fibre_g) == null ? null : round1(num(row.fibre_g)!),
    sugar: num(row.freesugar_g) == null ? null : round1(num(row.freesugar_g)!),
    sodiumMg: num(row.sodium_mg) == null ? null : round1(num(row.sodium_mg)!),
    veg: !nonVeg.has(code),
    liquid: LIQUID_UNITS.has(unit),
    serving,
    units,
  };
}

const asObjects = (rows: Cell[][]) => {
  const [head, ...body] = rows;
  const keys = head!.map((h) => String(h ?? "").trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? null])));
};

async function main() {
  const dir = process.argv[2];
  if (!dir)
    throw new Error("Usage: tsx scripts/indb-convert.ts <folder with INDB.xlsx and recipes.xlsx>");
  const indb = asObjects((await readSheet(join(dir, "INDB.xlsx"))) as Cell[][]);
  const recipes = asObjects((await readSheet(join(dir, "recipes.xlsx"))) as Cell[][]);

  const nonVeg = new Set<string>();
  for (const r of recipes) {
    if (
      isNonVegIngredient(
        String(r.food_code ?? ""),
        `${r.food_name ?? ""} ${r.ingredient_name_org ?? ""}`,
      )
    ) {
      nonVeg.add(String(r.recipe_code).trim());
    }
  }

  const seen = new Set<string>();
  const foods: IndbFood[] = [];
  let skipped = 0;
  for (const row of indb) {
    const food = toFood(row, nonVeg);
    // Same dish in two cookbooks: the first one wins (names must be unique).
    if (!food || seen.has(food.name)) {
      skipped++;
      continue;
    }
    seen.add(food.name);
    foods.push(food);
  }

  const out = join(dirname(fileURLToPath(import.meta.url)), "../prisma/data/indb.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(foods)}\n`);
  console.log(`${foods.length} foods → ${out} (${skipped} skipped: duplicates or missing values)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
