package engine

import "fmt"

type routeRecommendationFactors struct {
	ExecutionNorm        float64
	RouteConfidence      float64
	DailyISKJumpNorm     float64
	WeakestQuality       float64
	RiskCountNorm        float64
	StopCountNorm        float64
	UtilizationAlignment float64
	AvgFill              float64
	AvgStale             float64
	AvgConcentration     float64
	RiskCount            int
	StopCount            int
}

func buildRouteReasonChips(f routeRecommendationFactors) ([]string, []string) {
	positives := make([]string, 0, 4)
	warnings := make([]string, 0, 3)

	if f.DailyISKJumpNorm >= 0.65 {
		positives = append(positives, "High ISK/jump")
	}
	if f.AvgStale <= 0.35 {
		positives = append(positives, "Low stale risk")
	}
	if f.RouteConfidence >= 0.65 || f.AvgFill >= 0.70 {
		positives = append(positives, "Good fill confidence")
	}
	if f.StopCount > 0 && f.StopCount <= 2 {
		positives = append(positives, fmt.Sprintf("Only %d stops", f.StopCount))
	} else if f.StopCount > 0 && f.StopCount <= 4 {
		positives = append(positives, "Compact stop count")
	}
	if f.UtilizationAlignment >= 0.70 {
		positives = append(positives, "Cargo utilized well")
	}
	if f.ExecutionNorm >= 0.75 {
		positives = append(positives, "Strong execution score")
	}
	if f.WeakestQuality >= 0.70 {
		positives = append(positives, "Consistent line quality")
	}

	if f.AvgFill <= 0.45 || f.RouteConfidence <= 0.45 {
		warnings = append(warnings, "Thin fill")
	}
	if f.AvgConcentration >= 0.65 {
		warnings = append(warnings, "High concentration")
	}
	if f.AvgStale >= 0.60 {
		warnings = append(warnings, "Stale quote risk")
	}
	if f.RiskCountNorm >= 0.65 || f.RiskCount >= 3 {
		warnings = append(warnings, "Elevated risk flags")
	}
	if f.StopCountNorm >= 0.75 || f.StopCount >= 6 {
		warnings = append(warnings, "High stop burden")
	}

	if len(positives) < 2 {
		positives = append(positives, "Balanced route profile")
	}
	if len(positives) > 4 {
		positives = positives[:4]
	}

	return positives, warnings
}
