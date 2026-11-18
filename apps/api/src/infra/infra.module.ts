import { Module } from "@nestjs/common";
import { MailModule } from "./mail/mail.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { StorageModule } from "./storage/storage.module.js";

/** Adapters to the outside world (database, cache, queue, object storage, email). Global: import once in the root. */
@Module({ imports: [PrismaModule, RedisModule, QueueModule, StorageModule, MailModule] })
export class InfraModule {}
