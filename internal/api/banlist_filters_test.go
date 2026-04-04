package api

import (
	"testing"

	"eve-flipper/internal/engine"
)

func TestFilterFlipResultsByBanlist(t *testing.T) {
	rows := []engine.FlipResult{
		{TypeID: 10, BuyLocationID: 100, SellLocationID: 200},
		{TypeID: 11, BuyLocationID: 101, SellLocationID: 201},
	}
	banned := banlistPredicates{
		typeIDs:    map[int32]struct{}{10: {}},
		stationIDs: map[int64]struct{}{201: {}},
	}

	filtered := filterFlipResultsByBanlist(rows, banned)
	if len(filtered) != 0 {
		t.Fatalf("expected all rows filtered, got %d", len(filtered))
	}
}

func TestFilterRouteResultsByBanlist(t *testing.T) {
	routes := []engine.RouteResult{
		{Hops: []engine.RouteHop{{TypeID: 22, LocationID: 300, DestLocationID: 301}}},
		{Hops: []engine.RouteHop{{TypeID: 23, LocationID: 302, DestLocationID: 303}}},
	}
	banned := banlistPredicates{
		typeIDs:    map[int32]struct{}{22: {}},
		stationIDs: map[int64]struct{}{303: {}},
	}

	filtered := filterRouteResultsByBanlist(routes, banned)
	if len(filtered) != 0 {
		t.Fatalf("expected all routes filtered, got %d", len(filtered))
	}
}

func TestFilterStationTradesByBanlist(t *testing.T) {
	rows := []engine.StationTrade{
		{TypeID: 33, StationID: 444},
		{TypeID: 34, StationID: 445},
	}
	banned := banlistPredicates{
		typeIDs:    map[int32]struct{}{33: {}},
		stationIDs: map[int64]struct{}{445: {}},
	}

	filtered := filterStationTradesByBanlist(rows, banned)
	if len(filtered) != 0 {
		t.Fatalf("expected all rows filtered, got %d", len(filtered))
	}
}
