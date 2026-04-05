package engine

import (
	"context"
	"fmt"
	"math"
	"sort"
)

type RouteSelectedStop struct {
	SystemID   int32
	LocationID int64
}

type RouteSelectedHop struct {
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

type RouteSelectedPlannerParams struct {
	SelectedRouteStops    []RouteSelectedStop
	SelectedRouteHops     []RouteSelectedHop
	CargoLimitM3          float64
	RemainingCapacityM3   float64
	OriginSystemID        int32
	CurrentSystemID       int32
	RouteMaxJumps         int
	MaxDetourJumpsPerNode int
	MinMargin             float64
	MinRouteSecurity      float64
	AllowLowsec           bool
	AllowNullsec          bool
	AllowWormhole         bool
	IncludeStructures     bool
	SnapshotID            string
	SplitTradeFees        bool
	SalesTaxPercent       float64
	BuyBrokerFeePercent   float64
	SellBrokerFeePercent  float64
	BuySalesTaxPercent    float64
	SellSalesTaxPercent   float64
	BrokerFeePercent      float64
	CandidateLines        []BatchRouteCandidateOpportunity
}

type RouteSelectedExcludedCandidate struct {
	TypeID         int32  `json:"type_id"`
	BuySystemID    int32  `json:"buy_system_id"`
	BuyLocationID  int64  `json:"buy_location_id"`
	SellSystemID   int32  `json:"sell_system_id"`
	SellLocationID int64  `json:"sell_location_id"`
	Reason         string `json:"reason"`
}

type RouteSelectedManifestStopGroup struct {
	StopSystemID       int32                  `json:"stop_system_id"`
	StopLocationID     int64                  `json:"stop_location_id"`
	BuyLines           []BatchCreateRouteLine `json:"buy_lines"`
	SellLines          []BatchCreateRouteLine `json:"sell_lines"`
	TotalBuyUnits      int64                  `json:"total_buy_units"`
	TotalSellUnits     int64                  `json:"total_sell_units"`
	TotalBuyVolumeM3   float64                `json:"total_buy_volume_m3"`
	TotalSellVolumeM3  float64                `json:"total_sell_volume_m3"`
	TotalBuyISK        float64                `json:"total_buy_isk"`
	TotalSellISK       float64                `json:"total_sell_isk"`
	TotalProfitISK     float64                `json:"total_profit_isk"`
	CargoUsedAfterM3   float64                `json:"cargo_used_after_m3"`
	CargoRemainAfterM3 float64                `json:"cargo_remain_after_m3"`
}

type RouteSelectedExpansionOption struct {
	BatchCreateRouteOption
	ManifestByStop []RouteSelectedManifestStopGroup `json:"manifest_by_stop"`
}

type RouteSelectedPlannerResult struct {
	Options            []RouteSelectedExpansionOption   `json:"options"`
	Diagnostics        []string                         `json:"diagnostics,omitempty"`
	ExcludedCandidates []RouteSelectedExcludedCandidate `json:"excluded_candidates,omitempty"`
	SnapshotID         string                           `json:"snapshot_id,omitempty"`
}

func (s *Scanner) PlanSelectedRouteExpansions(_ context.Context, params RouteSelectedPlannerParams) (RouteSelectedPlannerResult, error) {
	result := RouteSelectedPlannerResult{Diagnostics: make([]string, 0, 8), SnapshotID: params.SnapshotID}
	if s == nil || s.SDE == nil {
		return result, fmt.Errorf("route planner unavailable")
	}
	if params.RemainingCapacityM3 <= 0 {
		result.Diagnostics = append(result.Diagnostics, "no remaining cargo capacity; nothing to add")
		return result, nil
	}
	if len(params.SelectedRouteStops) == 0 {
		result.Diagnostics = append(result.Diagnostics, "selected route stops required")
		return result, nil
	}

	routePolicy := newBatchRoutePolicy(BatchCreateRouteParams{
		MinRouteSecurity: params.MinRouteSecurity,
		AllowLowsec:      params.AllowLowsec,
		AllowNullsec:     params.AllowNullsec,
		AllowWormhole:    params.AllowWormhole,
	})
	canonicalPath := make([]int32, 0, len(params.SelectedRouteStops))
	selectedStops := make(map[string]RouteSelectedStop, len(params.SelectedRouteStops))
	for _, stop := range params.SelectedRouteStops {
		if stop.SystemID <= 0 {
			continue
		}
		canonicalPath = append(canonicalPath, stop.SystemID)
		selectedStops[fmt.Sprintf("%d|%d", stop.SystemID, stop.LocationID)] = stop
	}
	if len(canonicalPath) == 0 {
		result.Diagnostics = append(result.Diagnostics, "selected route stops required")
		return result, nil
	}
	maxDetour := params.MaxDetourJumpsPerNode
	if maxDetour < 0 {
		maxDetour = 0
	}

	startSystemID := params.OriginSystemID
	if params.CurrentSystemID > 0 {
		startSystemID = params.CurrentSystemID
	}

	buyCostMult, sellRevenueMult := tradeFeeMultipliers(tradeFeeInputs{
		SplitTradeFees:       params.SplitTradeFees,
		BrokerFeePercent:     params.BrokerFeePercent,
		SalesTaxPercent:      params.SalesTaxPercent,
		BuyBrokerFeePercent:  params.BuyBrokerFeePercent,
		SellBrokerFeePercent: params.SellBrokerFeePercent,
		BuySalesTaxPercent:   params.BuySalesTaxPercent,
		SellSalesTaxPercent:  params.SellSalesTaxPercent,
	})

	lines := make([]BatchCreateRouteLine, 0, len(params.CandidateLines))
	excluded := make([]RouteSelectedExcludedCandidate, 0)
	for _, candidate := range params.CandidateLines {
		exc := RouteSelectedExcludedCandidate{
			TypeID:         candidate.TypeID,
			BuySystemID:    candidate.BuySystemID,
			BuyLocationID:  candidate.BuyLocationID,
			SellSystemID:   candidate.SellSystemID,
			SellLocationID: candidate.SellLocationID,
		}
		if candidate.TypeID <= 0 || candidate.Units <= 0 || candidate.UnitVolumeM3 <= 0 {
			exc.Reason = "invalid_candidate"
			excluded = append(excluded, exc)
			continue
		}
		if !systemWithinDetourOfCanonical(s, candidate.BuySystemID, canonicalPath, maxDetour, routePolicy) ||
			!systemWithinDetourOfCanonical(s, candidate.SellSystemID, canonicalPath, maxDetour, routePolicy) {
			exc.Reason = "detour_cap"
			excluded = append(excluded, exc)
			continue
		}
		if _, ok := selectedStops[fmt.Sprintf("%d|%d", candidate.BuySystemID, candidate.BuyLocationID)]; !ok {
			exc.Reason = "not_selected_stop"
			excluded = append(excluded, exc)
			continue
		}
		if _, ok := selectedStops[fmt.Sprintf("%d|%d", candidate.SellSystemID, candidate.SellLocationID)]; !ok {
			exc.Reason = "not_selected_stop"
			excluded = append(excluded, exc)
			continue
		}
		if !s.routePolicyAllowsSystem(routePolicy, candidate.BuySystemID) || !s.routePolicyAllowsSystem(routePolicy, candidate.SellSystemID) {
			exc.Reason = "security_filter"
			excluded = append(excluded, exc)
			continue
		}

		maxUnitsByCargo := int64(math.Floor(params.RemainingCapacityM3 / candidate.UnitVolumeM3))
		units := min64(candidate.Units, maxUnitsByCargo)
		if units <= 0 {
			exc.Reason = "capacity"
			excluded = append(excluded, exc)
			continue
		}
		effectiveBuy := candidate.BuyPriceISK * buyCostMult
		effectiveSell := candidate.SellPriceISK * sellRevenueMult
		profitPerUnit := effectiveSell - effectiveBuy
		if profitPerUnit <= 0 || effectiveBuy <= 0 {
			exc.Reason = "non_positive_net"
			excluded = append(excluded, exc)
			continue
		}
		margin := (profitPerUnit / effectiveBuy) * 100
		if margin < params.MinMargin {
			exc.Reason = "min_margin"
			excluded = append(excluded, exc)
			continue
		}
		routeJumps := s.jumpsBetweenWithRoutePolicy(startSystemID, candidate.BuySystemID, routePolicy) +
			s.jumpsBetweenWithRoutePolicy(candidate.BuySystemID, candidate.SellSystemID, routePolicy)
		if routeJumps >= UnreachableJumps {
			exc.Reason = "unreachable"
			excluded = append(excluded, exc)
			continue
		}
		if params.RouteMaxJumps > 0 && routeJumps > params.RouteMaxJumps {
			exc.Reason = "max_jumps"
			excluded = append(excluded, exc)
			continue
		}
		itemName := candidate.TypeName
		if itemName == "" && s.SDE.Types[candidate.TypeID] != nil {
			itemName = s.SDE.Types[candidate.TypeID].Name
		}
		lines = append(lines, BatchCreateRouteLine{
			TypeID:         candidate.TypeID,
			TypeName:       itemName,
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
	sort.SliceStable(lines, func(i, j int) bool { return batchRouteLineLess(lines[i], lines[j]) })
	if len(lines) == 0 {
		result.Diagnostics = append(result.Diagnostics, "no profitable expansions for selected route")
		result.ExcludedCandidates = excluded
		return result, nil
	}

	corridor := newCorridorPlanner(corridorPlannerParams{
		RouteStops:          append([]RouteSelectedStop(nil), params.SelectedRouteStops...),
		OriginSystemID:      params.OriginSystemID,
		CurrentSystemID:     params.CurrentSystemID,
		RemainingCapacityM3: params.RemainingCapacityM3,
		CargoLimitM3:        params.CargoLimitM3,
		RouteMaxJumps:       params.RouteMaxJumps,
		RoutePolicy:         routePolicy,
	})
	options := corridor.BuildOptions(s, lines)
	if len(options) == 0 {
		result.Diagnostics = append(result.Diagnostics, "no additions fit remaining cargo after capacity enforcement")
		result.ExcludedCandidates = excluded
		return result, nil
	}

	addedProfit := make(map[string]float64, len(options))
	for _, opt := range options {
		addedProfit[opt.OptionID] = opt.TotalProfitISK
	}
	ranked := rankRouteOptions(options, addedProfit, params.CargoLimitM3)
	result.Options = make([]RouteSelectedExpansionOption, 0, len(ranked))
	for _, opt := range ranked {
		result.Options = append(result.Options, RouteSelectedExpansionOption{
			BatchCreateRouteOption: opt,
			ManifestByStop:         corridor.BuildManifest(opt.Lines),
		})
	}
	result.ExcludedCandidates = excluded
	return result, nil
}
