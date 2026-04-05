package engine

import (
	"fmt"
	"math"
	"sort"
)

type corridorPlannerParams struct {
	RouteStops          []RouteSelectedStop
	OriginSystemID      int32
	CurrentSystemID     int32
	RemainingCapacityM3 float64
	CargoLimitM3        float64
	RouteMaxJumps       int
	RoutePolicy         batchRoutePolicy
}

type corridorLeg struct {
	line      BatchCreateRouteLine
	buyIdx    int
	sellIdx   int
	scoreHint float64
}

type corridorPlanner struct {
	params      corridorPlannerParams
	routeStops  []RouteSelectedStop
	idxByStop   map[string][]int
	startSystem int32
}

func newCorridorPlanner(params corridorPlannerParams) corridorPlanner {
	idxByStop := make(map[string][]int, len(params.RouteStops))
	for idx, stop := range params.RouteStops {
		key := fmt.Sprintf("%d|%d", stop.SystemID, stop.LocationID)
		idxByStop[key] = append(idxByStop[key], idx)
	}
	start := params.OriginSystemID
	if params.CurrentSystemID > 0 {
		start = params.CurrentSystemID
	}
	return corridorPlanner{params: params, routeStops: append([]RouteSelectedStop(nil), params.RouteStops...), idxByStop: idxByStop, startSystem: start}
}

func (p corridorPlanner) BuildOptions(scanner *Scanner, candidates []BatchCreateRouteLine) []BatchCreateRouteOption {
	legs := p.expandLegs(candidates)
	if len(legs) == 0 {
		return nil
	}
	type strategy struct {
		id   string
		sort func(left, right corridorLeg) bool
	}
	strategies := []strategy{
		{id: "max-total-profit", sort: func(left, right corridorLeg) bool {
			if left.line.ProfitTotalISK == right.line.ProfitTotalISK {
				return batchRouteLineLess(left.line, right.line)
			}
			return left.line.ProfitTotalISK > right.line.ProfitTotalISK
		}},
		{id: "max-isk-per-jump", sort: func(left, right corridorLeg) bool {
			l := left.line.ProfitTotalISK
			r := right.line.ProfitTotalISK
			if left.line.RouteJumps > 0 {
				l /= float64(left.line.RouteJumps)
			}
			if right.line.RouteJumps > 0 {
				r /= float64(right.line.RouteJumps)
			}
			if l == r {
				return batchRouteLineLess(left.line, right.line)
			}
			return l > r
		}},
		{id: "corridor-balanced", sort: func(left, right corridorLeg) bool {
			if left.scoreHint == right.scoreHint {
				return batchRouteLineLess(left.line, right.line)
			}
			return left.scoreHint > right.scoreHint
		}},
	}
	options := make([]BatchCreateRouteOption, 0, len(strategies))
	seen := map[string]bool{}
	for _, strat := range strategies {
		sorted := append([]corridorLeg(nil), legs...)
		sort.SliceStable(sorted, func(i, j int) bool { return strat.sort(sorted[i], sorted[j]) })
		selected := p.selectFeasible(sorted)
		if len(selected) == 0 {
			continue
		}
		option := BatchCreateRouteOption{OptionID: strat.id, Lines: make([]BatchCreateRouteLine, 0, len(selected))}
		sig := ""
		for _, leg := range selected {
			line := leg.line
			vol := float64(line.Units) * line.UnitVolumeM3
			option.Lines = append(option.Lines, line)
			option.AddedVolumeM3 += vol
			option.TotalBuyISK += line.BuyTotalISK
			option.TotalSellISK += line.SellTotalISK
			option.TotalProfitISK += line.ProfitTotalISK
			sig += fmt.Sprintf("%d:%d:%d:%d:%d|", line.TypeID, line.Units, leg.buyIdx, leg.sellIdx, line.SellLocationID)
		}
		if scanner != nil {
			jumps, orderedBuySystems, routeSequence, ok := scanner.computeRouteSequenceJumps(BatchCreateRouteParams{
				OriginSystemID:    p.params.OriginSystemID,
				CurrentSystemID:   p.params.CurrentSystemID,
				FinalSellSystemID: p.routeStops[len(p.routeStops)-1].SystemID,
			}, option.Lines, p.params.RoutePolicy)
			if ok {
				option.TotalJumps = jumps
				option.OrderedBuySystems = orderedBuySystems
				option.RouteSequence = routeSequence
			}
		}
		if p.params.RouteMaxJumps > 0 && option.TotalJumps > p.params.RouteMaxJumps {
			continue
		}
		if option.TotalJumps > 0 {
			option.ISKPerJump = option.TotalProfitISK / float64(option.TotalJumps)
		}
		if seen[sig] {
			continue
		}
		seen[sig] = true
		options = append(options, option)
	}
	return options
}

