package api

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func validBatchCreateRouteRequest() BatchCreateRouteRequest {
	return BatchCreateRouteRequest{
		OriginSystemID:    30000142,
		OriginSystemName:  "Jita",
		OriginLocationID:  60003760,
		CurrentSystemID:   30000142,
		CurrentLocationID: 60003760,
		BaseBatch: BaseBatchManifest{
			BaseBuySystemID:    30000142,
			BaseBuyLocationID:  60003760,
			BaseSellSystemID:   30002187,
			BaseSellLocationID: 60008494,
			BaseLines: []BaseBatchLine{
				{TypeID: 34, Units: 1000},
			},
		},
		CargoLimitM3:        12000,
		RemainingCapacityM3: 6000,
		DeterministicSort: DeterministicSortConfig{
			Primary:   "total_profit_isk",
			Secondary: "isk_per_jump",
		},
	}
}

func TestBatchCreateRouteRequestValidate(t *testing.T) {
	t.Run("missing_origin", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.OriginSystemID = 0

		err := req.Validate()
		if !errors.Is(err, errBatchRouteMissingOrigin) {
			t.Fatalf("Validate error = %v, want %v", err, errBatchRouteMissingOrigin)
		}
	})

	t.Run("missing_final_sell_location_or_system", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.BaseBatch.BaseSellSystemID = 0

		err := req.Validate()
		if !errors.Is(err, errBatchRouteMissingFinalSell) {
			t.Fatalf("Validate error = %v, want %v", err, errBatchRouteMissingFinalSell)
		}
	})

	t.Run("missing_base_buy_location_or_system", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.BaseBatch.BaseBuySystemID = 0

		err := req.Validate()
		if !errors.Is(err, errBatchRouteMissingBaseBuy) {
			t.Fatalf("Validate error = %v, want %v", err, errBatchRouteMissingBaseBuy)
		}
	})

	t.Run("negative_cargo_or_remaining", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.CargoLimitM3 = -1

		err := req.Validate()
		if !errors.Is(err, errBatchRouteNegativeCargo) {
			t.Fatalf("Validate error = %v, want %v", err, errBatchRouteNegativeCargo)
		}
	})

	t.Run("empty_base_lines", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.BaseBatch.BaseLines = nil

		err := req.Validate()
		if !errors.Is(err, errBatchRouteEmptyBaseLines) {
			t.Fatalf("Validate error = %v, want %v", err, errBatchRouteEmptyBaseLines)
		}
	})

	t.Run("requires_deterministic_sorting_fields", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.DeterministicSort.Primary = ""

		err := req.Validate()
		if !errors.Is(err, errBatchRouteDeterministicSortEmpty) {
			t.Fatalf("Validate error = %v, want %v", err, errBatchRouteDeterministicSortEmpty)
		}
	})
}

func TestBatchCreateRouteRequestApplyDefaults(t *testing.T) {
	t.Run("defaults_current_context_to_origin", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.CurrentSystemID = 0
		req.CurrentLocationID = 0

		req.ApplyDefaults()

		if req.CurrentSystemID != req.OriginSystemID {
			t.Fatalf("CurrentSystemID = %d, want %d", req.CurrentSystemID, req.OriginSystemID)
		}
		if req.CurrentLocationID != req.OriginLocationID {
			t.Fatalf("CurrentLocationID = %d, want %d", req.CurrentLocationID, req.OriginLocationID)
		}
	})

	t.Run("sets_remaining_capacity_to_cargo_when_zero", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.CargoLimitM3 = 24000
		req.RemainingCapacityM3 = 0

		req.ApplyDefaults()

		if req.RemainingCapacityM3 != 24000 {
			t.Fatalf("RemainingCapacityM3 = %v, want 24000", req.RemainingCapacityM3)
		}
	})

	t.Run("sets_sort_and_jumps_defaults", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.RouteMaxJumps = 0
		req.DeterministicSort = DeterministicSortConfig{}

		req.ApplyDefaults()

		if req.RouteMaxJumps != 50 {
			t.Fatalf("RouteMaxJumps = %d, want 50", req.RouteMaxJumps)
		}
		if req.DeterministicSort.Primary != "total_profit_isk" || req.DeterministicSort.Secondary != "isk_per_jump" {
			t.Fatalf("DeterministicSort = %+v, want defaults", req.DeterministicSort)
		}
	})

	t.Run("preserves_explicit_current_context", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.CurrentSystemID = 30002187
		req.CurrentLocationID = 60008494

		req.ApplyDefaults()

		if req.CurrentSystemID != 30002187 {
			t.Fatalf("CurrentSystemID = %d, want 30002187", req.CurrentSystemID)
		}
		if req.CurrentLocationID != 60008494 {
			t.Fatalf("CurrentLocationID = %d, want 60008494", req.CurrentLocationID)
		}
	})
}

func TestRouteAdditionOptionJSONIncludesRoleAndLineFields(t *testing.T) {
	option := RouteAdditionOption{
		OptionID:            "x",
		StrategyID:          "balanced_practical",
		StrategyLabel:       "Balanced Practical",
		Recommended:         true,
		RecommendationScore: 87.5,
		ReasonChips:         []string{"High ISK/jump"},
		WarningChips:        []string{"Thin fill"},
		Lines: []RouteAdditionLine{{
			TypeID:             1,
			LineExecutionScore: 55.5,
			LineRole:           "safe_filler",
			FillConfidence:     0.8,
			StaleRisk:          0.2,
			Concentration:      0.1,
		}},
		CoreLineCount:          1,
		SafeFillerLineCount:    2,
		StretchFillerLineCount: 3,
		CoreProfitTotalISK:     10,
		SafeFillerProfitISK:    20,
		StretchFillerProfitISK: 30,
	}
	body, err := json.Marshal(option)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}
	payload := string(body)
	for _, expected := range []string{
		`"line_execution_score"`,
		`"recommended"`,
		`"strategy_id"`,
		`"strategy_label"`,
		`"recommendation_score"`,
		`"reason_chips"`,
		`"warning_chips"`,
		`"line_role"`,
		`"fill_confidence"`,
		`"stale_risk"`,
		`"concentration_risk"`,
		`"core_line_count"`,
		`"safe_filler_line_count"`,
		`"stretch_filler_line_count"`,
		`"core_profit_total_isk"`,
		`"safe_filler_profit_isk"`,
		`"stretch_filler_profit_isk"`,
	} {
		if !strings.Contains(payload, expected) {
			t.Fatalf("JSON missing %s: %s", expected, payload)
		}
	}
}
