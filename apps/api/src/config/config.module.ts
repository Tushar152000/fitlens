import { Global, Inject, Module } from "@nestjs/common";
import { parseEnv, type Env } from "./env.js";

export { isDeployed, type AppEnv } from "./env.js";

export const ENV = Symbol("ENV");

/** Inject the validated environment: `constructor(@InjectEnv() private env: Env)`. */
export const InjectEnv = () => Inject(ENV);

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => parseEnv() }],
  exports: [ENV],
})
export class ConfigModule {}

export type { Env };
