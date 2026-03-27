package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"eve-flipper/internal/config"
	"eve-flipper/internal/engine"
	"eve-flipper/internal/esi"
)

func testBatchCreateRouteRequest() BatchCreateRouteRequest {
	return BatchCreateRouteRequest{
		OriginSystemID:      30000142,
		OriginLocationID:    60003760,
		CurrentSystemID:     30000142,
		CurrentLocationID:   60003760,
		CargoLimitM3:        1000,
		RemainingCapacityM3: 400,
		IncludeStructures:   true,
		BaseBatch: BaseBatchManifest{
			BaseBuySystemID:    30000142,
			BaseBuyLocationID:  60003760,
			BaseSellSystemID:   30002187,
			BaseSellLocationID: 60008494,
			BaseLines: []BaseBatchLine{
				{TypeID: 34, Units: 100, UnitVolumeM3: 1.0, BuyTotalISK: 1000, SellTotalISK: 1200, ProfitTotalISK: 200},
			},
			TotalUnits:     100,
			TotalVolumeM3:  100,
			TotalBuyISK:    1000,
			TotalSellISK:   1200,
			TotalProfitISK: 200,
		},
		DeterministicSort: DeterministicSortConfig{
			Primary:   "total_profit_isk",
			Secondary: "isk_per_jump",
		},
		AllowLowsec:   true,
		AllowNullsec:  false,
		AllowWormhole: false,
	}
}

func TestHandleBatchCreateRoute_ValidRequestReturnsRankedOptions(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true
	srv.batchCreateRoutePlanner = func(_ context.Context, params engine.BatchCreateRouteParams) (engine.BatchCreateRouteResult, error) {
		if !params.IncludeStructures {
			t.Fatalf("IncludeStructures = false, want true")
		}
		if !params.AllowLowsec || params.AllowNullsec || params.AllowWormhole {
			t.Fatalf("allow flags = %+v, want lowsec-only", params)
		}
		if params.CurrentSystemID != 30000142 {
			t.Fatalf("CurrentSystemID = %d, want 30000142", params.CurrentSystemID)
		}
		return engine.BatchCreateRouteResult{
			Options: []engine.BatchCreateRouteOption{
				{
					OptionID:       "batch-option-1",
					AddedVolumeM3:  100,
					TotalBuyISK:    500,
					TotalSellISK:   700,
					TotalProfitISK: 180,
					TotalJumps:     8,
					ISKPerJump:     22.5,
					Lines: []engine.BatchCreateRouteLine{
						{
							TypeID:         35,
							TypeName:       "Pyerite",
							Units:          100,
							UnitVolumeM3:   1,
							BuySystemID:    30000142,
							BuyLocationID:  60003760,
							SellSystemID:   30002187,
							SellLocationID: 60008494,
							BuyTotalISK:    500,
							SellTotalISK:   700,
							ProfitTotalISK: 180,
							RouteJumps:     8,
						},
					},
				},
			},
			SelectedID:   "batch-option-1",
			SelectedRank: 1,
		}, nil
	}

	reqPayload := testBatchCreateRouteRequest()
	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var resp BatchCreateRouteResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.RankedOptions) != 1 {
		t.Fatalf("ranked options = %d, want 1", len(resp.RankedOptions))
	}
	if resp.SelectedOptionID != "batch-option-1" {
		t.Fatalf("SelectedOptionID = %q, want batch-option-1", resp.SelectedOptionID)
	}
}

func TestHandleBatchCreateRoute_MapsPolicyFlagsAndCurrentContext(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true
	captured := make([]engine.BatchCreateRouteParams, 0, 2)
	srv.batchCreateRoutePlanner = func(_ context.Context, params engine.BatchCreateRouteParams) (engine.BatchCreateRouteResult, error) {
		captured = append(captured, params)
		return engine.BatchCreateRouteResult{}, nil
	}

	reqPayload := testBatchCreateRouteRequest()
	reqPayload.AllowLowsec = false
	reqPayload.AllowNullsec = true
	reqPayload.AllowWormhole = true
	reqPayload.CurrentSystemID = 30002187
	reqPayload.CurrentLocationID = 60008494
	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if len(captured) != 1 {
		t.Fatalf("planner calls = %d, want 1", len(captured))
	}
	if captured[0].CurrentSystemID != 30002187 {
		t.Fatalf("CurrentSystemID = %d, want 30002187", captured[0].CurrentSystemID)
	}
	if captured[0].AllowLowsec || !captured[0].AllowNullsec || !captured[0].AllowWormhole {
		t.Fatalf("allow flags = %+v, want lowsec=false nullsec=true wormhole=true", captured[0])
	}
}

