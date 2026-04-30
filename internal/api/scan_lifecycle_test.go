package api

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"eve-flipper/internal/config"
	"eve-flipper/internal/engine"
	"eve-flipper/internal/esi"
	"eve-flipper/internal/graph"
	"eve-flipper/internal/sde"
)

func userCookieForServer(t *testing.T, srv *Server) *http.Cookie {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	srv.ensureRequestUserID(rec, req)
	cookies := rec.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("missing user cookie")
	}
	return cookies[0]
}

func TestScanLifecycleActiveAndCancelEndpoints(t *testing.T) {
	srv := NewServer(config.Default(), &esi.Client{}, nil, nil, nil)
	cookie := userCookieForServer(t, srv)
	reqID := httptest.NewRequest(http.MethodGet, "/", nil)
	reqID.AddCookie(cookie)
	uid := srv.ensureRequestUserID(httptest.NewRecorder(), reqID)

	cancelCalled := false
	srv.scanLifecycle.register(uid, "run-1", "radius", "starting", func() { cancelCalled = true })

	reqActive := httptest.NewRequest(http.MethodGet, "/api/scan/active", nil)
	reqActive.AddCookie(cookie)
	recActive := httptest.NewRecorder()
	srv.Handler().ServeHTTP(recActive, reqActive)
	if !strings.Contains(recActive.Body.String(), `"active":true`) {
		t.Fatalf("body=%s", recActive.Body.String())
	}

	reqCancel := httptest.NewRequest(http.MethodPost, "/api/scan/cancel", nil)
	reqCancel.AddCookie(cookie)
	recCancel := httptest.NewRecorder()
	srv.Handler().ServeHTTP(recCancel, reqCancel)
	if !strings.Contains(recCancel.Body.String(), `"ok":true`) {
		t.Fatalf("body=%s", recCancel.Body.String())
	}
	if !cancelCalled {
		t.Fatalf("cancel callback not called")
	}
}

func TestScanEndpoint_DeadlineExceeded_EmitsTerminalErrorEvent(t *testing.T) {
	srv := NewServer(config.Default(), esi.NewClient(nil), nil, nil, nil)
	u := graph.NewUniverse()
	u.SetRegion(30000142, 10000002)
	srv.sdeData = &sde.Data{Universe: u, SystemByName: map[string]int32{"jita": 30000142}}
	srv.scanner = &engine.Scanner{SDE: srv.sdeData, ESI: esi.NewClient(nil)}
	srv.ready = true
	cookie := userCookieForServer(t, srv)

	body := []byte(`{"system_name":"Jita","buy_radius":1,"sell_radius":1}`)
	req := httptest.NewRequest(http.MethodPost, "/api/scan", bytes.NewReader(body))
	req.AddCookie(cookie)
	req.Header.Set("Content-Type", "application/json")
	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-1*time.Second))
	defer cancel()
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rec, req)

	if !strings.Contains(rec.Body.String(), `"type":"error"`) || !strings.Contains(rec.Body.String(), "scan timed out") {
		t.Fatalf("expected timeout event, body=%s", rec.Body.String())
	}
}
