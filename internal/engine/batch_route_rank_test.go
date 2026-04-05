package engine

import (
	"testing"

	"eve-flipper/internal/esi"
)

func TestRankRouteOptions_DeterministicUnderExactTies(t *testing.T) {
	options := []BatchCreateRouteOption{
		{OptionID: "route-b", TotalProfitISK: 1000, AddedVolumeM3: 50, TotalJumps: 5},
		{OptionID: "route-a", TotalProfitISK: 1000, AddedVolumeM3: 50, TotalJumps: 5},
	}
	addedProfit := map[string]float64{
		"route-a": 100,
		"route-b": 100,
	}

	ranked := rankRouteOptions(options, addedProfit, 100, RouteExecutionScoringConfig{})
	if len(ranked) != 2 {
		t.Fatalf("len(ranked) = %d, want 2", len(ranked))
	}
	if ranked[0].OptionID != "route-a" || ranked[1].OptionID != "route-b" {
		t.Fatalf("expected stable final tie-break by route key; got %s then %s", ranked[0].OptionID, ranked[1].OptionID)
	}
}

func TestFitAdditionsToRemainingCargo_TrimsLastLine(t *testing.T) {
	lines := []BatchCreateRouteLine{
		{TypeID: 1, Units: 4, UnitVolumeM3: 10, BuyTotalISK: 40, SellTotalISK: 60, ProfitTotalISK: 20},
		{TypeID: 2, Units: 3, UnitVolumeM3: 10, BuyTotalISK: 30, SellTotalISK: 45, ProfitTotalISK: 15},
	}

	fitted := fitAdditionsToRemainingCargo(lines, 50)
	if len(fitted) != 2 {
		t.Fatalf("len(fitted) = %d, want 2", len(fitted))
	}
	if fitted[0].Units != 4 {
		t.Fatalf("first line Units = %d, want 4", fitted[0].Units)
	}
	if fitted[1].Units != 1 {
		t.Fatalf("second line Units = %d, want 1 after trim", fitted[1].Units)
	}
	if fitted[1].ProfitTotalISK != 5 {
		t.Fatalf("second line ProfitTotalISK = %f, want 5", fitted[1].ProfitTotalISK)
	}
}

func TestMergeBaseAndAdditions_DuplicateTypeMerged(t *testing.T) {
	base := []BatchCreateRouteLine{{
		TypeID:         34,
		TypeName:       "Tritanium",
		Units:          10,
		UnitVolumeM3:   1,
		BuySystemID:    30000142,
		SellSystemID:   30000144,
		BuyLocationID:  60003760,
		SellLocationID: 60008494,
		BuyTotalISK:    100,
		SellTotalISK:   150,
		ProfitTotalISK: 50,
		RouteJumps:     5,
	}}
	additions := []BatchCreateRouteLine{
		{
			TypeID:         34,
			TypeName:       "Tritanium",
			Units:          5,
			UnitVolumeM3:   1,
			BuySystemID:    30000142,
			SellSystemID:   30000144,
			BuyLocationID:  60003760,
			SellLocationID: 60008494,
			BuyTotalISK:    60,
			SellTotalISK:   90,
			ProfitTotalISK: 30,
			RouteJumps:     5,
		},
		{
			TypeID:         34,
			TypeName:       "Tritanium",
			Units:          5,
			UnitVolumeM3:   1,
			BuySystemID:    30000142,
			SellSystemID:   30000144,
			BuyLocationID:  60003761,
			SellLocationID: 60008495,
			BuyTotalISK:    50,
			SellTotalISK:   80,
			ProfitTotalISK: 30,
			RouteJumps:     5,
		},
	}

	merged := mergeBaseAndAdditions(base, additions)
	if len(merged) != 1 {
		t.Fatalf("len(merged) = %d, want 1 merged type", len(merged))
	}
	line := merged[0]
	if line.Units != 20 {
		t.Fatalf("Units = %d, want 20", line.Units)
	}
	if line.BuyTotalISK != 210 || line.SellTotalISK != 320 || line.ProfitTotalISK != 110 {
		t.Fatalf("totals mismatch after merge: buy=%f sell=%f profit=%f", line.BuyTotalISK, line.SellTotalISK, line.ProfitTotalISK)
	}
	if line.BuyLocationID != 0 || line.SellLocationID != 0 {
		t.Fatalf("expected mixed locations to collapse to 0, got buy=%d sell=%d", line.BuyLocationID, line.SellLocationID)
	}
}

