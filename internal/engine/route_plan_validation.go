package engine

import "time"

type ValidationBand string

const (
	ValidationBandPass ValidationBand = "pass"
	ValidationBandWarn ValidationBand = "warn"
	ValidationBandFail ValidationBand = "fail"
)

type RoutePlanValidationThresholds struct {
	MaxBuyDriftPct              float64 `json:"max_buy_drift_pct"`
	MaxSellDriftPct             float64 `json:"max_sell_drift_pct"`
	MinRouteProfitRetainedPct   float64 `json:"min_route_profit_retained_pct"`
	MinStopLiquidityRetainedPct float64 `json:"min_stop_liquidity_retained_pct"`
}

type RoutePlanValidationStop struct {
	StopKey               string  `json:"stop_key"`
	SnapshotBuyTotalISK   float64 `json:"snapshot_buy_total_isk"`
	SnapshotSellTotalISK  float64 `json:"snapshot_sell_total_isk"`
	SnapshotBuyLiquidity  float64 `json:"snapshot_buy_liquidity"`
	SnapshotSellLiquidity float64 `json:"snapshot_sell_liquidity"`
	CurrentBuyTotalISK    float64 `json:"current_buy_total_isk"`
	CurrentSellTotalISK   float64 `json:"current_sell_total_isk"`
	CurrentBuyLiquidity   float64 `json:"current_buy_liquidity"`
	CurrentSellLiquidity  float64 `json:"current_sell_liquidity"`
}

type RoutePlanValidationRequest struct {
	SnapshotAt  time.Time                     `json:"snapshot_at"`
	ValidatedAt time.Time                     `json:"validated_at"`
	StaleAfter  time.Duration                 `json:"stale_after"`
	Thresholds  RoutePlanValidationThresholds `json:"thresholds"`
	Stops       []RoutePlanValidationStop     `json:"stops"`
}

type RoutePlanValidationStopResult struct {
	StopKey              string         `json:"stop_key"`
	BuyCeilingISK        float64        `json:"buy_ceiling_isk"`
	SellFloorISK         float64        `json:"sell_floor_isk"`
	BuyDriftPct          float64        `json:"buy_drift_pct"`
	SellDriftPct         float64        `json:"sell_drift_pct"`
	LiquidityRetainedPct float64        `json:"liquidity_retained_pct"`
	Band                 ValidationBand `json:"band"`
}

type RoutePlanValidationCheckpoint struct {
	Name     string         `json:"name"`
	Band     ValidationBand `json:"band"`
	Messages []string       `json:"messages,omitempty"`
}

type RoutePlanValidationResponse struct {
	Band                     ValidationBand                  `json:"band"`
	SnapshotStale            bool                            `json:"snapshot_stale"`
	TotalBuyDriftPct         float64                         `json:"total_buy_drift_pct"`
	TotalSellDriftPct        float64                         `json:"total_sell_drift_pct"`
	RouteProfitRetainedPct   float64                         `json:"route_profit_retained_pct"`
	MinStopLiquidityRetained float64                         `json:"min_stop_liquidity_retained"`
	Checkpoints              []RoutePlanValidationCheckpoint `json:"checkpoints"`
	Stops                    []RoutePlanValidationStopResult `json:"stops"`
}

