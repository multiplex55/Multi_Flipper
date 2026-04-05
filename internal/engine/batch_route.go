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
	CurrentSystemID       int32
	BaseBuySystemID       int32
	FinalSellSystemID     int32
	FinalSellLocationID   int64
	CargoLimitM3          float64
	RemainingCapacityM3   float64
	MinMargin             float64
	MinRouteSecurity      float64
	AllowLowsec           bool
	AllowNullsec          bool
	AllowWormhole         bool
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
	BaseLines             []BatchCreateRouteLine
	CandidateLines        []BatchRouteCandidateOpportunity
	CandidateContextSeen  bool
	ExecutionScoring      RouteExecutionScoringConfig
}

type BatchRouteCandidateOpportunity struct {
	TypeID         int32
	TypeName       string
	Units          int64
	UnitVolumeM3   float64
	BuySystemID    int32
	BuyLocationID  int64
	SellSystemID   int32
	SellLocationID int64
	BuyPriceISK    float64
	SellPriceISK   float64
	FillConfidence float64
	CapitalLockup  float64
	StaleRisk      float64
	Concentration  float64
}

type BatchCreateRouteLine struct {
	TypeID             int32
	TypeName           string
	Units              int64
	UnitVolumeM3       float64
	BuySystemID        int32
	BuyLocationID      int64
	SellSystemID       int32
	SellLocationID     int64
	BuyTotalISK        float64
	SellTotalISK       float64
	ProfitTotalISK     float64
	RouteJumps         int
	FillConfidence     float64
	CapitalLockup      float64
	StaleRisk          float64
	Concentration      float64
	LineExecutionScore float64
	LineRole           string
}

