import { Body, Query, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/** Validates with a schema from @fitlens/contracts. A ZodError becomes a 400 in AllExceptionsFilter. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}
  transform(value: unknown): T {
    return this.schema.parse(value ?? {});
  }
}

/** `@ZodBody(CreateMealSchema) input: CreateMealInput` */
export const ZodBody = <T>(schema: ZodType<T>) => Body(new ZodPipe(schema));
/** `@ZodQuery(HistoryQuerySchema) query: HistoryQuery` */
export const ZodQuery = <T>(schema: ZodType<T>) => Query(new ZodPipe(schema));
