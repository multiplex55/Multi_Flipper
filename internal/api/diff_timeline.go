package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

type diffMetricSet struct {
	Buy         string   `json:"buy,omitempty"`
	Sell        string   `json:"sell,omitempty"`
	NetProfit   *float64 `json:"net_profit,omitempty"`
	Margin      *float64 `json:"margin,omitempty"`
	DailyVolume *float64 `json:"daily_volume,omitempty"`
	RouteRisk   *float64 `json:"route_risk,omitempty"`
	Confidence  *float64 `json:"confidence_proxy,omitempty"`
}

type diffMetricDelta struct {
	BuyChanged  bool     `json:"buy_changed,omitempty"`
	SellChanged bool     `json:"sell_changed,omitempty"`
	NetProfit   *float64 `json:"net_profit,omitempty"`
	Margin      *float64 `json:"margin,omitempty"`
	DailyVolume *float64 `json:"daily_volume,omitempty"`
	RouteRisk   *float64 `json:"route_risk,omitempty"`
	Confidence  *float64 `json:"confidence_proxy,omitempty"`
}

type diffDriver struct {
	Key    string `json:"key"`
	Label  string `json:"label"`
	Before string `json:"before,omitempty"`
	After  string `json:"after,omitempty"`
	Delta  string `json:"delta,omitempty"`
}

type diffTimelineEntry struct {
	TimelineKey string          `json:"timeline_key"`
	Label       string          `json:"label"`
	Timestamp   string          `json:"timestamp"`
	Fields      diffMetricSet   `json:"fields"`
	Delta       diffMetricDelta `json:"delta"`
	Drivers     []diffDriver    `json:"drivers,omitempty"`
}

type diffTimelineResponse struct {
	Source string              `json:"source"`
	Key    string              `json:"key"`
	Items  []diffTimelineEntry `json:"items"`
}

type diffPoint struct {
	timelineKey string
	label       string
	timestamp   string
	fields      diffMetricSet
	drivers     []diffDriver
}

func parseFloat(v any) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case float32:
		return float64(t), true
	case int:
		return float64(t), true
	case int64:
		return float64(t), true
	case json.Number:
		f, err := t.Float64()
		return f, err == nil
	default:
		return 0, false
	}
}

func ptrFloat(v float64) *float64 { return &v }

func diffFloat(a, b *float64) *float64 {
	if a == nil || b == nil {
		return nil
	}
	v := *a - *b
	return &v
}

func buildTimeline(points []diffPoint) []diffTimelineEntry {
	if len(points) == 0 {
		return []diffTimelineEntry{}
	}
	sort.SliceStable(points, func(i, j int) bool {
		ti, _ := time.Parse(time.RFC3339, points[i].timestamp)
		tj, _ := time.Parse(time.RFC3339, points[j].timestamp)
		if ti.Equal(tj) {
			return points[i].timelineKey < points[j].timelineKey
		}
		return ti.Before(tj)
	})
	out := make([]diffTimelineEntry, 0, len(points))
	for i, p := range points {
		entry := diffTimelineEntry{TimelineKey: p.timelineKey, Label: p.label, Timestamp: p.timestamp, Fields: p.fields, Drivers: p.drivers}
		if i > 0 {
			prev := points[i-1]
			entry.Delta = diffMetricDelta{
				BuyChanged:  p.fields.Buy != prev.fields.Buy,
				SellChanged: p.fields.Sell != prev.fields.Sell,
				NetProfit:   diffFloat(p.fields.NetProfit, prev.fields.NetProfit),
				Margin:      diffFloat(p.fields.Margin, prev.fields.Margin),
				DailyVolume: diffFloat(p.fields.DailyVolume, prev.fields.DailyVolume),
				RouteRisk:   diffFloat(p.fields.RouteRisk, prev.fields.RouteRisk),
				Confidence:  diffFloat(p.fields.Confidence, prev.fields.Confidence),
			}
		}
		out = append(out, entry)
	}
	return out
}

