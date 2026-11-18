import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../infra/prisma/prisma.service.js";

export interface KnowledgeHit {
  slug: string;
  title: string;
  topic: string;
  body: string;
  sources: string[];
  reviewed: boolean;
}

/** The words of a question as an OR full-text query: "how much protein?" → "how | much | protein". */
export function toOrQuery(question: string, maxWords = 12): string | null {
  const words = [
    ...new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 2),
    ),
  ].slice(0, maxWords);
  return words.length ? words.join(" | ") : null;
}

/**
 * The coach's science notes (table `knowledge_notes`, loaded by the seed from
 * packages/db/prisma/data/knowledge). Postgres full-text search ranks title and keywords above the
 * body; the table is small (tens to hundreds of notes), so no index is needed.
 */
@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async search(question: string, limit = 3): Promise<KnowledgeHit[]> {
    const query = toOrQuery(question);
    if (!query) return [];
    return this.prisma.$queryRaw<KnowledgeHit[]>`
      SELECT n.slug, n.title, n.topic, n.body, n.sources, n.reviewed
      FROM knowledge_notes n,
        to_tsquery('english', ${query}) q,
        LATERAL (
          SELECT setweight(to_tsvector('english', n.title), 'A')
            || setweight(to_tsvector('english', n.keywords), 'A')
            || setweight(to_tsvector('english', n.body), 'C') AS doc
        ) d
      WHERE d.doc @@ q
      ORDER BY ts_rank(d.doc, q) DESC, n.slug
      LIMIT ${limit}`;
  }
}