func TestHandleBatchCreateRoute_FilterCombinationsProduceDistinctPlannerInputs(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true
	captured := make([]engine.BatchCreateRouteParams, 0, 2)
	srv.batchCreateRoutePlanner = func(_ context.Context, params engine.BatchCreateRouteParams) (engine.BatchCreateRouteResult, error) {
		captured = append(captured, params)
		return engine.BatchCreateRouteResult{}, nil
	}

	base := testBatchCreateRouteRequest()
	base.AllowLowsec = false
	base.AllowNullsec = false
	base.AllowWormhole = false
	base.CurrentSystemID = base.OriginSystemID
	body, _ := json.Marshal(base)
	req := httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("first status = %d, want 200", rec.Code)
	}

	base.AllowLowsec = true
	base.AllowNullsec = true
	base.AllowWormhole = true
	base.CurrentSystemID = 30002187
	body, _ = json.Marshal(base)
	req = httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec = httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("second status = %d, want 200", rec.Code)
	}

	if len(captured) != 2 {
		t.Fatalf("planner calls = %d, want 2", len(captured))
	}
	if captured[0].AllowLowsec == captured[1].AllowLowsec &&
		captured[0].AllowNullsec == captured[1].AllowNullsec &&
		captured[0].AllowWormhole == captured[1].AllowWormhole &&
		captured[0].CurrentSystemID == captured[1].CurrentSystemID {
		t.Fatalf("expected distinct planner inputs, got identical params: %#v", captured)
	}
}

func TestHandleBatchCreateRoute_InvalidRequestReturns400(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true

	req := httptest.NewRequest(http.MethodPost, "/api/batch/create-route", strings.NewReader(`{"origin_system_id":0}`))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestHandleBatchCreateRoute_MissingOriginReturns400(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true

	reqPayload := testBatchCreateRouteRequest()
	reqPayload.OriginSystemID = 0
	reqPayload.OriginLocationID = 0
	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "missing origin") {
		t.Fatalf("body = %q, want missing origin", rec.Body.String())
	}
}

func TestHandleBatchCreateRoute_MissingFinalSellReturns400(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true

	reqPayload := testBatchCreateRouteRequest()
	reqPayload.BaseBatch.BaseSellSystemID = 0
	reqPayload.BaseBatch.BaseSellLocationID = 0
	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "missing final sell location/system") {
		t.Fatalf("body = %q, want missing final sell location/system", rec.Body.String())
	}
}

func TestHandleBatchCreateRoute_NoRemainingCargoReturnsEmptyOptions(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true
	srv.batchCreateRoutePlanner = func(_ context.Context, _ engine.BatchCreateRouteParams) (engine.BatchCreateRouteResult, error) {
		return engine.BatchCreateRouteResult{
			Options:     nil,
			Diagnostics: []string{"no remaining cargo capacity; nothing to add"},
		}, nil
	}

	reqPayload := testBatchCreateRouteRequest()
	reqPayload.RemainingCapacityM3 = 0
	reqPayload.CargoLimitM3 = 1000
	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var resp BatchCreateRouteResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.RankedOptions) != 0 {
		t.Fatalf("ranked options = %d, want 0", len(resp.RankedOptions))
	}
	if len(resp.Diagnostics) == 0 || !strings.Contains(resp.Diagnostics[0], "no remaining cargo") {
		t.Fatalf("diagnostics = %v, want no remaining cargo message", resp.Diagnostics)
	}
}

