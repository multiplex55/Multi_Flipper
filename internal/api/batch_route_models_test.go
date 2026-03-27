package api

import (
	"errors"
	"testing"
)

func validBatchCreateRouteRequest() BatchCreateRouteRequest {
	return BatchCreateRouteRequest{
		OriginSystemID:   30000142,
		OriginSystemName: "Jita",
		OriginLocationID: 60003760,
		BaseBatch: BaseBatchManifest{
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
	t.Run("sets_remaining_capacity_to_cargo_when_zero", func(t *testing.T) {
		req := validBatchCreateRouteRequest()
		req.CargoLimitM3 = 24000
		req.RemainingCapacityM3 = 0

		req.ApplyDefaults()

		if req.RemainingCapacityM3 != 24000 {
			t.Fatalf("RemainingCapacityM3 = %v, want 24000", req.RemainingCapacityM3)
		}
	})
}
