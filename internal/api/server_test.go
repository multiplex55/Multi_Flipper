package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"eve-flipper/internal/auth"
	"eve-flipper/internal/config"
	"eve-flipper/internal/engine"
	"eve-flipper/internal/esi"
)

// GET /api/status is not tested here because it calls esi.Client.HealthCheck() which performs a real HTTP request.

func TestHandleGetConfig_ReturnsConfig(t *testing.T) {
	cfg := &config.Config{SystemName: "Jita", CargoCapacity: 10000}
	srv := NewServer(cfg, &esi.Client{}, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("GET /api/config status = %d, want 200", rec.Code)
	}
	var out config.Config
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode config: %v", err)
	}
	if out.SystemName != "Jita" || out.CargoCapacity != 10000 {
		t.Errorf("config = %+v", out)
	}
}

func TestHandleSetConfig_StrategyScorePatchRoundTripAndClamp(t *testing.T) {
	cfg := config.Default()
	srv := NewServer(cfg, &esi.Client{}, nil, nil, nil)

	body := strings.NewReader(`{
		"strategy_score": {
			"profit_weight": 130,
			"risk_weight": -5,
			"velocity_weight": 30,
			"jump_weight": 20,
			"capital_weight": 10
		}
	}`)
	postReq := httptest.NewRequest(http.MethodPost, "/api/config", body)
	postRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(postRec, postReq)
	if postRec.Code != http.StatusOK {
		t.Fatalf("POST /api/config status = %d, want 200; body=%s", postRec.Code, postRec.Body.String())
	}

	var postOut config.Config
	if err := json.NewDecoder(postRec.Body).Decode(&postOut); err != nil {
		t.Fatalf("decode post config: %v", err)
	}
	if postOut.StrategyScore.ProfitWeight != 100 || postOut.StrategyScore.RiskWeight != 0 {
		t.Fatalf("strategy score clamping failed: %+v", postOut.StrategyScore)
	}
	if postOut.StrategyScore.VelocityWeight != 30 || postOut.StrategyScore.JumpWeight != 20 || postOut.StrategyScore.CapitalWeight != 10 {
		t.Fatalf("strategy score values mismatch: %+v", postOut.StrategyScore)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	getRec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("GET /api/config status = %d, want 200", getRec.Code)
	}

	var getOut config.Config
	if err := json.NewDecoder(getRec.Body).Decode(&getOut); err != nil {
		t.Fatalf("decode get config: %v", err)
	}
	if getOut.StrategyScore != postOut.StrategyScore {
		t.Fatalf("GET strategy score mismatch: got=%+v want=%+v", getOut.StrategyScore, postOut.StrategyScore)
	}
}

func TestBuildRegionalDayResultPayload_IncludesDataAndHubs(t *testing.T) {
	rows := []engine.FlipResult{
		{TypeID: 34, TypeName: "Tritanium"},
	}
	hubs := []engine.RegionalDayTradeHub{
		{
			SourceSystemID:   30000142,
			SourceSystemName: "Jita",
			ItemCount:        1,
			Items: []engine.RegionalDayTradeItem{
				{TypeID: 34, TypeName: "Tritanium"},
			},
		},
	}

	payload := buildRegionalDayResultPayload(
		rows,
		hubs,
		nil,
		123,
		stationCacheMeta{},
		"The Forge",
		14,
	)

	if payload["data"] == nil {
		t.Fatalf("expected result payload to include data")
	}
	if payload["hubs"] == nil {
		t.Fatalf("expected result payload to include hubs")
	}
	if payload["trends"] == nil {
		t.Fatalf("expected result payload to include trends")
	}
	if got := payload["count"].(int); got != len(rows) {
		t.Fatalf("count = %d, want %d", got, len(rows))
	}
	if got := payload["target_region_name"].(string); got != "The Forge" {
		t.Fatalf("target_region_name = %q, want %q", got, "The Forge")
	}
	if got := payload["period_days"].(int); got != 14 {
		t.Fatalf("period_days = %d, want 14", got)
	}
}

