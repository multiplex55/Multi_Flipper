package engine

import (
	"fmt"
	"math"
	"sort"
)

func filterAdditionsByFinalSell(lines []BatchCreateRouteLine, finalSellLocationID int64) []BatchCreateRouteLine {
	filtered := make([]BatchCreateRouteLine, 0, len(lines))
	for _, line := range lines {
		if line.Units <= 0 || line.UnitVolumeM3 <= 0 || line.ProfitTotalISK <= 0 {
			continue
		}
		if finalSellLocationID > 0 && line.SellLocationID != finalSellLocationID {
			continue
		}
		filtered = append(filtered, line)
	}
	return filtered
}

func fitAdditionsToRemainingCargo(lines []BatchCreateRouteLine, remainingCapacityM3 float64) []BatchCreateRouteLine {
	if remainingCapacityM3 <= 0 {
		return nil
	}

	fitted := make([]BatchCreateRouteLine, 0, len(lines))
	usedVolume := 0.0
	for _, line := range lines {
		if line.Units <= 0 || line.UnitVolumeM3 <= 0 {
			continue
		}
		lineVol := float64(line.Units) * line.UnitVolumeM3
		if usedVolume+lineVol > remainingCapacityM3 {
			fitUnits := int64(math.Floor((remainingCapacityM3 - usedVolume) / line.UnitVolumeM3))
			if fitUnits <= 0 {
				continue
			}
			scale := float64(fitUnits) / float64(line.Units)
			line.Units = fitUnits
			line.BuyTotalISK *= scale
			line.SellTotalISK *= scale
			line.ProfitTotalISK *= scale
			lineVol = float64(line.Units) * line.UnitVolumeM3
		}
		usedVolume += lineVol
		fitted = append(fitted, line)
	}
	return fitted
}

func mergeBatchRouteCandidatePools(
	marketLines []BatchCreateRouteLine,
	cacheLines []BatchCreateRouteLine,
	baseLines []BatchCreateRouteLine,
) []BatchCreateRouteLine {
	seenBase := make(map[string]bool, len(baseLines))
	for _, line := range baseLines {
		seenBase[batchRouteTupleKey(line)] = true
	}

	mergedByTuple := make(map[string]BatchCreateRouteLine, len(marketLines)+len(cacheLines))
	for _, pool := range [][]BatchCreateRouteLine{marketLines, cacheLines} {
		for _, line := range pool {
			if line.Units <= 0 || line.UnitVolumeM3 <= 0 || line.ProfitTotalISK <= 0 {
				continue
			}
			key := batchRouteTupleKey(line)
			if seenBase[key] {
				continue
			}
			if existing, ok := mergedByTuple[key]; ok {
				totalUnits := float64(existing.Units + line.Units)
				if totalUnits > 0 {
					existing.FillConfidence = ((existing.FillConfidence * float64(existing.Units)) + (line.FillConfidence * float64(line.Units))) / totalUnits
					existing.CapitalLockup = ((existing.CapitalLockup * float64(existing.Units)) + (line.CapitalLockup * float64(line.Units))) / totalUnits
					existing.StaleRisk = ((existing.StaleRisk * float64(existing.Units)) + (line.StaleRisk * float64(line.Units))) / totalUnits
					existing.Concentration = ((existing.Concentration * float64(existing.Units)) + (line.Concentration * float64(line.Units))) / totalUnits
				}
				existing.Units += line.Units
				existing.BuyTotalISK += line.BuyTotalISK
				existing.SellTotalISK += line.SellTotalISK
				existing.ProfitTotalISK += line.ProfitTotalISK
				if existing.RouteJumps == 0 || (line.RouteJumps > 0 && line.RouteJumps < existing.RouteJumps) {
					existing.RouteJumps = line.RouteJumps
				}
				mergedByTuple[key] = existing
				continue
			}
			mergedByTuple[key] = line
		}
	}

	merged := make([]BatchCreateRouteLine, 0, len(mergedByTuple))
	for _, line := range mergedByTuple {
		merged = append(merged, line)
	}
	sort.SliceStable(merged, func(i, j int) bool {
		return batchRouteLineLess(merged[i], merged[j])
	})
	return merged
}

