package engine

import (
	"fmt"
	"math"
	"sort"
)

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

type RouteExecutionManifestBuildInput struct {
	Origin                RouteExecutionManifestEndpoint
	CargoLimitM3          float64
	Lines                 []BatchCreateRouteLine
	RouteSequence         []int32
	TotalJumps            int
	CandidateSnapshotRows int
	CandidateContextSeen  bool
}

func BuildRouteExecutionManifest(input RouteExecutionManifestBuildInput) RouteExecutionManifest {
	stopsByKey := make(map[string]*RouteExecutionManifestStop)
	zeroRows := 0
	includedRows := 0

	for _, line := range input.Lines {
		if line.Units <= 0 || line.UnitVolumeM3 <= 0 {
			zeroRows++
			continue
		}
		includedRows++
		buyStop := ensureManifestStop(stopsByKey, line.BuySystemID, line.BuyLocationID)
		sellStop := ensureManifestStop(stopsByKey, line.SellSystemID, line.SellLocationID)
		action := manifestActionFromLine(line)
		buyStop.BuyActions = append(buyStop.BuyActions, action)
		sellStop.SellActions = append(sellStop.SellActions, action)
	}

	stops := make([]RouteExecutionManifestStop, 0, len(stopsByKey))
	for _, stop := range stopsByKey {
		calculateManifestStopTotals(stop)
		stops = append(stops, *stop)
	}
	sortManifestStops(stops, input.RouteSequence)

	cargoUsed := 0.0
	for i := range stops {
		for _, buy := range stops[i].BuyActions {
			cargoUsed += buy.VolumeM3
		}
		stops[i].CargoUsedAfterM3 = cargoUsed
		if input.CargoLimitM3 > 0 {
			stops[i].CargoRemainAfterM3 = math.Max(0, input.CargoLimitM3-cargoUsed)
		}
	}

	sequence := make([]RouteExecutionManifestStopRef, 0, len(stops))
	for i := range stops {
		stop := &stops[i]
		sequence = append(sequence, RouteExecutionManifestStopRef{
			StopKey:      stop.StopKey,
			SystemID:     stop.SystemID,
			SystemName:   stop.SystemName,
			LocationID:   stop.LocationID,
			LocationName: stop.LocationName,
		})
		if i == 0 {
			zero := 0
			stop.JumpsFromPrevious = &zero
			continue
		}
		if jumps := inferJumpsFromPrevious(stops[i-1], *stop, input.RouteSequence); jumps != nil {
			stop.JumpsFromPrevious = jumps
		}
	}

	capital := 0.0
	grossSell := 0.0
	for _, line := range input.Lines {
		if line.Units <= 0 || line.UnitVolumeM3 <= 0 {
			continue
		}
		capital += line.BuyTotalISK
		grossSell += line.SellTotalISK
	}
	remaining := 0.0
	if input.CargoLimitM3 > 0 {
		remaining = math.Max(0, input.CargoLimitM3-cargoUsed)
	}

	return RouteExecutionManifest{
		Corridor: RouteExecutionCorridorSummary{
			Origin:            input.Origin,
			StopSequence:      sequence,
			TotalJumps:        input.TotalJumps,
			DistinctStopCount: len(stops),
		},
		Stops: stops,
		RunTotals: RouteExecutionManifestRunTotals{
			CapitalISK:       capital,
			GrossSellISK:     grossSell,
			NetISK:           grossSell - capital,
			CargoUsedM3:      cargoUsed,
			CargoRemainingM3: remaining,
		},
		Validation: RouteValidationSnapshotSummary{
			CandidateContextSeen:  input.CandidateContextSeen,
			CandidateSnapshotRows: input.CandidateSnapshotRows,
			IncludedRows:          includedRows,
			ExcludedZeroRows:      zeroRows,
		},
	}
}

func ensureManifestStop(stopsByKey map[string]*RouteExecutionManifestStop, systemID int32, locationID int64) *RouteExecutionManifestStop {
	key := fmt.Sprintf("%d:%d", systemID, locationID)
	if stop, ok := stopsByKey[key]; ok {
		return stop
	}
	stop := &RouteExecutionManifestStop{
		StopKey:      key,
		SystemID:     systemID,
		SystemName:   fmt.Sprintf("System %d", systemID),
		LocationID:   locationID,
		LocationName: fmt.Sprintf("Location %d", locationID),
		BuyActions:   make([]RouteExecutionManifestActionLine, 0, 4),
		SellActions:  make([]RouteExecutionManifestActionLine, 0, 4),
	}
	stopsByKey[key] = stop
	return stop
}

func manifestActionFromLine(line BatchCreateRouteLine) RouteExecutionManifestActionLine {
	volume := float64(line.Units) * line.UnitVolumeM3
	return RouteExecutionManifestActionLine{
		TypeID:         line.TypeID,
		TypeName:       line.TypeName,
		Units:          line.Units,
		UnitVolumeM3:   line.UnitVolumeM3,
		VolumeM3:       volume,
		BuySystemID:    line.BuySystemID,
		BuyLocationID:  line.BuyLocationID,
		SellSystemID:   line.SellSystemID,
		SellLocationID: line.SellLocationID,
		BuyTotalISK:    line.BuyTotalISK,
		SellTotalISK:   line.SellTotalISK,
		NetDeltaISK:    line.SellTotalISK - line.BuyTotalISK,
	}
}

func calculateManifestStopTotals(stop *RouteExecutionManifestStop) {
	for _, buy := range stop.BuyActions {
		stop.StopBuyTotalISK += buy.BuyTotalISK
	}
	for _, sell := range stop.SellActions {
		stop.StopSellTotalISK += sell.SellTotalISK
	}
	stop.StopNetDeltaISK = stop.StopSellTotalISK - stop.StopBuyTotalISK
	if stop.StopNetDeltaISK < 0 {
		stop.Warnings = append(stop.Warnings, "negative_net_delta")
	}
}

func sortManifestStops(stops []RouteExecutionManifestStop, routeSequence []int32) {
	indexBySystem := make(map[int32]int, len(routeSequence))
	for i, systemID := range routeSequence {
		if _, exists := indexBySystem[systemID]; !exists {
			indexBySystem[systemID] = i
		}
	}
	sort.SliceStable(stops, func(i, j int) bool {
		leftIndex, leftFound := indexBySystem[stops[i].SystemID]
		rightIndex, rightFound := indexBySystem[stops[j].SystemID]
		if leftFound || rightFound {
			if !leftFound {
				return false
			}
			if !rightFound {
				return true
			}
			if leftIndex != rightIndex {
				return leftIndex < rightIndex
			}
		}
		if stops[i].SystemID != stops[j].SystemID {
			return stops[i].SystemID < stops[j].SystemID
		}
		return stops[i].LocationID < stops[j].LocationID
	})
}

func inferJumpsFromPrevious(previous RouteExecutionManifestStop, current RouteExecutionManifestStop, routeSequence []int32) *int {
	if len(routeSequence) == 0 {
		return nil
	}
	left := -1
	right := -1
	for i, systemID := range routeSequence {
		if left == -1 && systemID == previous.SystemID {
			left = i
		}
		if right == -1 && systemID == current.SystemID {
			right = i
		}
	}
	if left == -1 || right == -1 || right < left {
		return nil
	}
	j := right - left
	return &j
}
