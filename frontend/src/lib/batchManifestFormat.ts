import type { BatchLine } from "@/lib/batchMetrics";

type ManifestInputLine = {
  typeName: string;
  units: number | string;
};

function toIntegerQuantityString(units: number | string): string {
  if (typeof units === "number") {
    if (!Number.isFinite(units)) return "0";
    return String(Math.trunc(units));
  }

  const normalized = units.replaceAll(",", "").trim();
  if (normalized.length === 0) return "0";

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return "0";
  return String(Math.trunc(parsed));
}

function toManifestLine(input: ManifestInputLine): string {
  return `${input.typeName} ${toIntegerQuantityString(input.units)}`;
}

export function formatBatchLinesToMultibuyLines(
  lines: Array<ManifestInputLine | BatchLine>,
): string[] {
  return lines.map((line) => {
    if ("row" in line) {
      return toManifestLine({ typeName: line.row.TypeName, units: line.units });
    }
    return toManifestLine(line);
  });
}

export function formatBatchLinesToMultibuyText(
  lines: Array<ManifestInputLine | BatchLine>,
): string {
  return formatBatchLinesToMultibuyLines(lines).join("\n");
}

export function parseDetailedBatchLine(
  line: string,
): { typeName: string; units: string } | null {
  const match = line.match(/^(.*?)\s*\|\s*qty\s+([\d,]+)\b/i);
  if (!match) return null;
  const typeName = match[1];
  const units = match[2].replaceAll(",", "");
  return { typeName, units };
}
