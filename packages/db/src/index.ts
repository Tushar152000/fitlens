import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export * from "./generated/prisma/client.js";

export interface DatabaseOptions {
  connectionString: string;
  /** Pool size per process. Keep (instances × max) under the database's connection limit. */
  max?: number;
}

/** Constructor options for PrismaClient over node-postgres (the API's PrismaService extends PrismaClient). */
export function prismaOptions({ connectionString, max = 10 }: DatabaseOptions) {
  return { adapter: new PrismaPg({ connectionString, max }) };
}

/** A standalone client for scripts and tests. */
export function createPrismaClient(options: DatabaseOptions) {
  return new PrismaClient(prismaOptions(options));
}
