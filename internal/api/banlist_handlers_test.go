package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"eve-flipper/internal/config"
	"eve-flipper/internal/esi"
	"eve-flipper/internal/sde"
)

func banlistRequest(method, target string, body *bytes.Buffer, userID string) *http.Request {
	var reader *bytes.Buffer
	if body == nil {
		reader = bytes.NewBuffer(nil)
	} else {
		reader = body
	}
	req := httptest.NewRequest(method, target, reader)
	req.Header.Set(userIDHeaderName, userID)
	return req
}

func newBanlistTestServer(t *testing.T) (*Server, string) {
	t.Helper()
	database := openAPITestDB(t)
	userID := "banlist-user"

	srv := NewServer(config.Default(), &esi.Client{}, database, nil, nil)
	srv.sdeData = &sde.Data{
		Types: map[int32]*sde.ItemType{
			34: {ID: 34, Name: "Tritanium"},
			35: {ID: 35, Name: "Pyerite"},
		},
	}
	return srv, userID
}

func TestBanlistHandlers_ValidationFailures(t *testing.T) {
	srv, userID := newBanlistTestServer(t)
	h := srv.Handler()

	cases := []struct {
		name   string
		method string
		path   string
		body   string
	}{
		{name: "item unknown type", method: http.MethodPost, path: "/api/banlist/items", body: `{"type_id":999999,"type_name":"X"}`},
		{name: "item bad json", method: http.MethodPost, path: "/api/banlist/items", body: `{`},
		{name: "station missing location", method: http.MethodPost, path: "/api/banlist/stations", body: `{"location_id":0,"station_name":"Jita"}`},
		{name: "station blank name", method: http.MethodPost, path: "/api/banlist/stations", body: `{"location_id":60003760,"station_name":"   "}`},
		{name: "delete invalid type path", method: http.MethodDelete, path: "/api/banlist/items/not-a-number"},
		{name: "delete invalid station path", method: http.MethodDelete, path: "/api/banlist/stations/nope"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := banlistRequest(tc.method, tc.path, bytes.NewBufferString(tc.body), userID)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestBanlistHandlers_ItemsCRUDAndOrdering(t *testing.T) {
	srv, userID := newBanlistTestServer(t)
	h := srv.Handler()

	post := func(payload string) map[string]any {
		req := banlistRequest(http.MethodPost, "/api/banlist/items", bytes.NewBufferString(payload), userID)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("POST /api/banlist/items status=%d body=%s", rec.Code, rec.Body.String())
		}
		var out map[string]any
		if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
			t.Fatalf("decode post response: %v", err)
		}
		return out
	}

	first := post(`{"type_id":34}`)
	if inserted, _ := first["inserted"].(bool); !inserted {
		t.Fatalf("first insert should report inserted=true: %#v", first)
	}
	second := post(`{"type_id":35}`)
	if inserted, _ := second["inserted"].(bool); !inserted {
		t.Fatalf("second insert should report inserted=true: %#v", second)
	}
	dup := post(`{"type_id":35,"type_name":"Pyerite"}`)
	if inserted, _ := dup["inserted"].(bool); inserted {
		t.Fatalf("duplicate insert should report inserted=false: %#v", dup)
	}

	getReq := banlistRequest(http.MethodGet, "/api/banlist/items", nil, userID)
	getRec := httptest.NewRecorder()
	h.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("GET /api/banlist/items status=%d body=%s", getRec.Code, getRec.Body.String())
	}
	var items []config.BanlistItem
	if err := json.NewDecoder(getRec.Body).Decode(&items); err != nil {
		t.Fatalf("decode items: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("items len=%d, want 2", len(items))
	}
	if items[0].AddedAt < items[1].AddedAt {
		t.Fatalf("items should be sorted descending by added_at: %+v", items)
	}

	delReq := banlistRequest(http.MethodDelete, "/api/banlist/items/34", nil, userID)
	delRec := httptest.NewRecorder()
	h.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusOK {
		t.Fatalf("DELETE /api/banlist/items/{typeID} status=%d body=%s", delRec.Code, delRec.Body.String())
	}
	var afterDelete []config.BanlistItem
	if err := json.NewDecoder(delRec.Body).Decode(&afterDelete); err != nil {
		t.Fatalf("decode delete response: %v", err)
	}
	if len(afterDelete) != 1 || afterDelete[0].TypeID != 35 {
		t.Fatalf("unexpected list after delete: %+v", afterDelete)
	}
}

func TestBanlistHandlers_StationsCRUDAndOrdering(t *testing.T) {
	srv, userID := newBanlistTestServer(t)
	h := srv.Handler()

	add := func(payload string) map[string]any {
		req := banlistRequest(http.MethodPost, "/api/banlist/stations", bytes.NewBufferString(payload), userID)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("POST /api/banlist/stations status=%d body=%s", rec.Code, rec.Body.String())
		}
		var out map[string]any
		if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
			t.Fatalf("decode station post response: %v", err)
		}
		return out
	}

	first := add(`{"location_id":60003760,"station_name":"  Jita 4-4  ","system_id":30000142,"system_name":" Jita "}`)
	if inserted, _ := first["inserted"].(bool); !inserted {
		t.Fatalf("first station insert should report inserted=true: %#v", first)
	}
	second := add(`{"location_id":60008494,"station_name":"Amarr Emperor Academy"}`)
	if inserted, _ := second["inserted"].(bool); !inserted {
		t.Fatalf("second station insert should report inserted=true: %#v", second)
	}
	dup := add(`{"location_id":60008494,"station_name":"Amarr Emperor Academy"}`)
	if inserted, _ := dup["inserted"].(bool); inserted {
		t.Fatalf("duplicate station insert should report inserted=false: %#v", dup)
	}

	getReq := banlistRequest(http.MethodGet, "/api/banlist/stations", nil, userID)
	getRec := httptest.NewRecorder()
	h.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("GET /api/banlist/stations status=%d body=%s", getRec.Code, getRec.Body.String())
	}
	var stations []config.BannedStation
	if err := json.NewDecoder(getRec.Body).Decode(&stations); err != nil {
		t.Fatalf("decode stations: %v", err)
	}
	if len(stations) != 2 {
		t.Fatalf("stations len=%d, want 2", len(stations))
	}
	if stations[0].AddedAt < stations[1].AddedAt {
		t.Fatalf("stations should be sorted descending by added_at: %+v", stations)
	}
	if stations[0].LocationID == 60003760 && stations[0].StationName != "Jita 4-4" {
		t.Fatalf("station_name should be trimmed, got %+v", stations[0])
	}

	delReq := banlistRequest(http.MethodDelete, "/api/banlist/stations/60003760", nil, userID)
	delRec := httptest.NewRecorder()
	h.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusOK {
		t.Fatalf("DELETE /api/banlist/stations/{locationID} status=%d body=%s", delRec.Code, delRec.Body.String())
	}
	var afterDelete []config.BannedStation
	if err := json.NewDecoder(delRec.Body).Decode(&afterDelete); err != nil {
		t.Fatalf("decode station delete response: %v", err)
	}
	if len(afterDelete) != 1 || afterDelete[0].LocationID != 60008494 {
		t.Fatalf("unexpected stations after delete: %+v", afterDelete)
	}
}
