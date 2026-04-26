export interface RoutePilotRecommendationCandidate {
  characterId: number;
  characterName: string;
  jumpsToBuy: number | null;
  totalRunJumps: number | null;
  availableCapitalIsk?: number | null;
  availableCargoM3?: number | null;
  maxComfortableJumps?: number | null;
}

export interface RoutePilotRecommendationRow
  extends RoutePilotRecommendationCandidate {
  rank: number | null;
  eligible: boolean;
  rationale: string;
}

export interface RoutePilotRecommendationResult {
  bestCandidate: RoutePilotRecommendationCandidate | null;
  rationale: string;
  candidates: RoutePilotRecommendationRow[];
}

export interface RoutePilotRecommendationOptions {
  requiredCapitalIsk?: number;
  requiredCargoM3?: number;
  expectedJumps?: number;
  activeAssignmentRouteKeysByCharacterId?: Record<number, string | undefined>;
}

function normalizeJumps(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.trunc(value);
}

function compareCandidate(
  left: RoutePilotRecommendationCandidate,
  right: RoutePilotRecommendationCandidate,
): number {
  if (left.jumpsToBuy !== right.jumpsToBuy) {
    return (left.jumpsToBuy ?? Number.POSITIVE_INFINITY) - (right.jumpsToBuy ?? Number.POSITIVE_INFINITY);
  }
  if (left.totalRunJumps !== right.totalRunJumps) {
    return (left.totalRunJumps ?? Number.POSITIVE_INFINITY) - (right.totalRunJumps ?? Number.POSITIVE_INFINITY);
  }
  return left.characterName.localeCompare(right.characterName);
}

export function recommendBestPilotForRoute(
  candidates: RoutePilotRecommendationCandidate[],
  options: RoutePilotRecommendationOptions = {},
): RoutePilotRecommendationResult {
  const normalized = candidates.map((candidate) => ({
    ...candidate,
    jumpsToBuy: normalizeJumps(candidate.jumpsToBuy),
    totalRunJumps: normalizeJumps(candidate.totalRunJumps),
  }));

  const eligible = normalized.filter((candidate) => {
    if (candidate.jumpsToBuy == null || candidate.totalRunJumps == null) return false;
    if (
      typeof options.requiredCapitalIsk === "number" &&
      Number.isFinite(options.requiredCapitalIsk) &&
      typeof candidate.availableCapitalIsk === "number" &&
      Number.isFinite(candidate.availableCapitalIsk) &&
      candidate.availableCapitalIsk < options.requiredCapitalIsk
    ) {
      return false;
    }
    if (
      typeof options.requiredCargoM3 === "number" &&
      Number.isFinite(options.requiredCargoM3) &&
      typeof candidate.availableCargoM3 === "number" &&
      Number.isFinite(candidate.availableCargoM3) &&
      candidate.availableCargoM3 < options.requiredCargoM3
    ) {
      return false;
    }
    if (
      typeof options.expectedJumps === "number" &&
      Number.isFinite(options.expectedJumps) &&
      typeof candidate.maxComfortableJumps === "number" &&
      Number.isFinite(candidate.maxComfortableJumps) &&
      candidate.maxComfortableJumps < options.expectedJumps
    ) {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    return {
      bestCandidate: null,
      rationale: "No pilot has both jumps-to-buy and total-run-jumps distance data.",
      candidates: normalized.map((candidate) => ({
        ...candidate,
        rank: null,
        eligible: false,
        rationale: "Missing distance data",
      })),
    };
  }

  const sortedEligible = [...eligible].sort((left, right) => {
    const leftConflict = Boolean(
      options.activeAssignmentRouteKeysByCharacterId?.[left.characterId],
    );
    const rightConflict = Boolean(
      options.activeAssignmentRouteKeysByCharacterId?.[right.characterId],
    );
    if (leftConflict !== rightConflict) return leftConflict ? 1 : -1;
    return compareCandidate(left, right);
  });
  const bestCandidate = sortedEligible[0] ?? null;

  const rankByCharacterId = new Map<number, number>();
  sortedEligible.forEach((candidate, index) => {
    rankByCharacterId.set(candidate.characterId, index + 1);
  });

  const rows: RoutePilotRecommendationRow[] = normalized
    .map((candidate) => {
      const rank = rankByCharacterId.get(candidate.characterId) ?? null;
      const eligibleCandidate = rank != null;
      return {
        ...candidate,
        rank,
        eligible: eligibleCandidate,
        rationale: eligibleCandidate
          ? `#${rank} by jumps-to-buy ${candidate.jumpsToBuy}, total-run ${candidate.totalRunJumps}`
          : "Missing distance data",
      };
    })
    .sort((left, right) => {
      if (left.rank != null && right.rank != null) return left.rank - right.rank;
      if (left.rank != null) return -1;
      if (right.rank != null) return 1;
      return left.characterName.localeCompare(right.characterName);
    });

  return {
    bestCandidate,
    rationale: bestCandidate
      ? `${bestCandidate.characterName} has the lowest jumps-to-buy (${bestCandidate.jumpsToBuy}) and best total-run tie-break (${bestCandidate.totalRunJumps}).`
      : "No eligible pilots.",
    candidates: rows,
  };
}