func TestFilterAdditionsByFinalSell_NoProfitableAdditionsReturnsEmpty(t *testing.T) {
	lines := []BatchCreateRouteLine{
		{TypeID: 1, Units: 10, UnitVolumeM3: 1, SellLocationID: 6001, ProfitTotalISK: -1},
		{TypeID: 2, Units: 10, UnitVolumeM3: 1, SellLocationID: 6002, ProfitTotalISK: 5},
	}

	filtered := filterAdditionsByFinalSell(lines, 9999)
	if len(filtered) != 0 {
		t.Fatalf("len(filtered) = %d, want 0", len(filtered))
	}
}

func TestFitAdditionsToRemainingCargo_AdditionsFoundButNoneFitCargo(t *testing.T) {
	lines := []BatchCreateRouteLine{
		{TypeID: 10, Units: 5, UnitVolumeM3: 20, ProfitTotalISK: 100},
		{TypeID: 20, Units: 1, UnitVolumeM3: 12, ProfitTotalISK: 50},
	}

	fitted := fitAdditionsToRemainingCargo(lines, 10)
	if len(fitted) != 0 {
		t.Fatalf("len(fitted) = %d, want 0 when no line can fit remaining cargo", len(fitted))
	}
}

func TestBuildOrderIndexWithFilters_StructureOnlyCandidatesExcluded(t *testing.T) {
	sellOrders := []esi.MarketOrder{
		{SystemID: 1, TypeID: 100, Price: 10, VolumeRemain: 50, LocationID: 1_000_000_000_123},
	}
	buyOrders := []esi.MarketOrder{
		{SystemID: 2, TypeID: 100, Price: 30, VolumeRemain: 50, LocationID: 1_000_000_000_456},
	}

	idx := buildOrderIndexWithFilters(sellOrders, buyOrders, false)
	if got := len(idx.cheapestSell[1]); got != 0 {
		t.Fatalf("cheapestSell candidates = %d, want 0 when structure-only candidates are excluded", got)
	}
	if got := len(idx.highestBuy[2][100]); got != 0 {
		t.Fatalf("highestBuy levels = %d, want 0 when structure-only candidates are excluded", got)
	}
}

func TestExecutionScore_MonotonicityFixtures(t *testing.T) {
	options := []BatchCreateRouteOption{
		{
			OptionID:       "low",
			TotalProfitISK: 50_000,
			TotalBuyISK:    400_000,
			AddedVolumeM3:  100,
			TotalJumps:     12,
			ISKPerJump:     4_166.67,
			Lines:          []BatchCreateRouteLine{{FillConfidence: 0.45, Concentration: 0.5, StaleRisk: 0.5, BuySystemID: 1, BuyLocationID: 10, SellSystemID: 2, SellLocationID: 20}},
		},
		{
			OptionID:       "high",
			TotalProfitISK: 120_000,
			TotalBuyISK:    220_000,
			AddedVolumeM3:  90,
			TotalJumps:     7,
			ISKPerJump:     17_142.85,
			Lines:          []BatchCreateRouteLine{{FillConfidence: 0.9, Concentration: 0.1, StaleRisk: 0.1, BuySystemID: 1, BuyLocationID: 10, SellSystemID: 2, SellLocationID: 20}},
		},
	}
	ranked := rankRouteOptions(options, map[string]float64{"low": 50_000, "high": 120_000}, 1000, RouteExecutionScoringConfig{})
	if ranked[0].OptionID != "high" {
		t.Fatalf("expected high-quality fixture first; got %s", ranked[0].OptionID)
	}
	if ranked[0].ExecutionScore <= ranked[1].ExecutionScore {
		t.Fatalf("expected monotonic scores high > low, got %f <= %f", ranked[0].ExecutionScore, ranked[1].ExecutionScore)
	}
	if len(ranked[0].ScoreBreakdown) != 9 {
		t.Fatalf("score breakdown factors = %d, want 9", len(ranked[0].ScoreBreakdown))
	}
}

func TestExecutionScore_DeterministicTieBreakWithEqualScores(t *testing.T) {
	options := []BatchCreateRouteOption{
		{OptionID: "z-opt", TotalProfitISK: 1000, AddedVolumeM3: 20, TotalJumps: 5, ISKPerJump: 200, Lines: []BatchCreateRouteLine{{BuySystemID: 1, BuyLocationID: 10, SellSystemID: 2, SellLocationID: 20}}},
		{OptionID: "a-opt", TotalProfitISK: 1000, AddedVolumeM3: 20, TotalJumps: 5, ISKPerJump: 200, Lines: []BatchCreateRouteLine{{BuySystemID: 1, BuyLocationID: 10, SellSystemID: 2, SellLocationID: 20}}},
	}
	ranked := rankRouteOptions(options, map[string]float64{"z-opt": 1000, "a-opt": 1000}, 100, RouteExecutionScoringConfig{})
	if ranked[0].OptionID != "a-opt" || ranked[1].OptionID != "z-opt" {
		t.Fatalf("expected deterministic option_id tie-break, got %s then %s", ranked[0].OptionID, ranked[1].OptionID)
	}
}

