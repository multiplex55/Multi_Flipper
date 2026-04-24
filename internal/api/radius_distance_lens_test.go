package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"eve-flipper/internal/config"
	"eve-flipper/internal/graph"
	"eve-flipper/internal/sde"
)

func testUniverse() *graph.Universe {
	u := graph.NewUniverse()
	u.AddGate(1, 2)
	u.AddGate(2, 1)
	u.AddGate(2, 3)
	u.AddGate(3, 2)
	u.SetSecurity(1, 0.9)
	u.SetSecurity(2, 0.9)
	u.SetSecurity(3, 0.9)
	u.SetSecurity(4, 0.2)
	u.InitPathCache()
	return u
}

func TestBuildRadiusDistanceLensMetricReachable(t *testing.T) {
	srv := &Server{sdeData: &sde.Data{Universe: testUniverse()}}
	metric := srv.buildRadiusDistanceLensMetric(1, 0.45, radiusDistanceLensRow{
		RowKey:       "r1",
		BuySystemID:  2,
		SellSystemID: 3,
		TotalProfit:  900,
		RealProfit:   600,
		DailyProfit:  300,
	})
	if metric.Unreachable {
		t.Fatalf("expected reachable metric")
	}
	if metric.BuyJumps != 1 || metric.SellJumps != 1 || metric.TotalJumps != 2 {
		t.Fatalf("unexpected jumps: %+v", metric)
	}
	if metric.ProfitPerJump != 450 || metric.RealIskPerJump != 300 || metric.DailyIskPerJump != 150 {
		t.Fatalf("unexpected per-jump values: %+v", metric)
	}
}

func TestBuildRadiusDistanceLensMetricUnreachable(t *testing.T) {
	srv := &Server{sdeData: &sde.Data{Universe: testUniverse()}}
	metric := srv.buildRadiusDistanceLensMetric(1, 0.45, radiusDistanceLensRow{
		RowKey:       "r2",
		BuySystemID:  4,
		SellSystemID: 3,
		TotalProfit:  900,
		RealProfit:   600,
		DailyProfit:  300,
	})
	if !metric.Unreachable {
		t.Fatalf("expected unreachable metric")
	}
	if metric.TotalJumps != -1 || metric.ProfitPerJump != 0 || metric.RealIskPerJump != 0 || metric.DailyIskPerJump != 0 {
		t.Fatalf("unexpected unreachable metric values: %+v", metric)
	}
}

func TestBuildRadiusDistanceLensMetricZeroJumpGuard(t *testing.T) {
	srv := &Server{sdeData: &sde.Data{Universe: testUniverse()}}
	metric := srv.buildRadiusDistanceLensMetric(1, 0.45, radiusDistanceLensRow{
		RowKey:       "r3",
		BuySystemID:  1,
		SellSystemID: 1,
		TotalProfit:  100,
		RealProfit:   50,
		DailyProfit:  25,
	})
	if metric.TotalJumps != 0 {
		t.Fatalf("TotalJumps=%d want 0", metric.TotalJumps)
	}
	if metric.ProfitPerJump != 100 || metric.RealIskPerJump != 50 || metric.DailyIskPerJump != 25 {
		t.Fatalf("zero-jump guard failed: %+v", metric)
	}
}

func TestHandleRadiusDistanceLensDoesNotRequireScanPath(t *testing.T) {
	srv := NewServer(config.Default(), nil, nil, nil, nil)
	srv.sdeData = &sde.Data{Universe: testUniverse()}
	srv.scanner = nil

	payload := radiusDistanceLensRequest{
		OriginSystemID:   1,
		MinRouteSecurity: 0.45,
		Rows: []radiusDistanceLensRow{{
			RowKey:       "r1",
			BuySystemID:  2,
			SellSystemID: 3,
			TotalProfit:  900,
			RealProfit:   600,
			DailyProfit:  300,
		}},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/scan/radius-distance-lens", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	srv.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var resp radiusDistanceLensResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Rows) != 1 || resp.Rows[0].TotalJumps != 2 {
		t.Fatalf("unexpected response rows: %+v", resp.Rows)
	}
}
