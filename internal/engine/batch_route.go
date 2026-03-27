package engine

import (
	"context"
	"fmt"
	"math"
	"sort"
	"sync"

	"eve-flipper/internal/esi"
)

type BatchCreateRouteParams struct {
	OriginSystemID        int32
	BaseBuySystemID       int32
	FinalSellSystemID     int32
	FinalSellLocationID   int64
	CargoLimitM3          float64
	RemainingCapacityM3   float64
	MinMargin             float64
	MinRouteSecurity      float64
	IncludeStructures     bool
	RouteMaxJumps         int
	MaxDetourJumpsPerNode int
	SplitTradeFees        bool
	SalesTaxPercent       float64
	BuyBrokerFeePercent   float64
	SellBrokerFeePercent  float64
	BuySalesTaxPercent    float64
	SellSalesTaxPercent   float64
	BrokerFeePercent      float64
}

type BatchCreateRouteLine struct {
	TypeID         int32
	TypeName       string
	Units          int64
	UnitVolumeM3   float64
	BuySystemID    int32
	BuyLocationID  int64
	SellSystemID   int32
	SellLocationID int64
	BuyTotalISK    float64
	SellTotalISK   float64
	ProfitTotalISK float64
	RouteJumps     int
}

type BatchCreateRouteOption struct {
	OptionID       string
	Lines          []BatchCreateRouteLine
	AddedVolumeM3  float64
	TotalBuyISK    float64
	TotalSellISK   float64
	TotalProfitISK float64
	TotalJumps     int
	ISKPerJump     float64
}

type BatchCreateRouteResult struct {
	Options      []BatchCreateRouteOption
	Diagnostics  []string
	SelectedID   string
	SelectedRank int
}

type batchRoutePruneStats struct {
	security          int
	detourCap         int
	capacity          int
	sellLocation      int
	margin            int
	nonProfitable     int
	unreachable       int
	missingTypeOrBook int
}

func (s *Scanner) CreateBatchRoute(ctx context.Context, params BatchCreateRouteParams) (BatchCreateRouteResult, error) {
	result := BatchCreateRouteResult{Diagnostics: make([]string, 0, 8)}
	if ctx != nil && ctx.Err() != nil {
		return result, ctx.Err()
	}
	if s == nil || s.SDE == nil || s.ESI == nil {
		return result, fmt.Errorf("batch route planner unavailable")
	}

	if params.RemainingCapacityM3 <= 0 {
		result.Diagnostics = append(result.Diagnostics, "no remaining cargo capacity; nothing to add")
		return result, nil
	}

	segmentA := s.jumpsBetweenWithSecurity(params.OriginSystemID, params.BaseBuySystemID, params.MinRouteSecurity)
	segmentB := s.jumpsBetweenWithSecurity(params.BaseBuySystemID, params.FinalSellSystemID, params.MinRouteSecurity)
	if segmentA == UnreachableJumps || segmentB == UnreachableJumps {
		result.Diagnostics = append(result.Diagnostics, "route constraints make segment A or B unreachable")
		return result, nil
	}
	if params.RouteMaxJumps > 0 && (segmentA+segmentB) > params.RouteMaxJumps {
		result.Diagnostics = append(result.Diagnostics, "route exceeds max jump constraint")
		return result, nil
	}

	canonicalPath := s.SDE.Universe.GetPath(params.BaseBuySystemID, params.FinalSellSystemID, params.MinRouteSecurity)
	if len(canonicalPath) == 0 {
		result.Diagnostics = append(result.Diagnostics, "unable to resolve canonical route path for batch planning")
		return result, nil
	}

	baseRegionID := s.SDE.Universe.SystemRegion[params.BaseBuySystemID]
	finalRegionID := s.SDE.Universe.SystemRegion[params.FinalSellSystemID]
	if baseRegionID == 0 || finalRegionID == 0 {
		return result, fmt.Errorf("unable to resolve market regions for route")
	}

	var sellOrders, buyOrders []esi.MarketOrder
	var sellErr, buyErr error
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		sellOrders, sellErr = s.ESI.FetchRegionOrders(baseRegionID, "sell")
	}()
	go func() {
		defer wg.Done()
		buyOrders, buyErr = s.ESI.FetchRegionOrders(finalRegionID, "buy")
	}()
	wg.Wait()
	if sellErr != nil {
		return result, fmt.Errorf("fetch sell orders: %w", sellErr)
	}
	if buyErr != nil {
		return result, fmt.Errorf("fetch buy orders: %w", buyErr)
	}

	idx := buildOrderIndexWithFilters(sellOrders, buyOrders, params.IncludeStructures)
	buyCostMult, sellRevenueMult := tradeFeeMultipliers(tradeFeeInputs{
		SplitTradeFees:       params.SplitTradeFees,
		BrokerFeePercent:     params.BrokerFeePercent,
		SalesTaxPercent:      params.SalesTaxPercent,
		BuyBrokerFeePercent:  params.BuyBrokerFeePercent,
		SellBrokerFeePercent: params.SellBrokerFeePercent,
		BuySalesTaxPercent:   params.BuySalesTaxPercent,
		SellSalesTaxPercent:  params.SellSalesTaxPercent,
	})

	lines, pruned := s.buildBatchRouteCandidateLines(params, idx, canonicalPath, segmentA, buyCostMult, sellRevenueMult)
	if len(lines) == 0 {
		result.Diagnostics = append(result.Diagnostics, "no profitable additions found for selected destination")
		result.Diagnostics = append(result.Diagnostics, formatBatchRoutePruneDiagnostics(pruned)...)
		return result, nil
	}

	options := buildBatchRouteOptionsFromCandidates(lines, params)
	if len(options) == 0 {
		result.Diagnostics = append(result.Diagnostics, "no additions fit remaining cargo after capacity enforcement")
		result.Diagnostics = append(result.Diagnostics, formatBatchRoutePruneDiagnostics(pruned)...)
		return result, nil
	}

	addedProfit := make(map[string]float64, len(options))
	for _, opt := range options {
		addedProfit[opt.OptionID] = opt.TotalProfitISK
	}
	ranked := rankRouteOptions(options, addedProfit, params.CargoLimitM3)
	result.Options = ranked
	result.Diagnostics = append(result.Diagnostics, formatBatchRoutePruneDiagnostics(pruned)...)
	result.SelectedID = ranked[0].OptionID
	result.SelectedRank = 1
	return result, nil
}

