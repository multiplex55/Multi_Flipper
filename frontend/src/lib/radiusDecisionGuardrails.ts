import { formatISK } from "@/lib/format";

type NormalizeMetricInput = {
  value: number | null | undefined;
  min: number;
  max: number;
  invert?: boolean;
};

export type MetricNormalizer = (value: number | null | undefined) => number;

export function finiteNumber(value: number | null | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export function normalizeMetric({ value, min, max, invert = false }: NormalizeMetricInput): number {
  const safeMin = finiteNumber(min, 0);
  const safeMax = finiteNumber(max, safeMin + 1);
  const range = Math.max(1e-9, safeMax - safeMin);
  const safeValue = finiteNumber(value, safeMin);
  const raw = Math.max(0, Math.min(1, (safeValue - safeMin) / range));
  return invert ? 1 - raw : raw;
}

// Radius guardrail entrypoint: build a null/NaN-safe normalizer that remains deterministic for sparse inputs.
export function createMetricNormalizer(values: Array<number | null | undefined>, invert = false): MetricNormalizer {
  const normalizedValues = values.map((entry) => finiteNumber(entry, 0));
  const min = normalizedValues.length > 0 ? Math.min(...normalizedValues) : 0;
  const max = normalizedValues.length > 0 ? Math.max(...normalizedValues) : 1;
  return (value) => normalizeMetric({ value, min, max, invert });
}

export type Comparator<T> = (left: T, right: T) => number;

export function compareNumberDesc(left: number | null | undefined, right: number | null | undefined): number {
  return finiteNumber(right, 0) - finiteNumber(left, 0);
}

export function compareNumberAsc(left: number | null | undefined, right: number | null | undefined): number {
  return finiteNumber(left, 0) - finiteNumber(right, 0);
}

export function compareTextAsc(left: string | null | undefined, right: string | null | undefined): number {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

// Radius guardrail entrypoint: deterministic comparator composition shared by focus/cargo/shopping ranking.
export function combineComparators<T>(...comparators: Comparator<T>[]): Comparator<T> {
  return (left, right) => {
    for (const comparator of comparators) {
      const value = comparator(left, right);
      if (value !== 0) return value;
    }
    return 0;
  };
}

// Radius guardrail entrypoint: formatting helpers keep labels consistent across decision surfaces.
export function formatIskLabel(value: number | null | undefined): string {
  return formatISK(finiteNumber(value, 0));
}

export function formatM3Label(value: number | null | undefined): string {
  return `${Math.round(finiteNumber(value, 0)).toLocaleString()} m3`;
}

export function formatIskPerJumpLabel(value: number | null | undefined): string {
  return `${formatISK(finiteNumber(value, 0))}/jump`;
}

export function formatRiskLabel(value: number | null | undefined): string {
  return `risk ${finiteNumber(value, 0).toFixed(0)}`;
}
