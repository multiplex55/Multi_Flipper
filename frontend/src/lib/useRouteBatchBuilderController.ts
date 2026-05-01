import { useCallback } from "react";
import type { FlipResult, SavedRoutePack } from "@/lib/types";
import { routeLineKey } from "@/lib/batchMetrics";

export type RouteBatchBuilderLaunchContext = {
  intentLabel?: string;
  batchEntryMode?: "core" | "filler" | "loop";
  mode?: "single_anchor" | "same_leg_fill";
};

export type RouteBatchBuilderRecommendationLaunchInput = {
  routeKey: string;
  recommendation?: {
    rows?: FlipResult[];
  } | null;
  intentLabel?: string;
  batchEntryMode?: "core" | "filler" | "loop";
  mode?: "single_anchor" | "same_leg_fill";
};

type RouteBatchBuilderControllerInput = {
  routeRowsByKey: Record<string, FlipResult[]>;
  savedRoutePacks?: SavedRoutePack[];
  preferredRouteKey?: string | null;
  setBatchPlanRow: (row: FlipResult | null) => void;
  setBatchPlanRows: (rows: FlipResult[]) => void;
  setActiveRouteGroupKey: (routeKey: string | null) => void;
  setBatchBuilderEntryMode: (mode: "core" | "filler" | "loop") => void;
  setBatchBuilderLaunchIntent: (intent: string | null) => void;
  setBatchBuilderMode: (mode: "single_anchor" | "same_leg_fill") => void;
  setBatchBuilderInitialSelectedLineKeys: (keys: string[] | undefined) => void;
};

function firstRouteWithRows(routeRowsByKey: Record<string, FlipResult[]>): string | null {
  for (const [routeKey, rows] of Object.entries(routeRowsByKey)) {
    if (rows.length > 0) return routeKey;
  }
  return null;
}

export function resolveRouteBatchBuilderRouteKey(input: {
  routeKey?: string | null;
  preferredRouteKey?: string | null;
  routeRowsByKey: Record<string, FlipResult[]>;
  savedRoutePacks?: SavedRoutePack[];
}): string | null {
  if (input.routeKey) {
    const directRows = input.routeRowsByKey[input.routeKey] ?? [];
    return directRows.length > 0 ? input.routeKey : null;
  }

  const candidates = [
    input.preferredRouteKey,
    ...(input.savedRoutePacks ?? []).map((pack) => pack.routeKey),
    firstRouteWithRows(input.routeRowsByKey),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const rows = input.routeRowsByKey[candidate] ?? [];
    if (rows.length > 0) return candidate;
  }
  return null;
}

export function useRouteBatchBuilderController(input: RouteBatchBuilderControllerInput) {
  const {
    routeRowsByKey,
    savedRoutePacks,
    preferredRouteKey,
    setBatchPlanRow,
    setBatchPlanRows,
    setActiveRouteGroupKey,
    setBatchBuilderEntryMode,
    setBatchBuilderLaunchIntent,
    setBatchBuilderMode,
    setBatchBuilderInitialSelectedLineKeys,
  } = input;

  const openBatchBuilderForRoute = useCallback(
    (routeKey: string, context?: RouteBatchBuilderLaunchContext): boolean => {
      const resolvedRouteKey = resolveRouteBatchBuilderRouteKey({
        routeKey,
        preferredRouteKey,
        routeRowsByKey,
        savedRoutePacks,
      });
      if (!resolvedRouteKey) return false;
      const rows = routeRowsByKey[resolvedRouteKey] ?? [];
      const anchor = rows[0] ?? null;
      if (!anchor) return false;

      setBatchPlanRow(anchor);
      setBatchPlanRows(rows);
      setActiveRouteGroupKey(resolvedRouteKey);
      setBatchBuilderEntryMode(context?.batchEntryMode ?? "core");
      setBatchBuilderLaunchIntent(context?.intentLabel ?? null);
      setBatchBuilderMode(context?.mode ?? "single_anchor");
      setBatchBuilderInitialSelectedLineKeys(undefined);
      return true;
    },
    [
      preferredRouteKey,
      routeRowsByKey,
      savedRoutePacks,
      setActiveRouteGroupKey,
      setBatchBuilderEntryMode,
      setBatchBuilderInitialSelectedLineKeys,
      setBatchBuilderLaunchIntent,
      setBatchBuilderMode,
      setBatchPlanRow,
      setBatchPlanRows,
    ],
  );

  const openBatchBuilderForRecommendation = useCallback(
    (input: RouteBatchBuilderRecommendationLaunchInput): boolean => {
      const resolvedRouteKey = resolveRouteBatchBuilderRouteKey({
        routeKey: input.routeKey,
        preferredRouteKey,
        routeRowsByKey,
        savedRoutePacks,
      });
      if (!resolvedRouteKey) return false;
      const rows = routeRowsByKey[resolvedRouteKey] ?? [];
      const anchor = rows[0] ?? null;
      if (!anchor) return false;

      const recommendationRows = input.recommendation?.rows ?? rows;
      const initialSelectedLineKeys = recommendationRows
        .map((row) => routeLineKey(row))
        .filter((key) => key.length > 0);

      setBatchPlanRow(anchor);
      setBatchPlanRows(rows);
      setActiveRouteGroupKey(resolvedRouteKey);
      setBatchBuilderEntryMode(input.batchEntryMode ?? "core");
      setBatchBuilderLaunchIntent(input.intentLabel ?? "Buy-Now recommendation");
      setBatchBuilderMode(input.mode ?? "same_leg_fill");
      setBatchBuilderInitialSelectedLineKeys(initialSelectedLineKeys);
      return true;
    },
    [
      preferredRouteKey,
      routeRowsByKey,
      savedRoutePacks,
      setActiveRouteGroupKey,
      setBatchBuilderEntryMode,
      setBatchBuilderInitialSelectedLineKeys,
      setBatchBuilderLaunchIntent,
      setBatchBuilderMode,
      setBatchPlanRow,
      setBatchPlanRows,
    ],
  );

  return { openBatchBuilderForRoute, openBatchBuilderForRecommendation };
}