func (s *Scanner) buildBatchRouteCandidateLines(
	params BatchCreateRouteParams,
	idx *orderIndex,
	canonicalPath []int32,
	originToBaseJumps int,
	buyCostMult float64,
	sellRevenueMult float64,
) ([]BatchCreateRouteLine, batchRoutePruneStats) {
	stats := batchRoutePruneStats{}
	if len(canonicalPath) == 0 {
		return nil, stats
	}

	maxDetour := params.MaxDetourJumpsPerNode
	if maxDetour < 0 {
		maxDetour = 0
	}

	buyNodeIndices := make([]int, 0, len(canonicalPath))
	sellNodeIndices := make([]int, 0, len(canonicalPath))
	if maxDetour == 0 {
		buyNodeIndices = append(buyNodeIndices, 0)
		sellNodeIndices = append(sellNodeIndices, len(canonicalPath)-1)
	} else {
		for i := range canonicalPath {
			buyNodeIndices = append(buyNodeIndices, i)
			sellNodeIndices = append(sellNodeIndices, i)
		}
	}

	nodeNeighborhoods := make(map[int]map[int32]int, len(canonicalPath))
	for i, node := range canonicalPath {
		nodeNeighborhoods[i] = expandBatchRouteNodeNeighborhood(s, node, maxDetour, params.MinRouteSecurity)
	}

	lines := make([]BatchCreateRouteLine, 0, 128)
	seen := make(map[string]bool, 128)
	for _, buyNodeIdx := range buyNodeIndices {
		buyNode := canonicalPath[buyNodeIdx]
		buySystems := nodeNeighborhoods[buyNodeIdx]
		for _, sellNodeIdx := range sellNodeIndices {
			if sellNodeIdx < buyNodeIdx {
				continue
			}
			sellNode := canonicalPath[sellNodeIdx]
			sellSystems := nodeNeighborhoods[sellNodeIdx]

			for buySystemID, buyDetourJumps := range buySystems {
				if buyDetourJumps > maxDetour {
					stats.detourCap++
					continue
				}
				sellsByType := idx.cheapestSell[buySystemID]
				if len(sellsByType) == 0 {
					stats.missingTypeOrBook++
					continue
				}
				for sellSystemID, sellDetourJumps := range sellSystems {
					if sellDetourJumps > maxDetour {
						stats.detourCap++
						continue
					}
					buysByType := idx.highestBuy[sellSystemID]
					if len(buysByType) == 0 {
						stats.missingTypeOrBook++
						continue
					}

					baseToBuy := s.jumpsBetweenWithSecurity(params.BaseBuySystemID, buySystemID, params.MinRouteSecurity)
					buyToSell := s.jumpsBetweenWithSecurity(buySystemID, sellSystemID, params.MinRouteSecurity)
					sellToFinal := s.jumpsBetweenWithSecurity(sellSystemID, params.FinalSellSystemID, params.MinRouteSecurity)
					if baseToBuy == UnreachableJumps || buyToSell == UnreachableJumps || sellToFinal == UnreachableJumps {
						stats.unreachable++
						continue
					}

					for typeID, sell := range sellsByType {
						itemType := s.SDE.Types[typeID]
						if itemType == nil || itemType.Volume <= 0 {
							stats.missingTypeOrBook++
							continue
						}
						buyLevels := buysByType[typeID]
						if len(buyLevels) == 0 {
							stats.missingTypeOrBook++
							continue
						}

						for _, buy := range buyLevels {
							if params.FinalSellLocationID > 0 && buy.LocationID != params.FinalSellLocationID {
								stats.sellLocation++
								continue
							}
							maxUnitsByCargo := int64(math.Floor(params.RemainingCapacityM3 / itemType.Volume))
							if maxUnitsByCargo <= 0 {
								stats.capacity++
								break
							}
							units := min64(maxUnitsByCargo, int64(sell.VolumeRemain), int64(buy.VolumeRemain))
							if units <= 0 || int32(units) < buy.MinVolume {
								stats.capacity++
								continue
							}
							effectiveBuy := sell.Price * buyCostMult
							effectiveSell := buy.Price * sellRevenueMult
							profitPerUnit := effectiveSell - effectiveBuy
							if profitPerUnit <= 0 {
								stats.nonProfitable++
								continue
							}
							margin := (profitPerUnit / effectiveBuy) * 100
							if margin < params.MinMargin {
								stats.margin++
								continue
							}
							routeJumps := originToBaseJumps + baseToBuy + buyToSell + sellToFinal
							if params.RouteMaxJumps > 0 && routeJumps > params.RouteMaxJumps {
								stats.detourCap++
								continue
							}
							if params.MinRouteSecurity > 0 {
								if sec, ok := s.SDE.Universe.SystemSecurity[buySystemID]; !ok || sec < params.MinRouteSecurity {
									stats.security++
									continue
								}
								if sec, ok := s.SDE.Universe.SystemSecurity[sellSystemID]; !ok || sec < params.MinRouteSecurity {
									stats.security++
									continue
								}
							}

							key := fmt.Sprintf("%d|%d|%d|%d|%d", typeID, buySystemID, sellSystemID, sell.LocationID, buy.LocationID)
							if seen[key] {
								continue
							}
							seen[key] = true

							lines = append(lines, BatchCreateRouteLine{
								TypeID:         typeID,
								TypeName:       itemType.Name,
								Units:          units,
								UnitVolumeM3:   itemType.Volume,
								BuySystemID:    buySystemID,
								BuyLocationID:  sell.LocationID,
								SellSystemID:   sellSystemID,
								SellLocationID: buy.LocationID,
								BuyTotalISK:    float64(units) * sell.Price,
								SellTotalISK:   float64(units) * buy.Price,
								ProfitTotalISK: float64(units) * profitPerUnit,
								RouteJumps:     routeJumps,
							})
						}
					}
				}
			}
			_ = buyNode
			_ = sellNode
		}
	}

	sort.Slice(lines, func(i, j int) bool {
		if lines[i].ProfitTotalISK == lines[j].ProfitTotalISK {
			if lines[i].TypeID == lines[j].TypeID {
				if lines[i].BuySystemID == lines[j].BuySystemID {
					return lines[i].SellSystemID < lines[j].SellSystemID
				}
				return lines[i].BuySystemID < lines[j].BuySystemID
			}
			return lines[i].TypeID < lines[j].TypeID
		}
		return lines[i].ProfitTotalISK > lines[j].ProfitTotalISK
	})

	return lines, stats
}

