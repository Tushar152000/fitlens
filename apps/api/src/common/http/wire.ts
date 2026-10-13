import type { Jsonify } from "@fitr8/contracts";

/**
 * Type-level only: what a service value looks like once Nest serialises it (Dates → ISO strings).
 * Returns its argument unchanged, so a controller can declare `Promise<SomeDto>` and have the
 * compiler check the service's real return type against the contract in @fitr8/contracts.
 */
export function wire<T>(value: Promise<T>): Promise<Jsonify<T>>;
export function wire<T>(value: T): Jsonify<T>;
export function wire(value: unknown): unknown {
  return value;
}
