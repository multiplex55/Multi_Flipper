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

	add := `{"tab":"station","opportunity_key":"station:34:60003760","payload":{"source":"station","opportunity_key":"station:34:60003760","type_id":34,"metrics":{"profit":1000,"margin":10,"volume":200,"route_risk":1}}}`
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
		`{"tab":"bad-tab","opportunity_key":"x","payload":{"source":"scan","opportunity_key":"x","type_id":1,"metrics":{"profit":1,"margin":1,"volume":1,"route_risk":1}}}`,
		`{"tab":"scan","opportunity_key":"x","payload":[]}`,
		`{"tab":"scan","opportunity_key":"","payload":{"source":"scan","opportunity_key":"","type_id":1,"metrics":{"profit":1,"margin":1,"volume":1,"route_risk":1}}}`,
		`{"tab":"scan","opportunity_key":"flip:1:2:3","payload":{"source":"scan","opportunity_key":"flip:1:2:3","type_id":1}}`,
		`{"tab":"contracts","opportunity_key":"flip:1:2:3","payload":{"source":"contracts","opportunity_key":"flip:1:2:3","type_id":0,"metrics":{"profit":1,"margin":1,"volume":1,"route_risk":1}}}`,
	}
	for _, body := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, pinnedReq(http.MethodPost, "/api/pinned-opportunities", body, "user-a"))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for %s got %d", body, rec.Code)
		}
	}
}

func TestPinnedOpportunityHandlers_RescanSnapshotUpdateDoesNotDeletePins(t *testing.T) {
	srv, database := newPinnedAPITestServer(t)
	const userID = "user-rescan"

	if err := database.AddPinnedOpportunityForUser(userID, db.PinnedOpportunity{
		OpportunityKey: "flip:34:60003760:60008494",
		Tab:            db.PinnedTabScan,
		PayloadJSON:    `{"source":"scan","opportunity_key":"flip:34:60003760:60008494","type_id":34,"metrics":{"profit":1,"margin":1,"volume":1,"route_risk":1}}`,
	}); err != nil {
		t.Fatalf("seed pinned row: %v", err)
	}

	before, err := database.ListPinnedOpportunitiesForUser(userID, db.PinnedTabScan)
	if err != nil {
		t.Fatalf("list before: %v", err)
	}
	if len(before) != 1 {
		t.Fatalf("expected 1 pin before rescan, got %d", len(before))
	}

	srv.updatePinnedSnapshotsForFlipResults(userID, db.PinnedTabScan, 101, nil)

	after, err := database.ListPinnedOpportunitiesForUser(userID, db.PinnedTabScan)
	if err != nil {
		t.Fatalf("list after: %v", err)
	}
	if len(after) != len(before) {
		t.Fatalf("pin count changed after rescan snapshot update: before=%d after=%d", len(before), len(after))
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
