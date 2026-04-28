export type RadiusPerfMetrics = {
  rowsScanned: number;
  rowsVisible: number;
  renderRowCount: number;
  filterTimeMs: number;
  sortTimeMs: number;
  lastScanDurationMs: number | null;
  lastScanTimestampMs: number | null;
  cacheAgeMs: number | null;
  cacheHitCount: number | null;
  cacheMissCount: number | null;
};

export function timed<T>(run: () => T): { value: T; durationMs: number } {
  const startedAt = performance.now();
  const value = run();
  return { value, durationMs: performance.now() - startedAt };
}

export function aggregateDurations(samples: number[]): { totalMs: number; averageMs: number; maxMs: number } {
  if (samples.length === 0) return { totalMs: 0, averageMs: 0, maxMs: 0 };
  const totalMs = samples.reduce((sum, sample) => sum + sample, 0);
  return {
    totalMs,
    averageMs: totalMs / samples.length,
    maxMs: Math.max(...samples),
  };
}

export function resetPerfMetrics(): RadiusPerfMetrics {
  return {
    rowsScanned: 0,
    rowsVisible: 0,
    renderRowCount: 0,
    filterTimeMs: 0,
    sortTimeMs: 0,
    lastScanDurationMs: null,
    lastScanTimestampMs: null,
    cacheAgeMs: null,
    cacheHitCount: null,
    cacheMissCount: null,
  };
}
