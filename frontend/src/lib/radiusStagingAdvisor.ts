import type { AuthCharacter, FlipResult } from "@/lib/types";
import type { RadiusHubSummary } from "@/lib/radiusHubSummaries";

export interface RadiusCharacterLocation {
  character_id: number;
  character_name: string;
  current_system_id: number | null;
  current_system_name: string;
}

export interface RadiusStagingRecommendation {
  characterId: number;
  characterName: string;
  currentSystemName: string;
  recommendedSystemId: number;
  recommendedSystemName: string;
  side: "buy" | "sell";
  score: number;
  reason: string;
  supportingRows: number;
  jumps: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function safeJump(value: number | undefined): number {
  if (!Number.isFinite(value)) return 12;
  return Math.max(0, value ?? 12);
}

function stableRank(
  a: RadiusStagingRecommendation,
  b: RadiusStagingRecommendation,
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.jumps !== b.jumps) return a.jumps - b.jumps;
  if (b.supportingRows !== a.supportingRows) return b.supportingRows - a.supportingRows;
  return a.recommendedSystemName.localeCompare(b.recommendedSystemName);
}

function normalizeCharacters(
  characters: AuthCharacter[],
  locations: RadiusCharacterLocation[],
  fallbackSystemName: string,
): RadiusCharacterLocation[] {
  const byCharacter = new Map<number, RadiusCharacterLocation>(
    locations.map((location) => [location.character_id, location]),
  );
  return characters.map((character) => {
    const location = byCharacter.get(character.character_id);
    if (location) return location;
    return {
      character_id: character.character_id,
      character_name: character.character_name,
      current_system_id: null,
      current_system_name: fallbackSystemName,
    };
  });
}

export function buildRadiusStagingRecommendations(params: {
  rows: FlipResult[];
  buyHubs: RadiusHubSummary[];
  sellHubs: RadiusHubSummary[];
  characters: AuthCharacter[];
  characterLocations?: RadiusCharacterLocation[];
  fallbackSystemName?: string;
}): RadiusStagingRecommendation[] {
  const {
    rows,
    buyHubs,
    sellHubs,
    characters,
    characterLocations = [],
    fallbackSystemName = "Unknown",
  } = params;
  if (rows.length === 0 || characters.length === 0) return [];

  const normalizedCharacters = normalizeCharacters(
    characters,
    characterLocations,
    fallbackSystemName,
  );
  const candidateHubs = [
    ...buyHubs.slice(0, 3).map((hub) => ({ ...hub, side: "buy" as const })),
    ...sellHubs.slice(0, 3).map((hub) => ({ ...hub, side: "sell" as const })),
  ];
  if (candidateHubs.length === 0) return [];

  const maxProfit = Math.max(
    ...candidateHubs.map((hub) => hub.period_profit ?? 0),
    1,
  );
  const maxRows = Math.max(...candidateHubs.map((hub) => hub.row_count ?? 0), 1);

  return normalizedCharacters
    .map((character) => {
      const ranked = candidateHubs
        .map((hub): RadiusStagingRecommendation => {
          const supportingRows = rows.filter((row) =>
            hub.side === "buy"
              ? row.BuySystemID === hub.system_id
              : row.SellSystemID === hub.system_id,
          ).length;
          const jumpValues = rows
            .filter((row) =>
              hub.side === "buy"
                ? row.BuySystemID === hub.system_id
                : row.SellSystemID === hub.system_id,
            )
            .map((row) =>
              hub.side === "buy"
                ? safeJump(row.BuyJumps)
                : safeJump(row.SellJumps),
            );
          const jumps = jumpValues.length > 0
            ? Math.round(
                jumpValues.reduce((sum, value) => sum + value, 0) / jumpValues.length,
              )
            : 12;

          const score = Number(
            (
              clamp01((hub.period_profit ?? 0) / maxProfit) * 0.45 +
              clamp01((hub.row_count ?? 0) / maxRows) * 0.25 +
              clamp01(supportingRows / Math.max(rows.length, 1)) * 0.2 +
              clamp01(1 - jumps / 20) * 0.1
            ).toFixed(4),
          );

          const reason = [
            `${hub.system_name} (${hub.side}) ranks high from ${supportingRows} matching row(s).`,
            `${jumps} avg jump(s) from current lens values.`,
            `Hub period profit ${Math.round(hub.period_profit ?? 0).toLocaleString()} ISK.`,
          ].join(" ");

          return {
            characterId: character.character_id,
            characterName: character.character_name,
            currentSystemName: character.current_system_name,
            recommendedSystemId: hub.system_id,
            recommendedSystemName: hub.system_name,
            side: hub.side,
            score,
            reason,
            supportingRows,
            jumps,
          };
        })
        .sort(stableRank);

      return ranked[0];
    })
    .filter((entry): entry is RadiusStagingRecommendation => Boolean(entry));
}
