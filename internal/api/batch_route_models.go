package api

import (
	"errors"
	"fmt"
)

var (
	errBatchRouteMissingOrigin          = errors.New("missing origin")
	errBatchRouteMissingFinalSell       = errors.New("missing final sell location/system")
	errBatchRouteNegativeCargo          = errors.New("negative cargo/remaining cargo")
	errBatchRouteEmptyBaseLines         = errors.New("empty base lines")
	errBatchRouteDeterministicSortEmpty = errors.New("deterministic sort must include primary and secondary")
)

type BaseBatchLine struct {
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
	BuyTotalISK    float64 `json:"buy_total_isk"`
	SellTotalISK   float64 `json:"sell_total_isk"`
	ProfitTotalISK float64 `json:"profit_total_isk"`
	Jumps          int     `json:"jumps"`
}

type BaseBatchManifest struct {
	OriginSystemID      int32           `json:"origin_system_id"`
	OriginSystemName    string          `json:"origin_system_name"`
	OriginLocationID    int64           `json:"origin_location_id"`
	OriginLocationName  string          `json:"origin_location_name"`
	BaseBuySystemID     int32           `json:"base_buy_system_id"`
	BaseBuyLocationID   int64           `json:"base_buy_location_id"`
	BaseSellSystemID    int32           `json:"base_sell_system_id"`
	BaseSellLocationID  int64           `json:"base_sell_location_id"`
	BaseLines           []BaseBatchLine `json:"base_lines"`
	BaseLineCount       int             `json:"base_line_count"`
	TotalUnits          int64           `json:"total_units"`
	TotalVolumeM3       float64         `json:"total_volume_m3"`
	TotalBuyISK         float64         `json:"total_buy_isk"`
	TotalSellISK        float64         `json:"total_sell_isk"`
	TotalProfitISK      float64         `json:"total_profit_isk"`
	CargoLimitM3        float64         `json:"cargo_limit_m3"`
	RemainingCapacityM3 float64         `json:"remaining_capacity_m3"`
}

type RouteAdditionLine struct {
	TypeID         int32   `json:"type_id"`
	TypeName       string  `json:"type_name"`
	Units          int64   `json:"units"`
	UnitVolumeM3   float64 `json:"unit_volume_m3"`
	BuySystemID    int32   `json:"buy_system_id"`
	BuyLocationID  int64   `json:"buy_location_id"`
	SellSystemID   int32   `json:"sell_system_id"`
	SellLocationID int64   `json:"sell_location_id"`
	BuyTotalISK    float64 `json:"buy_total_isk"`
	SellTotalISK   float64 `json:"sell_total_isk"`
	ProfitTotalISK float64 `json:"profit_total_isk"`
	RouteJumps     int     `json:"route_jumps"`
}

type RouteOptionRankingInputs struct {
	TotalProfitISK float64 `json:"total_profit_isk"`
	TotalJumps     int     `json:"total_jumps"`
	ISKPerJump     float64 `json:"isk_per_jump"`
	UtilizationPct float64 `json:"utilization_pct"`
}

type RouteAdditionOption struct {
	OptionID              string                   `json:"option_id"`
	Rank                  int                      `json:"rank"`
	Lines                 []RouteAdditionLine      `json:"lines"`
	LineCount             int                      `json:"line_count"`
	AddedVolumeM3         float64                  `json:"added_volume_m3"`
	UtilizationPct        float64                  `json:"utilization_pct"`
	TotalBuyISK           float64                  `json:"total_buy_isk"`
	TotalSellISK          float64                  `json:"total_sell_isk"`
	TotalProfitISK        float64                  `json:"total_profit_isk"`
	TotalJumps            int                      `json:"total_jumps"`
	ISKPerJump            float64                  `json:"isk_per_jump"`
	RankingInputs         RouteOptionRankingInputs `json:"ranking_inputs"`
	RankingTieBreakValues []float64                `json:"ranking_tie_break_values"`
	RankingSortKey        string                   `json:"ranking_sort_key"`
}

type DeterministicSortConfig struct {
	Primary       string   `json:"primary"`
	Secondary     string   `json:"secondary"`
	TieBreakOrder []string `json:"tie_break_order"`
}

