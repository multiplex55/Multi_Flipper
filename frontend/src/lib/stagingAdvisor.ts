import type {
  CharacterStagingRecommendation,
  CharacterStagingRole,
  RegionalDayTradeHub,
  RegionalTradeCorridor,
} from "@/lib/types";

export interface CharacterLocationInput {
  character_id: number;
  character_name: string;
  solar_system_id: number;
  solar_system_name: string;
}

const ROLE_WEIGHTS: Record<CharacterStagingRole, number> = {
  hub_trader: 1,
  corridor_runner: 0.9,
  short_haul: 0.8,
};

interface CandidateRole {
  role: CharacterStagingRole;
  fit: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function pickRole(jumps: number, corridorCount: number): CandidateRole {
  if (jumps <= 2) {
    return {
      role: corridorCount > 0 ? "hub_trader" : "short_haul",
      fit: corridorCount > 0 ? 1 : 0.85,
    };
  }
  if (jumps <= 6) {
    return {
      role: corridorCount > 0 ? "corridor_runner" : "short_haul",
      fit: corridorCount > 0 ? 0.95 : 0.75,
    };
  }
  return {
    role: "short_haul",
    fit: 0.6,
  };
}

function byStableKey(a: CharacterStagingRecommendation, b: CharacterStagingRecommendation): number {
  if (b.total_score !== a.total_score) return b.total_score - a.total_score;
  if (a.jumps !== b.jumps) return a.jumps - b.jumps;
  if (b.staging_score !== a.staging_score) return b.staging_score - a.staging_score;
  return a.recommended_system_name.localeCompare(b.recommended_system_name) ||
    a.recommended_system_id - b.recommended_system_id;
}

export function buildCharacterStagingRecommendations(params: {
  characterLocations: CharacterLocationInput[];
  hubs: RegionalDayTradeHub[];
  corridors: RegionalTradeCorridor[];
}): CharacterStagingRecommendation[] {
  const { characterLocations, hubs, corridors } = params;
  if (characterLocations.length === 0 || hubs.length === 0) return [];

  const maxStagingScore = Math.max(
    ...hubs.map((hub) => hub.staging_score ?? 0),
    1,
  );
  const maxCorridorProfit = Math.max(
    ...corridors.map((corridor) => corridor.target_period_profit ?? 0),
    1,
  );

  const corridorBySource = new Map<number, RegionalTradeCorridor[]>();
  for (const corridor of corridors) {
    const list = corridorBySource.get(corridor.source_system_id) ?? [];
    list.push(corridor);
    corridorBySource.set(corridor.source_system_id, list);
  }

  return characterLocations
    .map((character) => {
      const rankedCandidates = hubs
        .map((hub): CharacterStagingRecommendation => {
          const jumpsFromHub = hub.source_jumps_from_current ?? 6;
          const jumps =
            character.solar_system_id === hub.source_system_id
              ? 0
              : Math.max(0, Math.round(jumpsFromHub));
          const matchingCorridors = corridorBySource.get(hub.source_system_id) ?? [];
          const topCorridor = [...matchingCorridors].sort(
            (a, b) => (b.target_period_profit - a.target_period_profit) || (a.target_system_name.localeCompare(b.target_system_name)),
          )[0];

          const roleInfo = pickRole(jumps, matchingCorridors.length);
          const normalizedStaging = clamp01((hub.staging_score ?? 0) / maxStagingScore);
          const normalizedJumpEfficiency = clamp01(1 - jumps / 20);
          const normalizedCorridor = clamp01((topCorridor?.target_period_profit ?? 0) / maxCorridorProfit);
          const roleWeight = ROLE_WEIGHTS[roleInfo.role];
          const totalScore =
            normalizedStaging * 0.5 +
            normalizedJumpEfficiency * 0.25 +
            roleInfo.fit * roleWeight * 0.2 +
            normalizedCorridor * 0.05;

          const reason = `${hub.source_system_name} favors ${roleInfo.role.replace("_", " ")} with ${jumps} jumps and ${matchingCorridors.length} corridor(s).`;

          return {
            character_id: character.character_id,
            character_name: character.character_name,
            current_system_id: character.solar_system_id,
            current_system_name: character.solar_system_name,
            recommended_system_id: hub.source_system_id,
            recommended_system_name: hub.source_system_name,
            recommended_role: roleInfo.role,
            jumps,
            staging_score: hub.staging_score ?? 0,
            role_fit_score: roleInfo.fit,
            total_score: Number(totalScore.toFixed(4)),
            reason_summary: reason,
            top_metrics: {
              destinations_count: hub.destinations_count ?? 0,
              best_destination_system_name: hub.best_destination_system_name,
              corridor_count: matchingCorridors.length,
              corridor_profit: topCorridor?.target_period_profit ?? 0,
            },
            top_corridor: topCorridor
              ? {
                  source_system_id: topCorridor.source_system_id,
                  source_system_name: topCorridor.source_system_name,
                  target_system_id: topCorridor.target_system_id,
                  target_system_name: topCorridor.target_system_name,
                }
              : undefined,
          };
        })
        .sort(byStableKey);

      return rankedCandidates[0];
    })
    .filter((entry): entry is CharacterStagingRecommendation => Boolean(entry));
}
