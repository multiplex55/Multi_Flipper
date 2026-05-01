import type { RadiusCargoBuild, RadiusCargoBuildLine } from "@/lib/radiusCargoBuilds";

function fmtISK(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("en-US");
}

function fmtM3(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtLineM3(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0 (zero-volume)";
  return fmtM3(value);
}

function buildOrderedLines(lines: RadiusCargoBuildLine[]): Array<{ line: RadiusCargoBuildLine; sequence: number }> {
  return lines.map((line, index) => ({ line, sequence: index + 1 }));
}

function buildFooterSummary(build: RadiusCargoBuild): string[] {
  return [
    "",
    `Totals: ${build.lines.length} lines | Profit ${fmtISK(build.totalProfitIsk)} ISK | Capital ${fmtISK(build.totalCapitalIsk)} ISK | Gross sell ${fmtISK(build.totalGrossSellIsk)} ISK`,
    `Cargo ${fmtM3(build.totalCargoM3)} m3 (${build.cargoFillPercent.toFixed(1)}%) | ISK/jump ${fmtISK(build.iskPerJump)} | Confidence ${build.confidencePercent.toFixed(1)}% | Execution ${build.executionQuality.toFixed(1)}%`,
  ];
}

export function formatRadiusCargoBuildManifest(build: RadiusCargoBuild): string {
  const lines: string[] = [
    "=== RADIUS CARGO BUILD MANIFEST ===",
    `Route: ${build.routeLabel}`,
    `Route key: ${build.routeKey}`,
    `Jumps: ${build.jumps}`,
    "",
    "Lines:",
  ];

  for (const { line, sequence } of buildOrderedLines(build.lines)) {
    const execCue = line.partial ? "partial" : "full";
    lines.push(
      `${sequence}. ${line.row.TypeName} | qty ${line.units.toLocaleString("en-US")} | buy ${fmtISK(line.capitalIsk)} | sell ${fmtISK(line.grossSellIsk)} | profit ${fmtISK(line.profitIsk)} | m3 ${fmtLineM3(line.volumeM3)} | ${execCue}`,
    );
  }

  lines.push(...buildFooterSummary(build));
  return lines.join("\n");
}

export function formatRadiusCargoBuildBuyChecklist(build: RadiusCargoBuild): string {
  const lines: string[] = [
    `Buy Checklist — ${build.routeLabel}`,
    "",
  ];
  for (const { line, sequence } of buildOrderedLines(build.lines)) {
    lines.push(
      `${sequence}. [ ] BUY ${line.row.TypeName} x${line.units.toLocaleString("en-US")} @ ${fmtISK(line.capitalIsk)} ISK total${line.partial ? " (partial)" : ""}`,
    );
  }
  lines.push(...buildFooterSummary(build));
  return lines.join("\n");
}

export function formatRadiusCargoBuildSellChecklist(build: RadiusCargoBuild): string {
  const lines: string[] = [
    `Sell Checklist — ${build.routeLabel}`,
    "",
  ];
  for (const { line, sequence } of buildOrderedLines(build.lines)) {
    lines.push(
      `${sequence}. [ ] SELL ${line.row.TypeName} x${line.units.toLocaleString("en-US")} @ ${fmtISK(line.grossSellIsk)} ISK total | expected profit ${fmtISK(line.profitIsk)} ISK${line.partial ? " (partial)" : ""}`,
    );
  }
  lines.push(...buildFooterSummary(build));
  return lines.join("\n");
}
