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

	lines, _ := scanner.buildBatchRouteCandidateLines(params, newBatchRoutePolicy(params), idx, path, 0, 1, 1)
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

	lines, _ := scanner.buildBatchRouteCandidateLines(params, newBatchRoutePolicy(params), idx, path, 0, 1, 1)
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

	scanner := testBatchRouteScanner()
	params.OriginSystemID = 10
	params.FinalSellSystemID = 30
	options1 := scanner.buildBatchRouteOptionsFromCandidates(lines, params)
	options2 := scanner.buildBatchRouteOptionsFromCandidates(lines, params)
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

	lines, stats := scanner.buildBatchRouteCandidateLines(params, newBatchRoutePolicy(params), idx, path, 0, 1, 1)
	if len(lines) != 0 {
		t.Fatalf("expected no profitable candidates, got %d", len(lines))
	}
	if stats.nonProfitable == 0 {
		t.Fatalf("expected non-profitable prune reason to be tracked")
	}
}

func TestMergeBatchRouteCandidatePools_DedupesAndExcludesBaseLines(t *testing.T) {
	market := []BatchCreateRouteLine{
		{TypeID: 34, TypeName: "Tritanium", Units: 100, UnitVolumeM3: 0.01, BuySystemID: 1, BuyLocationID: 11, SellSystemID: 2, SellLocationID: 22, BuyTotalISK: 400, SellTotalISK: 500, ProfitTotalISK: 100, RouteJumps: 5},
	}
	cache := []BatchCreateRouteLine{
		{TypeID: 34, TypeName: "Tritanium", Units: 50, UnitVolumeM3: 0.01, BuySystemID: 1, BuyLocationID: 11, SellSystemID: 2, SellLocationID: 22, BuyTotalISK: 210, SellTotalISK: 300, ProfitTotalISK: 90, RouteJumps: 4},
		{TypeID: 35, TypeName: "Pyerite", Units: 10, UnitVolumeM3: 0.01, BuySystemID: 1, BuyLocationID: 15, SellSystemID: 2, SellLocationID: 25, BuyTotalISK: 100, SellTotalISK: 180, ProfitTotalISK: 80, RouteJumps: 6},
	}
	base := []BatchCreateRouteLine{
		{TypeID: 35, TypeName: "Pyerite", Units: 5, UnitVolumeM3: 0.01, BuySystemID: 1, BuyLocationID: 15, SellSystemID: 2, SellLocationID: 25},
	}

	merged := mergeBatchRouteCandidatePools(market, cache, base)
	if len(merged) != 1 {
		t.Fatalf("merged lines = %d, want 1", len(merged))
	}
	if merged[0].TypeID != 34 {
		t.Fatalf("merged line type = %d, want 34", merged[0].TypeID)
	}
	if merged[0].Units != 150 {
		t.Fatalf("merged units = %d, want 150", merged[0].Units)
	}
	if merged[0].RouteJumps != 4 {
		t.Fatalf("merged route jumps = %d, want 4", merged[0].RouteJumps)
	}
}

func TestBuildBatchRouteOptions_OptimizesMultiStopJumpsAcrossStations(t *testing.T) {
	u := graph.NewUniverse()
	// 1(start) -> 2 -> 3 -> 6(final) is shortest sequence when buying at 2 and 3.
	u.AddGate(1, 2)
	u.AddGate(2, 1)
	u.AddGate(2, 3)
	u.AddGate(3, 2)
	u.AddGate(3, 6)
	u.AddGate(6, 3)
	// Longer detour branch.
	u.AddGate(1, 4)
	u.AddGate(4, 1)
	u.AddGate(4, 5)
	u.AddGate(5, 4)
	u.AddGate(5, 6)
	u.AddGate(6, 5)
	for _, sys := range []int32{1, 2, 3, 4, 5, 6} {
		u.SetRegion(sys, 1)
		u.SetSecurity(sys, 1.0)
	}
	scanner := &Scanner{SDE: &sde.Data{Universe: u}}
	params := BatchCreateRouteParams{
		OriginSystemID:      1,
		CurrentSystemID:     1,
		FinalSellSystemID:   6,
		RemainingCapacityM3: 100,
	}
	lines := []BatchCreateRouteLine{
		{TypeID: 10, Units: 1, UnitVolumeM3: 1, ProfitTotalISK: 100, BuyTotalISK: 100, SellTotalISK: 200, RouteJumps: 6, BuySystemID: 2},
		{TypeID: 11, Units: 1, UnitVolumeM3: 1, ProfitTotalISK: 90, BuyTotalISK: 90, SellTotalISK: 180, RouteJumps: 6, BuySystemID: 3},
	}
	options := scanner.buildBatchRouteOptionsFromCandidates(lines, params)
	if len(options) == 0 {
		t.Fatalf("expected options")
	}
	if options[0].TotalJumps != 3 {
		t.Fatalf("optimized total jumps = %d, want 3", options[0].TotalJumps)
	}
	if !reflect.DeepEqual(options[0].OrderedBuySystems, []int32{2, 3}) {
		t.Fatalf("ordered buy systems = %v, want [2 3]", options[0].OrderedBuySystems)
	}
}

func TestBuildBatchRouteOptions_IncludesBaseLinesInRouteSequence(t *testing.T) {
	u := graph.NewUniverse()
	u.AddGate(1, 2)
	u.AddGate(2, 1)
	u.AddGate(2, 3)
	u.AddGate(3, 2)
	u.AddGate(3, 4)
	u.AddGate(4, 3)
	for _, sys := range []int32{1, 2, 3, 4} {
		u.SetRegion(sys, 1)
		u.SetSecurity(sys, 1.0)
	}
	scanner := &Scanner{SDE: &sde.Data{Universe: u}}
	params := BatchCreateRouteParams{
		OriginSystemID:      1,
		CurrentSystemID:     1,
		FinalSellSystemID:   4,
		RemainingCapacityM3: 100,
		BaseLines: []BatchCreateRouteLine{
			{TypeID: 50, Units: 1, UnitVolumeM3: 1, BuySystemID: 2},
		},
	}
	lines := []BatchCreateRouteLine{
		{TypeID: 60, Units: 1, UnitVolumeM3: 1, ProfitTotalISK: 20, BuyTotalISK: 80, SellTotalISK: 100, RouteJumps: 2, BuySystemID: 3},
	}
	options := scanner.buildBatchRouteOptionsFromCandidates(lines, params)
	if len(options) == 0 {
		t.Fatalf("expected options")
	}
	if options[0].TotalJumps != 3 {
		t.Fatalf("total jumps with base-line buy inclusion = %d, want 3", options[0].TotalJumps)
	}
	if !reflect.DeepEqual(options[0].OrderedBuySystems, []int32{2, 3}) {
		t.Fatalf("ordered buy systems = %v, want [2 3]", options[0].OrderedBuySystems)
	}
	if !reflect.DeepEqual(options[0].RouteSequence, []int32{1, 2, 3, 4}) {
		t.Fatalf("route sequence = %v, want [1 2 3 4]", options[0].RouteSequence)
	}
}
