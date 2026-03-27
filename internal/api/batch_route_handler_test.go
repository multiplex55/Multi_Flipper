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
	}
}

func TestHandleBatchCreateRoute_ValidRequestReturnsRankedOptions(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	srv.ready = true
	srv.batchCreateRoutePlanner = func(_ context.Context, params engine.BatchCreateRouteParams) (engine.BatchCreateRouteResult, error) {
		if !params.IncludeStructures {
			t.Fatalf("IncludeStructures = false, want true")
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