func (p corridorPlanner) expandLegs(candidates []BatchCreateRouteLine) []corridorLeg {
	legs := make([]corridorLeg, 0, len(candidates))
	for _, line := range candidates {
		buySeq := p.idxByStop[fmt.Sprintf("%d|%d", line.BuySystemID, line.BuyLocationID)]
		sellSeq := p.idxByStop[fmt.Sprintf("%d|%d", line.SellSystemID, line.SellLocationID)]
		buyIdx, sellIdx, ok := firstOrderedPair(buySeq, sellSeq)
		if !ok { // no sell-after-buy on the selected route sequence
			continue
		}
		score := line.ProfitTotalISK
		if line.RouteJumps > 0 {
			score += line.ProfitTotalISK / float64(line.RouteJumps)
		}
		score += line.FillConfidence * 1000
		score -= line.CapitalLockup * 10
		score -= line.StaleRisk * 500
		score -= line.Concentration * 300
		legs = append(legs, corridorLeg{line: line, buyIdx: buyIdx, sellIdx: sellIdx, scoreHint: score})
	}
	return legs
}

func firstOrderedPair(buys, sells []int) (int, int, bool) {
	for _, b := range buys {
		for _, s := range sells {
			if s > b {
				return b, s, true
			}
		}
	}
	return 0, 0, false
}

func (p corridorPlanner) selectFeasible(candidates []corridorLeg) []corridorLeg {
	if len(candidates) == 0 {
		return nil
	}
	selected := make([]corridorLeg, 0, len(candidates))
	delta := make([]float64, len(p.routeStops)+1)
	for _, leg := range candidates {
		vol := float64(leg.line.Units) * leg.line.UnitVolumeM3
		if vol <= 0 {
			continue
		}
		testDelta := append([]float64(nil), delta...)
		testDelta[leg.buyIdx] += vol
		testDelta[leg.sellIdx] -= vol
		if exceedsCapacity(testDelta, p.params.RemainingCapacityM3) {
			continue
		}
		delta = testDelta
		selected = append(selected, leg)
	}
	return selected
}

func exceedsCapacity(delta []float64, capM3 float64) bool {
	used := 0.0
	for i := 0; i < len(delta); i++ {
		used += delta[i]
		if used > capM3+1e-9 {
			return true
		}
		if used < -1e-9 {
			return true
		}
	}
	return false
}

func (p corridorPlanner) BuildManifest(lines []BatchCreateRouteLine) []RouteSelectedManifestStopGroup {
	if len(lines) == 0 || len(p.routeStops) == 0 {
		return nil
	}
	manifests := make([]RouteSelectedManifestStopGroup, len(p.routeStops))
	for i, stop := range p.routeStops {
		manifests[i] = RouteSelectedManifestStopGroup{StopSystemID: stop.SystemID, StopLocationID: stop.LocationID, BuyLines: []BatchCreateRouteLine{}, SellLines: []BatchCreateRouteLine{}}
	}
	for _, line := range lines {
		buyIdxs := p.idxByStop[fmt.Sprintf("%d|%d", line.BuySystemID, line.BuyLocationID)]
		sellIdxs := p.idxByStop[fmt.Sprintf("%d|%d", line.SellSystemID, line.SellLocationID)]
		buyIdx, sellIdx, ok := firstOrderedPair(buyIdxs, sellIdxs)
		if !ok {
			continue
		}
		manifests[buyIdx].BuyLines = append(manifests[buyIdx].BuyLines, line)
		manifests[sellIdx].SellLines = append(manifests[sellIdx].SellLines, line)
	}
	used := 0.0
	out := make([]RouteSelectedManifestStopGroup, 0, len(manifests))
	for i := range manifests {
		sort.SliceStable(manifests[i].BuyLines, func(a, b int) bool { return batchRouteLineLess(manifests[i].BuyLines[a], manifests[i].BuyLines[b]) })
		sort.SliceStable(manifests[i].SellLines, func(a, b int) bool { return batchRouteLineLess(manifests[i].SellLines[a], manifests[i].SellLines[b]) })
		for _, line := range manifests[i].BuyLines {
			vol := float64(line.Units) * line.UnitVolumeM3
			manifests[i].TotalBuyUnits += line.Units
			manifests[i].TotalBuyVolumeM3 += vol
			manifests[i].TotalBuyISK += line.BuyTotalISK
			used += vol
		}
		for _, line := range manifests[i].SellLines {
			vol := float64(line.Units) * line.UnitVolumeM3
			manifests[i].TotalSellUnits += line.Units
			manifests[i].TotalSellVolumeM3 += vol
			manifests[i].TotalSellISK += line.SellTotalISK
			manifests[i].TotalProfitISK += line.ProfitTotalISK
			used -= vol
		}
		manifests[i].CargoUsedAfterM3 = math.Max(0, used)
		if p.params.RemainingCapacityM3 > 0 {
			manifests[i].CargoRemainAfterM3 = math.Max(0, p.params.RemainingCapacityM3-manifests[i].CargoUsedAfterM3)
		}
		if len(manifests[i].BuyLines) == 0 && len(manifests[i].SellLines) == 0 {
			continue
		}
		out = append(out, manifests[i])
	}
	return out
}
