package engine

import "testing"

func TestBuildRouteExecutionManifest_GroupsAcrossMultiStop(t *testing.T) {
	manifest := BuildRouteExecutionManifest(RouteExecutionManifestBuildInput{
		Origin:        RouteExecutionManifestEndpoint{SystemID: 30000142, SystemName: "Jita", LocationID: 60003760, LocationName: "Jita IV"},
		CargoLimitM3:  1000,
		RouteSequence: []int32{30000142, 30002659, 30002187},
		TotalJumps:    8,
		Lines: []BatchCreateRouteLine{
			{TypeID: 34, TypeName: "Tritanium", Units: 100, UnitVolumeM3: 0.01, BuySystemID: 30000142, BuyLocationID: 60003760, SellSystemID: 30002187, SellLocationID: 60008494, BuyTotalISK: 1000, SellTotalISK: 1500},
			{TypeID: 35, TypeName: "Pyerite", Units: 50, UnitVolumeM3: 0.02, BuySystemID: 30002659, BuyLocationID: 60011791, SellSystemID: 30002187, SellLocationID: 60008494, BuyTotalISK: 2500, SellTotalISK: 3500},
		},
	})

	if len(manifest.Stops) != 3 {
		t.Fatalf("stop count = %d, want 3", len(manifest.Stops))
	}
	if manifest.Corridor.DistinctStopCount != 3 {
		t.Fatalf("distinct stops = %d, want 3", manifest.Corridor.DistinctStopCount)
	}
	if manifest.Stops[0].JumpsFromPrevious == nil || *manifest.Stops[0].JumpsFromPrevious != 0 {
		t.Fatalf("first stop jumps = %v, want 0", manifest.Stops[0].JumpsFromPrevious)
	}
	if manifest.Stops[1].JumpsFromPrevious == nil || *manifest.Stops[1].JumpsFromPrevious != 1 {
		t.Fatalf("second stop jumps = %v, want 1", manifest.Stops[1].JumpsFromPrevious)
	}
}

func TestBuildRouteExecutionManifest_AggregatesTotalsAndTracksRepeatedItemsPerStop(t *testing.T) {
	manifest := BuildRouteExecutionManifest(RouteExecutionManifestBuildInput{
		CargoLimitM3: 200,
		Lines: []BatchCreateRouteLine{
			{TypeID: 34, TypeName: "Tritanium", Units: 100, UnitVolumeM3: 0.01, BuySystemID: 1, BuyLocationID: 10, SellSystemID: 2, SellLocationID: 20, BuyTotalISK: 800, SellTotalISK: 1000},
			{TypeID: 34, TypeName: "Tritanium", Units: 75, UnitVolumeM3: 0.01, BuySystemID: 3, BuyLocationID: 30, SellSystemID: 2, SellLocationID: 20, BuyTotalISK: 900, SellTotalISK: 1200},
		},
	})

	if manifest.RunTotals.CapitalISK != 1700 {
		t.Fatalf("capital = %v, want 1700", manifest.RunTotals.CapitalISK)
	}
	if manifest.RunTotals.GrossSellISK != 2200 {
		t.Fatalf("gross sell = %v, want 2200", manifest.RunTotals.GrossSellISK)
	}
	if manifest.RunTotals.NetISK != 500 {
		t.Fatalf("net = %v, want 500", manifest.RunTotals.NetISK)
	}
	var tritaniumBuyRows int
	for _, stop := range manifest.Stops {
		for _, action := range stop.BuyActions {
			if action.TypeID == 34 {
				tritaniumBuyRows++
			}
		}
	}
	if tritaniumBuyRows != 2 {
		t.Fatalf("tritanium buy rows = %d, want 2 distinct stop rows", tritaniumBuyRows)
	}
}

func TestBuildRouteExecutionManifest_ExcludesZeroRowsAndValidationSummary(t *testing.T) {
	manifest := BuildRouteExecutionManifest(RouteExecutionManifestBuildInput{
		CandidateContextSeen:  true,
		CandidateSnapshotRows: 7,
		Lines: []BatchCreateRouteLine{
			{TypeID: 34, TypeName: "Tritanium", Units: 10, UnitVolumeM3: 0.01, BuySystemID: 1, BuyLocationID: 10, SellSystemID: 2, SellLocationID: 20, BuyTotalISK: 100, SellTotalISK: 150},
			{TypeID: 35, TypeName: "Pyerite", Units: 0, UnitVolumeM3: 0.01, BuySystemID: 1, BuyLocationID: 10, SellSystemID: 2, SellLocationID: 20, BuyTotalISK: 0, SellTotalISK: 0},
			{TypeID: 36, TypeName: "Mexallon", Units: 5, UnitVolumeM3: 0, BuySystemID: 1, BuyLocationID: 10, SellSystemID: 2, SellLocationID: 20, BuyTotalISK: 0, SellTotalISK: 0},
		},
	})

	if manifest.Validation.ExcludedZeroRows != 2 {
		t.Fatalf("excluded zero rows = %d, want 2", manifest.Validation.ExcludedZeroRows)
	}
	if manifest.Validation.IncludedRows != 1 {
		t.Fatalf("included rows = %d, want 1", manifest.Validation.IncludedRows)
	}
	if !manifest.Validation.CandidateContextSeen || manifest.Validation.CandidateSnapshotRows != 7 {
		t.Fatalf("validation snapshot = %+v, want context seen with 7 rows", manifest.Validation)
	}
}
