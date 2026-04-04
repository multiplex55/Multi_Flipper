package api

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"eve-flipper/internal/db"
	"eve-flipper/internal/engine"
)

type pinnedOpportunityRequest struct {
	OpportunityKey string          `json:"opportunity_key"`
	Tab            string          `json:"tab"`
	Payload        json.RawMessage `json:"payload"`
}

type pinnedSnapshotBatchRequest struct {
	OpportunityKey string          `json:"opportunity_key"`
	SnapshotLabel  string          `json:"snapshot_label"`
	SnapshotAt     string          `json:"snapshot_at"`
	Metrics        json.RawMessage `json:"metrics"`
}

func pinnedDebugEnabled() bool {
	return os.Getenv("EVE_FLIPPER_DEBUG_PINNED") == "1"
}

func logPinnedDebug(format string, args ...any) {
	if pinnedDebugEnabled() {
		log.Printf("[DEBUG][PINNED] "+format, args...)
	}
}

func normalizePinnedTab(tab string) string {
	tab = strings.ToLower(strings.TrimSpace(tab))
	switch tab {
	case db.PinnedTabScan, db.PinnedTabStation, db.PinnedTabRegionalDay, db.PinnedTabContracts:
		return tab
	default:
		return ""
	}
}

func normalizeJSONObject(raw json.RawMessage) (map[string]any, string, error) {
	if len(raw) == 0 {
		return nil, "", fmt.Errorf("payload is required")
	}
	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err != nil {
		return nil, "", fmt.Errorf("payload must be valid json object")
	}
	encoded, err := json.Marshal(obj)
	if err != nil {
		return nil, "", fmt.Errorf("payload encode failed")
	}
	return obj, string(encoded), nil
}

func validatePinnedPayload(tab, key string, payload map[string]any) error {
	source, _ := payload["source"].(string)
	if source != tab {
		return fmt.Errorf("payload.source must match tab")
	}
	payloadKey, _ := payload["opportunity_key"].(string)
	if payloadKey != key {
		return fmt.Errorf("payload.opportunity_key must match opportunity_key")
	}
	metrics, ok := payload["metrics"].(map[string]any)
	if !ok {
		return fmt.Errorf("payload.metrics is required")
	}
	required := []string{"profit", "margin", "volume", "route_risk"}
	for _, field := range required {
		value, ok := metrics[field]
		if !ok {
			return fmt.Errorf("payload.metrics.%s is required", field)
		}
		number, ok := value.(float64)
		if !ok || math.IsNaN(number) || math.IsInf(number, 0) {
			return fmt.Errorf("payload.metrics.%s must be a finite number", field)
		}
	}
	switch tab {
	case db.PinnedTabScan, db.PinnedTabRegionalDay:
		if !strings.HasPrefix(key, "flip:") {
			return fmt.Errorf("invalid opportunity_key for tab")
		}
	case db.PinnedTabStation:
		if !strings.HasPrefix(key, "station:") {
			return fmt.Errorf("invalid opportunity_key for tab")
		}
	case db.PinnedTabContracts:
		if !strings.HasPrefix(key, "contract:") {
			return fmt.Errorf("invalid opportunity_key for tab")
		}
	}
	return nil
}

func (s *Server) handleListPinnedOpportunities(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	tab := normalizePinnedTab(r.URL.Query().Get("tab"))
	if tab == "" {
		writeError(w, http.StatusBadRequest, "invalid tab")
		return
	}
	items, err := s.db.ListPinnedOpportunitiesForUser(userID, tab)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list pinned opportunities")
		return
	}
	logPinnedDebug("list user_id=%s tab=%s count=%d", userID, tab, len(items))
	writeJSON(w, items)
}

