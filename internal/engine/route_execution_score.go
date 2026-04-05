package engine

import (
	"fmt"
	"math"
	"sort"
)

type RouteExecutionScoreWeights struct {
	NetProfit         float64 `json:"net_profit"`
	ISKPerJump        float64 `json:"isk_per_jump"`
	CargoUtilization  float64 `json:"cargo_utilization"`
	StopPenalty       float64 `json:"stop_penalty"`
	CapitalRequired   float64 `json:"capital_required"`
	DetourPenalty     float64 `json:"detour_penalty"`
	FillConfidence    float64 `json:"fill_confidence"`
	ConcentrationRisk float64 `json:"concentration_risk"`
	StaleRisk         float64 `json:"stale_risk"`
}

type RouteExecutionScoringConfig struct {
	Preset            string                      `json:"preset,omitempty"`
	UtilizationTarget float64                     `json:"utilization_target,omitempty"`
	Weights           *RouteExecutionScoreWeights `json:"weights,omitempty"`
}

type RouteScoreFactorBreakdown struct {
	Key            string  `json:"key"`
	Label          string  `json:"label"`
	RawValue       float64 `json:"raw_value"`
	Normalized     float64 `json:"normalized"`
	Weight         float64 `json:"weight"`
	Contribution   float64 `json:"contribution"`
	HigherIsBetter bool    `json:"higher_is_better"`
}

const (
	routeExecutionPresetConservative = "conservative"
	routeExecutionPresetBalanced     = "balanced"
	routeExecutionPresetAggressive   = "aggressive"
	routeExecutionPresetMaxFill      = "max_fill"
	routeExecutionPresetLegacy       = "practical-hauling"
)

func routeExecutionPresetConfig(name string) RouteExecutionScoringConfig {
	switch name {
	case routeExecutionPresetConservative:
		return RouteExecutionScoringConfig{
			Preset:            routeExecutionPresetConservative,
			UtilizationTarget: 0.58,
			Weights: &RouteExecutionScoreWeights{
				NetProfit:         0.8,
				ISKPerJump:        1.3,
				CargoUtilization:  0.6,
				StopPenalty:       1.7,
				CapitalRequired:   1.2,
				DetourPenalty:     1.0,
				FillConfidence:    1.8,
				ConcentrationRisk: 1.4,
				StaleRisk:         1.4,
			},
		}
	case routeExecutionPresetAggressive:
		return RouteExecutionScoringConfig{
			Preset:            routeExecutionPresetAggressive,
			UtilizationTarget: 0.78,
			Weights: &RouteExecutionScoreWeights{
				NetProfit:         1.5,
				ISKPerJump:        1.7,
				CargoUtilization:  1.0,
				StopPenalty:       0.9,
				CapitalRequired:   0.6,
				DetourPenalty:     0.7,
				FillConfidence:    0.8,
				ConcentrationRisk: 0.5,
				StaleRisk:         0.5,
			},
		}
	case routeExecutionPresetMaxFill:
		return RouteExecutionScoringConfig{
			Preset:            routeExecutionPresetMaxFill,
			UtilizationTarget: 0.95,
			Weights: &RouteExecutionScoreWeights{
				NetProfit:         1.1,
				ISKPerJump:        1.2,
				CargoUtilization:  2.0,
				StopPenalty:       0.8,
				CapitalRequired:   0.6,
				DetourPenalty:     0.7,
				FillConfidence:    1.0,
				ConcentrationRisk: 0.5,
				StaleRisk:         0.5,
			},
		}
	case routeExecutionPresetLegacy, routeExecutionPresetBalanced, "":
		fallthrough
	default:
		return RouteExecutionScoringConfig{
			Preset:            routeExecutionPresetBalanced,
			UtilizationTarget: 0.68,
			Weights: &RouteExecutionScoreWeights{
				NetProfit:         1.0,
				ISKPerJump:        1.5,
				CargoUtilization:  0.8,
				StopPenalty:       1.2,
				CapitalRequired:   0.8,
				DetourPenalty:     0.9,
				FillConfidence:    1.2,
				ConcentrationRisk: 0.9,
				StaleRisk:         0.9,
			},
		}
	}
}

