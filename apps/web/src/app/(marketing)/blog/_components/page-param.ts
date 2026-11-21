/** ?page=N as a positive integer (anything else → 1). */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
}