func TestRankRouteOptions_PreservesRoleSummariesAfterRanking(t *testing.T) {
	options := []BatchCreateRouteOption{
		{
			OptionID:       "opt-a",
			TotalProfitISK: 500_000,
			TotalBuyISK:    1_000_000,
			AddedVolumeM3:  40,
			TotalJumps:     8,
			ISKPerJump:     62_500,
			Lines: []BatchCreateRouteLine{
				{TypeID: 1, ProfitTotalISK: 260_000, BuyTotalISK: 300_000, RouteJumps: 5, FillConfidence: 0.9, StaleRisk: 0.2, Concentration: 0.2},
				{TypeID: 2, ProfitTotalISK: 120_000, BuyTotalISK: 150_000, RouteJumps: 10, FillConfidence: 0.5, StaleRisk: 0.2, Concentration: 0.2},
				{TypeID: 3, ProfitTotalISK: 120_000, BuyTotalISK: 550_000, RouteJumps: 14, FillConfidence: 0.2, StaleRisk: 0.9, Concentration: 0.9},
			},
		},
	}

	ranked := rankRouteOptions(options, map[string]float64{"opt-a": 500_000}, 100, RouteExecutionScoringConfig{})
	got := ranked[0]
	totalCount := got.CoreLineCount + got.SafeFillerLineCount + got.StretchFillerLineCount
	if totalCount != len(got.Lines) {
		t.Fatalf("role summary line counts = %d, want %d", totalCount, len(got.Lines))
	}
	totalProfit := got.CoreProfitTotalISK + got.SafeFillerProfitISK + got.StretchFillerProfitISK
	if totalProfit != got.TotalProfitISK {
		t.Fatalf("role summary profits = %f, want total %f", totalProfit, got.TotalProfitISK)
	}
	for _, line := range got.Lines {
		if line.LineRole == "" {
			t.Fatalf("line role should not be empty: %+v", line)
		}
	}
}

func TestRankRouteOptions_PreservesStrategyMetadata(t *testing.T) {
	options := []BatchCreateRouteOption{
		{
			OptionID:       "capital_light",
			StrategyID:     "capital_light",
			StrategyLabel:  "Capital Light",
			TotalProfitISK: 100_000,
			TotalBuyISK:    80_000,
			AddedVolumeM3:  50,
			TotalJumps:     4,
			ISKPerJump:     25_000,
			Lines:          []BatchCreateRouteLine{{TypeID: 11, Units: 2, UnitVolumeM3: 1, ProfitTotalISK: 100_000, BuySystemID: 1, BuyLocationID: 2, SellSystemID: 3, SellLocationID: 4}},
		},
	}

	ranked := rankRouteOptions(options, map[string]float64{"capital_light": 100_000}, 100, RouteExecutionScoringConfig{})
	if len(ranked) != 1 {
		t.Fatalf("len(ranked) = %d, want 1", len(ranked))
	}
	if ranked[0].StrategyID != "capital_light" || ranked[0].StrategyLabel != "Capital Light" {
		t.Fatalf("strategy metadata not preserved after ranking: %+v", ranked[0])
	}
}

func TestRecommendation_ChangesWhenConfidenceWorsens(t *testing.T) {
	options := []BatchCreateRouteOption{
		{
			OptionID:       "confident",
			TotalProfitISK: 120000,
			TotalBuyISK:    450000,
			AddedVolumeM3:  90,
			TotalJumps:     8,
			ISKPerJump:     15000,
			Lines: []BatchCreateRouteLine{
				{FillConfidence: 0.9, StaleRisk: 0.1, Concentration: 0.1, BuySystemID: 1, BuyLocationID: 11, SellSystemID: 2, SellLocationID: 21},
			},
		},
		{
			OptionID:       "thin",
			TotalProfitISK: 130000,
			TotalBuyISK:    450000,
			AddedVolumeM3:  90,
			TotalJumps:     8,
			ISKPerJump:     16250,
			Lines: []BatchCreateRouteLine{
				{FillConfidence: 0.25, StaleRisk: 0.55, Concentration: 0.7, BuySystemID: 1, BuyLocationID: 11, SellSystemID: 2, SellLocationID: 21},
			},
		},
	}
	ranked := rankRouteOptions(options, map[string]float64{"confident": 120000, "thin": 130000}, 1000, RouteExecutionScoringConfig{})
	if !ranked[0].Recommended && !ranked[1].Recommended {
		t.Fatalf("expected one recommended option")
	}
	var recommendedID string
	for _, option := range ranked {
		if option.Recommended {
			recommendedID = option.OptionID
			break
		}
	}
	if recommendedID != "confident" {
		t.Fatalf("expected confident option to be recommended, got %s", recommendedID)
	}
}