func TestHandleBatchCreateRoute_IncludeExcludeStructuresBehavior(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true
	srv.batchCreateRoutePlanner = func(_ context.Context, params engine.BatchCreateRouteParams) (engine.BatchCreateRouteResult, error) {
		if params.IncludeStructures {
			return engine.BatchCreateRouteResult{
				Options:    []engine.BatchCreateRouteOption{{OptionID: "with-structure", AddedVolumeM3: 1}},
				SelectedID: "with-structure", SelectedRank: 1,
			}, nil
		}
		return engine.BatchCreateRouteResult{
			Options:     nil,
			Diagnostics: []string{"structure orders excluded by request"},
		}, nil
	}

	reqPayload := testBatchCreateRouteRequest()
	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("include status = %d, want 200", rec.Code)
	}
	var includeResp BatchCreateRouteResponse
	if err := json.NewDecoder(rec.Body).Decode(&includeResp); err != nil {
		t.Fatalf("decode include response: %v", err)
	}
	if len(includeResp.RankedOptions) != 1 {
		t.Fatalf("include ranked options = %d, want 1", len(includeResp.RankedOptions))
	}

	reqPayload.IncludeStructures = false
	body, _ = json.Marshal(reqPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec = httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("exclude status = %d, want 200", rec.Code)
	}
	var excludeResp BatchCreateRouteResponse
	if err := json.NewDecoder(rec.Body).Decode(&excludeResp); err != nil {
		t.Fatalf("decode exclude response: %v", err)
	}
	if len(excludeResp.RankedOptions) != 0 {
		t.Fatalf("exclude ranked options = %d, want 0", len(excludeResp.RankedOptions))
	}
	if len(excludeResp.Diagnostics) == 0 {
		t.Fatalf("exclude diagnostics empty, want structure exclusion message")
	}
}

func TestHandleBatchCreateRoute_StaleSnapshotFallbackDiagnosticsPassedThrough(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true
	srv.batchCreateRoutePlanner = func(_ context.Context, _ engine.BatchCreateRouteParams) (engine.BatchCreateRouteResult, error) {
		return engine.BatchCreateRouteResult{
			Options: []engine.BatchCreateRouteOption{
				{OptionID: "fallback-cache", AddedVolumeM3: 42, TotalProfitISK: 1000},
			},
			Diagnostics:  []string{"market snapshot stale; served deterministic fallback from cache"},
			SelectedID:   "fallback-cache",
			SelectedRank: 1,
		}, nil
	}

	reqPayload := testBatchCreateRouteRequest()
	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var resp BatchCreateRouteResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Diagnostics) == 0 || !strings.Contains(resp.Diagnostics[0], "stale") {
		t.Fatalf("diagnostics = %v, want stale fallback diagnostic", resp.Diagnostics)
	}
}

func TestHandleBatchCreateRoute_MapsCandidateSnapshotToPlanner(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true
	captured := engine.BatchCreateRouteParams{}
	srv.batchCreateRoutePlanner = func(_ context.Context, params engine.BatchCreateRouteParams) (engine.BatchCreateRouteResult, error) {
		captured = params
		return engine.BatchCreateRouteResult{}, nil
	}

	reqPayload := testBatchCreateRouteRequest()
	reqPayload.CandidateContext = &BatchRouteCandidateContext{
		SourceTab:     "radius",
		CacheRevision: 77,
	}
	reqPayload.CandidateSnapshot = []BatchRouteCandidateLine{
		{
			TypeID:         35,
			TypeName:       "Pyerite",
			Units:          120,
			UnitVolumeM3:   0.01,
			BuySystemID:    30000142,
			BuyLocationID:  60003760,
			SellSystemID:   30002187,
			SellLocationID: 60008494,
			BuyPriceISK:    6.0,
			SellPriceISK:   7.2,
		},
	}
	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/batch/create-route", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !captured.CandidateContextSeen {
		t.Fatalf("expected candidate context flag to be true")
	}
	if len(captured.CandidateLines) != 1 {
		t.Fatalf("candidate lines = %d, want 1", len(captured.CandidateLines))
	}
	if captured.CandidateLines[0].TypeID != 35 {
		t.Fatalf("candidate type = %d, want 35", captured.CandidateLines[0].TypeID)
	}
}
