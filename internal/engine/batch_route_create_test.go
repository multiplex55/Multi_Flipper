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
