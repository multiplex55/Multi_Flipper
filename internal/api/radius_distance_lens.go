package api

import (
	"encoding/json"
	"net/http"
)

type radiusDistanceLensRequest struct {
	OriginSystemID   int32                   `json:"origin_system_id"`
	MinRouteSecurity float64                 `json:"min_route_security"`
	Rows             []radiusDistanceLensRow `json:"rows"`
}

type radiusDistanceLensRow struct {
	RowKey       string  `json:"row_key"`
	BuySystemID  int32   `json:"buy_system_id"`
	SellSystemID int32   `json:"sell_system_id"`
	TotalProfit  float64 `json:"total_profit"`
	RealProfit   float64 `json:"real_profit"`
	DailyProfit  float64 `json:"daily_profit"`
}

type radiusDistanceLensMetric struct {
	RowKey          string  `json:"row_key"`
	BuyJumps        int     `json:"buy_jumps"`
	SellJumps       int     `json:"sell_jumps"`
	TotalJumps      int     `json:"total_jumps"`
	ProfitPerJump   float64 `json:"profit_per_jump"`
	RealIskPerJump  float64 `json:"real_isk_per_jump"`
	DailyIskPerJump float64 `json:"daily_isk_per_jump"`
	Unreachable     bool    `json:"unreachable"`
}

type radiusDistanceLensResponse struct {
	OriginSystemID   int32                      `json:"origin_system_id"`
	MinRouteSecurity float64                    `json:"min_route_security"`
	Rows             []radiusDistanceLensMetric `json:"rows"`
}

func iskPerJumpSafe(value float64, jumps int) float64 {
	if jumps <= 0 {
		return value
	}
	return value / float64(jumps)
}

func (s *Server) buildRadiusDistanceLensMetric(originSystemID int32, minRouteSecurity float64, row radiusDistanceLensRow) radiusDistanceLensMetric {
	metric := radiusDistanceLensMetric{RowKey: row.RowKey}
	s.mu.RLock()
	sdeData := s.sdeData
	s.mu.RUnlock()
	if sdeData == nil || sdeData.Universe == nil {
		metric.Unreachable = true
		metric.BuyJumps = -1
		metric.SellJumps = -1
		metric.TotalJumps = -1
		return metric
	}

	metric.BuyJumps = sdeData.Universe.ShortestPathMinSecurity(originSystemID, row.BuySystemID, minRouteSecurity)
	metric.SellJumps = sdeData.Universe.ShortestPathMinSecurity(row.BuySystemID, row.SellSystemID, minRouteSecurity)
	if metric.BuyJumps < 0 || metric.SellJumps < 0 {
		metric.Unreachable = true
		metric.BuyJumps = -1
		metric.SellJumps = -1
		metric.TotalJumps = -1
		metric.ProfitPerJump = 0
		metric.RealIskPerJump = 0
		metric.DailyIskPerJump = 0
		return metric
	}

	metric.TotalJumps = metric.BuyJumps + metric.SellJumps
	metric.ProfitPerJump = iskPerJumpSafe(row.TotalProfit, metric.TotalJumps)
	metric.RealIskPerJump = iskPerJumpSafe(row.RealProfit, metric.TotalJumps)
	metric.DailyIskPerJump = iskPerJumpSafe(row.DailyProfit, metric.TotalJumps)
	return metric
}

func (s *Server) handleRadiusDistanceLens(w http.ResponseWriter, r *http.Request) {
	var req radiusDistanceLensRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.OriginSystemID <= 0 {
		writeError(w, http.StatusBadRequest, "origin_system_id is required")
		return
	}

	resp := radiusDistanceLensResponse{
		OriginSystemID:   req.OriginSystemID,
		MinRouteSecurity: req.MinRouteSecurity,
		Rows:             make([]radiusDistanceLensMetric, 0, len(req.Rows)),
	}
	for _, row := range req.Rows {
		resp.Rows = append(resp.Rows, s.buildRadiusDistanceLensMetric(req.OriginSystemID, req.MinRouteSecurity, row))
	}
	writeJSON(w, resp)
}
