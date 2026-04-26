import type { RouteBatchMetadata } from "@/lib/batchMetrics";
import type { FillerCandidate } from "@/lib/fillerCandidates";
import type {
  ActionQueueItem,
  TopRoutePicks,
  TopRoutePickCandidate,
} from "@/lib/radiusMetrics";
import type { RouteDecisionExplanation } from "@/lib/routeExplanation";
import type { RouteAggregateMetrics } from "@/lib/useRadiusRouteInsights";

export type RadiusBestDealCardKind =
  | "best_single_item"
  | "best_full_cargo"
  | "best_safe_route"
  | "best_isk_per_jump"
  | "best_low_capital"
  | "best_backhaul"
  | "best_near_lens_origin";

export type RadiusBestDealCard = {
  kind: RadiusBestDealCardKind;
  title: string;
  routeKey: string;
  routeLabel: string;
  metricLabel: string;
  whySummary?: string;
  explanation?: RouteDecisionExplanation;
  lensDelta?: string;
  hasFillerCandidates: boolean;
  expectedProfitIsk: number;
  totalJumps: number;
  urgencyBand?: "stable" | "aging" | "fragile";
  scanAgeMinutes?: number;
  lensJumpDelta?: number;
};

export type RadiusBestDealCardDerivationInput = {
  topRoutePicks: TopRoutePicks;
  actionQueue: ActionQueueItem[];
  batchMetricsByRoute: Record<string, RouteBatchMetadata>;
  routeAggregateMetricsByRoute: Record<string, RouteAggregateMetrics>;
  routeExplanationByKey?: Record<string, RouteDecisionExplanation>;
  routeFillerCandidatesByKey?: Record<
    string,
    { remainingCapacityM3: number; candidates: FillerCandidate[] }
  >;
  lensDeltaByRouteKey?: Record<string, string>;
  lensActive?: boolean;
};

function pickMetricRoute(
  routes: string[],
  metric: (routeKey: string) => number,
  direction: "max" | "min",
): string | null {
  const seeded = routes.filter((routeKey) => Number.isFinite(metric(routeKey)));
  if (seeded.length === 0) return null;
  seeded.sort((left, right) => {
    const leftValue = metric(left);
    const rightValue = metric(right);
    if (leftValue === rightValue) return left.localeCompare(right);
    return direction === "max" ? rightValue - leftValue : leftValue - rightValue;
  });
  return seeded[0] ?? null;
}

function parseLensDeltaMagnitude(delta: string | undefined): number {
  if (!delta) return Number.POSITIVE_INFINITY;
  const match = delta.match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Math.abs(Number(match[0]));
}

function candidateByRouteKey(input: RadiusBestDealCardDerivationInput): Record<string, TopRoutePickCandidate> {
  const out: Record<string, TopRoutePickCandidate> = {};
  for (const pick of [
    input.topRoutePicks.bestRecommendedRoutePack,
    input.topRoutePicks.bestQuickSingleRoute,
    input.topRoutePicks.bestSafeFillerRoute,
  ]) {
    if (pick?.routeKey) out[pick.routeKey] = pick;
  }
  for (const item of input.actionQueue) {
    out[item.routeKey] = item.candidate;
  }
  return out;
}