func TestBuildRegionalDayResultPayload_IncludesTrendPayloadShape(t *testing.T) {
	payload := buildRegionalDayResultPayload(
		nil,
		nil,
		[]engine.RegionalHubTrend{
			{
				SourceSystemID: 30000142,
				Latest: engine.RegionalHubTrendSnapshot{
					ScanTimestamp:      "2026-04-21T10:00:00Z",
					SourceSystemID:     30000142,
					SourceSystemName:   "Jita",
					ItemCount:          7,
					TargetPeriodProfit: 1500,
					DemandPerDay:       30,
					TopItemSummary:     "Tritanium, Mexallon",
				},
				Delta: engine.RegionalHubTrendDelta{
					ItemCountDelta:          2,
					TargetPeriodProfitDelta: 500,
					DemandPerDayDelta:       10,
					NewTopItems:             []string{"Mexallon"},
					RemovedTopItems:         []string{"Pyerite"},
				},
			},
		},
		99,
		stationCacheMeta{},
		"The Forge",
		14,
	)
	trends, ok := payload["trends"].([]engine.RegionalHubTrend)
	if !ok || len(trends) != 1 {
		t.Fatalf("trends payload missing or wrong shape: %#v", payload["trends"])
	}
	if trends[0].Delta.ItemCountDelta != 2 || trends[0].Delta.TargetPeriodProfitDelta != 500 {
		t.Fatalf("unexpected trend delta payload: %+v", trends[0].Delta)
	}
}

func TestReadBodyWithLimit(t *testing.T) {
	t.Parallel()

	body, err := readBodyWithLimit(strings.NewReader("abc"), 3)
	if err != nil {
		t.Fatalf("readBodyWithLimit exact size failed: %v", err)
	}
	if string(body) != "abc" {
		t.Fatalf("body = %q, want %q", string(body), "abc")
	}

	_, err = readBodyWithLimit(strings.NewReader("abcd"), 3)
	if err == nil {
		t.Fatalf("expected size-limit error for oversized body")
	}
}

func TestWalletTxnCache_IsolatedByCharacterAndClearable(t *testing.T) {
	srv := &Server{}
	txns := []esi.WalletTransaction{
		{TransactionID: 1, TypeID: 34, Quantity: 10},
	}

	srv.setWalletTxnCache(1001, txns)

	if got, ok := srv.getWalletTxnCache(1001); !ok || len(got) != 1 || got[0].TransactionID != 1 {
		t.Fatalf("expected cache hit for same character, got ok=%v txns=%v", ok, got)
	}

	if _, ok := srv.getWalletTxnCache(2002); ok {
		t.Fatalf("expected cache miss for different character")
	}

	srv.clearWalletTxnCache()
	if _, ok := srv.getWalletTxnCache(1001); ok {
		t.Fatalf("expected cache miss after clear")
	}
}

func TestWalletTxnCache_ExpiresByTTL(t *testing.T) {
	srv := &Server{}
	srv.setWalletTxnCache(1001, []esi.WalletTransaction{{TransactionID: 42}})

	// Simulate stale cache entry.
	srv.txnCacheMu.Lock()
	srv.txnCacheTime = time.Now().Add(-walletTxnCacheTTL - time.Second)
	srv.txnCacheMu.Unlock()

	if _, ok := srv.getWalletTxnCache(1001); ok {
		t.Fatalf("expected cache miss for stale entry")
	}
}

