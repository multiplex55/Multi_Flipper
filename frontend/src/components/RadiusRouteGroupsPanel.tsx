import { useEffect, useMemo, useState } from "react";
import { formatISK } from "@/lib/format";
import { routeGroupKey } from "@/lib/batchMetrics";
import { buildSavedRoutePack } from "@/lib/routePackBuilder";
import { buildRadiusRouteGroups } from "@/lib/radiusRouteGroups";
import {
  clampRouteGroupPage,
  filterRadiusRouteGroups,
  RADIUS_ROUTE_GROUP_COLUMNS,
  sortRadiusRouteGroups,
  type RadiusRouteGroupColumnDef,
  type RadiusRouteGroupColumnKey,
  type RadiusRouteGroupSort,
} from "@/lib/routeGroupTable";
import type { RouteAssignment } from "@/lib/routeAssignments";
import type { RouteQueueEntry } from "@/lib/routeQueue";
import type { RadiusRouteInsights } from "@/lib/useRadiusRouteInsights";
import type { RouteExecutionWorkspace } from "@/lib/useRouteExecutionWorkspace";
import type { AuthCharacter, FlipResult } from "@/lib/types";

export type RouteExecutionFilterState = {
  hideQueued: boolean;
  unassignedOnly: boolean;
  needsVerify: boolean;
  executableNow: boolean;
  activePilotOnly: boolean;
  staleVerifyOnly: boolean;
};

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
  routeExecutionFilters?: RouteExecutionFilterState;
  onRouteExecutionFiltersChange?: (next: RouteExecutionFilterState) => void;
  onAssignActivePilot?: (routeKey: string, characterId: number) => void;
  onAssignBestPilot?: (routeKey: string, characterId: number) => void;
  onOpenBatchBuilderForRoute?: (routeKey: string) => void;
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;

function formatPercent(value: number): string {
  return `${Math.max(0, value).toFixed(1)}%`;
}