func expandBatchRouteNodeNeighborhood(s *Scanner, nodeSystemID int32, maxDetourJumps int, minSecurity float64) map[int32]int {
	if maxDetourJumps <= 0 {
		return map[int32]int{nodeSystemID: 0}
	}
	if minSecurity > 0 {
		return s.SDE.Universe.SystemsWithinRadiusMinSecurity(nodeSystemID, maxDetourJumps, minSecurity)
	}
	return s.SDE.Universe.SystemsWithinRadius(nodeSystemID, maxDetourJumps)
}

func buildBatchRouteOptionsFromCandidates(lines []BatchCreateRouteLine, params BatchCreateRouteParams) []BatchCreateRouteOption {
	if len(lines) == 0 {
		return nil
	}

	type strategy struct {
		id   string
		sort func(i, j BatchCreateRouteLine) bool
	}
	strategies := []strategy{
		{
			id: "max-total-profit",
			sort: func(i, j BatchCreateRouteLine) bool {
				if i.ProfitTotalISK == j.ProfitTotalISK {
					return i.TypeID < j.TypeID
				}
				return i.ProfitTotalISK > j.ProfitTotalISK
			},
		},
		{
			id: "max-isk-per-jump",
			sort: func(i, j BatchCreateRouteLine) bool {
				left := 0.0
				right := 0.0
				if i.RouteJumps > 0 {
					left = i.ProfitTotalISK / float64(i.RouteJumps)
				}
				if j.RouteJumps > 0 {
					right = j.ProfitTotalISK / float64(j.RouteJumps)
				}
				if left == right {
					return i.TypeID < j.TypeID
				}
				return left > right
			},
		},
		{
			id: "max-cargo-utilization",
			sort: func(i, j BatchCreateRouteLine) bool {
				leftVol := float64(i.Units) * i.UnitVolumeM3
				rightVol := float64(j.Units) * j.UnitVolumeM3
				if leftVol == rightVol {
					if i.ProfitTotalISK == j.ProfitTotalISK {
						return i.TypeID < j.TypeID
					}
					return i.ProfitTotalISK > j.ProfitTotalISK
				}
				return leftVol > rightVol
			},
		},
	}

	options := make([]BatchCreateRouteOption, 0, len(strategies))
	seenOptionSignature := make(map[string]bool, len(strategies))
	for _, strat := range strategies {
		sorted := append([]BatchCreateRouteLine(nil), lines...)
		sort.SliceStable(sorted, func(i, j int) bool { return strat.sort(sorted[i], sorted[j]) })
		fitted := fitAdditionsToRemainingCargo(sorted, params.RemainingCapacityM3)
		if len(fitted) == 0 {
			continue
		}

		option := BatchCreateRouteOption{OptionID: strat.id, Lines: make([]BatchCreateRouteLine, 0, len(fitted))}
		signature := ""
		for _, line := range fitted {
			lineVol := float64(line.Units) * line.UnitVolumeM3
			option.Lines = append(option.Lines, line)
			option.AddedVolumeM3 += lineVol
			option.TotalBuyISK += line.BuyTotalISK
			option.TotalSellISK += line.SellTotalISK
			option.TotalProfitISK += line.ProfitTotalISK
			if line.RouteJumps > option.TotalJumps {
				option.TotalJumps = line.RouteJumps
			}
			signature += fmt.Sprintf("%d:%d:%d:%d:%d|", line.TypeID, line.Units, line.BuySystemID, line.SellSystemID, line.SellLocationID)
		}
		if option.TotalJumps > 0 {
			option.ISKPerJump = option.TotalProfitISK / float64(option.TotalJumps)
		}
		if seenOptionSignature[signature] {
			continue
		}
		seenOptionSignature[signature] = true
		options = append(options, option)
	}

	return options
}

