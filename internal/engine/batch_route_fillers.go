package engine

import (
	"context"
	"fmt"
	"math"
	"sort"
)

type BatchRouteFillerSuggestionParams struct {
	CargoLimitM3       float64
	BaseLines          []BatchCreateRouteLine
	SelectedLines      []BatchCreateRouteLine
	CandidateLines     []BatchRouteCandidateOpportunity
	CurrentSystemID    int32
	MinRouteSecurity   float64
	AllowLowsec        bool
	AllowNullsec       bool
	AllowWormhole      bool
	RouteMaxJumps      int
	ExecutionScoring   RouteExecutionScoringConfig
	MaxSuggestionsHint int
}

type BatchRouteFillerSuggestion struct {
	Line          BatchCreateRouteLine
	VolumeM3      float64
	FillerScore   float64
	SuggestedRole string
}

type BatchRouteFillerSuggestionResult struct {
	RemainingCapacityM3 float64
	Suggestions         []BatchRouteFillerSuggestion
}

func (s *Scanner) SuggestBatchRouteFillers(ctx context.Context, params BatchRouteFillerSuggestionParams) (BatchRouteFillerSuggestionResult, error) {
	result := BatchRouteFillerSuggestionResult{}
	if ctx != nil && ctx.Err() != nil {
		return result, ctx.Err()
	}
	if params.CargoLimitM3 <= 0 {
		return result, nil
	}
	usedVolume := 0.0
	for _, line := range params.BaseLines {
		if line.Units <= 0 || line.UnitVolumeM3 <= 0 {
			continue
		}
		usedVolume += float64(line.Units) * line.UnitVolumeM3
	}
	for _, line := range params.SelectedLines {
		if line.Units <= 0 || line.UnitVolumeM3 <= 0 {
			continue
		}
		usedVolume += float64(line.Units) * line.UnitVolumeM3
	}
	remaining := math.Max(0, params.CargoLimitM3-usedVolume)
	result.RemainingCapacityM3 = remaining
	if remaining <= 0 || len(params.CandidateLines) == 0 {
		return result, nil
	}

	routePolicy := batchRoutePolicy{
		MinSecurity:   params.MinRouteSecurity,
		AllowLowsec:   params.AllowLowsec,
		AllowNullsec:  params.AllowNullsec,
		AllowWormhole: params.AllowWormhole,
	}
	excluded := make(map[string]bool, len(params.BaseLines)+len(params.SelectedLines))
	for _, line := range params.BaseLines {
		excluded[batchRouteTupleKey(line)] = true
	}
	for _, line := range params.SelectedLines {
		excluded[batchRouteTupleKey(line)] = true
	}

	ranked := make([]BatchRouteFillerSuggestion, 0, len(params.CandidateLines))
	originSystemID := params.CurrentSystemID
	for _, candidate := range params.CandidateLines {
		if ctx != nil && ctx.Err() != nil {
			return result, ctx.Err()
		}
		if candidate.Units <= 0 || candidate.UnitVolumeM3 <= 0 {
			continue
		}
		line := BatchCreateRouteLine{
			TypeID:         candidate.TypeID,
			TypeName:       candidate.TypeName,
			Units:          candidate.Units,
			UnitVolumeM3:   candidate.UnitVolumeM3,
			BuySystemID:    candidate.BuySystemID,
			BuyLocationID:  candidate.BuyLocationID,
			SellSystemID:   candidate.SellSystemID,
			SellLocationID: candidate.SellLocationID,
			BuyTotalISK:    candidate.BuyPriceISK * float64(candidate.Units),
			SellTotalISK:   candidate.SellPriceISK * float64(candidate.Units),
			FillConfidence: clampUnit(candidate.FillConfidence),
			CapitalLockup:  clampUnit(candidate.CapitalLockup),
			StaleRisk:      clampUnit(candidate.StaleRisk),
			Concentration:  clampUnit(candidate.Concentration),
		}
		line.ProfitTotalISK = line.SellTotalISK - line.BuyTotalISK
		if line.ProfitTotalISK <= 0 {
			continue
		}
		if excluded[batchRouteTupleKey(line)] {
			continue
		}
		if s != nil {
			segmentA := 0
			if originSystemID > 0 {
				segmentA = s.jumpsBetweenWithRoutePolicy(originSystemID, line.BuySystemID, routePolicy)
				if segmentA == UnreachableJumps {
					continue
				}
			}
			segmentB := s.jumpsBetweenWithRoutePolicy(line.BuySystemID, line.SellSystemID, routePolicy)
			if segmentB == UnreachableJumps {
				continue
			}
			line.RouteJumps = segmentA + segmentB
			if params.RouteMaxJumps > 0 && line.RouteJumps > params.RouteMaxJumps {
				continue
			}
		}
		fillerScore := computeFillerScore(line, params.ExecutionScoring)
		role := routeLineRoleStretchFiller
		if fillerScore >= 78 && line.FillConfidence >= 0.70 && line.StaleRisk <= 0.30 {
			role = routeLineRoleCore
		} else if fillerScore >= 50 && line.FillConfidence >= 0.45 && line.StaleRisk <= 0.60 {
			role = routeLineRoleSafeFiller
		}
		ranked = append(ranked, BatchRouteFillerSuggestion{
			Line:          line,
			VolumeM3:      float64(line.Units) * line.UnitVolumeM3,
			FillerScore:   fillerScore,
			SuggestedRole: role,
		})
	}

	cfg := resolveRouteExecutionScoring(params.ExecutionScoring)
	minScore := 20.0
	switch cfg.Preset {
	case routeExecutionPresetConservative:
		minScore = 45
	case routeExecutionPresetAggressive, routeExecutionPresetMaxFill:
		minScore = 5
	}
	filtered := ranked[:0]
	for _, sug := range ranked {
		if sug.FillerScore >= minScore {
			filtered = append(filtered, sug)
		}
	}
	ranked = filtered

	sort.SliceStable(ranked, func(i, j int) bool {
		left := ranked[i]
		right := ranked[j]
		if left.FillerScore != right.FillerScore {
			return left.FillerScore > right.FillerScore
		}
		if left.Line.FillConfidence != right.Line.FillConfidence {
			return left.Line.FillConfidence > right.Line.FillConfidence
		}
		if left.Line.StaleRisk != right.Line.StaleRisk {
			return left.Line.StaleRisk < right.Line.StaleRisk
		}
		if left.Line.ProfitTotalISK != right.Line.ProfitTotalISK {
			return left.Line.ProfitTotalISK > right.Line.ProfitTotalISK
		}
		return batchRouteLineLess(left.Line, right.Line)
	})

	limit := params.MaxSuggestionsHint
	if limit <= 0 {
		switch cfg.Preset {
		case routeExecutionPresetConservative:
			limit = 5
		case routeExecutionPresetAggressive, routeExecutionPresetMaxFill:
			limit = 10
		default:
			limit = 7
		}
	}
	if limit > 10 {
		limit = 10
	}
	if limit < 1 {
		limit = 1
	}

	fitted := make([]BatchRouteFillerSuggestion, 0, min(limit, len(ranked)))
	used := 0.0
	for _, suggestion := range ranked {
		if len(fitted) >= limit {
			break
		}
		if suggestion.Line.UnitVolumeM3 <= 0 || suggestion.Line.Units <= 0 {
			continue
		}
		if used+suggestion.VolumeM3 > remaining {
			fitUnits := int64(math.Floor((remaining - used) / suggestion.Line.UnitVolumeM3))
			if fitUnits <= 0 {
				continue
			}
			scaled := suggestion
			scale := float64(fitUnits) / float64(suggestion.Line.Units)
			scaled.Line.Units = fitUnits
			scaled.Line.BuyTotalISK *= scale
			scaled.Line.SellTotalISK *= scale
			scaled.Line.ProfitTotalISK *= scale
			scaled.VolumeM3 = float64(fitUnits) * scaled.Line.UnitVolumeM3
			fitted = append(fitted, scaled)
			used += scaled.VolumeM3
			continue
		}
		fitted = append(fitted, suggestion)
		used += suggestion.VolumeM3
	}
	result.Suggestions = fitted
	return result, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s BatchRouteFillerSuggestion) DebugString() string {
	return fmt.Sprintf("%d:%d:%.2f", s.Line.TypeID, s.Line.Units, s.VolumeM3)
}
