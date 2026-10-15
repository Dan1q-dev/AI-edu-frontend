// Accept only concrete colors, never arbitrary CSS expressions from imported JSON.
export function safeTextColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) return value
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(value)
  if (rgb && rgb.slice(1).every(part => Number(part) <= 255)) return value
  return undefined
}