func (s *Server) handleAddPinnedOpportunity(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	var req pinnedOpportunityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	tab := normalizePinnedTab(req.Tab)
	if tab == "" {
		writeError(w, http.StatusBadRequest, "invalid tab")
		return
	}
	req.OpportunityKey = strings.TrimSpace(req.OpportunityKey)
	if req.OpportunityKey == "" {
		writeError(w, http.StatusBadRequest, "opportunity_key is required")
		return
	}
	payloadObj, payloadJSON, err := normalizeJSONObject(req.Payload)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validatePinnedPayload(tab, req.OpportunityKey, payloadObj); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.db.AddPinnedOpportunityForUser(userID, db.PinnedOpportunity{
		OpportunityKey: req.OpportunityKey,
		Tab:            tab,
		PayloadJSON:    payloadJSON,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save pinned opportunity")
		return
	}
	items, err := s.db.ListPinnedOpportunitiesForUser(userID, tab)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list pinned opportunities")
		return
	}
	logPinnedDebug("add user_id=%s tab=%s key=%s count=%d", userID, tab, req.OpportunityKey, len(items))
	writeJSON(w, items)
}

func (s *Server) handleDeletePinnedOpportunity(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	opportunityKey := strings.TrimSpace(r.PathValue("opportunityKey"))
	if opportunityKey == "" {
		writeError(w, http.StatusBadRequest, "invalid opportunity_key")
		return
	}
	if err := s.db.DeletePinnedOpportunityForUser(userID, opportunityKey); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete pinned opportunity")
		return
	}
	logPinnedDebug("delete user_id=%s key=%s", userID, opportunityKey)
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (s *Server) handleListPinnedSnapshots(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	opportunityKey := strings.TrimSpace(r.URL.Query().Get("opportunity_key"))
	if opportunityKey == "" {
		writeError(w, http.StatusBadRequest, "opportunity_key is required")
		return
	}
	limit := 50
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	items, err := s.db.ListPinnedOpportunitySnapshotsForUser(userID, opportunityKey, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list pinned snapshots")
		return
	}
	logPinnedDebug("list snapshots user_id=%s key=%s limit=%d count=%d", userID, opportunityKey, limit, len(items))
	writeJSON(w, items)
}

