package engine

import "testing"

func TestRankRouteOptions_DeterministicUnderExactTies(t *testing.T) {
	options := []BatchCreateRouteOption{
		{OptionID: "route-b", TotalProfitISK: 1000, AddedVolumeM3: 50, TotalJumps: 5},
		{OptionID: "route-a", TotalProfitISK: 1000, AddedVolumeM3: 50, TotalJumps: 5},
	}
	addedProfit := map[string]float64{
		"route-a": 100,
		"route-b": 100,
	}

	ranked := rankRouteOptions(options, addedProfit, 100)
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