export function deriveRadiusBestDealCards(
  input: RadiusBestDealCardDerivationInput,
): RadiusBestDealCard[] {
  const candidateByKey = candidateByRouteKey(input);
  const routeKeys = [
    ...new Set<string>([
      ...Object.keys(input.batchMetricsByRoute),
      ...Object.keys(input.routeAggregateMetricsByRoute),
      ...Object.keys(candidateByKey),
    ]),
  ];
  const cards: RadiusBestDealCard[] = [];

  const addCard = (
    kind: RadiusBestDealCardKind,
    title: string,
    routeKey: string | null,
    metricLabel: string,
  ) => {
    if (!routeKey) return;
    const candidate = candidateByKey[routeKey];
    const batch = input.batchMetricsByRoute[routeKey];
    const routeLabel =
      candidate?.routeLabel ??
      input.actionQueue.find((item) => item.routeKey === routeKey)?.routeLabel ??
      (batch ? `Route ${routeKey}` : routeKey);
    const explanation = input.routeExplanationByKey?.[routeKey];
    const lensDelta = input.lensDeltaByRouteKey?.[routeKey];
    const filler = input.routeFillerCandidatesByKey?.[routeKey];
    cards.push({
      kind,
      title,
      routeKey,
      routeLabel,
      metricLabel,
      whySummary: explanation?.summary,
      explanation,
      lensDelta,
      hasFillerCandidates: (filler?.candidates.length ?? 0) > 0,
      expectedProfitIsk: batch?.routeTotalProfit ?? candidate?.totalProfit ?? 0,
      totalJumps: Math.max(0, (batch?.routeStopCount ?? 1) - 1),
      urgencyBand: batch && batch.routeTurnoverDays != null && batch.routeTurnoverDays <= 1
        ? "fragile"
        : batch && batch.routeTurnoverDays != null && batch.routeTurnoverDays <= 3
          ? "aging"
          : "stable",
      scanAgeMinutes: undefined,
      lensJumpDelta: lensDelta ? parseLensDeltaMagnitude(lensDelta) : 0,
    });
  };

  addCard(
    "best_single_item",
    "Best Single Item",
    input.topRoutePicks.bestQuickSingleRoute?.routeKey ??
      input.topRoutePicks.bestRecommendedRoutePack?.routeKey ??
      routeKeys[0] ??
      null,
    "Fast single-route pick",
  );

  const bestCargoRoute = pickMetricRoute(
    routeKeys,
    (routeKey) =>
      input.batchMetricsByRoute[routeKey]?.routeCapacityUsedPercent ??
      candidateByKey[routeKey]?.cargoUsePercent ??
      0,
    "max",
  );
  addCard("best_full_cargo", "Best Full Cargo", bestCargoRoute, "Max cargo utilization");

  const bestSafeRoute = pickMetricRoute(
    routeKeys,
    (routeKey) => {
      const aggregate = input.routeAggregateMetricsByRoute[routeKey];
      if (!aggregate) return Number.NEGATIVE_INFINITY;
      return aggregate.routeSafetyRank * 100 - aggregate.riskTotalCount;
    },
    "max",
  );
  addCard("best_safe_route", "Best Safe Route", bestSafeRoute, "Highest safety confidence");

  const bestIskPerJump = pickMetricRoute(
    routeKeys,
    (routeKey) => input.batchMetricsByRoute[routeKey]?.routeDailyIskPerJump ?? 0,
    "max",
  );
  addCard("best_isk_per_jump", "Best ISK/Jump", bestIskPerJump, "Top daily ISK per jump");

  const bestLowCapital = pickMetricRoute(
    routeKeys,
    (routeKey) => {
      const capital = input.batchMetricsByRoute[routeKey]?.routeTotalCapital ?? 0;
      if (!(capital > 0)) return Number.POSITIVE_INFINITY;
      return capital;
    },
    "min",
  );
  addCard("best_low_capital", "Best Low Capital", bestLowCapital, "Lowest capital lockup");

  const backhaulRoute =
    input.actionQueue.find((item) => item.action === "loop_return")?.routeKey ??
    routeKeys.find((routeKey) => candidateByKey[routeKey]?.hasBackhaulCandidate) ??
    null;
  addCard("best_backhaul", "Best Backhaul", backhaulRoute, "Strong return-leg potential");

  const hasLensDelta =
    input.lensActive ??
    Object.values(input.lensDeltaByRouteKey ?? {}).some((value) => value.trim().length > 0);
  if (hasLensDelta) {
    const bestNearLensOrigin = pickMetricRoute(
      routeKeys,
      (routeKey) => parseLensDeltaMagnitude(input.lensDeltaByRouteKey?.[routeKey]),
      "min",
    );
    addCard(
      "best_near_lens_origin",
      "Best Near Lens Origin",
      bestNearLensOrigin,
      "Closest to lens baseline",
    );
  }

  return cards;
}
