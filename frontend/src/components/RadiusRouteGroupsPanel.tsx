import { useMemo } from "react";
import { formatISK } from "@/lib/format";
import { routeGroupKey } from "@/lib/batchMetrics";
import { buildSavedRoutePack } from "@/lib/routePackBuilder";
import { buildRadiusRouteGroups } from "@/lib/radiusRouteGroups";
import type { RouteAssignment } from "@/lib/routeAssignments";
import type { RouteQueueEntry } from "@/lib/routeQueue";
import type { RadiusRouteInsights } from "@/lib/useRadiusRouteInsights";
import type { RouteExecutionWorkspace } from "@/lib/useRouteExecutionWorkspace";
import type { AuthCharacter, FlipResult } from "@/lib/types";

type RadiusRouteGroupsPanelProps = {
  results: FlipResult[];
  routeInsightsSnapshot?: RadiusRouteInsights;
  routeWorkspace?: RouteExecutionWorkspace;
  routeQueueEntries?: RouteQueueEntry[];
  routeAssignmentsByKey?: Record<string, RouteAssignment>;
  cargoCapacityM3?: number;
  characters?: AuthCharacter[];
  characterLocations?: Record<number, string>;
  onQueueRoute?: (routeKey: string, routeLabel: string) => void;
  onValidateRoute?: (routeKey: string) => void;
  onCompareRoute?: (routeKey: string) => void;
  onAssignActivePilot?: (routeKey: string, characterId: number) => void;
  onAssignBestPilot?: (routeKey: string, characterId: number) => void;
  onOpenBatchBuilderForRoute?: (routeKey: string) => void;
};

function formatPercent(value: number): string {
  return `${Math.max(0, value).toFixed(1)}%`;
}