func TestRecommendation_ChangesWhenStopBurdenWorsens(t *testing.T) {
	options := []BatchCreateRouteOption{
		{
			OptionID:       "compact",
			TotalProfitISK: 100000,
			TotalBuyISK:    300000,
			AddedVolumeM3:  80,
			TotalJumps:     7,
			ISKPerJump:     14285,
			Lines: []BatchCreateRouteLine{
				{FillConfidence: 0.8, StaleRisk: 0.2, Concentration: 0.2, BuySystemID: 1, BuyLocationID: 11, SellSystemID: 2, SellLocationID: 21},
				{FillConfidence: 0.8, StaleRisk: 0.2, Concentration: 0.2, BuySystemID: 1, BuyLocationID: 11, SellSystemID: 2, SellLocationID: 21},
			},
		},
		{
			OptionID:       "many-stops",
			TotalProfitISK: 110000,
			TotalBuyISK:    300000,
			AddedVolumeM3:  80,
			TotalJumps:     7,
			ISKPerJump:     15714,
			Lines: []BatchCreateRouteLine{
				{FillConfidence: 0.45, StaleRisk: 0.55, Concentration: 0.45, BuySystemID: 10, BuyLocationID: 101, SellSystemID: 20, SellLocationID: 201},
				{FillConfidence: 0.45, StaleRisk: 0.55, Concentration: 0.45, BuySystemID: 11, BuyLocationID: 102, SellSystemID: 21, SellLocationID: 202},
				{FillConfidence: 0.45, StaleRisk: 0.55, Concentration: 0.45, BuySystemID: 12, BuyLocationID: 103, SellSystemID: 22, SellLocationID: 203},
			},
		},
	}
	ranked := rankRouteOptions(options, map[string]float64{"compact": 100000, "many-stops": 115000}, 1000, RouteExecutionScoringConfig{})
	var recommendedID string
	for _, option := range ranked {
		if option.Recommended {
			recommendedID = option.OptionID
			break
		}
	}
	if recommendedID != "compact" {
		t.Fatalf("expected compact option to be recommended, got %s", recommendedID)
	}
}

func TestRecommendation_ConservativeProfileCanPreferSaferBundle(t *testing.T) {
	options := []BatchCreateRouteOption{
		{
			OptionID:       "max-profit",
			TotalProfitISK: 250000,
			TotalBuyISK:    600000,
			AddedVolumeM3:  95,
			TotalJumps:     9,
			ISKPerJump:     27777,
			Lines: []BatchCreateRouteLine{
				{FillConfidence: 0.25, StaleRisk: 0.75, Concentration: 0.8, BuySystemID: 1, BuyLocationID: 11, SellSystemID: 2, SellLocationID: 21},
			},
		},
		{
			OptionID:       "safer",
			TotalProfitISK: 170000,
			TotalBuyISK:    580000,
			AddedVolumeM3:  90,
			TotalJumps:     9,
			ISKPerJump:     18888,
			Lines: []BatchCreateRouteLine{
				{FillConfidence: 0.9, StaleRisk: 0.1, Concentration: 0.1, BuySystemID: 1, BuyLocationID: 11, SellSystemID: 2, SellLocationID: 21},
			},
		},
	}
	scoring := RouteExecutionScoringConfig{
		Weights: &RouteExecutionScoreWeights{
			NetProfit:         0.4,
			ISKPerJump:        0.6,
			CargoUtilization:  0.3,
			StopPenalty:       1.0,
			CapitalRequired:   0.8,
			DetourPenalty:     0.8,
			FillConfidence:    1.8,
			ConcentrationRisk: 1.8,
			StaleRisk:         1.8,
		},
	}
	ranked := rankRouteOptions(options, map[string]float64{"max-profit": 250000, "safer": 170000}, 1000, scoring)
	var recommendedID string
	for _, option := range ranked {
		if option.Recommended {
			recommendedID = option.OptionID
			break
		}
	}
	if recommendedID != "safer" {
		t.Fatalf("expected safer option to be recommended under conservative profile, got %s", recommendedID)
	}
}
