import type {
  RouteExecutionManifest,
  RouteExecutionManifestStop,
} from "@/lib/types";

function fmtISK(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("en-US");
}

function fmtQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.max(0, Math.trunc(value)).toLocaleString("en-US");
}

function fmtM3(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export type RouteStopCardData = {
  heading: string;
  jumpsFromPrevious?: number;
  buyTotalISK: number;
  sellTotalISK: number;
  netDeltaISK: number;
  warningMetadata: string[];
};

export function buildRouteStopCardData(
  stop: RouteExecutionManifestStop,
): RouteStopCardData {
  return {
    heading: `${stop.location_name} (${stop.system_name})`,
    jumpsFromPrevious: stop.jumps_from_previous,
    buyTotalISK: stop.stop_buy_total_isk,
    sellTotalISK: stop.stop_sell_total_isk,
    netDeltaISK: stop.stop_net_delta_isk,
    warningMetadata: stop.warnings ?? [],
  };
}

export function formatRouteExecutionManifestText(
  manifest: RouteExecutionManifest,
): string {
  const out: string[] = [];
  out.push("=== ROUTE EXECUTION MANIFEST ===");
  out.push(
    `Origin: ${manifest.corridor.origin.location_name} (${manifest.corridor.origin.system_name})`,
  );
  out.push(`Stops: ${fmtQty(manifest.corridor.distinct_stop_count)}`);
  out.push(`Total jumps: ${fmtQty(manifest.corridor.total_jumps)}`);
  out.push(`Capital: ${fmtISK(manifest.run_totals.capital_isk)} ISK`);
  out.push(`Gross sell: ${fmtISK(manifest.run_totals.gross_sell_isk)} ISK`);
  out.push(`Net: ${fmtISK(manifest.run_totals.net_isk)} ISK`);
  out.push(
    `Cargo used/remaining: ${fmtM3(manifest.run_totals.cargo_used_m3)} / ${fmtM3(manifest.run_totals.cargo_remaining_m3)} m3`,
  );
  out.push(
    `Validation: included ${fmtQty(manifest.validation.included_rows)}, excluded zero rows ${fmtQty(manifest.validation.excluded_zero_rows)}`,
  );

  manifest.stops.forEach((stop, index) => {
    out.push("");
    out.push(
      `-- Stop ${index + 1}: ${stop.location_name} (${stop.system_name}) --`,
    );
    out.push(`Jumps from previous: ${stop.jumps_from_previous ?? "N/A"}`);
    out.push(`Buy total: ${fmtISK(stop.stop_buy_total_isk)} ISK`);
    out.push(`Sell total: ${fmtISK(stop.stop_sell_total_isk)} ISK`);
    out.push(`Net delta: ${fmtISK(stop.stop_net_delta_isk)} ISK`);
    if (stop.warnings && stop.warnings.length > 0) {
      out.push(`Warnings: ${stop.warnings.join(", ")}`);
    }

    if (stop.buy_actions.length > 0) {
      out.push("Buy actions:");
      for (const row of stop.buy_actions) {
        out.push(
          `- ${row.type_name} x${fmtQty(row.units)} | buy ${fmtISK(row.buy_total_isk)} ISK`,
        );
      }
    }

    if (stop.sell_actions.length > 0) {
      out.push("Sell actions:");
      for (const row of stop.sell_actions) {
        out.push(
          `- ${row.type_name} x${fmtQty(row.units)} | sell ${fmtISK(row.sell_total_isk)} ISK`,
        );
      }
    }
  });

  return out.join("\n");
}
