package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"eve-flipper/internal/config"
	"eve-flipper/internal/engine"
	"eve-flipper/internal/esi"
)

func TestHandleRoutePlanner_ReturnsRankedGroupedOptions(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true
	srv.routeSelectedPlanner = func(_ context.Context, params engine.RouteSelectedPlannerParams) (engine.RouteSelectedPlannerResult, error) {
		if len(params.SelectedRouteStops) != 2 {
			t.Fatalf("selected stops = %d, want 2", len(params.SelectedRouteStops))
		}
		return engine.RouteSelectedPlannerResult{
			Options: []engine.RouteSelectedExpansionOption{{
				BatchCreateRouteOption: engine.BatchCreateRouteOption{
					OptionID:       "max-total-profit",
					TotalProfitISK: 100,
					TotalJumps:     5,
					ISKPerJump:     20,
					Lines:          []engine.BatchCreateRouteLine{{TypeID: 1, TypeName: "Type-1", Units: 3, UnitVolumeM3: 1, BuySystemID: 10, BuyLocationID: 1002, SellSystemID: 30, SellLocationID: 3001, BuyTotalISK: 30, SellTotalISK: 60, ProfitTotalISK: 30, RouteJumps: 5}},
				},
				ManifestByStop: []engine.RouteSelectedManifestStopGroup{{StopSystemID: 30, StopLocationID: 3001, TotalSellUnits: 3, TotalSellVolumeM3: 3, TotalBuyISK: 30, TotalSellISK: 60, TotalProfitISK: 30}},
			}},
			Diagnostics: []string{"ok"},
			SnapshotID:  "snap-1",
		}, nil
	}

	req := RoutePlannerRequest{
		SelectedRouteStops:  []RoutePlannerStop{{SystemID: 10, LocationID: 1001}, {SystemID: 30, LocationID: 3001}},
		CargoLimitM3:        100,
		RemainingCapacityM3: 50,
		CandidateSnapshotID: "snap-1",
	}
	body, _ := json.Marshal(req)
	httpReq := httptest.NewRequest(http.MethodPost, "/api/route/planner", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, httpReq)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var resp RoutePlannerResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Options) != 1 {
		t.Fatalf("options = %d, want 1", len(resp.Options))
	}
	if len(resp.Options[0].ManifestByStop) != 1 {
		t.Fatalf("manifest groups = %d, want 1", len(resp.Options[0].ManifestByStop))
	}
	if !resp.DeterministicSort {
		t.Fatalf("DeterministicSort = false, want true")
	}
}
