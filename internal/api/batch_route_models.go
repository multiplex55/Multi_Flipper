package api

import (
	"errors"
	"fmt"

	"eve-flipper/internal/engine"
)

var (
	errBatchRouteMissingOrigin          = errors.New("missing origin")
	errBatchRouteMissingBaseBuy         = errors.New("missing base buy location/system")
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
	TypeID             int32   `json:"type_id"`
	TypeName           string  `json:"type_name"`
	Units              int64   `json:"units"`
	UnitVolumeM3       float64 `json:"unit_volume_m3"`
	BuySystemID        int32   `json:"buy_system_id"`
	BuyLocationID      int64   `json:"buy_location_id"`
	SellSystemID       int32   `json:"sell_system_id"`
	SellLocationID     int64   `json:"sell_location_id"`
	BuyTotalISK        float64 `json:"buy_total_isk"`
	SellTotalISK       float64 `json:"sell_total_isk"`
	ProfitTotalISK     float64 `json:"profit_total_isk"`
	RouteJumps         int     `json:"route_jumps"`
	FillConfidence     float64 `json:"fill_confidence"`
	StaleRisk          float64 `json:"stale_risk"`
	Concentration      float64 `json:"concentration_risk"`
	LineExecutionScore float64 `json:"line_execution_score"`
	LineRole           string  `json:"line_role"`
}

type RouteOptionRankingInputs struct {
	TotalProfitISK float64 `json:"total_profit_isk"`
	TotalJumps     int     `json:"total_jumps"`
	ISKPerJump     float64 `json:"isk_per_jump"`
	UtilizationPct float64 `json:"utilization_pct"`
}

type RouteAdditionOption struct {
	OptionID               string                             `json:"option_id"`
	StrategyID             string                             `json:"strategy_id,omitempty"`
	StrategyLabel          string                             `json:"strategy_label,omitempty"`
	Rank                   int                                `json:"rank"`
	Lines                  []RouteAdditionLine                `json:"lines"`
	LineCount              int                                `json:"line_count"`
	AddedVolumeM3          float64                            `json:"added_volume_m3"`
	UtilizationPct         float64                            `json:"utilization_pct"`
	TotalBuyISK            float64                            `json:"total_buy_isk"`
	TotalSellISK           float64                            `json:"total_sell_isk"`
	TotalProfitISK         float64                            `json:"total_profit_isk"`
	TotalJumps             int                                `json:"total_jumps"`
	ISKPerJump             float64                            `json:"isk_per_jump"`
	ExecutionScore         float64                            `json:"execution_score"`
	Recommended            bool                               `json:"recommended"`
	RecommendationScore    float64                            `json:"recommendation_score"`
	ReasonChips            []string                           `json:"reason_chips,omitempty"`
	WarningChips           []string                           `json:"warning_chips,omitempty"`
	ScoreBreakdown         []engine.RouteScoreFactorBreakdown `json:"score_breakdown,omitempty"`
	RankingInputs          RouteOptionRankingInputs           `json:"ranking_inputs"`
	RankingTieBreakValues  []float64                          `json:"ranking_tie_break_values"`
	RankingSortKey         string                             `json:"ranking_sort_key"`
	OrderedBuySystems      []int32                            `json:"ordered_buy_systems,omitempty"`
	RouteSequence          []int32                            `json:"route_sequence,omitempty"`
	RouteTotalJumps        int                                `json:"route_total_jumps,omitempty"`
	CoreLineCount          int                                `json:"core_line_count"`
	SafeFillerLineCount    int                                `json:"safe_filler_line_count"`
	StretchFillerLineCount int                                `json:"stretch_filler_line_count"`
	CoreProfitTotalISK     float64                            `json:"core_profit_total_isk"`
	SafeFillerProfitISK    float64                            `json:"safe_filler_profit_isk"`
	StretchFillerProfitISK float64                            `json:"stretch_filler_profit_isk"`
}

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
	Preset            string                      `json:"preset"`
	UtilizationTarget float64                     `json:"utilization_target"`
	Weights           *RouteExecutionScoreWeights `json:"weights"`
}

type DeterministicSortConfig struct {
	Primary       string   `json:"primary"`
	Secondary     string   `json:"secondary"`
	TieBreakOrder []string `json:"tie_break_order"`
}

