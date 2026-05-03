export type ParseDiagnostic = {
  lineNumber: number;
  line: string;
  reason: string;
};

export type ParseResult<T> = {
  items: T[];
  ignoredLines: ParseDiagnostic[];
  errors: ParseDiagnostic[];
};

export type ManifestItem = {
  rawName: string;
  name: string;
  qty: number;
  buyTotal?: number;
  buyPer?: number;
  sellTotal?: number;
  sellPer?: number;
  vol?: number;
  profit?: number;
};

export type ExportItem = {
  rawName: string;
  name: string;
  qty: number;
  buyPer: number;
  buyTotal: number;
};


export type BatchManifestHeader = {
  buyStation?: string;
  jumpsToBuyStation?: number;
  sellStation?: string;
  jumpsBuyToSell?: number;
  cargoM3?: number;
};

const batchManifestHeaderParsers: Array<[RegExp, (value: string, header: BatchManifestHeader) => void]> = [
  [/^buy station:\s*(.*)$/i, (value, header) => {
    const station = normalizeItemName(value);
    if (station) header.buyStation = station;
  }],
  [/^jumps to buy station:\s*(.*)$/i, (value, header) => {
    const parsed = parseIskNumber(value);
    if (Number.isFinite(parsed)) header.jumpsToBuyStation = parsed;
  }],
  [/^sell station:\s*(.*)$/i, (value, header) => {
    const station = normalizeItemName(value);
    if (station) header.sellStation = station;
  }],
  [/^jumps buy\s*->\s*sell:\s*(.*)$/i, (value, header) => {
    const parsed = parseIskNumber(value);
    if (Number.isFinite(parsed)) header.jumpsBuyToSell = parsed;
  }],
  [/^cargo m3:\s*(.*)$/i, (value, header) => {
    const parsed = parseIskNumber(value);
    if (Number.isFinite(parsed)) header.cargoM3 = parsed;
  }],
];

export function parseBatchManifestHeader(text: string): BatchManifestHeader {
  const header: BatchManifestHeader = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const [pattern, assign] of batchManifestHeaderParsers) {
      const match = trimmed.match(pattern);
      if (!match) continue;

      assign(match[1] ?? "", header);
      break;
    }
  }

  return header;
}

const manifestLabels = ["qty", "buy total", "buy per", "sell total", "sell per", "vol", "profit"] as const;
const manifestLabelSet = new Set<string>(manifestLabels);

function addIgnored(target: ParseDiagnostic[], lineNumber: number, line: string, reason: string): void {
  target.push({ lineNumber, line, reason });
}

function addError(target: ParseDiagnostic[], lineNumber: number, line: string, reason: string): void {
  target.push({ lineNumber, line, reason });
}

export function normalizeItemName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function parseIskNumber(raw: string): number {
  const cleaned = raw
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .replace(/isk/gi, "")
    .replace(/m3/gi, "");

  if (!cleaned) {
    return Number.NaN;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function findManifestLabel(segment: string): { label: string; value: string } | null {
  const normalized = segment.trim().replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  for (const label of manifestLabels) {
    if (!lower.startsWith(`${label} `)) continue;
    return {
      label,
      value: normalized.slice(label.length).trim(),
    };
  }

  return null;
}

function isManifestNonDataLine(trimmed: string): boolean {
  if (!trimmed) return true;
  if (/^[-=|\s]+$/.test(trimmed)) return true;
  if (/^items\s*:/i.test(trimmed)) return true;
  if (/^(summary|totals?)\s*:/i.test(trimmed)) return true;
  return false;
}

export function parseBatchManifest(text: string): ParseResult<ManifestItem> {
  const items: ManifestItem[] = [];
  const ignoredLines: ParseDiagnostic[] = [];
  const errors: ParseDiagnostic[] = [];

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const lineNumber = i + 1;
    const trimmed = line.trim();

    if (isManifestNonDataLine(trimmed)) {
      addIgnored(ignoredLines, lineNumber, line, trimmed ? "header/summary/separator line" : "blank line");
      continue;
    }

    const segments = line.split("|").map((segment) => segment.trim()).filter(Boolean);
    if (segments.length < 2) {
      addIgnored(ignoredLines, lineNumber, line, "line does not contain expected manifest segments");
      continue;
    }

    const rawName = segments[0] ?? "";
    const name = normalizeItemName(rawName);
    if (!name) {
      addError(errors, lineNumber, line, "missing item name");
      continue;
    }

    const parsedValues = new Map<string, number>();
    let hasSegmentError = false;

    for (const segment of segments.slice(1)) {
      const matched = findManifestLabel(segment);
      if (!matched) {
        addError(errors, lineNumber, line, `unknown or malformed segment: ${segment}`);
        hasSegmentError = true;
        break;
      }

      if (!manifestLabelSet.has(matched.label)) {
        addError(errors, lineNumber, line, `unsupported label: ${matched.label}`);
        hasSegmentError = true;
        break;
      }

      const parsed = parseIskNumber(matched.value);
      if (!Number.isFinite(parsed)) {
        addError(errors, lineNumber, line, `invalid numeric value for ${matched.label}`);
        hasSegmentError = true;
        break;
      }

      parsedValues.set(matched.label, parsed);
    }

    if (hasSegmentError) {
      continue;
    }

    const qty = parsedValues.get("qty");
    if (!Number.isFinite(qty)) {
      addError(errors, lineNumber, line, "missing required qty segment");
      continue;
    }
    const requiredQty = qty as number;

    items.push({
      rawName,
      name,
      qty: Math.trunc(requiredQty),
      buyTotal: parsedValues.get("buy total"),
      buyPer: parsedValues.get("buy per"),
      sellTotal: parsedValues.get("sell total"),
      sellPer: parsedValues.get("sell per"),
      vol: parsedValues.get("vol"),
      profit: parsedValues.get("profit"),
    });
  }

  return { items, ignoredLines, errors };
}

export function parseExportOrder(text: string): ParseResult<ExportItem> {
  const items: ExportItem[] = [];
  const ignoredLines: ParseDiagnostic[] = [];
  const errors: ParseDiagnostic[] = [];

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const lineNumber = i + 1;
    const trimmed = line.trim();

    if (!trimmed) {
      addIgnored(ignoredLines, lineNumber, line, "blank line");
      continue;
    }

    const cols = line.split("\t");
    if (cols.length !== 4) {
      addError(errors, lineNumber, line, `expected 4 tab-delimited columns, got ${cols.length}`);
      continue;
    }

    const rawName = cols[0] ?? "";
    const name = normalizeItemName(rawName);

    if (!name) {
      addError(errors, lineNumber, line, "missing item name");
      continue;
    }

    if (/^total:$/i.test(name)) {
      addIgnored(ignoredLines, lineNumber, line, "total summary row");
      continue;
    }

    const qty = parseIskNumber(cols[1] ?? "");
    const buyPer = parseIskNumber(cols[2] ?? "");
    const buyTotal = parseIskNumber(cols[3] ?? "");

    if (!Number.isFinite(qty) || !Number.isFinite(buyPer) || !Number.isFinite(buyTotal)) {
      addError(errors, lineNumber, line, "invalid numeric value in qty/per/total columns");
      continue;
    }

    items.push({
      rawName,
      name,
      qty: Math.trunc(qty),
      buyPer,
      buyTotal,
    });
  }

  return { items, ignoredLines, errors };
}
