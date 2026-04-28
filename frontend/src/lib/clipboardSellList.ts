export type ClipboardInventoryLine = {
  lineNumber: number;
  rawLine: string;
  name: string;
  originalName: string;
  quantity: number;
};

export type ClipboardInventoryParseError = {
  lineNumber: number;
  rawLine: string;
  message: string;
};

export type ClipboardInventoryParseResult = {
  items: ClipboardInventoryLine[];
  errors: ClipboardInventoryParseError[];
};

export type ClipboardInventoryParseOptions = {
  defaultQuantity?: number;
  mergeDuplicates?: boolean;
};

const TAB_PATTERN = /^(.*?)\t+([^\t]+)$/;
const SPACE_PATTERN = /^(.*?)(?:\s{2,})(\S+)$/;

function parseQty(text: string): number {
  const parsed = Number(text.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function parseClipboardSellList(
  source: string,
  options: ClipboardInventoryParseOptions = {},
): ClipboardInventoryParseResult {
  const lines = source.split(/\r?\n/);
  const items: ClipboardInventoryLine[] = [];
  const errors: ClipboardInventoryParseError[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const lineNumber = index + 1;
    if (!rawLine.trim()) continue;

    const tab = rawLine.match(TAB_PATTERN);
    const spaced = rawLine.match(SPACE_PATTERN);
    const match = tab ?? spaced;

    if (!match) {
      if (options.defaultQuantity === 1) {
        const fallbackName = rawLine.trim();
        if (fallbackName) {
          items.push({
            lineNumber,
            rawLine,
            name: fallbackName,
            originalName: fallbackName,
            quantity: 1,
          });
        }
      } else {
        errors.push({ lineNumber, rawLine, message: "Unable to parse line format" });
      }
      continue;
    }

    const originalName = (match[1] ?? "").trim();
    const quantityRaw = (match[2] ?? "").trim();
    const quantity = parseQty(quantityRaw);

    if (!originalName) {
      errors.push({ lineNumber, rawLine, message: "Missing item name" });
      continue;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ lineNumber, rawLine, message: "Invalid quantity" });
      continue;
    }

    items.push({ lineNumber, rawLine, name: originalName, originalName, quantity });
  }

  if (!options.mergeDuplicates) {
    return { items, errors };
  }

  const merged = new Map<string, ClipboardInventoryLine>();
  for (const item of items) {
    const key = item.name.trim().toLocaleLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item });
      continue;
    }
    existing.quantity += item.quantity;
  }

  return { items: [...merged.values()], errors };
}
