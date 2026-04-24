package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"eve-flipper/internal/db"
)

func TestDiffTimeline_ScanHistoryEndpoint(t *testing.T) {
	srv, database := newPinnedAPITestServer(t)
	h := srv.Handler()

	id1 := database.InsertHistoryFull("radius", "Jita", 10, 1000, 5000, 2000, map[string]any{"min_margin": 5, "target_market_system": "Amarr", "min_route_security": 0.6})
	id2 := database.InsertHistoryFull("radius", "Jita", 12, 1200, 7000, 3000, map[string]any{"min_margin": 7, "target_market_system": "Amarr", "min_route_security": 0.7})
	_ = database.InsertHistoryFull("station", "Jita", 15, 2200, 9000, 3000, map[string]any{"min_margin": 9})

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, pinnedReq(http.MethodGet, "/api/scan/history/"+jsonNumber(id2)+"/diffs", "", "user-a"))
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out struct {
		Source string `json:"source"`
		Items  []struct {
			TimelineKey string `json:"timeline_key"`
			Delta       struct {
				NetProfit *float64 `json:"net_profit"`
			} `json:"delta"`
		} `json:"items"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Source != "scan_history" {
		t.Fatalf("unexpected source=%s", out.Source)
	}
	if len(out.Items) != 2 {
		t.Fatalf("expected 2 timeline items, got %d", len(out.Items))
	}
	if out.Items[0].TimelineKey != "scan:"+jsonNumber(id1) {
		t.Fatalf("unexpected first timeline key=%s", out.Items[0].TimelineKey)
	}
	if out.Items[1].Delta.NetProfit == nil || *out.Items[1].Delta.NetProfit != 2000 {
		t.Fatalf("expected net profit delta 2000, got %#v", out.Items[1].Delta.NetProfit)
	}
}

func TestDiffTimeline_PinnedOpportunityEndpoint(t *testing.T) {
	srv, database := newPinnedAPITestServer(t)
	h := srv.Handler()
	const userID = "user-diff"
	const key = "station:34:60003760"

	if err := database.AddPinnedOpportunityForUser(userID, db.PinnedOpportunity{
		OpportunityKey: key,
		Tab:            db.PinnedTabStation,
		PayloadJSON:    `{"source":"station","opportunity_key":"station:34:60003760","buy_label":"Jita","sell_label":"Jita","metrics":{"profit":3000,"margin":12,"volume":100,"route_risk":2}}`,
	}); err != nil {
		t.Fatalf("add pinned: %v", err)
	}
	if err := database.UpsertPinnedOpportunitySnapshotForUser(userID, key, db.PinnedSnapshot{SnapshotLabel: "scan:1", SnapshotAt: "2026-01-01T00:00:00Z", MetricsJSON: `{"profit":1000,"margin":7,"volume":70,"route_risk":1}`}); err != nil {
		t.Fatalf("seed snapshot: %v", err)
	}
	if err := database.UpsertPinnedOpportunitySnapshotForUser(userID, key, db.PinnedSnapshot{SnapshotLabel: "scan:2", SnapshotAt: "2026-01-02T00:00:00Z", MetricsJSON: `{"profit":2000,"margin":8,"volume":80,"route_risk":2}`}); err != nil {
		t.Fatalf("seed snapshot 2: %v", err)
	}

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, pinnedReq(http.MethodGet, "/api/pinned-opportunities/"+key+"/diffs", "", userID))
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out struct {
		Source string `json:"source"`
		Items  []struct {
			Label string `json:"label"`
			Delta struct {
				NetProfit *float64 `json:"net_profit"`
			} `json:"delta"`
		} `json:"items"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Source != "pinned_opportunity" {
		t.Fatalf("unexpected source=%s", out.Source)
	}
	if len(out.Items) != 3 {
		t.Fatalf("expected snapshots + current (3), got %d", len(out.Items))
	}
	if out.Items[2].Label != "Current" {
		t.Fatalf("expected current item last, got %s", out.Items[2].Label)
	}
	if out.Items[1].Delta.NetProfit == nil || *out.Items[1].Delta.NetProfit != 1000 {
		t.Fatalf("expected second delta 1000 got %#v", out.Items[1].Delta.NetProfit)
	}
}

func jsonNumber(id int64) string {
	return fmt.Sprintf("%d", id)
}