type BatchCreateRouteOption struct {
	OptionID               string
	Lines                  []BatchCreateRouteLine
	OrderedBuySystems      []int32
	RouteSequence          []int32
	AddedVolumeM3          float64
	TotalBuyISK            float64
	TotalSellISK           float64
	TotalProfitISK         float64
	TotalJumps             int
	ISKPerJump             float64
	ExecutionScore         float64
	ScoreBreakdown         []RouteScoreFactorBreakdown
	CoreLineCount          int
	SafeFillerLineCount    int
	StretchFillerLineCount int
	CoreProfitTotalISK     float64
	SafeFillerProfitISK    float64
	StretchFillerProfitISK float64
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

type batchRoutePolicy struct {
	MinSecurity   float64
	AllowLowsec   bool
	AllowNullsec  bool
	AllowWormhole bool
}

func newBatchRoutePolicy(params BatchCreateRouteParams) batchRoutePolicy {
	return batchRoutePolicy{
		MinSecurity:   params.MinRouteSecurity,
		AllowLowsec:   params.AllowLowsec,
		AllowNullsec:  params.AllowNullsec,
		AllowWormhole: params.AllowWormhole,
	}
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

	routePolicy := newBatchRoutePolicy(params)
	originSystemID := params.OriginSystemID
	if params.CurrentSystemID > 0 {
		originSystemID = params.CurrentSystemID
	}

	segmentA := s.jumpsBetweenWithRoutePolicy(originSystemID, params.BaseBuySystemID, routePolicy)
	segmentB := s.jumpsBetweenWithRoutePolicy(params.BaseBuySystemID, params.FinalSellSystemID, routePolicy)
	if segmentA == UnreachableJumps || segmentB == UnreachableJumps {
		result.Diagnostics = append(result.Diagnostics, "route constraints make segment A or B unreachable")
		return result, nil
	}
	if params.RouteMaxJumps > 0 && (segmentA+segmentB) > params.RouteMaxJumps {
		result.Diagnostics = append(result.Diagnostics, "route exceeds max jump constraint")
		return result, nil
	}

	canonicalPath := s.pathWithRoutePolicy(params.BaseBuySystemID, params.FinalSellSystemID, routePolicy)
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

	marketLines, pruned := s.buildBatchRouteCandidateLines(params, routePolicy, idx, canonicalPath, segmentA, buyCostMult, sellRevenueMult)
	cacheLines := s.buildBatchRouteCacheCandidateLines(params, routePolicy, canonicalPath, segmentA, buyCostMult, sellRevenueMult)
	lines := mergeBatchRouteCandidatePools(marketLines, cacheLines, params.BaseLines)
	if params.CandidateContextSeen && len(params.CandidateLines) == 0 {
		result.Diagnostics = append(result.Diagnostics, "radius cache unavailable or stale; falling back to market-only candidates")
	}
	if len(lines) == 0 {
		result.Diagnostics = append(result.Diagnostics, "no profitable additions found for selected destination")
		result.Diagnostics = append(result.Diagnostics, formatBatchRoutePruneDiagnostics(pruned)...)
		return result, nil
	}

	options := s.buildBatchRouteOptionsFromCandidates(lines, params)
	if len(options) == 0 {
		result.Diagnostics = append(result.Diagnostics, "no additions fit remaining cargo after capacity enforcement")
		result.Diagnostics = append(result.Diagnostics, formatBatchRoutePruneDiagnostics(pruned)...)
		return result, nil
	}

	addedProfit := make(map[string]float64, len(options))
	for _, opt := range options {
		addedProfit[opt.OptionID] = opt.TotalProfitISK
	}
	ranked := rankRouteOptions(options, addedProfit, params.CargoLimitM3, params.ExecutionScoring)
	result.Options = ranked
	result.Diagnostics = append(result.Diagnostics, formatBatchRoutePruneDiagnostics(pruned)...)
	result.SelectedID = ranked[0].OptionID
	result.SelectedRank = 1
	return result, nil
}

func (s *Scanner) buildBatchRouteCacheCandidateLines(
	params BatchCreateRouteParams,
	routePolicy batchRoutePolicy,
	canonicalPath []int32,
	originToBaseJumps int,
	buyCostMult float64,
	sellRevenueMult float64,
) []BatchCreateRouteLine {
	if len(params.CandidateLines) == 0 || len(canonicalPath) == 0 {
		return nil
	}
	maxDetour := params.MaxDetourJumpsPerNode
	if maxDetour < 0 {
		maxDetour = 0
	}
	lines := make([]BatchCreateRouteLine, 0, len(params.CandidateLines))
	for _, candidate := range params.CandidateLines {
		if candidate.TypeID <= 0 || candidate.Units <= 0 || candidate.UnitVolumeM3 <= 0 {
			continue
		}
		if candidate.BuySystemID <= 0 || candidate.SellSystemID <= 0 {
			continue
		}
		if params.FinalSellLocationID > 0 && candidate.SellLocationID != params.FinalSellLocationID {
			continue
		}
		if !s.routePolicyAllowsSystem(routePolicy, candidate.BuySystemID) || !s.routePolicyAllowsSystem(routePolicy, candidate.SellSystemID) {
			continue
		}
		if !systemWithinDetourOfCanonical(s, candidate.BuySystemID, canonicalPath, maxDetour, routePolicy) {
			continue
		}
		if !systemWithinDetourOfCanonical(s, candidate.SellSystemID, canonicalPath, maxDetour, routePolicy) {
			continue
		}
		baseToBuy := s.jumpsBetweenWithRoutePolicy(params.BaseBuySystemID, candidate.BuySystemID, routePolicy)
		buyToSell := s.jumpsBetweenWithRoutePolicy(candidate.BuySystemID, candidate.SellSystemID, routePolicy)
		sellToFinal := s.jumpsBetweenWithRoutePolicy(candidate.SellSystemID, params.FinalSellSystemID, routePolicy)
		if baseToBuy == UnreachableJumps || buyToSell == UnreachableJumps || sellToFinal == UnreachableJumps {
			continue
		}
		routeJumps := originToBaseJumps + baseToBuy + buyToSell + sellToFinal
		if params.RouteMaxJumps > 0 && routeJumps > params.RouteMaxJumps {
			continue
		}
		maxUnitsByCargo := int64(math.Floor(params.RemainingCapacityM3 / candidate.UnitVolumeM3))
		if maxUnitsByCargo <= 0 {
			continue
		}
		units := min64(candidate.Units, maxUnitsByCargo)
		if units <= 0 {
			continue
		}
		effectiveBuy := candidate.BuyPriceISK * buyCostMult
		effectiveSell := candidate.SellPriceISK * sellRevenueMult
		profitPerUnit := effectiveSell - effectiveBuy
		if profitPerUnit <= 0 || effectiveBuy <= 0 {
			continue
		}
		margin := (profitPerUnit / effectiveBuy) * 100
		if margin < params.MinMargin {
			continue
		}
		lines = append(lines, BatchCreateRouteLine{
			TypeID:         candidate.TypeID,
			TypeName:       candidate.TypeName,
			Units:          units,
			UnitVolumeM3:   candidate.UnitVolumeM3,
			BuySystemID:    candidate.BuySystemID,
			BuyLocationID:  candidate.BuyLocationID,
			SellSystemID:   candidate.SellSystemID,
			SellLocationID: candidate.SellLocationID,
			BuyTotalISK:    float64(units) * candidate.BuyPriceISK,
			SellTotalISK:   float64(units) * candidate.SellPriceISK,
			ProfitTotalISK: float64(units) * profitPerUnit,
			RouteJumps:     routeJumps,
			FillConfidence: candidate.FillConfidence,
			CapitalLockup:  candidate.CapitalLockup,
			StaleRisk:      candidate.StaleRisk,
			Concentration:  candidate.Concentration,
		})
	}
	return lines
}

func systemWithinDetourOfCanonical(s *Scanner, systemID int32, canonicalPath []int32, maxDetour int, routePolicy batchRoutePolicy) bool {
	if len(canonicalPath) == 0 {
		return false
	}
	if maxDetour <= 0 {
		for _, node := range canonicalPath {
			if node == systemID {
				return true
			}
		}
		return false
	}
	for _, node := range canonicalPath {
		jumps := s.jumpsBetweenWithRoutePolicy(node, systemID, routePolicy)
		if jumps != UnreachableJumps && jumps <= maxDetour {
			return true
		}
	}
	return false
}

func (s *Scanner) buildBatchRouteCandidateLines(
	params BatchCreateRouteParams,
	routePolicy batchRoutePolicy,
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
		nodeNeighborhoods[i] = expandBatchRouteNodeNeighborhood(s, node, maxDetour, routePolicy)
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

					baseToBuy := s.jumpsBetweenWithRoutePolicy(params.BaseBuySystemID, buySystemID, routePolicy)
					buyToSell := s.jumpsBetweenWithRoutePolicy(buySystemID, sellSystemID, routePolicy)
					sellToFinal := s.jumpsBetweenWithRoutePolicy(sellSystemID, params.FinalSellSystemID, routePolicy)
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
							if !s.routePolicyAllowsSystem(routePolicy, buySystemID) || !s.routePolicyAllowsSystem(routePolicy, sellSystemID) {
								stats.security++
								continue
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

func expandBatchRouteNodeNeighborhood(s *Scanner, nodeSystemID int32, maxDetourJumps int, routePolicy batchRoutePolicy) map[int32]int {
	if maxDetourJumps <= 0 {
		return map[int32]int{nodeSystemID: 0}
	}
	return s.systemsWithinRadiusWithRoutePolicy(nodeSystemID, maxDetourJumps, routePolicy)
}

func (s *Scanner) jumpsBetweenWithRoutePolicy(from, to int32, routePolicy batchRoutePolicy) int {
	path := s.pathWithRoutePolicy(from, to, routePolicy)
	if len(path) == 0 {
		return UnreachableJumps
	}
	return len(path) - 1
}

func (s *Scanner) pathWithRoutePolicy(from, to int32, routePolicy batchRoutePolicy) []int32 {
	if from == to {
		if s.routePolicyAllowsSystem(routePolicy, from) {
			return []int32{from}
		}
		return nil
	}
	if !s.routePolicyAllowsSystem(routePolicy, from) || !s.routePolicyAllowsSystem(routePolicy, to) {
		return nil
	}
	parent := make(map[int32]int32, 256)
	parent[from] = from
	queue := []int32{from}
	for head := 0; head < len(queue); head++ {
		current := queue[head]
		for _, neighbor := range s.SDE.Universe.Adj[current] {
			if _, seen := parent[neighbor]; seen {
				continue
			}
			if !s.routePolicyAllowsSystem(routePolicy, neighbor) {
				continue
			}
			parent[neighbor] = current
			if neighbor == to {
				path := []int32{}
				cur := to
				for cur != from {
					path = append(path, cur)
					cur = parent[cur]
				}
				path = append(path, from)
				for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
					path[i], path[j] = path[j], path[i]
				}
				return path
			}
			queue = append(queue, neighbor)
		}
	}
	return nil
}

func (s *Scanner) systemsWithinRadiusWithRoutePolicy(origin int32, maxJumps int, routePolicy batchRoutePolicy) map[int32]int {
	if !s.routePolicyAllowsSystem(routePolicy, origin) {
		return map[int32]int{}
	}
	result := map[int32]int{origin: 0}
	queue := []int32{origin}
	for head := 0; head < len(queue); head++ {
		current := queue[head]
		dist := result[current]
		if dist >= maxJumps {
			continue
		}
		for _, neighbor := range s.SDE.Universe.Adj[current] {
			if !s.routePolicyAllowsSystem(routePolicy, neighbor) {
				continue
			}
			if _, seen := result[neighbor]; seen {
				continue
			}
			result[neighbor] = dist + 1
			queue = append(queue, neighbor)
		}
	}
	return result
}

func (s *Scanner) routePolicyAllowsSystem(routePolicy batchRoutePolicy, systemID int32) bool {
	regionID := s.SDE.Universe.SystemRegion[systemID]
	if regionID >= 11000001 && regionID <= 11000033 {
		return routePolicy.AllowWormhole
	}

	sec, ok := s.SDE.Universe.SystemSecurity[systemID]
	if !ok {
		return false
	}
	if routePolicy.MinSecurity > 0 && sec < routePolicy.MinSecurity {
		return false
	}
	if sec >= 0.45 {
		return true
	}
	if sec > 0 {
		return routePolicy.AllowLowsec
	}
	return routePolicy.AllowNullsec
}

func (s *Scanner) computeRouteSequenceJumps(
	params BatchCreateRouteParams,
	additionLines []BatchCreateRouteLine,
	routePolicy batchRoutePolicy,
) (int, []int32, []int32, bool) {
	if s == nil {
		return 0, nil, nil, false
	}
	startSystemID := params.OriginSystemID
	if params.CurrentSystemID > 0 {
		startSystemID = params.CurrentSystemID
	}
	finalSellSystemID := params.FinalSellSystemID
	if startSystemID <= 0 || finalSellSystemID <= 0 {
		return 0, nil, nil, false
	}
	if !s.routePolicyAllowsSystem(routePolicy, startSystemID) || !s.routePolicyAllowsSystem(routePolicy, finalSellSystemID) {
		return 0, nil, nil, false
	}

	uniqueBuySet := make(map[int32]struct{}, len(params.BaseLines)+len(additionLines))
	for _, line := range params.BaseLines {
		if line.BuySystemID > 0 {
			uniqueBuySet[line.BuySystemID] = struct{}{}
		}
	}
	for _, line := range additionLines {
		if line.BuySystemID > 0 {
			uniqueBuySet[line.BuySystemID] = struct{}{}
		}
	}
	uniqueBuySystems := make([]int32, 0, len(uniqueBuySet))
	for systemID := range uniqueBuySet {
		uniqueBuySystems = append(uniqueBuySystems, systemID)
	}
	sort.Slice(uniqueBuySystems, func(i, j int) bool { return uniqueBuySystems[i] < uniqueBuySystems[j] })
	if len(uniqueBuySystems) == 0 {
		jumps := s.jumpsBetweenWithRoutePolicy(startSystemID, finalSellSystemID, routePolicy)
		if jumps == UnreachableJumps {
			return 0, nil, nil, false
		}
		return jumps, nil, []int32{startSystemID, finalSellSystemID}, true
	}

	routeOrder, ok := s.optimizeBuySystemVisitOrder(startSystemID, finalSellSystemID, uniqueBuySystems, routePolicy)
	if !ok {
		return 0, nil, nil, false
	}

	totalJumps := 0
	routeSequence := make([]int32, 0, len(routeOrder)+2)
	routeSequence = append(routeSequence, startSystemID)
	prev := startSystemID
	for _, nextSystem := range routeOrder {
		segment := s.jumpsBetweenWithRoutePolicy(prev, nextSystem, routePolicy)
		if segment == UnreachableJumps {
			return 0, nil, nil, false
		}
		totalJumps += segment
		routeSequence = append(routeSequence, nextSystem)
		prev = nextSystem
	}
	lastSegment := s.jumpsBetweenWithRoutePolicy(prev, finalSellSystemID, routePolicy)
	if lastSegment == UnreachableJumps {
		return 0, nil, nil, false
	}
	totalJumps += lastSegment
	routeSequence = append(routeSequence, finalSellSystemID)
	return totalJumps, routeOrder, routeSequence, true
}

func (s *Scanner) optimizeBuySystemVisitOrder(
	startSystemID int32,
	finalSellSystemID int32,
	buySystems []int32,
	routePolicy batchRoutePolicy,
) ([]int32, bool) {
	if len(buySystems) <= 10 {
		return s.optimizeBuySystemOrderExact(startSystemID, finalSellSystemID, buySystems, routePolicy)
	}
	return s.optimizeBuySystemOrderHeuristic(startSystemID, finalSellSystemID, buySystems, routePolicy)
}

func (s *Scanner) optimizeBuySystemOrderExact(
	startSystemID int32,
	finalSellSystemID int32,
	buySystems []int32,
	routePolicy batchRoutePolicy,
) ([]int32, bool) {
	n := len(buySystems)
	if n == 0 {
		return nil, true
	}
	distsStart := make([]int, n)
	distsToFinal := make([]int, n)
	between := make([][]int, n)
	for i := 0; i < n; i++ {
		distsStart[i] = s.jumpsBetweenWithRoutePolicy(startSystemID, buySystems[i], routePolicy)
		distsToFinal[i] = s.jumpsBetweenWithRoutePolicy(buySystems[i], finalSellSystemID, routePolicy)
		if distsStart[i] == UnreachableJumps || distsToFinal[i] == UnreachableJumps {
			return nil, false
		}
		between[i] = make([]int, n)
		for j := 0; j < n; j++ {
			if i == j {
				continue
			}
			between[i][j] = s.jumpsBetweenWithRoutePolicy(buySystems[i], buySystems[j], routePolicy)
			if between[i][j] == UnreachableJumps {
				return nil, false
			}
		}
	}

	const inf = int(^uint(0) >> 2)
	stateCount := 1 << n
	dp := make([][]int, stateCount)
	prev := make([][]int, stateCount)
	for mask := 0; mask < stateCount; mask++ {
		dp[mask] = make([]int, n)
		prev[mask] = make([]int, n)
		for i := 0; i < n; i++ {
			dp[mask][i] = inf
			prev[mask][i] = -1
		}
	}

	for i := 0; i < n; i++ {
		mask := 1 << i
		dp[mask][i] = distsStart[i]
	}
	for mask := 1; mask < stateCount; mask++ {
		for last := 0; last < n; last++ {
			if (mask&(1<<last)) == 0 || dp[mask][last] >= inf {
				continue
			}
			for next := 0; next < n; next++ {
				if mask&(1<<next) != 0 {
					continue
				}
				nextMask := mask | (1 << next)
				cost := dp[mask][last] + between[last][next]
				if cost < dp[nextMask][next] || (cost == dp[nextMask][next] && (prev[nextMask][next] == -1 || buySystems[last] < buySystems[prev[nextMask][next]])) {
					dp[nextMask][next] = cost
					prev[nextMask][next] = last
				}
			}
		}
	}

	fullMask := stateCount - 1
	bestLast := -1
	bestCost := inf
	for i := 0; i < n; i++ {
		cost := dp[fullMask][i] + distsToFinal[i]
		if cost < bestCost || (cost == bestCost && (bestLast == -1 || buySystems[i] < buySystems[bestLast])) {
			bestCost = cost
			bestLast = i
		}
	}
	if bestLast == -1 || bestCost >= inf {
		return nil, false
	}

	order := make([]int32, 0, n)
	mask := fullMask
	current := bestLast
	for current != -1 {
		order = append(order, buySystems[current])
		next := prev[mask][current]
		mask &= ^(1 << current)
		current = next
	}
	for i, j := 0, len(order)-1; i < j; i, j = i+1, j-1 {
		order[i], order[j] = order[j], order[i]
	}
	return order, true
}

func (s *Scanner) optimizeBuySystemOrderHeuristic(
	startSystemID int32,
	finalSellSystemID int32,
	buySystems []int32,
	routePolicy batchRoutePolicy,
) ([]int32, bool) {
	remaining := append([]int32(nil), buySystems...)
	sort.Slice(remaining, func(i, j int) bool { return remaining[i] < remaining[j] })
	order := make([]int32, 0, len(remaining))
	current := startSystemID
	for len(remaining) > 0 {
		bestIdx := -1
		bestDist := int(^uint(0) >> 1)
		for idx, systemID := range remaining {
			dist := s.jumpsBetweenWithRoutePolicy(current, systemID, routePolicy)
			if dist == UnreachableJumps {
				return nil, false
			}
			if dist < bestDist || (dist == bestDist && systemID < remaining[bestIdx]) {
				bestDist = dist
				bestIdx = idx
			}
		}
		order = append(order, remaining[bestIdx])
		current = remaining[bestIdx]
		remaining = append(remaining[:bestIdx], remaining[bestIdx+1:]...)
	}

	routeCost := func(candidate []int32) int {
		if len(candidate) == 0 {
			return s.jumpsBetweenWithRoutePolicy(startSystemID, finalSellSystemID, routePolicy)
		}
		total := 0
		prev := startSystemID
		for _, systemID := range candidate {
			segment := s.jumpsBetweenWithRoutePolicy(prev, systemID, routePolicy)
			if segment == UnreachableJumps {
				return int(^uint(0) >> 1)
			}
			total += segment
			prev = systemID
		}
		last := s.jumpsBetweenWithRoutePolicy(prev, finalSellSystemID, routePolicy)
		if last == UnreachableJumps {
			return int(^uint(0) >> 1)
		}
		return total + last
	}

	bestCost := routeCost(order)
	if bestCost == int(^uint(0)>>1) {
		return nil, false
	}
	for i := 0; i < len(order)-1; i++ {
		for j := i + 1; j < len(order); j++ {
			candidate := append([]int32(nil), order...)
			for left, right := i, j; left < right; left, right = left+1, right-1 {
				candidate[left], candidate[right] = candidate[right], candidate[left]
			}
			candidateCost := routeCost(candidate)
			if candidateCost < bestCost {
				order = candidate
				bestCost = candidateCost
			}
		}
	}
	return order, true
}

func (s *Scanner) buildBatchRouteOptionsFromCandidates(lines []BatchCreateRouteLine, params BatchCreateRouteParams) []BatchCreateRouteOption {
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
					return batchRouteLineLess(i, j)
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
					return batchRouteLineLess(i, j)
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
						return batchRouteLineLess(i, j)
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
		if s != nil {
			jumps, orderedBuySystems, routeSequence, ok := s.computeRouteSequenceJumps(params, option.Lines, newBatchRoutePolicy(params))
			if ok {
				option.TotalJumps = jumps
				option.OrderedBuySystems = orderedBuySystems
				option.RouteSequence = routeSequence
			}
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