func (s *Server) handleGetScanHistoryDiffTimeline(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	record := s.db.GetHistoryByID(id)
	if record == nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	history := s.db.GetHistory(500)
	points := make([]diffPoint, 0)
	for i := len(history) - 1; i >= 0; i-- {
		h := history[i]
		if h.Tab != record.Tab || h.System != record.System {
			continue
		}
		if h.ID > id {
			continue
		}
		fields := diffMetricSet{Buy: h.System, NetProfit: ptrFloat(h.TotalProfit), DailyVolume: ptrFloat(float64(h.Count))}
		params := map[string]any{}
		_ = json.Unmarshal(h.Params, &params)
		if sell, ok := params["target_market_system"].(string); ok && strings.TrimSpace(sell) != "" {
			fields.Sell = strings.TrimSpace(sell)
		}
		if fields.Sell == "" {
			fields.Sell = h.System
		}
		if margin, ok := parseFloat(params["min_margin"]); ok {
			fields.Margin = ptrFloat(margin)
		}
		if risk, ok := parseFloat(params["min_route_security"]); ok {
			fields.RouteRisk = ptrFloat(risk)
		}
		confidence := 0.0
		if h.DurationMs > 0 {
			confidence = float64(h.Count) * 1000 / float64(h.DurationMs)
		}
		fields.Confidence = ptrFloat(confidence)
		points = append(points, diffPoint{
			timelineKey: fmt.Sprintf("scan:%d", h.ID),
			label:       fmt.Sprintf("Scan #%d", h.ID),
			timestamp:   h.Timestamp,
			fields:      fields,
			drivers: []diffDriver{
				{Key: "count", Label: "Result count", After: strconv.Itoa(h.Count)},
				{Key: "top_profit", Label: "Top profit", After: fmt.Sprintf("%.2f", h.TopProfit)},
				{Key: "duration_ms", Label: "Duration ms", After: strconv.FormatInt(h.DurationMs, 10)},
			},
		})
	}
	writeJSON(w, diffTimelineResponse{Source: "scan_history", Key: strconv.FormatInt(id, 10), Items: buildTimeline(points)})
}

func (s *Server) handleGetPinnedOpportunityDiffTimeline(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromRequest(r)
	opportunityKey := strings.TrimSpace(r.PathValue("opportunityKey"))
	if opportunityKey == "" {
		writeError(w, http.StatusBadRequest, "opportunity key is required")
		return
	}
	pinned, err := s.db.GetPinnedOpportunityForUser(userID, opportunityKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load pinned opportunity")
		return
	}
	if pinned == nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	snapshots, err := s.db.ListPinnedOpportunitySnapshotsForUser(userID, opportunityKey, 100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load pinned snapshots")
		return
	}
	payload := map[string]any{}
	_ = json.Unmarshal([]byte(pinned.PayloadJSON), &payload)
	labelsBuy, _ := payload["buy_label"].(string)
	labelsSell, _ := payload["sell_label"].(string)
	points := make([]diffPoint, 0, len(snapshots)+1)
	for _, snap := range snapshots {
		metrics := map[string]any{}
		_ = json.Unmarshal([]byte(snap.MetricsJSON), &metrics)
		fields := diffMetricSet{Buy: labelsBuy, Sell: labelsSell}
		if v, ok := parseFloat(metrics["profit"]); ok {
			fields.NetProfit = ptrFloat(v)
		}
		if v, ok := parseFloat(metrics["margin"]); ok {
			fields.Margin = ptrFloat(v)
		}
		if v, ok := parseFloat(metrics["volume"]); ok {
			fields.DailyVolume = ptrFloat(v)
		}
		if v, ok := parseFloat(metrics["route_risk"]); ok {
			fields.RouteRisk = ptrFloat(v)
		}
		if v, ok := parseFloat(metrics["confidence"]); ok {
			fields.Confidence = ptrFloat(v)
		}
		points = append(points, diffPoint{timelineKey: fmt.Sprintf("snapshot:%d", snap.ID), label: snap.SnapshotLabel, timestamp: snap.SnapshotAt, fields: fields, drivers: []diffDriver{{Key: "snapshot", Label: "Snapshot label", After: snap.SnapshotLabel}}})
	}
	if metrics, ok := payload["metrics"].(map[string]any); ok {
		fields := diffMetricSet{Buy: labelsBuy, Sell: labelsSell}
		if v, ok := parseFloat(metrics["profit"]); ok {
			fields.NetProfit = ptrFloat(v)
		}
		if v, ok := parseFloat(metrics["margin"]); ok {
			fields.Margin = ptrFloat(v)
		}
		if v, ok := parseFloat(metrics["volume"]); ok {
			fields.DailyVolume = ptrFloat(v)
		}
		if v, ok := parseFloat(metrics["route_risk"]); ok {
			fields.RouteRisk = ptrFloat(v)
		}
		if meta, ok := payload["metadata"].(map[string]any); ok {
			if v, ok := parseFloat(meta["confidence"]); ok {
				fields.Confidence = ptrFloat(v)
			}
		}
		points = append(points, diffPoint{timelineKey: "current", label: "Current", timestamp: pinned.UpdatedAt, fields: fields, drivers: []diffDriver{{Key: "updated", Label: "Pinned updated", After: pinned.UpdatedAt}}})
	}
	writeJSON(w, diffTimelineResponse{Source: "pinned_opportunity", Key: opportunityKey, Items: buildTimeline(points)})
}
