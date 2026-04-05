package engine

import (
	"context"
	"testing"
)

func TestCorridorPlanner_TableDrivenScenarios(t *testing.T) {
	scanner := testBatchRouteScanner()

	tests := []struct {
		name   string
		params RouteSelectedPlannerParams
		assert func(t *testing.T, result RouteSelectedPlannerResult)
	}{
		{
			name: "multi-stop corridor success case",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:  []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 20, LocationID: 2001}, {SystemID: 30, LocationID: 3001}},
				OriginSystemID:      10,
				CurrentSystemID:     10,
				RemainingCapacityM3: 100,
				CandidateLines: []BatchRouteCandidateOpportunity{
					{TypeID: 1, TypeName: "Type-1", Units: 10, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1001, SellSystemID: 20, SellLocationID: 2001, BuyPriceISK: 10, SellPriceISK: 20, FillConfidence: 0.9},
					{TypeID: 2, TypeName: "Type-2", Units: 10, UnitVolumeM3: 1, BuySystemID: 20, BuyLocationID: 2001, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 10, SellPriceISK: 30, FillConfidence: 0.8},
				},
			},
			assert: func(t *testing.T, result RouteSelectedPlannerResult) {
				if len(result.Options) == 0 {
					t.Fatalf("expected options, got none")
				}
				manifest := result.Options[0].ManifestByStop
				if len(manifest) != 3 {
					t.Fatalf("manifest stops = %d, want 3", len(manifest))
				}
				if len(manifest[1].BuyLines) == 0 || len(manifest[1].SellLines) == 0 {
					t.Fatalf("middle stop should include sell+buy actions: %+v", manifest[1])
				}
			},
		},
		{
			name: "occupancy over-commit rejected",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:    []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 20, LocationID: 2001}, {SystemID: 30, LocationID: 3001}, {SystemID: 40, LocationID: 4001}},
				OriginSystemID:        10,
				CurrentSystemID:       10,
				RemainingCapacityM3:   100,
				MaxDetourJumpsPerNode: 1,
				CandidateLines: []BatchRouteCandidateOpportunity{
					{TypeID: 1, TypeName: "Type-1", Units: 80, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1001, SellSystemID: 40, SellLocationID: 4001, BuyPriceISK: 10, SellPriceISK: 20},
					{TypeID: 2, TypeName: "Type-2", Units: 40, UnitVolumeM3: 1, BuySystemID: 20, BuyLocationID: 2001, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 10, SellPriceISK: 25},
				},
			},
			assert: func(t *testing.T, result RouteSelectedPlannerResult) {
				if len(result.Options) == 0 {
					t.Fatalf("expected options")
				}
				if len(result.Options[0].Lines) != 1 {
					t.Fatalf("expected one line after occupancy enforcement, got %d", len(result.Options[0].Lines))
				}
			},
		},
		{
			name: "repeated type across multiple stations resolved correctly",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:    []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 20, LocationID: 2001}, {SystemID: 30, LocationID: 3001}, {SystemID: 40, LocationID: 4001}},
				OriginSystemID:        10,
				CurrentSystemID:       10,
				RemainingCapacityM3:   100,
				MaxDetourJumpsPerNode: 1,
				CandidateLines: []BatchRouteCandidateOpportunity{
					{TypeID: 1, TypeName: "Type-1", Units: 5, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1001, SellSystemID: 20, SellLocationID: 2001, BuyPriceISK: 10, SellPriceISK: 20},
					{TypeID: 1, TypeName: "Type-1", Units: 5, UnitVolumeM3: 1, BuySystemID: 30, BuyLocationID: 3001, SellSystemID: 40, SellLocationID: 4001, BuyPriceISK: 11, SellPriceISK: 25},
				},
			},
			assert: func(t *testing.T, result RouteSelectedPlannerResult) {
				if len(result.Options) == 0 || len(result.Options[0].Lines) != 2 {
					t.Fatalf("expected both repeated-type legs, got %+v", result.Options)
				}
			},
		},
		{
			name: "route invalid mid-way handling",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:  []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 20, LocationID: 2001}, {SystemID: 30, LocationID: 3001}},
				OriginSystemID:      10,
				CurrentSystemID:     10,
				RemainingCapacityM3: 100,
				CandidateLines:      []BatchRouteCandidateOpportunity{{TypeID: 1, TypeName: "Type-1", Units: 5, UnitVolumeM3: 1, BuySystemID: 30, BuyLocationID: 3001, SellSystemID: 20, SellLocationID: 2001, BuyPriceISK: 10, SellPriceISK: 20}},
			},
			assert: func(t *testing.T, result RouteSelectedPlannerResult) {
				if len(result.Options) != 0 {
					t.Fatalf("expected no options for sell-before-buy candidate")
				}
			},
		},
		{
			name: "unreachable final sell under security/risk rules",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:  []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 20, LocationID: 2001}, {SystemID: 30, LocationID: 3001}},
				OriginSystemID:      10,
				CurrentSystemID:     10,
				RemainingCapacityM3: 100,
				AllowLowsec:         false,
				AllowNullsec:        false,
				AllowWormhole:       false,
				MinRouteSecurity:    0.5,
				CandidateLines:      []BatchRouteCandidateOpportunity{{TypeID: 1, TypeName: "Type-1", Units: 5, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1001, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 10, SellPriceISK: 20}},
			},
			assert: func(t *testing.T, result RouteSelectedPlannerResult) {
				if len(result.Options) != 0 {
					t.Fatalf("expected security blocked option")
				}
				if len(result.ExcludedCandidates) == 0 || result.ExcludedCandidates[0].Reason != "security_filter" {
					t.Fatalf("unexpected exclusions: %+v", result.ExcludedCandidates)
				}
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.name == "unreachable final sell under security/risk rules" {
				scanner.SDE.Universe.SetSecurity(30, -0.5)
			} else {
				scanner.SDE.Universe.SetSecurity(30, 1.0)
			}
			result, err := scanner.PlanSelectedRouteExpansions(context.Background(), tc.params)
			if err != nil {
				t.Fatalf("PlanSelectedRouteExpansions error: %v", err)
			}
			tc.assert(t, result)
		})
	}
}
