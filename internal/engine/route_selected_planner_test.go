package engine

import (
	"context"
	"strings"
	"testing"
)

func TestPlanSelectedRouteExpansions_TableDrivenScenarios(t *testing.T) {
	scanner := testBatchRouteScanner()

	tests := []struct {
		name             string
		params           RouteSelectedPlannerParams
		wantOptions      bool
		wantDiagContains string
		assert           func(t *testing.T, result RouteSelectedPlannerResult)
	}{
		{
			name: "expansion from selected route result",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:    []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 20, LocationID: 2001}, {SystemID: 30, LocationID: 3001}},
				OriginSystemID:        10,
				CurrentSystemID:       10,
				CargoLimitM3:          100,
				RemainingCapacityM3:   50,
				MaxDetourJumpsPerNode: 1,
				CandidateLines:        []BatchRouteCandidateOpportunity{{TypeID: 1, TypeName: "Type-1", Units: 20, UnitVolumeM3: 1, BuySystemID: 20, BuyLocationID: 2002, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 10, SellPriceISK: 20}},
			},
			wantOptions: true,
			assert: func(t *testing.T, result RouteSelectedPlannerResult) {
				if got := len(result.Options[0].ManifestByStop); got != 1 {
					t.Fatalf("manifest stop groups = %d, want 1", got)
				}
			},
		},
		{
			name: "detour limit enforcement",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:    []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 20, LocationID: 2001}, {SystemID: 30, LocationID: 3001}},
				OriginSystemID:        10,
				CurrentSystemID:       10,
				CargoLimitM3:          100,
				RemainingCapacityM3:   50,
				MaxDetourJumpsPerNode: 0,
				CandidateLines:        []BatchRouteCandidateOpportunity{{TypeID: 1, TypeName: "Type-1", Units: 20, UnitVolumeM3: 1, BuySystemID: 40, BuyLocationID: 4001, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 10, SellPriceISK: 20}},
			},
			wantOptions:      false,
			wantDiagContains: "no profitable expansions",
		},
		{
			name: "thin orderbook reduces executable qty",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:    []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 30, LocationID: 3001}},
				OriginSystemID:        10,
				CurrentSystemID:       10,
				CargoLimitM3:          100,
				RemainingCapacityM3:   100,
				MaxDetourJumpsPerNode: 1,
				CandidateLines:        []BatchRouteCandidateOpportunity{{TypeID: 1, TypeName: "Type-1", Units: 3, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1002, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 10, SellPriceISK: 20}},
			},
			wantOptions: true,
			assert: func(t *testing.T, result RouteSelectedPlannerResult) {
				if units := result.Options[0].Lines[0].Units; units != 3 {
					t.Fatalf("units = %d, want 3 (limited by thin orderbook)", units)
				}
			},
		},
		{
			name: "zero remaining cargo",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:  []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 30, LocationID: 3001}},
				OriginSystemID:      10,
				CurrentSystemID:     10,
				CargoLimitM3:        100,
				RemainingCapacityM3: 0,
			},
			wantOptions:      false,
			wantDiagContains: "no remaining cargo",
		},
		{
			name: "zero or negative net filtered",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:  []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 30, LocationID: 3001}},
				OriginSystemID:      10,
				CurrentSystemID:     10,
				CargoLimitM3:        100,
				RemainingCapacityM3: 50,
				CandidateLines:      []BatchRouteCandidateOpportunity{{TypeID: 1, TypeName: "Type-1", Units: 5, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1002, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 20, SellPriceISK: 10}},
			},
			wantOptions: false,
			assert: func(t *testing.T, result RouteSelectedPlannerResult) {
				if len(result.ExcludedCandidates) == 0 || result.ExcludedCandidates[0].Reason != "non_positive_net" {
					t.Fatalf("excluded reasons = %+v, want non_positive_net", result.ExcludedCandidates)
				}
			},
		},
		{
			name: "current system differs from route origin",
			params: RouteSelectedPlannerParams{
				SelectedRouteStops:  []RouteSelectedStop{{SystemID: 10, LocationID: 1001}, {SystemID: 30, LocationID: 3001}},
				OriginSystemID:      10,
				CurrentSystemID:     20,
				CargoLimitM3:        100,
				RemainingCapacityM3: 50,
				CandidateLines:      []BatchRouteCandidateOpportunity{{TypeID: 1, TypeName: "Type-1", Units: 5, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1002, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 10, SellPriceISK: 20}},
			},
			wantOptions: true,
			assert: func(t *testing.T, result RouteSelectedPlannerResult) {
				if result.Options[0].TotalJumps <= 0 {
					t.Fatalf("expected total jumps > 0 when current system differs from origin")
				}
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result, err := scanner.PlanSelectedRouteExpansions(context.Background(), tc.params)
			if err != nil {
				t.Fatalf("PlanSelectedRouteExpansions error: %v", err)
			}
			if tc.wantOptions && len(result.Options) == 0 {
				t.Fatalf("expected options, got none (diagnostics=%v)", result.Diagnostics)
			}
			if !tc.wantOptions && len(result.Options) > 0 {
				t.Fatalf("expected no options, got %d", len(result.Options))
			}
			if tc.wantDiagContains != "" {
				joined := ""
				for _, d := range result.Diagnostics {
					joined += d
				}
				if joined == "" || !strings.Contains(joined, tc.wantDiagContains) {
					t.Fatalf("diagnostics=%v, want substring %q", result.Diagnostics, tc.wantDiagContains)
				}
			}
			if tc.assert != nil {
				tc.assert(t, result)
			}
		})
	}
}
