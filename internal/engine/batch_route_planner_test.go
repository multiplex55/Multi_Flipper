package engine

import (
	"reflect"
	"testing"

	"eve-flipper/internal/graph"
	"eve-flipper/internal/sde"
)

func testBatchRouteScanner() *Scanner {
	u := graph.NewUniverse()
	// Main path: 10 -> 20 -> 30
	u.AddGate(10, 20)
	u.AddGate(20, 10)
	u.AddGate(20, 30)
	u.AddGate(30, 20)
	// Off-path detour branch from 20
	u.AddGate(20, 40)
	u.AddGate(40, 20)

	for _, sys := range []int32{10, 20, 30, 40} {
		u.SetRegion(sys, 1)
		u.SetSecurity(sys, 1.0)
	}

	return &Scanner{SDE: &sde.Data{
		Universe: u,
		Types: map[int32]*sde.ItemType{
			1: {Name: "Type-1", Volume: 1},
			2: {Name: "Type-2", Volume: 1},
			3: {Name: "Type-3", Volume: 2},
		},
	}}
}

func testBatchRouteIndex() *orderIndex {
	return &orderIndex{
		cheapestSell: map[int32]map[int32]orderEntry{
			10: {
				1: {Price: 10, VolumeRemain: 100, LocationID: 60000001},
				2: {Price: 20, VolumeRemain: 100, LocationID: 60000002},
				3: {Price: 12, VolumeRemain: 100, LocationID: 60000003},
			},
			40: {
				1: {Price: 5, VolumeRemain: 100, LocationID: 60000004},
			},
		},
		highestBuy: map[int32]map[int32][]orderEntry{
			30: {
				1: {{Price: 20, VolumeRemain: 100, LocationID: 60000101}},
				2: {{Price: 35, VolumeRemain: 100, LocationID: 60000102}},
				3: {{Price: 30, VolumeRemain: 100, LocationID: 60000103}},
			},
			40: {
				1: {{Price: 28, VolumeRemain: 100, LocationID: 60000104}},
			},
		},
	}
}

func TestBatchRouteCandidateLines_DetourZeroStrictPathOnly(t *testing.T) {
	scanner := testBatchRouteScanner()
	path := scanner.SDE.Universe.GetPath(10, 30, 0)
	idx := testBatchRouteIndex()
	params := BatchCreateRouteParams{
		OriginSystemID:        10,
		BaseBuySystemID:       10,
		FinalSellSystemID:     30,
		RemainingCapacityM3:   50,
		MaxDetourJumpsPerNode: 0,
	}

	lines, _ := scanner.buildBatchRouteCandidateLines(params, idx, path, 0, 1, 1)
	if len(lines) == 0 {
		t.Fatalf("expected strict-path candidates, got none")
	}
	for _, line := range lines {
		if line.BuySystemID != 10 {
			t.Fatalf("detour=0 should only buy in base system 10, got %d", line.BuySystemID)
		}
		if line.SellSystemID != 30 {
			t.Fatalf("detour=0 should only sell in final system 30, got %d", line.SellSystemID)
		}
	}
}

func TestBatchRouteCandidateLines_DetourIncludesOffPathSystems(t *testing.T) {
	scanner := testBatchRouteScanner()
	path := scanner.SDE.Universe.GetPath(10, 30, 0)
	idx := testBatchRouteIndex()
	params := BatchCreateRouteParams{
		OriginSystemID:        10,
		BaseBuySystemID:       10,
		FinalSellSystemID:     30,
		RemainingCapacityM3:   50,
		MaxDetourJumpsPerNode: 1,
	}

	lines, _ := scanner.buildBatchRouteCandidateLines(params, idx, path, 0, 1, 1)
	if len(lines) == 0 {
		t.Fatalf("expected detour candidates, got none")
	}
	foundOffPath := false
	for _, line := range lines {
		if line.BuySystemID == 40 || line.SellSystemID == 40 {
			foundOffPath = true
			break
		}
	}
	if !foundOffPath {
		t.Fatalf("expected off-path system 40 to appear when detour is enabled")
	}
}

func TestBuildBatchRouteOptions_MultipleRankedOptionsDeterministic(t *testing.T) {
	lines := []BatchCreateRouteLine{
		{TypeID: 1, Units: 10, UnitVolumeM3: 1, ProfitTotalISK: 100, BuyTotalISK: 10, SellTotalISK: 110, RouteJumps: 10, BuySystemID: 10, SellSystemID: 30, SellLocationID: 1},
		{TypeID: 2, Units: 10, UnitVolumeM3: 1, ProfitTotalISK: 80, BuyTotalISK: 20, SellTotalISK: 100, RouteJumps: 2, BuySystemID: 10, SellSystemID: 30, SellLocationID: 2},
		{TypeID: 3, Units: 5, UnitVolumeM3: 2, ProfitTotalISK: 70, BuyTotalISK: 30, SellTotalISK: 100, RouteJumps: 3, BuySystemID: 10, SellSystemID: 30, SellLocationID: 3},
	}
	params := BatchCreateRouteParams{RemainingCapacityM3: 12, CargoLimitM3: 20}

	options1 := buildBatchRouteOptionsFromCandidates(lines, params)
	options2 := buildBatchRouteOptionsFromCandidates(lines, params)
	if len(options1) < 2 {
		t.Fatalf("expected multiple strategy options, got %d", len(options1))
	}

	addedProfit := map[string]float64{}
	for _, opt := range options1 {
		addedProfit[opt.OptionID] = opt.TotalProfitISK
	}
	ranked1 := rankRouteOptions(options1, addedProfit, params.CargoLimitM3)
	ranked2 := rankRouteOptions(options2, addedProfit, params.CargoLimitM3)
	if !reflect.DeepEqual(ranked1, ranked2) {
		t.Fatalf("ranked options should be deterministic")
	}
}

func TestBatchRouteCandidateLines_NoOptionsOnlyWhenNoProfitableReachableCandidates(t *testing.T) {
	scanner := testBatchRouteScanner()
	path := scanner.SDE.Universe.GetPath(10, 30, 0)
	idx := &orderIndex{
		cheapestSell: map[int32]map[int32]orderEntry{10: {1: {Price: 20, VolumeRemain: 100, LocationID: 60000001}}},
		highestBuy:   map[int32]map[int32][]orderEntry{30: {1: {{Price: 10, VolumeRemain: 100, LocationID: 60000101}}}},
	}
	params := BatchCreateRouteParams{
		OriginSystemID:        10,
		BaseBuySystemID:       10,
		FinalSellSystemID:     30,
		RemainingCapacityM3:   50,
		MaxDetourJumpsPerNode: 1,
	}

	lines, stats := scanner.buildBatchRouteCandidateLines(params, idx, path, 0, 1, 1)
	if len(lines) != 0 {
		t.Fatalf("expected no profitable candidates, got %d", len(lines))
	}
	if stats.nonProfitable == 0 {
		t.Fatalf("expected non-profitable prune reason to be tracked")
	}
}