function renderCell(column: RadiusRouteGroupColumnDef, route: ReturnType<typeof buildRadiusRouteGroups>[number]): string {
  switch (column.key) {
    case "totalProfit":
    case "totalCapital":
    case "iskPerJump":
      return formatISK(column.getValue(route) as number);
    case "roiPercent":
    case "cargoUsedPercent":
      return formatPercent(column.getValue(route) as number);
    case "weakestExecutionQuality":
      return `${Number(column.getValue(route)).toFixed(0)}%`;
    case "urgencyBand":
      return String(column.getValue(route)).replace("_", " ");
    case "status":
      return String(column.getValue(route)).replace("_", " ");
    case "assignedPilot": {
      const value = String(column.getValue(route));
      return value || "—";
    }
    default:
      return String(column.getValue(route));
  }
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
  routeExecutionFilters = {
    hideQueued: false,
    unassignedOnly: false,
    needsVerify: false,
    executableNow: false,
    activePilotOnly: false,
    staleVerifyOnly: false,
  },
  onRouteExecutionFiltersChange,
  onAssignActivePilot,
  onAssignBestPilot,
  onOpenBatchBuilderForRoute,
}: RadiusRouteGroupsPanelProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(50);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Partial<Record<RadiusRouteGroupColumnKey, string>>>({});
  const [sort, setSort] = useState<RadiusRouteGroupSort>({ key: "totalProfit", direction: "desc" });

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

  const executionFilteredRoutes = useMemo(
    () =>
      groupedRoutes.filter((route) => {
        if (routeExecutionFilters.hideQueued && route.status === "queued") return false;
        if (routeExecutionFilters.unassignedOnly && Boolean(route.assignedPilot)) return false;
        if (routeExecutionFilters.needsVerify && route.status !== "needs_verify") return false;
        if (routeExecutionFilters.activePilotOnly && !route.assignedPilot) return false;
        if (
          routeExecutionFilters.staleVerifyOnly &&
          route.verificationStatus.toLowerCase() !== "stale" &&
          route.status !== "needs_verify"
        ) return false;
        if (routeExecutionFilters.executableNow) {
          const staleVerification = route.verificationStatus.toLowerCase() === "stale";
          if (route.status === "queued" || route.status === "needs_verify" || staleVerification) return false;
        }
        return true;
      }),
    [groupedRoutes, routeExecutionFilters],
  );

  const filteredRoutes = useMemo(
    () => filterRadiusRouteGroups(executionFilteredRoutes, RADIUS_ROUTE_GROUP_COLUMNS, filters),
    [executionFilteredRoutes, filters],
  );
  const sortedRoutes = useMemo(() => sortRadiusRouteGroups(filteredRoutes, sort), [filteredRoutes, sort]);

  useEffect(() => {
    setPage(0);
  }, [filters, pageSize]);

  useEffect(() => {
    setPage((current) => clampRouteGroupPage(current, sortedRoutes.length, pageSize));
  }, [sortedRoutes.length, pageSize]);

  const pagedRoutes = useMemo(() => {
    const start = page * pageSize;
    return sortedRoutes.slice(start, start + pageSize);
  }, [page, pageSize, sortedRoutes]);

  const activePilot = useMemo(
    () => characters.find((character) => character.active) ?? characters[0] ?? null,
    [characters],
  );

  const openBatchBuilder = (routeKey: string) => {
    if (routeWorkspace) {
      routeWorkspace.openBatchBuilder(routeKey);
      return;
    }
    onOpenBatchBuilderForRoute?.(routeKey);
  };

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

  const totalPages = Math.max(1, Math.ceil(sortedRoutes.length / pageSize));
  const startRow = sortedRoutes.length === 0 ? 0 : page * pageSize + 1;
  const endRow = Math.min((page + 1) * pageSize, sortedRoutes.length);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          {[
            ["hideQueued", "Hide queued"],
            ["unassignedOnly", "Unassigned only"],
            ["needsVerify", "Needs verify"],
            ["executableNow", "Executable now"],
            ["activePilotOnly", "Active-pilot only"],
            ["staleVerifyOnly", "Stale verify"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                onRouteExecutionFiltersChange?.({
                  ...routeExecutionFilters,
                  [key]: !routeExecutionFilters[key as keyof RouteExecutionFilterState],
                })
              }
              className={`px-1.5 py-0.5 rounded-sm border ${routeExecutionFilters[key as keyof RouteExecutionFilterState] ? "border-eve-accent/60 text-eve-accent bg-eve-accent/10" : "border-eve-border/60 text-eve-dim"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((current) => !current)}
          className={`px-1.5 py-0.5 rounded-sm border text-[11px] ${showFilters ? "border-eve-accent/60 text-eve-accent bg-eve-accent/10" : "border-eve-border/60 text-eve-dim"}`}
        >
          {showFilters ? "Hide filters" : "Show filters"}
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] text-eve-dim">
        <div>Showing {startRow}–{endRow} of {sortedRoutes.length}</div>
        <div>Page {Math.min(page + 1, totalPages)} / {totalPages}</div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <label className="flex items-center gap-1 text-eve-dim">
          Page size
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="rounded-sm border border-eve-border/60 bg-eve-panel px-1 py-0.5 text-eve-text"
            aria-label="Page size"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(0)}
            disabled={page === 0}
            className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 disabled:opacity-50"
          >First</button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 disabled:opacity-50"
          >Prev</button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 disabled:opacity-50"
          >Next</button>
          <button
            type="button"
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="rounded-sm border border-eve-border/60 px-1.5 py-0.5 disabled:opacity-50"
          >Last</button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto rounded-sm border border-eve-border/50"
        data-testid="radius-route-groups-panel"
      >
        <table className="min-w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-eve-panel/95 text-eve-dim" data-testid="radius-route-groups-thead">
            <tr>
              {RADIUS_ROUTE_GROUP_COLUMNS.map((column) => {
                const isSorted = sort.key === column.key;
                const direction = isSorted ? (sort.direction === "asc" ? " ↑" : " ↓") : "";
                return (
                  <th key={column.key} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                    <button
                      type="button"
                      className="whitespace-nowrap"
                      onClick={() => {
                        setSort((current) =>
                          current.key === column.key
                            ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" }
                            : { key: column.key, direction: "asc" },
                        );
                      }}
                    >
                      {column.label}{direction}
                    </button>
                  </th>
                );
              })}
              <th className="px-2 py-1 text-left font-medium whitespace-nowrap">Actions</th>
            </tr>
            {showFilters && (
              <tr className="border-t border-eve-border/40">
                {RADIUS_ROUTE_GROUP_COLUMNS.map((column) => (
                  <th key={`${column.key}-filter`} className="px-2 py-1">
                    <input
                      value={filters[column.key] ?? ""}
                      onChange={(event) => setFilters((current) => ({ ...current, [column.key]: event.target.value }))}
                      placeholder={column.numeric ? ">=100" : "filter"}
                      className="w-full rounded-sm border border-eve-border/60 bg-eve-panel px-1 py-0.5 text-[11px] font-normal text-eve-text"
                      aria-label={`${column.label} filter`}
                    />
                  </th>
                ))}
                <th className="px-2 py-1" />
              </tr>
            )}
          </thead>
          <tbody>
            {pagedRoutes.map((route) => (
              <tr key={route.routeKey} className="border-t border-eve-border/40 align-top">
                {RADIUS_ROUTE_GROUP_COLUMNS.map((column) => (
                  <td key={`${route.routeKey}-${column.key}`} className={`px-2 py-1 whitespace-nowrap ${column.key === "urgencyBand" || column.key === "status" ? "capitalize" : ""}`}>
                    {renderCell(column, route)}
                  </td>
                ))}
                <td className="px-2 py-1 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1 whitespace-nowrap">
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
                    <button type="button" className="rounded-sm border border-eve-border/60 px-1 py-0.5" onClick={() => openBatchBuilder(route.routeKey)}>Build Batch</button>
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
    </div>
  );
}
