package engine

import "math"

// computeFillerScore emphasizes operational safety and burden over raw profit.
func computeFillerScore(line BatchCreateRouteLine, config RouteExecutionScoringConfig) float64 {
	cfg := resolveRouteExecutionScoring(config)
	weights := cfg.Weights
	if weights == nil {
		return 0
	}

	routeJumps := math.Max(1, float64(line.RouteJumps))
	profitDensity := 0.0
	if line.ProfitTotalISK > 0 {
		profitDensity = line.ProfitTotalISK / routeJumps
	}
	profitNorm := 1 - math.Exp(-profitDensity/100_000.0)
	capitalBurden := 0.0
	if line.BuyTotalISK > 0 {
		capitalBurden = 1 - math.Exp(-line.BuyTotalISK/250_000_000.0)
	}
	stopBurden := 1 - math.Exp(-(routeJumps-1)/8.0)
	utilSignal := clampUnit(line.UnitVolumeM3 / 50.0)

	safety := (0.55 * clampUnit(line.FillConfidence)) +
		(0.20 * (1 - clampUnit(line.StaleRisk))) +
		(0.25 * (1 - clampUnit(line.Concentration)))
	burden := (0.45 * stopBurden) + (0.55 * capitalBurden)
	utilTargetBonus := 1 - math.Min(1, math.Abs(utilSignal-clampUnit(cfg.UtilizationTarget))/math.Max(0.1, clampUnit(cfg.UtilizationTarget)))

	raw := (2.25 * safety) +
		(0.55 * utilTargetBonus) +
		(0.35 * profitNorm) -
		(weights.StopPenalty * burden) -
		(weights.CapitalRequired * capitalBurden) -
		(weights.StaleRisk * clampUnit(line.StaleRisk)) -
		(weights.ConcentrationRisk * clampUnit(line.Concentration))

	return math.Max(0, math.Min(100, ((raw+2.0)/4.0)*100.0))
}
