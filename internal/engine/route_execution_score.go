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

func practicalHaulingScoringPreset() RouteExecutionScoringConfig {
	return RouteExecutionScoringConfig{
		Preset:            "practical-hauling",
		UtilizationTarget: 0.60,
		Weights: &RouteExecutionScoreWeights{
			NetProfit:         0.9,
			ISKPerJump:        1.5,
			CargoUtilization:  0.7,
			StopPenalty:       1.3,
			CapitalRequired:   0.8,
			DetourPenalty:     0.9,
			FillConfidence:    1.2,
			ConcentrationRisk: 0.7,
			StaleRisk:         0.7,
		},
	}
}

func resolveRouteExecutionScoring(input RouteExecutionScoringConfig) RouteExecutionScoringConfig {
	cfg := practicalHaulingScoringPreset()
	if input.Preset != "" {
		cfg.Preset = input.Preset
	}
	if input.UtilizationTarget > 0 {
		cfg.UtilizationTarget = input.UtilizationTarget
	}
	if input.Weights != nil {
		cfg.Weights = input.Weights
	}
	if cfg.Weights == nil {
		cfg.Weights = practicalHaulingScoringPreset().Weights
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

	for i, opt := range options {
		stopKeys := map[string]struct{}{}
		fillSum := 0.0
		concSum := 0.0
		staleSum := 0.0
		lineCount := float64(len(opt.Lines))
		for _, line := range opt.Lines {
			stopKeys[fmt.Sprintf("%d|%d", line.BuySystemID, line.BuyLocationID)] = struct{}{}
			stopKeys[fmt.Sprintf("%d|%d", line.SellSystemID, line.SellLocationID)] = struct{}{}
			fillSum += clampUnit(line.FillConfidence)
			concSum += clampUnit(line.Concentration)
			staleSum += clampUnit(line.StaleRisk)
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
		}
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
	}
	minProfit, maxProfit := minMax(profitVals)
	minISKJump, maxISKJump := minMax(iskJumpVals)
	minStop, maxStop := minMax(stopVals)
	minCap, maxCap := minMax(capitalVals)
	minDetour, maxDetour := minMax(detourVals)
	minFill, maxFill := minMax(fillVals)
	minConc, maxConc := minMax(concVals)
	minStale, maxStale := minMax(staleVals)
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
	}
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