type BatchCreateRouteRequest struct {
	OriginSystemID        int32                       `json:"origin_system_id"`
	OriginSystemName      string                      `json:"origin_system_name"`
	OriginLocationID      int64                       `json:"origin_location_id"`
	OriginLocationName    string                      `json:"origin_location_name"`
	CurrentSystemID       int32                       `json:"current_system_id"`
	CurrentLocationID     int64                       `json:"current_location_id"`
	BaseBatch             BaseBatchManifest           `json:"base_batch"`
	CargoLimitM3          float64                     `json:"cargo_limit_m3"`
	RemainingCapacityM3   float64                     `json:"remaining_capacity_m3"`
	MinRouteSecurity      float64                     `json:"min_route_security"`
	IncludeStructures     bool                        `json:"include_structures"`
	AllowLowsec           bool                        `json:"allow_lowsec"`
	AllowNullsec          bool                        `json:"allow_nullsec"`
	AllowWormhole         bool                        `json:"allow_wormhole"`
	RouteMaxJumps         int                         `json:"route_max_jumps"`
	MaxDetourJumpsPerNode int                         `json:"max_detour_jumps_per_node"`
	SalesTaxPercent       float64                     `json:"sales_tax_percent"`
	BuyBrokerFeePercent   float64                     `json:"buy_broker_fee_percent"`
	SellBrokerFeePercent  float64                     `json:"sell_broker_fee_percent"`
	DeterministicSort     DeterministicSortConfig     `json:"deterministic_sort"`
	ExecutionScoring      RouteExecutionScoringConfig `json:"execution_scoring,omitempty"`
	CandidateContext      *BatchRouteCandidateContext `json:"candidate_context,omitempty"`
	CandidateSnapshot     []BatchRouteCandidateLine   `json:"candidate_snapshot,omitempty"`
}

type BatchRouteCandidateContext struct {
	SourceTab       string `json:"source_tab,omitempty"`
	CacheRevision   int64  `json:"cache_revision,omitempty"`
	CacheNextExpiry string `json:"cache_next_expiry,omitempty"`
	CacheStale      bool   `json:"cache_stale,omitempty"`
}

type BatchRouteCandidateLine struct {
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
	FillConfidence float64 `json:"fill_confidence,omitempty"`
	CapitalLockup  float64 `json:"capital_lockup_duration,omitempty"`
	StaleRisk      float64 `json:"stale_snapshot_risk,omitempty"`
	Concentration  float64 `json:"concentration_risk,omitempty"`
}

type BatchRouteFillerSuggestionsRequest struct {
	CargoLimitM3      float64                     `json:"cargo_limit_m3"`
	OriginSystemID    int32                       `json:"origin_system_id"`
	CurrentSystemID   int32                       `json:"current_system_id"`
	MinRouteSecurity  float64                     `json:"min_route_security"`
	AllowLowsec       bool                        `json:"allow_lowsec"`
	AllowNullsec      bool                        `json:"allow_nullsec"`
	AllowWormhole     bool                        `json:"allow_wormhole"`
	RouteMaxJumps     int                         `json:"route_max_jumps"`
	ExecutionScoring  RouteExecutionScoringConfig `json:"execution_scoring,omitempty"`
	BaseLines         []BaseBatchLine             `json:"base_lines"`
	SelectedAdditions []RouteAdditionLine         `json:"selected_additions"`
	CandidateSnapshot []BatchRouteCandidateLine   `json:"candidate_snapshot"`
}

type BatchRouteFillerSuggestion struct {
	TypeID          int32   `json:"type_id"`
	TypeName        string  `json:"type_name"`
	Units           int64   `json:"units"`
	UnitVolumeM3    float64 `json:"unit_volume_m3"`
	BuySystemID     int32   `json:"buy_system_id"`
	BuyLocationID   int64   `json:"buy_location_id"`
	SellSystemID    int32   `json:"sell_system_id"`
	SellLocationID  int64   `json:"sell_location_id"`
	VolumeM3        float64 `json:"volume_m3"`
	AddedProfitISK  float64 `json:"added_profit_isk"`
	AddedCapitalISK float64 `json:"added_capital_isk"`
	FillConfidence  float64 `json:"fill_confidence"`
	StaleRisk       float64 `json:"stale_risk"`
	SuggestedRole   string  `json:"suggested_role"`
	FillerScore     float64 `json:"filler_score"`
}

