export function passesNumericFilter(value: number, filter: string): boolean {
  const trimmed = filter.trim();
  if (!trimmed) return true;

  const rangeMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const min = Number.parseFloat(rangeMatch[1]);
    const max = Number.parseFloat(rangeMatch[2]);
    if (Number.isNaN(min) || Number.isNaN(max)) return true;
    return value >= Math.min(min, max) && value <= Math.max(min, max);
  }

  if (trimmed.startsWith(">=")) {
    const parsed = Number.parseFloat(trimmed.slice(2));
    return Number.isNaN(parsed) || value >= parsed;
  }
  if (trimmed.startsWith(">")) {
    const parsed = Number.parseFloat(trimmed.slice(1));
    return Number.isNaN(parsed) || value > parsed;
  }
  if (trimmed.startsWith("<=")) {
    const parsed = Number.parseFloat(trimmed.slice(2));
    return Number.isNaN(parsed) || value <= parsed;
  }
  if (trimmed.startsWith("<")) {
    const parsed = Number.parseFloat(trimmed.slice(1));
    return Number.isNaN(parsed) || value < parsed;
  }
  if (trimmed.startsWith("=")) {
    const parsed = Number.parseFloat(trimmed.slice(1));
    return Number.isNaN(parsed) || value === parsed;
  }

  const threshold = Number.parseFloat(trimmed);
  return Number.isNaN(threshold) || value >= threshold;
}

export function passesTextFilter(value: unknown, filter: string): boolean {
  return String(value ?? "")
    .toLowerCase()
    .includes(filter.toLowerCase());
}
