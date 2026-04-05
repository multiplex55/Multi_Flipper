package engine

import "math"

const (
	routeLineRoleCore          = "core"
	routeLineRoleSafeFiller    = "safe_filler"
	routeLineRoleStretchFiller = "stretch_filler"
)

// Deterministic thresholds used for line classification.
const (
	lineRoleCoreContributionProfitThreshold   = 0.25
	lineRoleCoreContributionISKJumpThreshold  = 0.25
	lineRoleCoreExecutionScoreThreshold       = 75.0
	lineRoleSafeFillerExecutionScoreThreshold = 35.0
	lineRoleSafeFillerRiskBurdenThreshold     = 0.55
	lineRoleSafeFillerFillConfidenceThreshold = 0.45
)

type routeLineClassificationMetrics struct {
	contributionProfitPct  float64
	contributionISKJumpPct float64
	stopComplexityProxy    float64
	capitalBurden          float64
	riskBurden             float64
}

func classifyRouteOptionLines(option *BatchCreateRouteOption, config RouteExecutionScoringConfig) {
	if option == nil {
		return
	}
	option.CoreLineCount = 0
	option.SafeFillerLineCount = 0
	option.StretchFillerLineCount = 0
	option.CoreProfitTotalISK = 0
	option.SafeFillerProfitISK = 0
	option.StretchFillerProfitISK = 0

	for i := range option.Lines {
		line := &option.Lines[i]
		metrics := computeRouteLineClassificationMetrics(*line, *option)
		line.LineExecutionScore = computeRouteLineExecutionScore(*line, metrics, option.ExecutionScore)
		line.LineRole = determineRouteLineRole(*line, metrics, config)

		switch line.LineRole {
		case routeLineRoleCore:
			option.CoreLineCount++
			option.CoreProfitTotalISK += line.ProfitTotalISK
		case routeLineRoleSafeFiller:
			option.SafeFillerLineCount++
			option.SafeFillerProfitISK += line.ProfitTotalISK
		default:
			line.LineRole = routeLineRoleStretchFiller
			option.StretchFillerLineCount++
			option.StretchFillerProfitISK += line.ProfitTotalISK
		}
	}
}

func computeRouteLineClassificationMetrics(line BatchCreateRouteLine, option BatchCreateRouteOption) routeLineClassificationMetrics {
	profitContribution := 0.0
	if option.TotalProfitISK > 0 {
		profitContribution = clampUnit(line.ProfitTotalISK / option.TotalProfitISK)
	}
	lineISKJump := 0.0
	if line.RouteJumps > 0 {
		lineISKJump = line.ProfitTotalISK / float64(line.RouteJumps)
	}
	iskJumpContribution := 0.0
	if option.ISKPerJump > 0 {
		iskJumpContribution = clampUnit(lineISKJump / option.ISKPerJump)
	}
	stopComplexity := 1.0
	if line.BuySystemID == line.SellSystemID && line.BuyLocationID == line.SellLocationID {
		stopComplexity = 0.5
	}
	capitalBurden := 0.0
	if option.TotalBuyISK > 0 {
		capitalBurden = clampUnit(line.BuyTotalISK / option.TotalBuyISK)
	}
	riskBurden := clampUnit((clampUnit(line.StaleRisk) + clampUnit(line.Concentration)) / 2.0)
	return routeLineClassificationMetrics{
		contributionProfitPct:  profitContribution,
		contributionISKJumpPct: iskJumpContribution,
		stopComplexityProxy:    stopComplexity,
		capitalBurden:          capitalBurden,
		riskBurden:             riskBurden,
	}
}

func computeRouteLineExecutionScore(line BatchCreateRouteLine, metrics routeLineClassificationMetrics, optionExecutionScore float64) float64 {
	positive := 0.45*metrics.contributionProfitPct + 0.35*metrics.contributionISKJumpPct + 0.20*clampUnit(line.FillConfidence)
	negative := 0.25*metrics.capitalBurden + 0.20*metrics.riskBurden + 0.15*metrics.stopComplexityProxy
	baseScore := (positive - negative) * 100
	finalScore := (0.75 * baseScore) + (0.25 * optionExecutionScore)
	return math.Max(0, math.Min(100, finalScore))
}

func determineRouteLineRole(line BatchCreateRouteLine, metrics routeLineClassificationMetrics, config RouteExecutionScoringConfig) string {
	fillerScore := computeFillerScore(line, config)
	if metrics.contributionProfitPct >= lineRoleCoreContributionProfitThreshold ||
		(metrics.contributionISKJumpPct >= lineRoleCoreContributionISKJumpThreshold &&
			metrics.contributionProfitPct >= 0.20) ||
		(line.LineExecutionScore >= lineRoleCoreExecutionScoreThreshold &&
			clampUnit(line.FillConfidence) >= 0.65 &&
			metrics.riskBurden <= 0.45) {
		return routeLineRoleCore
	}
	if line.LineExecutionScore >= lineRoleSafeFillerExecutionScoreThreshold &&
		metrics.riskBurden <= lineRoleSafeFillerRiskBurdenThreshold &&
		clampUnit(line.FillConfidence) >= lineRoleSafeFillerFillConfidenceThreshold {
		return routeLineRoleSafeFiller
	}
	// Tie-break near-threshold fillers using dedicated filler scoring.
	if line.LineExecutionScore >= (lineRoleSafeFillerExecutionScoreThreshold-5) &&
		clampUnit(line.FillConfidence) >= 0.40 &&
		fillerScore >= 52 {
		return routeLineRoleSafeFiller
	}
	return routeLineRoleStretchFiller
}