func resolveRouteExecutionScoring(input RouteExecutionScoringConfig) RouteExecutionScoringConfig {
	cfg := routeExecutionPresetConfig(input.Preset)
	if input.UtilizationTarget > 0 {
		cfg.UtilizationTarget = input.UtilizationTarget
	}
	if input.Weights != nil {
		cfg.Weights = input.Weights
	}
	if cfg.Weights == nil {
		cfg.Weights = routeExecutionPresetConfig(routeExecutionPresetBalanced).Weights
	}
	return cfg
}

func applyExecutionScoring(options []BatchCreateRouteOption, cargoLimitM3 float64, scoring RouteExecutionScoringConfig) {
	if len(options) == 0 {
		return
	}
	cfg := resolveRouteExecutionScoring(scoring)
	weights := cfg.Weights
	if weights == nil {
		return
	}

	type metricSet struct {
		profit      float64
		iskPerJump  float64
		util        float64
		stopCount   float64
		capitalReq  float64
		detour      float64
		fillConf    float64
		concentRisk float64
		staleRisk   float64
		riskCount   float64
		weakestQual float64
		routeConf   float64
		dailyProxy  float64
	}
	metrics := make([]metricSet, len(options))
	profitVals := make([]float64, len(options))
	iskJumpVals := make([]float64, len(options))
	utilVals := make([]float64, len(options))
	stopVals := make([]float64, len(options))
	capitalVals := make([]float64, len(options))
	detourVals := make([]float64, len(options))
	fillVals := make([]float64, len(options))
	concVals := make([]float64, len(options))
	staleVals := make([]float64, len(options))
	riskCountVals := make([]float64, len(options))
	weakestVals := make([]float64, len(options))
	dailyProxyVals := make([]float64, len(options))

	for i, opt := range options {
		stopKeys := map[string]struct{}{}
		fillSum := 0.0
		concSum := 0.0
		staleSum := 0.0
		riskCount := 0
		weakestQual := 1.0
		lineCount := float64(len(opt.Lines))
		for _, line := range opt.Lines {
			stopKeys[fmt.Sprintf("%d|%d", line.BuySystemID, line.BuyLocationID)] = struct{}{}
			stopKeys[fmt.Sprintf("%d|%d", line.SellSystemID, line.SellLocationID)] = struct{}{}
			fillSum += clampUnit(line.FillConfidence)
			concSum += clampUnit(line.Concentration)
			staleSum += clampUnit(line.StaleRisk)
			lineQuality := clampUnit((0.65 * clampUnit(line.FillConfidence)) + (0.2 * (1 - clampUnit(line.StaleRisk))) + (0.15 * (1 - clampUnit(line.Concentration))))
			if lineQuality < weakestQual {
				weakestQual = lineQuality
			}
			if clampUnit(line.FillConfidence) < 0.45 {
				riskCount++
			}
			if clampUnit(line.StaleRisk) > 0.65 {
				riskCount++
			}
			if clampUnit(line.Concentration) > 0.65 {
				riskCount++
			}
		}
		util := 0.0
		if cargoLimitM3 > 0 {
			util = clampUnit(opt.AddedVolumeM3 / cargoLimitM3)
		}
		fill := 0.0
		conc := 0.0
		stale := 0.0
		if lineCount > 0 {
			fill = fillSum / lineCount
			conc = concSum / lineCount
			stale = staleSum / lineCount
		} else {
			weakestQual = 0
		}
		routeConf := clampUnit((0.55 * fill) + (0.25 * (1 - stale)) + (0.20 * (1 - conc)))
		dailyProxy := opt.ISKPerJump * routeConf
		detour := 0.0
		if opt.TotalJumps > 0 {
			detour = float64(opt.TotalJumps)
		}
		m := metricSet{
			profit:      opt.TotalProfitISK,
			iskPerJump:  opt.ISKPerJump,
			util:        util,
			stopCount:   float64(len(stopKeys)),
			capitalReq:  opt.TotalBuyISK,
			detour:      detour,
			fillConf:    fill,
			concentRisk: conc,
			staleRisk:   stale,
			riskCount:   float64(riskCount),
			weakestQual: weakestQual,
			routeConf:   routeConf,
			dailyProxy:  dailyProxy,
		}
		metrics[i] = m
		profitVals[i] = m.profit
		iskJumpVals[i] = m.iskPerJump
		utilVals[i] = m.util
		stopVals[i] = m.stopCount
		capitalVals[i] = m.capitalReq
		detourVals[i] = m.detour
		fillVals[i] = m.fillConf
		concVals[i] = m.concentRisk
		staleVals[i] = m.staleRisk
		riskCountVals[i] = m.riskCount
		weakestVals[i] = m.weakestQual
		dailyProxyVals[i] = m.dailyProxy
	}
	minProfit, maxProfit := minMax(profitVals)
	minISKJump, maxISKJump := minMax(iskJumpVals)
	minStop, maxStop := minMax(stopVals)
	minCap, maxCap := minMax(capitalVals)
	minDetour, maxDetour := minMax(detourVals)
	minFill, maxFill := minMax(fillVals)
	minConc, maxConc := minMax(concVals)
	minStale, maxStale := minMax(staleVals)
	minRiskCount, maxRiskCount := minMax(riskCountVals)
	minDailyProxy, maxDailyProxy := minMax(dailyProxyVals)
	targetUtil := clampUnit(cfg.UtilizationTarget)

	for i := range options {
		m := metrics[i]
		utilNorm := 1 - math.Min(1, math.Abs(m.util-targetUtil)/math.Max(0.1, targetUtil))
		factors := []RouteScoreFactorBreakdown{
			makeScoreFactor("net_profit", "Net profit", m.profit, normalizedRange(m.profit, minProfit, maxProfit), weights.NetProfit, true),
			makeScoreFactor("isk_per_jump", "ISK per jump", m.iskPerJump, normalizedRange(m.iskPerJump, minISKJump, maxISKJump), weights.ISKPerJump, true),
			makeScoreFactor("cargo_utilization", "Cargo utilization", m.util, utilNorm, weights.CargoUtilization, true),
			makeScoreFactor("stop_penalty", "Stop penalty", m.stopCount, normalizedRange(m.stopCount, minStop, maxStop), weights.StopPenalty, false),
			makeScoreFactor("capital_required", "Capital required", m.capitalReq, normalizedRange(m.capitalReq, minCap, maxCap), weights.CapitalRequired, false),
			makeScoreFactor("detour_penalty", "Detour penalty", m.detour, normalizedRange(m.detour, minDetour, maxDetour), weights.DetourPenalty, false),
			makeScoreFactor("fill_confidence", "Fill confidence", m.fillConf, normalizedRange(m.fillConf, minFill, maxFill), weights.FillConfidence, true),
			makeScoreFactor("concentration_risk", "Concentration risk", m.concentRisk, normalizedRange(m.concentRisk, minConc, maxConc), weights.ConcentrationRisk, false),
			makeScoreFactor("stale_risk", "Stale risk", m.staleRisk, normalizedRange(m.staleRisk, minStale, maxStale), weights.StaleRisk, false),
		}
		totalAbsWeight := 0.0
		total := 0.0
		for _, factor := range factors {
			total += factor.Contribution
			totalAbsWeight += math.Abs(factor.Weight)
		}
		score := 50.0
		if totalAbsWeight > 0 {
			score = ((total / totalAbsWeight) + 1) * 50.0
		}
		options[i].ExecutionScore = math.Max(0, math.Min(100, score))
		options[i].ScoreBreakdown = factors

		recommendationFactors := routeRecommendationFactors{
			ExecutionNorm:        clampUnit(options[i].ExecutionScore / 100),
			RouteConfidence:      m.routeConf,
			DailyISKJumpNorm:     normalizedRange(m.dailyProxy, minDailyProxy, maxDailyProxy),
			WeakestQuality:       normalizedRange(m.weakestQual, minWeakest(weakestVals), maxWeakest(weakestVals)),
			RiskCountNorm:        normalizedRange(m.riskCount, minRiskCount, maxRiskCount),
			StopCountNorm:        normalizedRange(m.stopCount, minStop, maxStop),
			UtilizationAlignment: utilNorm,
			AvgFill:              m.fillConf,
			AvgStale:             m.staleRisk,
			AvgConcentration:     m.concentRisk,
			RiskCount:            int(m.riskCount),
			StopCount:            int(m.stopCount),
		}
		recommendationRaw := (0.30 * recommendationFactors.ExecutionNorm) +
			(0.20 * recommendationFactors.RouteConfidence) +
			(0.20 * recommendationFactors.DailyISKJumpNorm) +
			(0.15 * recommendationFactors.WeakestQuality) +
			(0.10 * recommendationFactors.UtilizationAlignment) -
			(0.03 * recommendationFactors.RiskCountNorm) -
			(0.02 * recommendationFactors.StopCountNorm)
		options[i].RecommendationScore = math.Max(0, math.Min(100, recommendationRaw*100))
		options[i].ReasonChips, options[i].WarningChips = buildRouteReasonChips(recommendationFactors)
	}
}