func ValidateRoutePlan(req RoutePlanValidationRequest) RoutePlanValidationResponse {
	staleAfter := req.StaleAfter
	if staleAfter <= 0 {
		staleAfter = 15 * time.Minute
	}
	snapshotStale := !req.SnapshotAt.IsZero() && req.ValidatedAt.Sub(req.SnapshotAt) > staleAfter

	totalSnapBuy, totalSnapSell := 0.0, 0.0
	totalCurBuy, totalCurSell := 0.0, 0.0
	minLiquidityRetained := 100.0
	stopResults := make([]RoutePlanValidationStopResult, 0, len(req.Stops))
	for _, stop := range req.Stops {
		totalSnapBuy += stop.SnapshotBuyTotalISK
		totalSnapSell += stop.SnapshotSellTotalISK
		totalCurBuy += stop.CurrentBuyTotalISK
		totalCurSell += stop.CurrentSellTotalISK

		buyDrift := pctDeltaUp(stop.SnapshotBuyTotalISK, stop.CurrentBuyTotalISK)
		sellDrift := pctDeltaDown(stop.SnapshotSellTotalISK, stop.CurrentSellTotalISK)
		liquidityRetained := minFloat(
			retainedPct(stop.SnapshotBuyLiquidity, stop.CurrentBuyLiquidity),
			retainedPct(stop.SnapshotSellLiquidity, stop.CurrentSellLiquidity),
		)
		if liquidityRetained < minLiquidityRetained {
			minLiquidityRetained = liquidityRetained
		}

		band := ValidationBandPass
		band = maxBand(band, bandByMax(buyDrift, req.Thresholds.MaxBuyDriftPct))
		band = maxBand(band, bandByMax(sellDrift, req.Thresholds.MaxSellDriftPct))
		band = maxBand(band, bandByMin(liquidityRetained, req.Thresholds.MinStopLiquidityRetainedPct))

		stopResults = append(stopResults, RoutePlanValidationStopResult{
			StopKey:              stop.StopKey,
			BuyCeilingISK:        stop.SnapshotBuyTotalISK * (1 + req.Thresholds.MaxBuyDriftPct/100),
			SellFloorISK:         stop.SnapshotSellTotalISK * (1 - req.Thresholds.MaxSellDriftPct/100),
			BuyDriftPct:          buyDrift,
			SellDriftPct:         sellDrift,
			LiquidityRetainedPct: liquidityRetained,
			Band:                 band,
		})
	}
	if len(req.Stops) == 0 {
		minLiquidityRetained = 100
	}

	totalBuyDrift := pctDeltaUp(totalSnapBuy, totalCurBuy)
	totalSellDrift := pctDeltaDown(totalSnapSell, totalCurSell)
	snapshotProfit := totalSnapSell - totalSnapBuy
	currentProfit := totalCurSell - totalCurBuy
	retainedProfit := retainedPct(snapshotProfit, currentProfit)

	preUndockBand := maxBand(
		bandByMax(totalBuyDrift, req.Thresholds.MaxBuyDriftPct),
		bandByMin(minLiquidityRetained, req.Thresholds.MinStopLiquidityRetainedPct),
	)
	preSaleBand := maxBand(
		bandByMax(totalSellDrift, req.Thresholds.MaxSellDriftPct),
		bandByMin(retainedProfit, req.Thresholds.MinRouteProfitRetainedPct),
	)
	if snapshotStale {
		preUndockBand = maxBand(preUndockBand, ValidationBandWarn)
		preSaleBand = maxBand(preSaleBand, ValidationBandWarn)
	}

	response := RoutePlanValidationResponse{
		Band:                     maxBand(preUndockBand, preSaleBand),
		SnapshotStale:            snapshotStale,
		TotalBuyDriftPct:         totalBuyDrift,
		TotalSellDriftPct:        totalSellDrift,
		RouteProfitRetainedPct:   retainedProfit,
		MinStopLiquidityRetained: minLiquidityRetained,
		Checkpoints: []RoutePlanValidationCheckpoint{
			{Name: "pre-undock", Band: preUndockBand, Messages: checkpointMessagesPreUndock(snapshotStale, totalBuyDrift, minLiquidityRetained, req.Thresholds)},
			{Name: "pre-sale", Band: preSaleBand, Messages: checkpointMessagesPreSale(snapshotStale, totalSellDrift, retainedProfit, req.Thresholds)},
		},
		Stops: stopResults,
	}
	return response
}

func checkpointMessagesPreUndock(stale bool, buyDrift, minLiquidity float64, th RoutePlanValidationThresholds) []string {
	messages := []string{}
	if stale {
		messages = append(messages, "snapshot_stale")
	}
	if band := bandByMax(buyDrift, th.MaxBuyDriftPct); band != ValidationBandPass {
		messages = append(messages, "buy_drift")
	}
	if band := bandByMin(minLiquidity, th.MinStopLiquidityRetainedPct); band != ValidationBandPass {
		messages = append(messages, "liquidity_retention")
	}
	return messages
}

func checkpointMessagesPreSale(stale bool, sellDrift, retained float64, th RoutePlanValidationThresholds) []string {
	messages := []string{}
	if stale {
		messages = append(messages, "snapshot_stale")
	}
	if band := bandByMax(sellDrift, th.MaxSellDriftPct); band != ValidationBandPass {
		messages = append(messages, "sell_drift")
	}
	if band := bandByMin(retained, th.MinRouteProfitRetainedPct); band != ValidationBandPass {
		messages = append(messages, "profit_retained")
	}
	return messages
}

func pctDeltaUp(base, current float64) float64 {
	if base <= 0 {
		if current > 0 {
			return 100
		}
		return 0
	}
	return ((current - base) / base) * 100
}

func pctDeltaDown(base, current float64) float64 {
	if base <= 0 {
		return 0
	}
	if current >= base {
		return 0
	}
	return ((base - current) / base) * 100
}

func retainedPct(base, current float64) float64 {
	if base <= 0 {
		return 100
	}
	return (current / base) * 100
}

func bandByMax(actual, threshold float64) ValidationBand {
	if threshold <= 0 {
		return ValidationBandPass
	}
	if actual <= threshold {
		return ValidationBandPass
	}
	if actual <= threshold*1.2 {
		return ValidationBandWarn
	}
	return ValidationBandFail
}

func bandByMin(actual, threshold float64) ValidationBand {
	if threshold <= 0 {
		return ValidationBandPass
	}
	if actual >= threshold {
		return ValidationBandPass
	}
	if actual >= threshold*0.8 {
		return ValidationBandWarn
	}
	return ValidationBandFail
}

func maxBand(a, b ValidationBand) ValidationBand {
	order := map[ValidationBand]int{ValidationBandPass: 0, ValidationBandWarn: 1, ValidationBandFail: 2}
	if order[b] > order[a] {
		return b
	}
	return a
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
