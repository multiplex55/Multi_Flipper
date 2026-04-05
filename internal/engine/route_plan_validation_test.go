package engine

import (
	"math"
	"testing"
	"time"
)

func baseValidationRequest() RoutePlanValidationRequest {
	now := time.Date(2026, 4, 5, 12, 0, 0, 0, time.UTC)
	return RoutePlanValidationRequest{
		SnapshotAt:  now.Add(-5 * time.Minute),
		ValidatedAt: now,
		Thresholds: RoutePlanValidationThresholds{
			MaxBuyDriftPct:              5,
			MaxSellDriftPct:             5,
			MinRouteProfitRetainedPct:   80,
			MinStopLiquidityRetainedPct: 70,
		},
		Stops: []RoutePlanValidationStop{
			{
				StopKey:               "jita",
				SnapshotBuyTotalISK:   100,
				SnapshotSellTotalISK:  130,
				SnapshotBuyLiquidity:  1000,
				SnapshotSellLiquidity: 1000,
				CurrentBuyTotalISK:    103,
				CurrentSellTotalISK:   127,
				CurrentBuyLiquidity:   900,
				CurrentSellLiquidity:  920,
			},
		},
	}
}

func TestValidateRoutePlan_StateMatrix(t *testing.T) {
	t.Run("pass", func(t *testing.T) {
		res := ValidateRoutePlan(baseValidationRequest())
		if res.Band != ValidationBandPass {
			t.Fatalf("band=%s want pass", res.Band)
		}
	})

	t.Run("warn", func(t *testing.T) {
		req := baseValidationRequest()
		req.Stops[0].CurrentBuyTotalISK = 106 // 6% > 5 and <= 6
		res := ValidateRoutePlan(req)
		if res.Checkpoints[0].Band != ValidationBandWarn {
			t.Fatalf("pre-undock=%s want warn", res.Checkpoints[0].Band)
		}
		if res.Band != ValidationBandWarn {
			t.Fatalf("band=%s want warn", res.Band)
		}
	})

	t.Run("fail", func(t *testing.T) {
		req := baseValidationRequest()
		req.Stops[0].CurrentBuyTotalISK = 107 // 7% > 6 -> fail
		res := ValidateRoutePlan(req)
		if res.Band != ValidationBandFail {
			t.Fatalf("band=%s want fail", res.Band)
		}
		if res.Checkpoints[0].Band != ValidationBandFail {
			t.Fatalf("pre-undock=%s want fail", res.Checkpoints[0].Band)
		}
	})
}

func TestValidateRoutePlan_ThresholdBoundaries(t *testing.T) {
	req := baseValidationRequest()
	req.Thresholds.MinRouteProfitRetainedPct = 0
	req.Stops[0].CurrentBuyTotalISK = 105
	req.Stops[0].CurrentSellTotalISK = 123.5 // exactly 5% drift
	res := ValidateRoutePlan(req)
	if res.TotalBuyDriftPct != 5 {
		t.Fatalf("buy drift=%v want 5", res.TotalBuyDriftPct)
	}
	if res.TotalSellDriftPct != 5 {
		t.Fatalf("sell drift=%v want 5", res.TotalSellDriftPct)
	}
	if res.Band != ValidationBandPass {
		t.Fatalf("band=%s want pass at boundary", res.Band)
	}

	req2 := baseValidationRequest()
	req2.Stops[0].CurrentBuyLiquidity = 700
	req2.Stops[0].CurrentSellLiquidity = 700
	req2.Stops[0].CurrentBuyTotalISK = 110
	req2.Stops[0].CurrentSellTotalISK = 120
	res2 := ValidateRoutePlan(req2)
	if res2.MinStopLiquidityRetained != 70 {
		t.Fatalf("liq retained=%v want 70", res2.MinStopLiquidityRetained)
	}
	if math.Abs(res2.RouteProfitRetainedPct-(100.0/3.0)) > 1e-9 {
		t.Fatalf("profit retained=%v want ~%v", res2.RouteProfitRetainedPct, 100.0/3.0)
	}
}
