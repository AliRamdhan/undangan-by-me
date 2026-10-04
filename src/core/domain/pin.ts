export const PIN_PATTERN = /^\d{6}$/

const RANGE = 1_000_000
// Largest multiple of RANGE below 2^32 — values above it are rejected so every
// PIN is equally likely.
const LIMIT = Math.floor(0x1_0000_0000 / RANGE) * RANGE

function randomPin(): string {
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < LIMIT) return String(buf[0] % RANGE).padStart(6, '0')
  }
}

/**
 * `count` new 6-digit PIN strings, unique among
 * themselves and against `existing`. Always strings — a PIN may start with 0.
 */
export function generatePins(count: number, existing: Iterable<string>): string[] {
  const taken = new Set(existing)
  if (taken.size + count > RANGE / 2) {
    throw new Error('Terlalu banyak PIN untuk ruang 6 digit')
  }
  const out: string[] = []
  while (out.length < count) {
    const pin = randomPin()
    if (taken.has(pin)) continue
    taken.add(pin)
    out.push(pin)
  }
  return out
}