func TestEnsureRequestUserID_SignedCookieRoundTrip(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)

	req1 := httptest.NewRequest(http.MethodGet, "/", nil)
	rec1 := httptest.NewRecorder()
	userID1 := srv.ensureRequestUserID(rec1, req1)
	if !isValidUserID(userID1) {
		t.Fatalf("ensureRequestUserID returned invalid user id: %q", userID1)
	}

	cookies := rec1.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected Set-Cookie on first request")
	}
	cookie := cookies[0]
	if cookie.Name != userIDCookieName {
		t.Fatalf("cookie name = %q, want %q", cookie.Name, userIDCookieName)
	}
	if parsed, ok := srv.parseSignedUserIDCookieValue(cookie.Value); !ok || parsed != userID1 {
		t.Fatalf("cookie value is not a valid signed user id: value=%q parsed=%q ok=%v", cookie.Value, parsed, ok)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.AddCookie(cookie)
	rec2 := httptest.NewRecorder()
	userID2 := srv.ensureRequestUserID(rec2, req2)
	if userID2 != userID1 {
		t.Fatalf("user id mismatch on valid signed cookie: got %q, want %q", userID2, userID1)
	}
	if len(rec2.Result().Cookies()) != 0 {
		t.Fatalf("did not expect Set-Cookie for valid signed cookie, got %d", len(rec2.Result().Cookies()))
	}
}

func TestEnsureRequestUserID_RotatesTamperedCookie(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)

	req1 := httptest.NewRequest(http.MethodGet, "/", nil)
	rec1 := httptest.NewRecorder()
	userID1 := srv.ensureRequestUserID(rec1, req1)
	origCookies := rec1.Result().Cookies()
	if len(origCookies) == 0 {
		t.Fatal("expected Set-Cookie on first request")
	}
	original := origCookies[0]

	tampered := *original
	tampered.Value = userID1 + ".tampered-signature"

	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.AddCookie(&tampered)
	rec2 := httptest.NewRecorder()
	userID2 := srv.ensureRequestUserID(rec2, req2)
	if userID2 == "" {
		t.Fatal("expected non-empty user id after tampered cookie")
	}

	newCookies := rec2.Result().Cookies()
	if len(newCookies) == 0 {
		t.Fatal("expected Set-Cookie after tampered cookie")
	}
	if parsed, ok := srv.parseSignedUserIDCookieValue(newCookies[0].Value); !ok || parsed != userID2 {
		t.Fatalf("new cookie is not a valid signed user id: value=%q parsed=%q ok=%v", newCookies[0].Value, parsed, ok)
	}
}

func TestAuthRevisionBumpAndStatusPayload(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)

	if got := srv.authRevisionForUser("u1"); got != 0 {
		t.Fatalf("initial auth revision = %d, want 0", got)
	}
	if got := srv.bumpAuthRevision("u1"); got != 1 {
		t.Fatalf("auth revision after first bump = %d, want 1", got)
	}
	if got := srv.bumpAuthRevision("u1"); got != 2 {
		t.Fatalf("auth revision after second bump = %d, want 2", got)
	}
	if got := srv.authRevisionForUser("u1"); got != 2 {
		t.Fatalf("stored auth revision = %d, want 2", got)
	}

	payload := srv.authStatusPayload("u1")
	revision, ok := payload["auth_revision"].(int64)
	if !ok {
		t.Fatalf("auth_revision type = %T, want int64", payload["auth_revision"])
	}
	if revision != 2 {
		t.Fatalf("payload auth_revision = %d, want 2", revision)
	}
}

type testStationStore struct {
	mu       sync.RWMutex
	stations map[int64]string
}

func (s *testStationStore) GetStation(locationID int64) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	name, ok := s.stations[locationID]
	return name, ok
}

func (s *testStationStore) SetStation(locationID int64, name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stations[locationID] = name
}

