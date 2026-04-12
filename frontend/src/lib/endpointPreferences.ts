import type { FlipResult } from "@/lib/types";

export type EndpointPreferenceProfile = {
  buyHubPenalty: number;
  nonHubBuyBonus: number;
  sellStructureBonus: number;
  routeDirectionBonus: number;
  deadheadPenalty: number;
};

export enum EndpointPreferenceApplicationMode {
  Hide = "hide",
  Deprioritize = "deprioritize",
}

export type EndpointPreferenceRuleResult = {
  rule: string;
  scoreDelta: number;
  hideViolation: boolean;
};

export type EndpointPreferenceEvaluation = {
  scoreDelta: number;
  appliedRules: string[];
  excluded: boolean;
};

export const DEFAULT_MAJOR_HUB_SYSTEMS = [
  "Jita",
  "Amarr",
  "Dodixie",
  "Rens",
  "Hek",
] as const;

export const DEFAULT_ENDPOINT_PREFERENCE_PROFILE: EndpointPreferenceProfile = {
  buyHubPenalty: -12,
  nonHubBuyBonus: 6,
  sellStructureBonus: 7,
  routeDirectionBonus: 5,
  deadheadPenalty: -8,
};

export const ENDPOINT_PREFERENCE_PRESETS: Record<
  "safe_arbitrage" | "structure_exit" | "low_attention",
  EndpointPreferenceProfile
> = {
  safe_arbitrage: {
    buyHubPenalty: -16,
    nonHubBuyBonus: 4,
    sellStructureBonus: 3,
    routeDirectionBonus: 9,
    deadheadPenalty: -15,
  },
  structure_exit: {
    buyHubPenalty: -6,
    nonHubBuyBonus: 5,
    sellStructureBonus: 16,
    routeDirectionBonus: 6,
    deadheadPenalty: -6,
  },
  low_attention: {
    buyHubPenalty: -10,
    nonHubBuyBonus: 2,
    sellStructureBonus: 2,
    routeDirectionBonus: 3,
    deadheadPenalty: -18,
  },
};

const KNOWN_STRUCTURE_MARKERS = [
  "Astrahus",
  "Fortizar",
  "Keepstar",
  "Raitaru",
  "Azbel",
  "Sotiyo",
  "Athanor",
  "Tatara",
  "Ansiblex",
  "Tenebrex",
  "Pharolux",
  "Metenox",
  "Skyhook",
];

function normalizeName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeMajorHubSystems(systems: string[]): string[] {
  const uniq = new Set<string>();
  for (const system of systems) {
    const normalized = system.trim();
    if (normalized.length > 0) {
      uniq.add(normalized);
    }
  }
  return [...uniq];
}

export function isMajorHubSystem(
  systemName: string | undefined,
  majorHubSystems: string[],
): boolean {
  const system = normalizeName(systemName);
  if (system.length === 0) return false;
  return majorHubSystems.some((hub) => normalizeName(hub) === system);
}

export function isLikelyStructureStation(stationName: string | undefined): boolean {
  const station = stationName?.trim() ?? "";
  if (station.length === 0) return false;
  return KNOWN_STRUCTURE_MARKERS.some((marker) => station.includes(marker));
}

export function evaluateEndpointPreferenceRules(
  row: FlipResult,
  profile: EndpointPreferenceProfile,
  majorHubSystems: string[],
): EndpointPreferenceRuleResult[] {
  const buyIsHub = isMajorHubSystem(row.BuySystemName, majorHubSystems);
  const sellIsHub = isMajorHubSystem(row.SellSystemName, majorHubSystems);
  const sellIsStructure = isLikelyStructureStation(row.SellStation);

  const results: EndpointPreferenceRuleResult[] = [];
  if (buyIsHub && profile.buyHubPenalty !== 0) {
    results.push({
      rule: "buy_hub_penalty",
      scoreDelta: profile.buyHubPenalty,
      hideViolation: profile.buyHubPenalty < 0,
    });
  }
  if (!buyIsHub && profile.nonHubBuyBonus !== 0) {
    results.push({
      rule: "non_hub_buy_bonus",
      scoreDelta: profile.nonHubBuyBonus,
      hideViolation: false,
    });
  }
  if (sellIsStructure && profile.sellStructureBonus !== 0) {
    results.push({
      rule: "sell_structure_bonus",
      scoreDelta: profile.sellStructureBonus,
      hideViolation: false,
    });
  }
  if (!buyIsHub && sellIsHub && profile.routeDirectionBonus !== 0) {
    results.push({
      rule: "route_direction_bonus",
      scoreDelta: profile.routeDirectionBonus,
      hideViolation: false,
    });
  }
  if (!buyIsHub && !sellIsHub && profile.deadheadPenalty !== 0) {
    results.push({
      rule: "deadhead_penalty",
      scoreDelta: profile.deadheadPenalty,
      hideViolation: profile.deadheadPenalty < 0,
    });
  }
  return results;
}

export function evaluateEndpointPreferences(
  row: FlipResult,
  profile: EndpointPreferenceProfile,
  majorHubSystems: string[],
  mode: EndpointPreferenceApplicationMode,
): EndpointPreferenceEvaluation {
  const ruleResults = evaluateEndpointPreferenceRules(row, profile, majorHubSystems);
  const scoreDelta = ruleResults.reduce((sum, entry) => sum + entry.scoreDelta, 0);
  const excluded =
    mode === EndpointPreferenceApplicationMode.Hide &&
    ruleResults.some((entry) => entry.hideViolation);
  return {
    scoreDelta,
    excluded,
    appliedRules: ruleResults.map((entry) => entry.rule),
  };
}
