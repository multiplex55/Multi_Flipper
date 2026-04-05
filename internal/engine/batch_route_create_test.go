package engine

import "testing"

func testBatchRouteOffPathOnlyIndex() *orderIndex {
	return &orderIndex{
		cheapestSell: map[int32]map[int32]orderEntry{
			40: {
				1: {Price: 5, VolumeRemain: 100, LocationID: 60000004},
			},
		},
		highestBuy: map[int32]map[int32][]orderEntry{
			30: {
				1: {{Price: 20, VolumeRemain: 100, LocationID: 60000101}},
			},
		},
	}
}

func TestBatchRouteRegression_StrictEndpointOnlyCanReturnEmpty(t *testing.T) {
	scanner := testBatchRouteScanner()
	path := scanner.SDE.Universe.GetPath(10, 30, 0)
	params := BatchCreateRouteParams{
		OriginSystemID:        10,
		BaseBuySystemID:       10,
		FinalSellSystemID:     30,
		RemainingCapacityM3:   50,
		CargoLimitM3:          100,
		MaxDetourJumpsPerNode: 0,
	}

	lines, _ := scanner.buildBatchRouteCandidateLines(
		params,
		newBatchRoutePolicy(params),
		testBatchRouteOffPathOnlyIndex(),
		path,
		0,
		1,
		1,
	)
	if len(lines) != 0 {
		t.Fatalf("strict endpoint-only behavior should prune off-path opportunities, got %d lines", len(lines))
	}

	options := scanner.buildBatchRouteOptionsFromCandidates(lines, params)
	if len(options) != 0 {
		t.Fatalf("expected no options when strict endpoint-only filtering is applied, got %d", len(options))
	}
}

func TestBatchRouteRegression_DetourExplorationReturnsOptions(t *testing.T) {
	scanner := testBatchRouteScanner()
	path := scanner.SDE.Universe.GetPath(10, 30, 0)
	params := BatchCreateRouteParams{
		OriginSystemID:        10,
		BaseBuySystemID:       10,
		FinalSellSystemID:     30,
		RemainingCapacityM3:   50,
		CargoLimitM3:          100,
		MaxDetourJumpsPerNode: 1,
	}

	lines, _ := scanner.buildBatchRouteCandidateLines(
		params,
		newBatchRoutePolicy(params),
		testBatchRouteOffPathOnlyIndex(),
		path,
		0,
		1,
		1,
	)
	if len(lines) == 0 {
		t.Fatalf("expected off-path opportunities when detour exploration is enabled")
	}

	options := scanner.buildBatchRouteOptionsFromCandidates(lines, params)
	if len(options) == 0 {
		t.Fatalf("expected non-empty options when detour exploration is enabled")
	}
}

func TestBatchRouteRegression_SecurityPolicyTogglesChangeOptions(t *testing.T) {
	scanner := testBatchRouteScanner()
	scanner.SDE.Universe.SetSecurity(20, 0.2)
	path := scanner.SDE.Universe.GetPath(10, 30, 0)
	idx := testBatchRouteIndex()

	blocked := BatchCreateRouteParams{
		OriginSystemID:      10,
		BaseBuySystemID:     10,
		FinalSellSystemID:   30,
		RemainingCapacityM3: 50,
		CargoLimitM3:        100,
		AllowLowsec:         false,
		AllowNullsec:        false,
		AllowWormhole:       false,
	}
	blockedLines, _ := scanner.buildBatchRouteCandidateLines(
		blocked,
		newBatchRoutePolicy(blocked),
		idx,
		path,
		0,
		1,
		1,
	)
	blockedOptions := scanner.buildBatchRouteOptionsFromCandidates(blockedLines, blocked)
	if len(blockedOptions) != 0 {
		t.Fatalf("expected no options when lowsec transit is disallowed, got %d", len(blockedOptions))
	}

	allowed := blocked
	allowed.AllowLowsec = true
	allowedLines, _ := scanner.buildBatchRouteCandidateLines(
		allowed,
		newBatchRoutePolicy(allowed),
		idx,
		path,
		0,
		1,
		1,
	)
	allowedOptions := scanner.buildBatchRouteOptionsFromCandidates(allowedLines, allowed)
	if len(allowedOptions) == 0 {
		t.Fatalf("expected options when lowsec transit is allowed")
	}
}

func TestBatchRouteRegression_AnchorPlusFillersPreservesTopAnchors(t *testing.T) {
	scanner := testBatchRouteScanner()
	params := BatchCreateRouteParams{
		OriginSystemID:      10,
		CurrentSystemID:     10,
		FinalSellSystemID:   30,
		RemainingCapacityM3: 8,
		CargoLimitM3:        12,
	}
	lines := []BatchCreateRouteLine{
		{TypeID: 9001, Units: 2, UnitVolumeM3: 1, ProfitTotalISK: 260, BuyTotalISK: 150, SellTotalISK: 410, RouteJumps: 2, BuySystemID: 10, BuyLocationID: 60001, SellSystemID: 30, SellLocationID: 70001, FillConfidence: 0.9, StaleRisk: 0.1, Concentration: 0.2},
		{TypeID: 9002, Units: 2, UnitVolumeM3: 1, ProfitTotalISK: 210, BuyTotalISK: 160, SellTotalISK: 370, RouteJumps: 2, BuySystemID: 20, BuyLocationID: 60002, SellSystemID: 30, SellLocationID: 70001, FillConfidence: 0.85, StaleRisk: 0.15, Concentration: 0.2},
		{TypeID: 9003, Units: 3, UnitVolumeM3: 1, ProfitTotalISK: 160, BuyTotalISK: 100, SellTotalISK: 260, RouteJumps: 3, BuySystemID: 20, BuyLocationID: 60003, SellSystemID: 30, SellLocationID: 70001, FillConfidence: 0.8, StaleRisk: 0.1, Concentration: 0.2},
		{TypeID: 9004, Units: 2, UnitVolumeM3: 1, ProfitTotalISK: 120, BuyTotalISK: 75, SellTotalISK: 195, RouteJumps: 4, BuySystemID: 40, BuyLocationID: 60004, SellSystemID: 30, SellLocationID: 70001, FillConfidence: 0.95, StaleRisk: 0.05, Concentration: 0.1},
	}

	options := scanner.buildBatchRouteOptionsFromCandidates(lines, params)
	var anchorOption *BatchCreateRouteOption
	for i := range options {
		if options[i].StrategyID == "anchor_plus_fillers" {
			anchorOption = &options[i]
			break
		}
	}
	if anchorOption == nil {
		t.Fatalf("expected anchor_plus_fillers option to be present")
	}
	if len(anchorOption.Lines) < 2 {
		t.Fatalf("expected anchor option to keep anchor lines")
	}
	if anchorOption.Lines[0].TypeID != 9001 || anchorOption.Lines[1].TypeID != 9002 {
		t.Fatalf("expected first two preserved anchors to be type 9001/9002, got %d/%d", anchorOption.Lines[0].TypeID, anchorOption.Lines[1].TypeID)
	}
}