func TestHandleAuthPortfolio_ResolvesTopStationLocationName(t *testing.T) {
	database := openAPITestDB(t)

	const (
		userID      = "user-portfolio-station"
		characterID = int64(90000001)
		locationID  = int64(60003760)
	)
	sessions := auth.NewSessionStore(database.SqlDB())
	if err := sessions.SaveAndActivateForUser(userID, &auth.Session{
		CharacterID:   characterID,
		CharacterName: "Station Trader",
		AccessToken:   "token",
		RefreshToken:  "refresh",
		ExpiresAt:     time.Now().Add(2 * time.Hour),
	}); err != nil {
		t.Fatalf("SaveAndActivateForUser: %v", err)
	}

	store := &testStationStore{stations: map[int64]string{
		locationID: "Jita IV - Moon 4 - Caldari Navy Assembly Plant",
	}}
	esiClient := esi.NewClient(store)
	srv := &Server{
		cfg:      config.Default(),
		db:       database,
		esi:      esiClient,
		sessions: sessions,
	}

	now := time.Now().UTC()
	srv.setWalletTxnCache(characterID, []esi.WalletTransaction{
		{
			TransactionID: 1001,
			Date:          now.Add(-12 * time.Hour).Format(time.RFC3339),
			TypeID:        34,
			LocationID:    locationID,
			UnitPrice:     5.0,
			Quantity:      100,
			IsBuy:         true,
		},
		{
			TransactionID: 1002,
			Date:          now.Add(-6 * time.Hour).Format(time.RFC3339),
			TypeID:        34,
			LocationID:    locationID,
			UnitPrice:     6.0,
			Quantity:      100,
			IsBuy:         false,
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/portfolio?character_id=90000001&days=30", nil)
	req = req.WithContext(context.WithValue(req.Context(), userIDContextKey, userID))
	rec := httptest.NewRecorder()

	srv.handleAuthPortfolio(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var out engine.PortfolioPnL
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(out.TopStations) == 0 {
		t.Fatalf("top_stations empty")
	}
	if out.TopStations[0].LocationName != store.stations[locationID] {
		t.Fatalf("top_stations[0].location_name = %q, want %q", out.TopStations[0].LocationName, store.stations[locationID])
	}
}

func TestHandleAuthPortfolio_FillsMissingOrIDLikeLocationNameFromResolver(t *testing.T) {
	database := openAPITestDB(t)

	const (
		userID      = "user-portfolio-station-fallback"
		characterID = int64(90000002)
		locationID  = int64(60008494)
	)
	sessions := auth.NewSessionStore(database.SqlDB())
	if err := sessions.SaveAndActivateForUser(userID, &auth.Session{
		CharacterID:   characterID,
		CharacterName: "Fallback Trader",
		AccessToken:   "token",
		RefreshToken:  "refresh",
		ExpiresAt:     time.Now().Add(2 * time.Hour),
	}); err != nil {
		t.Fatalf("SaveAndActivateForUser: %v", err)
	}

	store := &testStationStore{stations: map[int64]string{
		locationID: "Amarr VIII (Oris) - Emperor Family Academy",
	}}
	esiClient := esi.NewClient(store)
	srv := &Server{
		cfg:      config.Default(),
		db:       database,
		esi:      esiClient,
		sessions: sessions,
	}

	now := time.Now().UTC()
	srv.setWalletTxnCache(characterID, []esi.WalletTransaction{
		{
			TransactionID: 2001,
			Date:          now.Add(-10 * time.Hour).Format(time.RFC3339),
			TypeID:        35,
			LocationID:    locationID,
			LocationName:  "   ",
			UnitPrice:     10.0,
			Quantity:      50,
			IsBuy:         true,
		},
		{
			TransactionID: 2002,
			Date:          now.Add(-8 * time.Hour).Format(time.RFC3339),
			TypeID:        35,
			LocationID:    locationID,
			LocationName:  "#60008494",
			UnitPrice:     12.0,
			Quantity:      50,
			IsBuy:         false,
		},
	})

	req := requestWithUserID(http.MethodGet, "/api/auth/portfolio?character_id=90000002&days=30", nil, userID)
	rec := httptest.NewRecorder()

	srv.handleAuthPortfolio(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var out engine.PortfolioPnL
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(out.TopStations) == 0 {
		t.Fatalf("top_stations empty")
	}
	if out.TopStations[0].LocationName != store.stations[locationID] {
		t.Fatalf("top_stations[0].location_name = %q, want %q", out.TopStations[0].LocationName, store.stations[locationID])
	}
}
