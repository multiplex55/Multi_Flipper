import { describe, expect, it } from "vitest";
import { recommendBestPilotForRoute } from "@/lib/routePilotRecommendation";

describe("routePilotRecommendation", () => {
  it("ranks by jumps-to-buy then total-run-jumps", () => {
    const result = recommendBestPilotForRoute([
      { characterId: 1, characterName: "Alpha", jumpsToBuy: 4, totalRunJumps: 9 },
      { characterId: 2, characterName: "Bravo", jumpsToBuy: 2, totalRunJumps: 20 },
      { characterId: 3, characterName: "Charlie", jumpsToBuy: 2, totalRunJumps: 8 },
    ]);

    expect(result.bestCandidate?.characterId).toBe(3);
    expect(result.candidates[0]?.characterName).toBe("Charlie");
    expect(result.candidates[1]?.characterName).toBe("Bravo");
  });

  it("uses alphabetical tie-break when jumps are equal", () => {
    const result = recommendBestPilotForRoute([
      { characterId: 1, characterName: "Zulu", jumpsToBuy: 1, totalRunJumps: 3 },
      { characterId: 2, characterName: "Alpha", jumpsToBuy: 1, totalRunJumps: 3 },
    ]);

    expect(result.bestCandidate?.characterName).toBe("Alpha");
  });

  it("demotes candidates with missing distance entries", () => {
    const result = recommendBestPilotForRoute([
      { characterId: 1, characterName: "Alpha", jumpsToBuy: null, totalRunJumps: 5 },
      { characterId: 2, characterName: "Bravo", jumpsToBuy: 2, totalRunJumps: 7 },
    ]);

    expect(result.bestCandidate?.characterId).toBe(2);
    expect(result.candidates.find((row) => row.characterId === 1)?.eligible).toBe(false);
  });

  it("returns no best candidate when none are eligible", () => {
    const result = recommendBestPilotForRoute([
      { characterId: 1, characterName: "Alpha", jumpsToBuy: null, totalRunJumps: null },
    ]);

    expect(result.bestCandidate).toBeNull();
    expect(result.rationale).toMatch(/No pilot/);
  });
});
