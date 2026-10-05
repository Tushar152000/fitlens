import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, prismaOptions } from "@fitr8/db";
import { InjectEnv, type Env } from "../../config/config.module.js";

/**
 * The one database client per process. Services inject this; nothing else creates clients.
 * Extending PrismaClient keeps the full typed API (`this.prisma.mealLog.findMany(...)`).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@InjectEnv() env: Env) {
    super(prismaOptions({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_MAX }));
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