type BatchRouteFillerSuggestionsResponse struct {
	RemainingCapacityM3 float64                      `json:"remaining_capacity_m3"`
	Suggestions         []BatchRouteFillerSuggestion `json:"suggestions"`
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

type RouteExecutionManifest struct {
	Corridor   RouteExecutionCorridorSummary   `json:"corridor"`
	Stops      []RouteExecutionManifestStop    `json:"stops"`
	RunTotals  RouteExecutionManifestRunTotals `json:"run_totals"`
	Validation RouteValidationSnapshotSummary  `json:"validation"`
}

type RouteExecutionCorridorSummary struct {
	Origin            RouteExecutionManifestEndpoint  `json:"origin"`
	StopSequence      []RouteExecutionManifestStopRef `json:"stop_sequence"`
	TotalJumps        int                             `json:"total_jumps"`
	DistinctStopCount int                             `json:"distinct_stop_count"`
}

type RouteExecutionManifestEndpoint struct {
	SystemID     int32  `json:"system_id"`
	SystemName   string `json:"system_name"`
	LocationID   int64  `json:"location_id"`
	LocationName string `json:"location_name"`
}

type RouteExecutionManifestStopRef struct {
	StopKey      string `json:"stop_key"`
	SystemID     int32  `json:"system_id"`
	SystemName   string `json:"system_name"`
	LocationID   int64  `json:"location_id"`
	LocationName string `json:"location_name"`
}

type RouteExecutionManifestStop struct {
	StopKey            string                             `json:"stop_key"`
	SystemID           int32                              `json:"system_id"`
	SystemName         string                             `json:"system_name"`
	LocationID         int64                              `json:"location_id"`
	LocationName       string                             `json:"location_name"`
	JumpsFromPrevious  *int                               `json:"jumps_from_previous,omitempty"`
	BuyActions         []RouteExecutionManifestActionLine `json:"buy_actions"`
	SellActions        []RouteExecutionManifestActionLine `json:"sell_actions"`
	StopBuyTotalISK    float64                            `json:"stop_buy_total_isk"`
	StopSellTotalISK   float64                            `json:"stop_sell_total_isk"`
	StopNetDeltaISK    float64                            `json:"stop_net_delta_isk"`
	CargoUsedAfterM3   float64                            `json:"cargo_used_after_m3"`
	CargoRemainAfterM3 float64                            `json:"cargo_remain_after_m3"`
	Warnings           []string                           `json:"warnings,omitempty"`
}

type RouteExecutionManifestActionLine struct {
	TypeID         int32   `json:"type_id"`
	TypeName       string  `json:"type_name"`
	Units          int64   `json:"units"`
	UnitVolumeM3   float64 `json:"unit_volume_m3"`
	VolumeM3       float64 `json:"volume_m3"`
	BuySystemID    int32   `json:"buy_system_id"`
	BuyLocationID  int64   `json:"buy_location_id"`
	SellSystemID   int32   `json:"sell_system_id"`
	SellLocationID int64   `json:"sell_location_id"`
	BuyTotalISK    float64 `json:"buy_total_isk"`
	SellTotalISK   float64 `json:"sell_total_isk"`
	NetDeltaISK    float64 `json:"net_delta_isk"`
}

type RouteExecutionManifestRunTotals struct {
	CapitalISK       float64 `json:"capital_isk"`
	GrossSellISK     float64 `json:"gross_sell_isk"`
	NetISK           float64 `json:"net_isk"`
	CargoUsedM3      float64 `json:"cargo_used_m3"`
	CargoRemainingM3 float64 `json:"cargo_remaining_m3"`
}

type RouteValidationSnapshotSummary struct {
	CandidateContextSeen  bool `json:"candidate_context_seen"`
	CandidateSnapshotRows int  `json:"candidate_snapshot_rows"`
	IncludedRows          int  `json:"included_rows"`
	ExcludedZeroRows      int  `json:"excluded_zero_rows"`
}

type BatchCreateRouteResponse struct {
	Request                  BatchCreateRouteRequest `json:"request"`
	MergedManifest           MergedBatchManifest     `json:"merged_manifest"`
	RankedOptions            []RouteAdditionOption   `json:"ranked_options"`
	Diagnostics              []string                `json:"diagnostics,omitempty"`
	SelectedOptionID         string                  `json:"selected_option_id"`
	SelectedRank             int                     `json:"selected_rank"`
	DeterministicSortApplied bool                    `json:"deterministic_sort_applied"`
	SortSignature            string                  `json:"sort_signature"`
	RouteManifest            *RouteExecutionManifest `json:"route_manifest,omitempty"`
}

func (r *BatchCreateRouteRequest) ApplyDefaults() {
	if r.CurrentSystemID <= 0 {
		r.CurrentSystemID = r.OriginSystemID
	}
	if r.CurrentLocationID <= 0 {
		r.CurrentLocationID = r.OriginLocationID
	}
	if r.RemainingCapacityM3 == 0 && r.CargoLimitM3 > 0 {
		r.RemainingCapacityM3 = r.CargoLimitM3
	}
	if r.RouteMaxJumps <= 0 {
		r.RouteMaxJumps = 50
	}
	if r.DeterministicSort.Primary == "" {
		r.DeterministicSort.Primary = "total_profit_isk"
	}
	if r.DeterministicSort.Secondary == "" {
		r.DeterministicSort.Secondary = "isk_per_jump"
	}
}

func (r BatchCreateRouteRequest) Validate() error {
	if r.OriginSystemID <= 0 || r.OriginLocationID <= 0 {
		return errBatchRouteMissingOrigin
	}
	if r.BaseBatch.BaseBuySystemID <= 0 || r.BaseBatch.BaseBuyLocationID <= 0 {
		return errBatchRouteMissingBaseBuy
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