func batchRouteTupleKey(line BatchCreateRouteLine) string {
	return fmt.Sprintf("%d|%d|%d|%d|%d", line.TypeID, line.BuySystemID, line.BuyLocationID, line.SellSystemID, line.SellLocationID)
}

func batchRouteLineLess(left, right BatchCreateRouteLine) bool {
	if left.ProfitTotalISK != right.ProfitTotalISK {
		return left.ProfitTotalISK > right.ProfitTotalISK
	}
	if left.RouteJumps != right.RouteJumps {
		return left.RouteJumps < right.RouteJumps
	}
	if left.TypeID != right.TypeID {
		return left.TypeID < right.TypeID
	}
	if left.BuySystemID != right.BuySystemID {
		return left.BuySystemID < right.BuySystemID
	}
	if left.BuyLocationID != right.BuyLocationID {
		return left.BuyLocationID < right.BuyLocationID
	}
	if left.SellSystemID != right.SellSystemID {
		return left.SellSystemID < right.SellSystemID
	}
	return left.SellLocationID < right.SellLocationID
}

func mergeBaseAndAdditions(baseLines, additionLines []BatchCreateRouteLine) []BatchCreateRouteLine {
	merged := make([]BatchCreateRouteLine, 0, len(baseLines)+len(additionLines))
	byType := make(map[int32]int, len(baseLines)+len(additionLines))

	merge := func(line BatchCreateRouteLine) {
		idx, exists := byType[line.TypeID]
		if !exists {
			byType[line.TypeID] = len(merged)
			merged = append(merged, line)
			return
		}
		existing := &merged[idx]
		totalUnits := float64(existing.Units + line.Units)
		if totalUnits > 0 {
			existing.FillConfidence = ((existing.FillConfidence * float64(existing.Units)) + (line.FillConfidence * float64(line.Units))) / totalUnits
			existing.CapitalLockup = ((existing.CapitalLockup * float64(existing.Units)) + (line.CapitalLockup * float64(line.Units))) / totalUnits
			existing.StaleRisk = ((existing.StaleRisk * float64(existing.Units)) + (line.StaleRisk * float64(line.Units))) / totalUnits
			existing.Concentration = ((existing.Concentration * float64(existing.Units)) + (line.Concentration * float64(line.Units))) / totalUnits
		}
		existing.Units += line.Units
		existing.BuyTotalISK += line.BuyTotalISK
		existing.SellTotalISK += line.SellTotalISK
		existing.ProfitTotalISK += line.ProfitTotalISK
		if existing.RouteJumps == 0 || (line.RouteJumps > 0 && line.RouteJumps < existing.RouteJumps) {
			existing.RouteJumps = line.RouteJumps
		}
		if existing.BuySystemID != line.BuySystemID {
			existing.BuySystemID = 0
		}
		if existing.SellSystemID != line.SellSystemID {
			existing.SellSystemID = 0
		}
		if existing.BuyLocationID != line.BuyLocationID {
			existing.BuyLocationID = 0
		}
		if existing.SellLocationID != line.SellLocationID {
			existing.SellLocationID = 0
		}
	}

	for _, line := range baseLines {
		merge(line)
	}
	for _, line := range additionLines {
		merge(line)
	}

	sort.Slice(merged, func(i, j int) bool {
		if merged[i].TypeID == merged[j].TypeID {
			return merged[i].TypeName < merged[j].TypeName
		}
		return merged[i].TypeID < merged[j].TypeID
	})
	return merged
}

func rankRouteOptions(options []BatchCreateRouteOption, addedProfitByOptionID map[string]float64, cargoLimitM3 float64, scoring RouteExecutionScoringConfig) []BatchCreateRouteOption {
	ranked := append([]BatchCreateRouteOption(nil), options...)
	applyExecutionScoring(ranked, cargoLimitM3, scoring)
	for i := range ranked {
		classifyRouteOptionLines(&ranked[i])
	}
	sortByExecutionScore(ranked, addedProfitByOptionID, cargoLimitM3)
	markRecommendedRouteOption(ranked)
	return ranked
}