export function RadiusRouteGroupsPanel({
  results,
  routeInsightsSnapshot,
  routeWorkspace,
  routeQueueEntries = [],
  routeAssignmentsByKey = {},
  cargoCapacityM3 = 0,
  characters = [],
  characterLocations = {},
  onQueueRoute,
  onValidateRoute,
  onCompareRoute,
  onAssignActivePilot,
  onAssignBestPilot,
  onOpenBatchBuilderForRoute,
}: RadiusRouteGroupsPanelProps) {
  const routeRowsByKey = useMemo(() => {
    const out = new Map<string, FlipResult[]>();
    for (const row of results) {
      const key = routeGroupKey(row);
      out.set(key, [...(out.get(key) ?? []), row]);
    }
    return out;
  }, [results]);

  const groupedRoutes = useMemo(
    () =>
      buildRadiusRouteGroups({
        rows: results,
        routeInsightsSnapshot,
        routeQueueEntries,
        routeAssignmentsByKey,
        cargoCapacityM3,
      }),
    [cargoCapacityM3, results, routeAssignmentsByKey, routeInsightsSnapshot, routeQueueEntries],
  );

  const activePilot = useMemo(
    () => characters.find((character) => character.active) ?? characters[0] ?? null,
    [characters],
  );

  const ensurePack = (routeKey: string, routeLabel: string) => {
    if (!routeWorkspace) return null;
    const existing = routeWorkspace.getPackByRouteKey(routeKey);
    if (existing) return existing;
    const rows = routeRowsByKey.get(routeKey) ?? [];
    const anchorRow = rows[0];
    if (!anchorRow) return null;
    const pack = buildSavedRoutePack({
      routeKey,
      routeLabel,
      anchorRow,
      routeRows: rows,
      selectedRows: rows,
      entryMode: "core",
      launchIntent: "radius-groups-panel",
      summary: null,
      routeSafetyRank: null,
      verificationProfileId: routeWorkspace.getVerificationProfileId(routeKey),
    });
    routeWorkspace.upsertPack(pack);
    return pack;
  };

  if (groupedRoutes.length === 0) {
    return <div className="text-xs text-eve-dim">No grouped routes available for this session.</div>;
  }

  return (
    <div className="overflow-auto rounded-sm border border-eve-border/50" data-testid="radius-route-groups-panel">
      <table className="min-w-full text-[11px]">
        <thead className="bg-eve-panel/50 text-eve-dim">
          <tr>
            {[
              "Route",
              "Profit",
              "Capital",
              "ROI",
              "ISK/jump",
              "Jumps",
              "Items",
              "Cargo",
              "Exec",
              "Urgency",
              "Status",
              "Pilot",
              "Verify",
              "Actions",
            ].map((label) => (
              <th key={label} className="px-2 py-1 text-left font-medium whitespace-nowrap">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupedRoutes.map((route) => (
            <tr key={route.routeKey} className="border-t border-eve-border/40 align-top">
              <td className="px-2 py-1 text-eve-text whitespace-nowrap">{route.routeLabel}</td>
              <td className="px-2 py-1 whitespace-nowrap">{formatISK(route.totalProfit)}</td>
              <td className="px-2 py-1 whitespace-nowrap">{formatISK(route.totalCapital)}</td>
              <td className="px-2 py-1 whitespace-nowrap">{formatPercent(route.roiPercent)}</td>
              <td className="px-2 py-1 whitespace-nowrap">{formatISK(route.iskPerJump)}</td>
              <td className="px-2 py-1 whitespace-nowrap">{route.jumps}</td>
              <td className="px-2 py-1 whitespace-nowrap">{route.itemCount}</td>
              <td className="px-2 py-1 whitespace-nowrap">{formatPercent(route.cargoUsedPercent)}</td>
              <td className="px-2 py-1 whitespace-nowrap">{route.weakestExecutionQuality.toFixed(0)}%</td>
              <td className="px-2 py-1 capitalize whitespace-nowrap">{route.urgencyBand}</td>
              <td className="px-2 py-1 capitalize whitespace-nowrap">{route.status.replace("_", " ")}</td>
              <td className="px-2 py-1 whitespace-nowrap">{route.assignedPilot || "—"}</td>
              <td className="px-2 py-1 whitespace-nowrap">{route.verificationStatus}</td>
              <td className="px-2 py-1">
                <div className="flex flex-wrap gap-1">
                  <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => routeWorkspace?.openRoute(route.routeKey, "workbench")}>Open Workbench</button>
                  <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => onValidateRoute?.(route.routeKey)}>Validate</button>
                  <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => onQueueRoute?.(route.routeKey, route.routeLabel)}>Queue</button>
                  <button
                    type="button"
                    className="rounded-sm border border-eve-border/60 px-1 py-0.5"
                    disabled={!activePilot}
                    onClick={() => activePilot && onAssignActivePilot?.(route.routeKey, activePilot.character_id)}
                    title={activePilot ? `${activePilot.character_name}${characterLocations[activePilot.character_id] ? ` · ${characterLocations[activePilot.character_id]}` : ""}` : "No active pilot"}
                  >
                    Assign Active Pilot
                  </button>
                  <button
                    type="button"
                    className="rounded-sm border border-eve-border/60 px-1 py-0.5"
                    disabled={characters.length === 0}
                    onClick={() => {
                      const bestPilot = [...characters]
                        .sort((left, right) => left.character_name.localeCompare(right.character_name))
                        .sort((left, right) => {
                          const leftLoc = characterLocations[left.character_id] ?? "";
                          const rightLoc = characterLocations[right.character_id] ?? "";
                          const leftMatch = Number(leftLoc.includes(route.routeLabel.split("→")[0]?.trim() ?? ""));
                          const rightMatch = Number(rightLoc.includes(route.routeLabel.split("→")[0]?.trim() ?? ""));
                          return rightMatch - leftMatch;
                        })[0];
                      if (bestPilot) onAssignBestPilot?.(route.routeKey, bestPilot.character_id);
                    }}
                  >
                    Assign Best Pilot
                  </button>
                  <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => onCompareRoute?.(route.routeKey)}>Compare</button>
                  <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => {
                    routeWorkspace?.openBatchBuilder(route.routeKey);
                    onOpenBatchBuilderForRoute?.(route.routeKey);
                  }}>Build Batch</button>
                  <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => {
                    ensurePack(route.routeKey, route.routeLabel);
                    routeWorkspace?.copyManifest(route.routeKey);
                  }}>Copy Manifest</button>
                  <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => {
                    ensurePack(route.routeKey, route.routeLabel);
                    routeWorkspace?.copySummary(route.routeKey);
                  }}>Copy Summary</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