func formatBatchRoutePruneDiagnostics(stats batchRoutePruneStats) []string {
	diagnostics := make([]string, 0, 8)
	if stats.security > 0 {
		diagnostics = append(diagnostics, fmt.Sprintf("pruned %d candidates by security filter", stats.security))
	}
	if stats.detourCap > 0 {
		diagnostics = append(diagnostics, fmt.Sprintf("pruned %d candidates by detour/jump cap", stats.detourCap))
	}
	if stats.capacity > 0 {
		diagnostics = append(diagnostics, fmt.Sprintf("pruned %d candidates by capacity or volume limits", stats.capacity))
	}
	if stats.sellLocation > 0 {
		diagnostics = append(diagnostics, fmt.Sprintf("pruned %d candidates by final sell-location mismatch", stats.sellLocation))
	}
	if stats.margin > 0 {
		diagnostics = append(diagnostics, fmt.Sprintf("pruned %d candidates below minimum margin", stats.margin))
	}
	if stats.nonProfitable > 0 {
		diagnostics = append(diagnostics, fmt.Sprintf("pruned %d non-profitable candidates", stats.nonProfitable))
	}
	if stats.unreachable > 0 {
		diagnostics = append(diagnostics, fmt.Sprintf("pruned %d unreachable candidates", stats.unreachable))
	}
	if stats.missingTypeOrBook > 0 {
		diagnostics = append(diagnostics, fmt.Sprintf("pruned %d candidates due to missing type/book data", stats.missingTypeOrBook))
	}
	return diagnostics
}

func min64(v int64, vals ...int64) int64 {
	m := v
	for _, x := range vals {
		if x < m {
			m = x
		}
	}
	return m
}