func minWeakest(values []float64) float64 {
	minVal, _ := minMax(values)
	return minVal
}

func maxWeakest(values []float64) float64 {
	_, maxVal := minMax(values)
	return maxVal
}

func makeScoreFactor(key, label string, raw, norm, weight float64, higherIsBetter bool) RouteScoreFactorBreakdown {
	contrib := norm * weight
	if !higherIsBetter {
		contrib = -contrib
	}
	return RouteScoreFactorBreakdown{
		Key:            key,
		Label:          label,
		RawValue:       raw,
		Normalized:     norm,
		Weight:         weight,
		Contribution:   contrib,
		HigherIsBetter: higherIsBetter,
	}
}

func clampUnit(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}

func minMax(values []float64) (float64, float64) {
	if len(values) == 0 {
		return 0, 0
	}
	minVal, maxVal := values[0], values[0]
	for _, v := range values[1:] {
		if v < minVal {
			minVal = v
		}
		if v > maxVal {
			maxVal = v
		}
	}
	return minVal, maxVal
}

func normalizedRange(value, minVal, maxVal float64) float64 {
	if maxVal <= minVal {
		if maxVal <= 0 {
			return 0
		}
		return 1
	}
	return clampUnit((value - minVal) / (maxVal - minVal))
}

func sortByExecutionScore(ranked []BatchCreateRouteOption, addedProfitByOptionID map[string]float64, cargoLimitM3 float64) {
	profitPerJump := func(opt BatchCreateRouteOption) float64 {
		if opt.TotalJumps <= 0 {
			return 0
		}
		return opt.TotalProfitISK / float64(opt.TotalJumps)
	}
	cargoUtil := func(opt BatchCreateRouteOption) float64 {
		if cargoLimitM3 <= 0 {
			return 0
		}
		return opt.AddedVolumeM3 / cargoLimitM3
	}
	sort.SliceStable(ranked, func(i, j int) bool {
		left, right := ranked[i], ranked[j]
		if left.ExecutionScore != right.ExecutionScore {
			return left.ExecutionScore > right.ExecutionScore
		}
		leftAdded := addedProfitByOptionID[left.OptionID]
		rightAdded := addedProfitByOptionID[right.OptionID]
		if leftAdded != rightAdded {
			return leftAdded > rightAdded
		}
		leftPPJ := profitPerJump(left)
		rightPPJ := profitPerJump(right)
		if leftPPJ != rightPPJ {
			return leftPPJ > rightPPJ
		}
		leftCargoUtil := cargoUtil(left)
		rightCargoUtil := cargoUtil(right)
		if leftCargoUtil != rightCargoUtil {
			return leftCargoUtil > rightCargoUtil
		}
		if left.TotalJumps != right.TotalJumps {
			return left.TotalJumps < right.TotalJumps
		}
		return left.OptionID < right.OptionID
	})
}

func markRecommendedRouteOption(ranked []BatchCreateRouteOption) {
	if len(ranked) == 0 {
		return
	}
	bestIdx := 0
	for i := 1; i < len(ranked); i++ {
		left := ranked[i]
		right := ranked[bestIdx]
		if left.RecommendationScore > right.RecommendationScore ||
			(left.RecommendationScore == right.RecommendationScore && left.ExecutionScore > right.ExecutionScore) ||
			(left.RecommendationScore == right.RecommendationScore && left.ExecutionScore == right.ExecutionScore && left.TotalJumps < right.TotalJumps) ||
			(left.RecommendationScore == right.RecommendationScore && left.ExecutionScore == right.ExecutionScore && left.TotalJumps == right.TotalJumps && left.OptionID < right.OptionID) {
			bestIdx = i
		}
	}
	for i := range ranked {
		ranked[i].Recommended = i == bestIdx
	}
}
