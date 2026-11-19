/** Simulated network latency. Instant under Vitest so service tests stay fast. */
export const delay = (ms = 300) =>
  import.meta.env.MODE === 'test' ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms));
