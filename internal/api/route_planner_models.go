package api

import (
	"errors"

	"eve-flipper/internal/engine"
)

var (
	errRoutePlannerMissingStops = errors.New("missing selected route stops")
	errRoutePlannerMissingCargo = errors.New("negative cargo/remaining cargo")
)

type RoutePlannerStop struct {
	SystemID   int32  `json:"system_id"`
	SystemName string `json:"system_name,omitempty"`
	LocationID int64  `json:"location_id"`
}

type RoutePlannerHop struct {
	TypeID         int32   `json:"type_id"`
	TypeName       string  `json:"type_name"`
	Units          int64   `json:"units"`
	UnitVolumeM3   float64 `json:"unit_volume_m3"`
	BuySystemID    int32   `json:"buy_system_id"`
	BuyLocationID  int64   `json:"buy_location_id"`
	SellSystemID   int32   `json:"sell_system_id"`
	SellLocationID int64   `json:"sell_location_id"`
	BuyPriceISK    float64 `json:"buy_price_isk"`
	SellPriceISK   float64 `json:"sell_price_isk"`
}

type RoutePlannerRequest struct {
	SelectedRouteStops    []RoutePlannerStop        `json:"selected_route_stops"`
	SelectedRouteHops     []RoutePlannerHop         `json:"selected_route_hops"`
	CandidateSnapshotID   string                    `json:"candidate_snapshot_id,omitempty"`
	CandidateSnapshot     []BatchRouteCandidateLine `json:"candidate_snapshot,omitempty"`
	CargoLimitM3          float64                   `json:"cargo_limit_m3"`
	RemainingCapacityM3   float64                   `json:"remaining_capacity_m3"`
	OriginSystemID        int32                     `json:"origin_system_id"`
	CurrentSystemID       int32                     `json:"current_system_id"`
	RouteMaxJumps         int                       `json:"route_max_jumps"`
	MaxDetourJumpsPerNode int                       `json:"max_detour_jumps_per_node"`
	MinMargin             float64                   `json:"min_margin"`
	MinRouteSecurity      float64                   `json:"min_route_security"`
	AllowLowsec           bool                      `json:"allow_lowsec"`
	AllowNullsec          bool                      `json:"allow_nullsec"`
	AllowWormhole         bool                      `json:"allow_wormhole"`
	IncludeStructures     bool                      `json:"include_structures"`
	SalesTaxPercent       float64                   `json:"sales_tax_percent"`
	BuyBrokerFeePercent   float64                   `json:"buy_broker_fee_percent"`
	SellBrokerFeePercent  float64                   `json:"sell_broker_fee_percent"`
}

type RoutePlannerStopManifest struct {
	StopSystemID   int32               `json:"stop_system_id"`
	StopLocationID int64               `json:"stop_location_id"`
	Lines          []RouteAdditionLine `json:"lines"`
	TotalUnits     int64               `json:"total_units"`
	TotalVolumeM3  float64             `json:"total_volume_m3"`
	TotalBuyISK    float64             `json:"total_buy_isk"`
	TotalSellISK   float64             `json:"total_sell_isk"`
	TotalProfitISK float64             `json:"total_profit_isk"`
}

type RoutePlannerOption struct {
	OptionID        string                     `json:"option_id"`
	Rank            int                        `json:"rank"`
	Lines           []RouteAdditionLine        `json:"lines"`
	ExpectedTotals  RouteOptionRankingInputs   `json:"expected_totals"`
	ManifestByStop  []RoutePlannerStopManifest `json:"manifest_by_stop"`
	OrderedBuyStops []int32                    `json:"ordered_buy_stops,omitempty"`
	RouteSequence   []int32                    `json:"route_sequence,omitempty"`
}

type RoutePlannerResponse struct {
	Options            []RoutePlannerOption                    `json:"options"`
	Diagnostics        []string                                `json:"diagnostics,omitempty"`
	ExcludedCandidates []engine.RouteSelectedExcludedCandidate `json:"excluded_candidates,omitempty"`
	SnapshotID         string                                  `json:"snapshot_id,omitempty"`
	DeterministicSort  bool                                    `json:"deterministic_sort"`
}

func (r *RoutePlannerRequest) ApplyDefaults() {
	if r.RouteMaxJumps <= 0 {
		r.RouteMaxJumps = 50
	}
	if r.CurrentSystemID <= 0 {
		r.CurrentSystemID = r.OriginSystemID
	}
	if r.RemainingCapacityM3 == 0 && r.CargoLimitM3 > 0 {
		r.RemainingCapacityM3 = r.CargoLimitM3
	}
}

func (r RoutePlannerRequest) Validate() error {
	if len(r.SelectedRouteStops) == 0 {
		return errRoutePlannerMissingStops
	}
	if r.CargoLimitM3 < 0 || r.RemainingCapacityM3 < 0 {
		return errRoutePlannerMissingCargo
	}
	return nil
}
