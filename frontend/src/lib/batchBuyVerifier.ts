export type DecisionState =
  | "safe"
  | "do_not_buy"
  | "quantity_mismatch"
  | "missing_from_export"
  | "unexpected_in_export";

export type QuantityMode = "ignore_mismatch" | "require_exact";

export type ToleranceSettings = {
  mode: "strict" | "isk_slippage" | "percent_slippage";
  iskSlippageTolerance: number;
  percentSlippageTolerance: number;
  quantityMode: QuantityMode;
};

export type PlannedLine = {
  rawName: string;
  name: string;
  plannedQuantity: number;
  targetBuyPer: number;
  optionalFields: Record<string, string>;
};

export type ExportLine = {
  rawName: string;
  name: string;
  actualQuantity: number;
  actualBuyPer: number;
};

export type ComparisonRow = {
  itemName: string;
  state: DecisionState;
  targetBuyPer?: number;
  actualBuyPer?: number;
  plannedQuantity?: number;
  actualQuantity?: number;
  extraIskVsPlan?: number;
  estimatedProfitLost?: number;
  explanation: string;
};

export type ComparisonSummary = {
  safeCount: number;
  doNotBuyCount: number;
  quantityMismatchCount: number;
  missingCount: number;
  unexpectedCount: number;
  extraIskVsPlan: number;
  estimatedProfitLost: number;
};

export function normalizeItemName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function parseNumber(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function parseBatchManifestLine(line: string): PlannedLine | null {
  const parts = line.split("|").map((part) => part.trim());
  if (parts.length < 3) return null;

  const name = normalizeItemName(parts[0] ?? "");
  if (!name) return null;

  const kv = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const [key, ...rest] = part.split(/\s+/);
    if (!key || rest.length === 0) continue;
    kv.set(key.toLowerCase(), rest.join(" "));
  }

  const qty = parseNumber(kv.get("qty") ?? "");
  const buyPer = parseNumber(kv.get("buy") ?? "");
  if (!Number.isFinite(qty) || !Number.isFinite(buyPer)) return null;

  const optionalFields: Record<string, string> = {};
  for (const [key, value] of kv.entries()) {
    if (key !== "qty" && key !== "buy") optionalFields[key] = value;
  }

  return {
    rawName: parts[0] ?? "",
    name,
    plannedQuantity: Math.trunc(qty),
    targetBuyPer: buyPer,
    optionalFields,
  };
}

export function parseExportOrderLine(line: string): ExportLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const cols = line.split("\t").map((col) => col.trim());
  const name = normalizeItemName(cols[0] ?? "");
  if (!name || /^total:$/i.test(name)) return null;

  if (cols.length < 3) return null;
  const qty = parseNumber(cols[1] ?? "");
  const buyPer = parseNumber(cols[2] ?? "");
  if (!Number.isFinite(qty) || !Number.isFinite(buyPer)) return null;

  return {
    rawName: cols[0] ?? "",
    name,
    actualQuantity: Math.trunc(qty),
    actualBuyPer: buyPer,
  };
}

function allowedBuyPer(targetBuyPer: number, tolerance: ToleranceSettings): number {
  if (tolerance.mode === "strict") return targetBuyPer;
  if (tolerance.mode === "isk_slippage") return targetBuyPer + tolerance.iskSlippageTolerance;
  return targetBuyPer * (1 + tolerance.percentSlippageTolerance / 100);
}

function buildExplanation(row: ComparisonRow): string {
  switch (row.state) {
    case "safe":
      return "Within configured buy-per and quantity tolerances.";
    case "do_not_buy":
      return `Actual buy-per ${row.actualBuyPer} exceeds allowed target ${row.targetBuyPer}.`;
    case "quantity_mismatch":
      return `Quantity mismatch: planned ${row.plannedQuantity}, actual ${row.actualQuantity}.`;
    case "missing_from_export":
      return "Item exists in manifest but not in export order data.";
    case "unexpected_in_export":
      return "Item exists in export order data but not in manifest.";
  }
}

export function compareBatchToExport(
  plannedLines: PlannedLine[],
  exportLines: ExportLine[],
  tolerance: ToleranceSettings,
): { rows: ComparisonRow[]; summary: ComparisonSummary } {
  const plannedByName = new Map(plannedLines.map((line) => [line.name, line]));
  const exportByName = new Map(exportLines.map((line) => [line.name, line]));

  const rows: ComparisonRow[] = [];

  for (const planned of plannedLines) {
    const actual = exportByName.get(planned.name);
    if (!actual) {
      rows.push({
        itemName: planned.name,
        state: "missing_from_export",
        targetBuyPer: planned.targetBuyPer,
        plannedQuantity: planned.plannedQuantity,
        explanation: "",
      });
      continue;
    }

    const allowed = allowedBuyPer(planned.targetBuyPer, tolerance);
    const extraIskVsPlan = (actual.actualBuyPer - planned.targetBuyPer) * actual.actualQuantity;

    let state: DecisionState = "safe";
    if (actual.actualBuyPer > allowed) {
      state = "do_not_buy";
    } else if (
      tolerance.quantityMode === "require_exact" &&
      actual.actualQuantity !== planned.plannedQuantity
    ) {
      state = "quantity_mismatch";
    }

    rows.push({
      itemName: planned.name,
      state,
      targetBuyPer: planned.targetBuyPer,
      actualBuyPer: actual.actualBuyPer,
      plannedQuantity: planned.plannedQuantity,
      actualQuantity: actual.actualQuantity,
      extraIskVsPlan,
      estimatedProfitLost: Math.max(0, extraIskVsPlan),
      explanation: "",
    });
  }

  for (const actual of exportLines) {
    if (plannedByName.has(actual.name)) continue;
    rows.push({
      itemName: actual.name,
      state: "unexpected_in_export",
      actualBuyPer: actual.actualBuyPer,
      actualQuantity: actual.actualQuantity,
      explanation: "",
    });
  }

  for (const row of rows) {
    row.explanation = buildExplanation(row);
  }

  const summary: ComparisonSummary = {
    safeCount: rows.filter((row) => row.state === "safe").length,
    doNotBuyCount: rows.filter((row) => row.state === "do_not_buy").length,
    quantityMismatchCount: rows.filter((row) => row.state === "quantity_mismatch").length,
    missingCount: rows.filter((row) => row.state === "missing_from_export").length,
    unexpectedCount: rows.filter((row) => row.state === "unexpected_in_export").length,
    extraIskVsPlan: rows.reduce((sum, row) => sum + (row.extraIskVsPlan ?? 0), 0),
    estimatedProfitLost: rows.reduce((sum, row) => sum + (row.estimatedProfitLost ?? 0), 0),
  };

  return { rows, summary };
}