type BatchCreateRouteRequest struct {
	OriginSystemID       int32                   `json:"origin_system_id"`
	OriginSystemName     string                  `json:"origin_system_name"`
	OriginLocationID     int64                   `json:"origin_location_id"`
	OriginLocationName   string                  `json:"origin_location_name"`
	BaseBatch            BaseBatchManifest       `json:"base_batch"`
	CargoLimitM3         float64                 `json:"cargo_limit_m3"`
	RemainingCapacityM3  float64                 `json:"remaining_capacity_m3"`
	MinRouteSecurity     float64                 `json:"min_route_security"`
	IncludeStructures    bool                    `json:"include_structures"`
	AllowLowsec          bool                    `json:"allow_lowsec"`
	AllowNullsec         bool                    `json:"allow_nullsec"`
	AllowWormhole        bool                    `json:"allow_wormhole"`
	RouteMaxJumps        int                     `json:"route_max_jumps"`
	SalesTaxPercent      float64                 `json:"sales_tax_percent"`
	BuyBrokerFeePercent  float64                 `json:"buy_broker_fee_percent"`
	SellBrokerFeePercent float64                 `json:"sell_broker_fee_percent"`
	DeterministicSort    DeterministicSortConfig `json:"deterministic_sort"`
}

type MergedBatchManifest struct {
	OriginSystemID      int32               `json:"origin_system_id"`
	OriginLocationID    int64               `json:"origin_location_id"`
	FinalSellSystemID   int32               `json:"final_sell_system_id"`
	FinalSellLocationID int64               `json:"final_sell_location_id"`
	BaseLines           []BaseBatchLine     `json:"base_lines"`
	AddedLines          []RouteAdditionLine `json:"added_lines"`
	TotalLineCount      int                 `json:"total_line_count"`
	TotalUnits          int64               `json:"total_units"`
	TotalVolumeM3       float64             `json:"total_volume_m3"`
	CargoLimitM3        float64             `json:"cargo_limit_m3"`
	RemainingCapacityM3 float64             `json:"remaining_capacity_m3"`
	UtilizationPct      float64             `json:"utilization_pct"`
	TotalBuyISK         float64             `json:"total_buy_isk"`
	TotalSellISK        float64             `json:"total_sell_isk"`
	TotalProfitISK      float64             `json:"total_profit_isk"`
}

type BatchCreateRouteResponse struct {
	Request                  BatchCreateRouteRequest `json:"request"`
	MergedManifest           MergedBatchManifest     `json:"merged_manifest"`
	RankedOptions            []RouteAdditionOption   `json:"ranked_options"`
	SelectedOptionID         string                  `json:"selected_option_id"`
	SelectedRank             int                     `json:"selected_rank"`
	DeterministicSortApplied bool                    `json:"deterministic_sort_applied"`
	SortSignature            string                  `json:"sort_signature"`
}

func (r *BatchCreateRouteRequest) ApplyDefaults() {
	if r.RemainingCapacityM3 == 0 && r.CargoLimitM3 > 0 {
		r.RemainingCapacityM3 = r.CargoLimitM3
	}
}

func (r BatchCreateRouteRequest) Validate() error {
	if r.OriginSystemID <= 0 || r.OriginLocationID <= 0 {
		return errBatchRouteMissingOrigin
	}
	if r.CargoLimitM3 < 0 || r.RemainingCapacityM3 < 0 {
		return errBatchRouteNegativeCargo
	}
	if len(r.BaseBatch.BaseLines) == 0 {
		return errBatchRouteEmptyBaseLines
	}
	if r.BaseBatch.BaseSellSystemID <= 0 || r.BaseBatch.BaseSellLocationID <= 0 {
		return errBatchRouteMissingFinalSell
	}
	if r.DeterministicSort.Primary == "" || r.DeterministicSort.Secondary == "" {
		return errBatchRouteDeterministicSortEmpty
	}
	return nil
}

func (r BatchCreateRouteRequest) SortSignature() string {
	return fmt.Sprintf(
		"%s|%s|%v",
		r.DeterministicSort.Primary,
		r.DeterministicSort.Secondary,
		r.DeterministicSort.TieBreakOrder,
	)
}
