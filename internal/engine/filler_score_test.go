package engine

import "testing"

func TestComputeFillerScore_ConservativePrefersSaferFiller(t *testing.T) {
	safeLine := BatchCreateRouteLine{
		ProfitTotalISK: 80_000,
		BuyTotalISK:    20_000_000,
		RouteJumps:     5,
		FillConfidence: 0.92,
		StaleRisk:      0.10,
		Concentration:  0.15,
		UnitVolumeM3:   12,
	}
	riskyLine := BatchCreateRouteLine{
		ProfitTotalISK: 140_000,
		BuyTotalISK:    160_000_000,
		RouteJumps:     9,
		FillConfidence: 0.42,
		StaleRisk:      0.72,
		Concentration:  0.68,
		UnitVolumeM3:   12,
	}

	safeScore := computeFillerScore(safeLine, RouteExecutionScoringConfig{Preset: routeExecutionPresetConservative})
	riskyScore := computeFillerScore(riskyLine, RouteExecutionScoringConfig{Preset: routeExecutionPresetConservative})
	if safeScore <= riskyScore {
		t.Fatalf("conservative should prefer safe filler: safe=%.2f risky=%.2f", safeScore, riskyScore)
	}
}

func TestComputeFillerScore_AggressiveRaisesMarginalFillers(t *testing.T) {
	marginal := BatchCreateRouteLine{
		ProfitTotalISK: 120_000,
		BuyTotalISK:    110_000_000,
		RouteJumps:     8,
		FillConfidence: 0.50,
		StaleRisk:      0.52,
		Concentration:  0.55,
		UnitVolumeM3:   15,
	}

	conservativeScore := computeFillerScore(marginal, RouteExecutionScoringConfig{Preset: routeExecutionPresetConservative})
	aggressiveScore := computeFillerScore(marginal, RouteExecutionScoringConfig{Preset: routeExecutionPresetAggressive})
	if aggressiveScore <= conservativeScore {
		t.Fatalf("aggressive should raise marginal filler score: aggr=%.2f conservative=%.2f", aggressiveScore, conservativeScore)
	}
}

func TestComputeFillerScore_MaxFillBoostsUtilizationPreference(t *testing.T) {
	line := BatchCreateRouteLine{
		ProfitTotalISK: 70_000,
		BuyTotalISK:    35_000_000,
		RouteJumps:     6,
		FillConfidence: 0.70,
		StaleRisk:      0.20,
		Concentration:  0.25,
		UnitVolumeM3:   48,
	}

	balancedScore := computeFillerScore(line, RouteExecutionScoringConfig{Preset: routeExecutionPresetBalanced})
	maxFillScore := computeFillerScore(line, RouteExecutionScoringConfig{Preset: routeExecutionPresetMaxFill})
	if maxFillScore <= balancedScore {
		t.Fatalf("max_fill should prefer utilization-heavy fillers: max_fill=%.2f balanced=%.2f", maxFillScore, balancedScore)
	}
}
