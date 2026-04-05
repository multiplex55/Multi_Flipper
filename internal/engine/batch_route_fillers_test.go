package engine

import (
	"context"
	"testing"
)

func TestSuggestBatchRouteFillers_DoesNotExceedRemainingM3(t *testing.T) {
	scanner := testBatchRouteScanner()
	params := BatchRouteFillerSuggestionParams{
		CargoLimitM3:    100,
		CurrentSystemID: 10,
		BaseLines:       []BatchCreateRouteLine{{TypeID: 9000, Units: 40, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1001, SellSystemID: 30, SellLocationID: 3001}},
		SelectedLines:   []BatchCreateRouteLine{{TypeID: 9001, Units: 30, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1001, SellSystemID: 30, SellLocationID: 3001}},
		CandidateLines: []BatchRouteCandidateOpportunity{
			{TypeID: 1, TypeName: "Type-1", Units: 20, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1001, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 10, SellPriceISK: 20, FillConfidence: 0.9, StaleRisk: 0.1, Concentration: 0.1},
			{TypeID: 2, TypeName: "Type-2", Units: 20, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1002, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 10, SellPriceISK: 22, FillConfidence: 0.8, StaleRisk: 0.2, Concentration: 0.2},
		},
		ExecutionScoring: RouteExecutionScoringConfig{Preset: routeExecutionPresetBalanced},
	}
	result, err := scanner.SuggestBatchRouteFillers(context.Background(), params)
	if err != nil {
		t.Fatalf("SuggestBatchRouteFillers error = %v", err)
	}
	if result.RemainingCapacityM3 != 30 {
		t.Fatalf("RemainingCapacityM3 = %.2f, want 30", result.RemainingCapacityM3)
	}
	totalVolume := 0.0
	for _, suggestion := range result.Suggestions {
		totalVolume += suggestion.VolumeM3
	}
	if totalVolume > result.RemainingCapacityM3+1e-6 {
		t.Fatalf("total suggested volume = %.2f, remaining = %.2f", totalVolume, result.RemainingCapacityM3)
	}
}

func TestSuggestBatchRouteFillers_ConservativeRanksSafeAheadOfRisky(t *testing.T) {
	scanner := testBatchRouteScanner()
	params := BatchRouteFillerSuggestionParams{
		CargoLimitM3:    500,
		CurrentSystemID: 10,
		CandidateLines: []BatchRouteCandidateOpportunity{
			{TypeID: 1001, TypeName: "Safe", Units: 10, UnitVolumeM3: 5, BuySystemID: 10, BuyLocationID: 1001, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 100, SellPriceISK: 160, FillConfidence: 0.95, StaleRisk: 0.05, Concentration: 0.10},
			{TypeID: 1002, TypeName: "Risky", Units: 10, UnitVolumeM3: 5, BuySystemID: 10, BuyLocationID: 1002, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 100, SellPriceISK: 220, FillConfidence: 0.25, StaleRisk: 0.85, Concentration: 0.85},
		},
		ExecutionScoring: RouteExecutionScoringConfig{Preset: routeExecutionPresetConservative},
	}
	result, err := scanner.SuggestBatchRouteFillers(context.Background(), params)
	if err != nil {
		t.Fatalf("SuggestBatchRouteFillers error = %v", err)
	}
	if len(result.Suggestions) == 0 {
		t.Fatalf("expected at least one suggestion")
	}
	if got := result.Suggestions[0].Line.TypeID; got != 1001 {
		t.Fatalf("first suggestion type = %d, want 1001", got)
	}
}

func TestSuggestBatchRouteFillers_AggressiveIncludesMarginalFillers(t *testing.T) {
	scanner := testBatchRouteScanner()
	candidates := []BatchRouteCandidateOpportunity{
		{TypeID: 2001, TypeName: "Safe", Units: 10, UnitVolumeM3: 4, BuySystemID: 10, BuyLocationID: 1001, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 100, SellPriceISK: 170, FillConfidence: 0.9, StaleRisk: 0.1, Concentration: 0.1},
		{TypeID: 2002, TypeName: "Marginal-1", Units: 10, UnitVolumeM3: 4, BuySystemID: 10, BuyLocationID: 1002, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 100, SellPriceISK: 140, FillConfidence: 0.35, StaleRisk: 0.7, Concentration: 0.7},
		{TypeID: 2003, TypeName: "Marginal-2", Units: 10, UnitVolumeM3: 4, BuySystemID: 10, BuyLocationID: 1003, SellSystemID: 30, SellLocationID: 3001, BuyPriceISK: 100, SellPriceISK: 138, FillConfidence: 0.33, StaleRisk: 0.72, Concentration: 0.72},
	}
	conservative, err := scanner.SuggestBatchRouteFillers(context.Background(), BatchRouteFillerSuggestionParams{
		CargoLimitM3:     500,
		CurrentSystemID:  10,
		CandidateLines:   candidates,
		ExecutionScoring: RouteExecutionScoringConfig{Preset: routeExecutionPresetConservative},
	})
	if err != nil {
		t.Fatalf("conservative SuggestBatchRouteFillers error = %v", err)
	}
	aggressive, err := scanner.SuggestBatchRouteFillers(context.Background(), BatchRouteFillerSuggestionParams{
		CargoLimitM3:     500,
		CurrentSystemID:  10,
		CandidateLines:   candidates,
		ExecutionScoring: RouteExecutionScoringConfig{Preset: routeExecutionPresetAggressive},
	})
	if err != nil {
		t.Fatalf("aggressive SuggestBatchRouteFillers error = %v", err)
	}
	if len(aggressive.Suggestions) <= len(conservative.Suggestions) {
		t.Fatalf("aggressive suggestions = %d, conservative = %d; want aggressive to include more", len(aggressive.Suggestions), len(conservative.Suggestions))
	}
}
