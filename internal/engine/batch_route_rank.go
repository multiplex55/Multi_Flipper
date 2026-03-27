package engine

import (
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

func rankRouteOptions(options []BatchCreateRouteOption, addedProfitByOptionID map[string]float64, cargoLimitM3 float64) []BatchCreateRouteOption {
	ranked := append([]BatchCreateRouteOption(nil), options...)
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
	routeKey := func(opt BatchCreateRouteOption) string {
		if opt.OptionID != "" {
			return opt.OptionID
		}
		return "~"
	}

	sort.SliceStable(ranked, func(i, j int) bool {
		left := ranked[i]
		right := ranked[j]

		if left.TotalProfitISK != right.TotalProfitISK {
			return left.TotalProfitISK > right.TotalProfitISK
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

		return routeKey(left) < routeKey(right)
	})
	return ranked
}