func (s *Server) handleUpsertPinnedSnapshots(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	var req struct {
		Snapshots []pinnedSnapshotBatchRequest `json:"snapshots"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if len(req.Snapshots) == 0 {
		writeJSON(w, map[string]int{"upserted": 0})
		return
	}
	count := 0
	for _, snap := range req.Snapshots {
		key := strings.TrimSpace(snap.OpportunityKey)
		if key == "" {
			continue
		}
		_, metricsJSON, err := normalizeJSONObject(snap.Metrics)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		label := strings.TrimSpace(snap.SnapshotLabel)
		if label == "" {
			label = "24h"
		}
		snapshotAt := strings.TrimSpace(snap.SnapshotAt)
		if snapshotAt == "" {
			snapshotAt = time.Now().UTC().Format(time.RFC3339)
		}
		if err := s.db.UpsertPinnedOpportunitySnapshotForUser(userID, key, db.PinnedSnapshot{
			SnapshotLabel: label,
			SnapshotAt:    snapshotAt,
			MetricsJSON:   metricsJSON,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save snapshot")
			return
		}
		logPinnedDebug("upsert snapshot user_id=%s key=%s label=%s", userID, key, label)
		count++
	}
	writeJSON(w, map[string]int{"upserted": count})
}

func (s *Server) updatePinnedSnapshotsForFlipResults(userID, tab string, scanID int64, results []engine.FlipResult) {
	items, err := s.db.ListPinnedOpportunitiesForUser(userID, tab)
	if err != nil || len(items) == 0 {
		return
	}
	pinSet := make(map[string]struct{}, len(items))
	for _, item := range items {
		pinSet[item.OpportunityKey] = struct{}{}
	}
	label := "scan:" + strconv.FormatInt(scanID, 10)
	for _, row := range results {
		key := flipOpportunityKey(row)
		if _, ok := pinSet[key]; !ok {
			continue
		}
		metricsJSON, _ := json.Marshal(map[string]any{
			"profit":     flipResultKPIProfit(row),
			"margin":     row.MarginPercent,
			"volume":     row.DailyVolume,
			"route_risk": row.TotalJumps,
		})
		if err := s.db.UpsertPinnedOpportunitySnapshotForUser(userID, key, db.PinnedSnapshot{
			SnapshotLabel: label,
			SnapshotAt:    time.Now().UTC().Format(time.RFC3339),
			MetricsJSON:   string(metricsJSON),
		}); err != nil {
			log.Printf("[API] pinned snapshot upsert failed (tab=%s key=%s): %v", tab, key, err)
		}
	}
}

func (s *Server) updatePinnedSnapshotsForStationResults(userID string, scanID int64, results []engine.StationTrade) {
	items, err := s.db.ListPinnedOpportunitiesForUser(userID, db.PinnedTabStation)
	if err != nil || len(items) == 0 {
		return
	}
	pinSet := make(map[string]struct{}, len(items))
	for _, item := range items {
		pinSet[item.OpportunityKey] = struct{}{}
	}
	label := "scan:" + strconv.FormatInt(scanID, 10)
	for _, row := range results {
		key := stationOpportunityKey(row)
		if _, ok := pinSet[key]; !ok {
			continue
		}
		metricsJSON, _ := json.Marshal(map[string]any{
			"profit":     stationTradeKPIProfit(row),
			"margin":     row.MarginPercent,
			"volume":     row.DailyVolume,
			"route_risk": row.SDS,
		})
		if err := s.db.UpsertPinnedOpportunitySnapshotForUser(userID, key, db.PinnedSnapshot{
			SnapshotLabel: label,
			SnapshotAt:    time.Now().UTC().Format(time.RFC3339),
			MetricsJSON:   string(metricsJSON),
		}); err != nil {
			log.Printf("[API] pinned snapshot upsert failed (tab=station key=%s): %v", key, err)
		}
	}
}

func (s *Server) updatePinnedSnapshotsForContractResults(userID string, scanID int64, results []engine.ContractResult) {
	items, err := s.db.ListPinnedOpportunitiesForUser(userID, db.PinnedTabContracts)
	if err != nil || len(items) == 0 {
		return
	}
	pinSet := make(map[string]struct{}, len(items))
	for _, item := range items {
		pinSet[item.OpportunityKey] = struct{}{}
	}
	label := "scan:" + strconv.FormatInt(scanID, 10)
	for _, row := range results {
		key := contractOpportunityKey(row)
		if _, ok := pinSet[key]; !ok {
			continue
		}
		metricsJSON, _ := json.Marshal(map[string]any{
			"profit":     contractResultKPIProfit(row),
			"margin":     row.MarginPercent,
			"volume":     row.Volume,
			"route_risk": row.LiquidationJumps,
		})
		if err := s.db.UpsertPinnedOpportunitySnapshotForUser(userID, key, db.PinnedSnapshot{
			SnapshotLabel: label,
			SnapshotAt:    time.Now().UTC().Format(time.RFC3339),
			MetricsJSON:   string(metricsJSON),
		}); err != nil {
			log.Printf("[API] pinned snapshot upsert failed (tab=contracts key=%s): %v", key, err)
		}
	}
}

func flipOpportunityKey(r engine.FlipResult) string {
	buyLoc := r.BuyLocationID
	if buyLoc <= 0 {
		buyLoc = int64(r.BuySystemID)
	}
	sellLoc := r.SellLocationID
	if sellLoc <= 0 {
		sellLoc = int64(r.SellSystemID)
	}
	return fmt.Sprintf("flip:%d:%d:%d", r.TypeID, buyLoc, sellLoc)
}

func stationOpportunityKey(r engine.StationTrade) string {
	stationID := r.StationID
	if stationID <= 0 {
		stationID = int64(r.SystemID)
	}
	return fmt.Sprintf("station:%d:%d", r.TypeID, stationID)
}

func contractOpportunityKey(r engine.ContractResult) string {
	return fmt.Sprintf("contract:%d", r.ContractID)
}
