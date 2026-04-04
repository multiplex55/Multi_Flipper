package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"eve-flipper/internal/config"
	"eve-flipper/internal/db"
	"eve-flipper/internal/esi"
)

func pinnedReq(method, target, body, userID string) *http.Request {
	req := httptest.NewRequest(method, target, bytes.NewBufferString(body))
	req.Header.Set(userIDHeaderName, userID)
	return req
}

func newPinnedAPITestServer(t *testing.T) (*Server, *db.DB) {
	t.Helper()
	database := openAPITestDB(t)
	srv := &Server{
		cfg: config.Default(),
		esi: &esi.Client{},
		db:  database,
	}
	return srv, database
}

func TestPinnedOpportunityHandlers_AddListDeleteAndUserScoping(t *testing.T) {
	srv, _ := newPinnedAPITestServer(t)
	h := srv.Handler()

	add := `{"tab":"station","opportunity_key":"station:34:60003760","payload":{"type_id":34}}`
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, pinnedReq(http.MethodPost, "/api/pinned-opportunities", add, "user-a"))
	if rec.Code != http.StatusOK {
		t.Fatalf("POST status=%d body=%s", rec.Code, rec.Body.String())
	}

	listRec := httptest.NewRecorder()
	h.ServeHTTP(listRec, pinnedReq(http.MethodGet, "/api/pinned-opportunities?tab=station", "", "user-a"))
	if listRec.Code != http.StatusOK {
		t.Fatalf("GET list status=%d body=%s", listRec.Code, listRec.Body.String())
	}
	var items []db.PinnedOpportunity
	if err := json.NewDecoder(listRec.Body).Decode(&items); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("items len=%d want 1", len(items))
	}

	otherRec := httptest.NewRecorder()
	h.ServeHTTP(otherRec, pinnedReq(http.MethodGet, "/api/pinned-opportunities?tab=station", "", "user-b"))
	var otherItems []db.PinnedOpportunity
	_ = json.NewDecoder(otherRec.Body).Decode(&otherItems)
	if len(otherItems) != 0 {
		t.Fatalf("expected user-b isolated list, got %d", len(otherItems))
	}

	delRec := httptest.NewRecorder()
	h.ServeHTTP(delRec, pinnedReq(http.MethodDelete, "/api/pinned-opportunities/station:34:60003760", "", "user-a"))
	if delRec.Code != http.StatusOK {
		t.Fatalf("DELETE status=%d body=%s", delRec.Code, delRec.Body.String())
	}
}

func TestPinnedOpportunityHandlers_InvalidPayloadOrTabReturns400(t *testing.T) {
	srv, _ := newPinnedAPITestServer(t)
	h := srv.Handler()

	cases := []string{
		`{"tab":"bad-tab","opportunity_key":"x","payload":{"x":1}}`,
		`{"tab":"scan","opportunity_key":"x","payload":[]}`,
		`{"tab":"scan","opportunity_key":"","payload":{"x":1}}`,
	}
	for _, body := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, pinnedReq(http.MethodPost, "/api/pinned-opportunities", body, "user-a"))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for %s got %d", body, rec.Code)
		}
	}
}

func TestPinnedOpportunityHandlers_SnapshotBatchEndpoint(t *testing.T) {
	srv, database := newPinnedAPITestServer(t)
	h := srv.Handler()
	userID := "user-snap"

	if err := database.AddPinnedOpportunityForUser(userID, db.PinnedOpportunity{
		OpportunityKey: "station:34:60003760",
		Tab:            db.PinnedTabStation,
		PayloadJSON:    `{"type_id":34}`,
	}); err != nil {
		t.Fatalf("seed pinned row: %v", err)
	}

	payload := `{"snapshots":[{"opportunity_key":"station:34:60003760","snapshot_label":"scan:999","metrics":{"profit":1234,"margin":12.5,"volume":1000,"route_risk":3}}]}`
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, pinnedReq(http.MethodPost, "/api/pinned-opportunities/snapshots", payload, userID))
	if rec.Code != http.StatusOK {
		t.Fatalf("POST snapshots status=%d body=%s", rec.Code, rec.Body.String())
	}

	snaps, err := database.ListPinnedOpportunitySnapshotsForUser(userID, "station:34:60003760", 10)
	if err != nil {
		t.Fatalf("list snapshots: %v", err)
	}
	if len(snaps) != 1 {
		t.Fatalf("expected 1 snapshot, got %d", len(snaps))
	}
}
