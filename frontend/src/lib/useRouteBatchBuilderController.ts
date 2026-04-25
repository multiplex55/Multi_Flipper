import { useCallback } from "react";
import type { FlipResult, SavedRoutePack } from "@/lib/types";

export type RouteBatchBuilderLaunchContext = {
  intentLabel?: string;
  batchEntryMode?: "core" | "filler" | "loop";
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
  const candidates = [
    input.routeKey,
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
  const openBatchBuilderForRoute = useCallback(
    (routeKey: string, context?: RouteBatchBuilderLaunchContext): boolean => {
      const resolvedRouteKey = resolveRouteBatchBuilderRouteKey({
        routeKey,
        preferredRouteKey: input.preferredRouteKey,
        routeRowsByKey: input.routeRowsByKey,
        savedRoutePacks: input.savedRoutePacks,
      });
      if (!resolvedRouteKey) return false;
      const rows = input.routeRowsByKey[resolvedRouteKey] ?? [];
      const anchor = rows[0] ?? null;
      if (!anchor) return false;

      input.setBatchPlanRow(anchor);
      input.setBatchPlanRows(rows);
      input.setActiveRouteGroupKey(resolvedRouteKey);
      input.setBatchBuilderEntryMode(context?.batchEntryMode ?? "core");
      input.setBatchBuilderLaunchIntent(context?.intentLabel ?? null);
      input.setBatchBuilderMode("single_anchor");
      input.setBatchBuilderInitialSelectedLineKeys(undefined);
      return true;
    },
    [input],
  );

  return { openBatchBuilderForRoute };
}
