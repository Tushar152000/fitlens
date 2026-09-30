import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { StorageModule } from "./storage/storage.module.js";

/** Adapters to the outside world (database, cache, queue, object storage). Global: import once in the root. */
@Module({ imports: [PrismaModule, RedisModule, QueueModule, StorageModule] })
export class InfraModule {}
