/**
 * Parses the coach's science notes (prisma/data/knowledge/*.md) for the seed. Each note:
 *
 *   ---
 *   title: How much protein to eat
 *   topic: nutrition
 *   keywords: protein, grams per kg, muscle gain
 *   reviewed: false
 *   sources:
 *   - Jäger R, et al. ISSN Position Stand: protein and exercise. J Int Soc Sports Nutr 2017;14:20
 *   ---
 *
 *   Body in FITR8's own words (never text copied from a book or paper).
 *
 * `reviewed: true` only after a qualified professional has checked the note. See
 * docs/knowledge/README.md.
 */
export interface KnowledgeNoteInput {
  slug: string;
  title: string;
  topic: string;
  keywords: string;
  body: string;
  sources: string[];
  reviewed: boolean;
}

const TOPICS = new Set([
  "nutrition",
  "training",
  "running",
  "supplements",
  "recovery",
  "injury",
  "body",
  "special",
]);

export function parseNote(slug: string, text: string): KnowledgeNoteInput {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${slug}: missing --- front matter`);
  const [, head, rawBody] = match;
  const fields: Record<string, string> = {};
  const sources: string[] = [];
  let inSources = false;
  for (const line of head!.split("\n")) {
    if (inSources && line.startsWith("- ")) {
      sources.push(line.slice(2).trim());
      continue;
    }
    inSources = false;
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) throw new Error(`${slug}: bad front matter line "${line}"`);
    if (kv[1] === "sources") inSources = true;
    else fields[kv[1]!] = kv[2]!.trim();
  }
  const body = rawBody!.trim();
  if (!fields.title) throw new Error(`${slug}: title is required`);
  if (!fields.topic || !TOPICS.has(fields.topic))
    throw new Error(`${slug}: topic must be one of ${[...TOPICS].join(", ")}`);
  if (!sources.length) throw new Error(`${slug}: at least one source is required`);
  if (body.length < 50) throw new Error(`${slug}: body is too short`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error(`${slug}: slug must be kebab-case`);
  return {
    slug,
    title: fields.title,
    topic: fields.topic,
    keywords: fields.keywords ?? "",
    body,
    sources,
    reviewed: fields.reviewed === "true",
  };
}
