package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

// GET /api/gankcheck?from=30000142&to=30002187&min_sec=0.5
func (s *Server) handleGankCheck(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	fromID, err := strconv.ParseInt(q.Get("from"), 10, 32)
	if err != nil || fromID == 0 {
		http.Error(w, `{"error":"invalid from"}`, http.StatusBadRequest)
		return
	}
	toID, err := strconv.ParseInt(q.Get("to"), 10, 32)
	if err != nil || toID == 0 {
		http.Error(w, `{"error":"invalid to"}`, http.StatusBadRequest)
		return
	}
	minSec := 0.0
	if ms := q.Get("min_sec"); ms != "" {
		if v, err := strconv.ParseFloat(ms, 64); err == nil {
			minSec = v
		}
	}

	dangers, err := s.ganker.CheckRoute(int32(fromID), int32(toID), minSec)
	if err != nil {
		http.Error(w, `{"error":"route_check_failed"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dangers)
}

// GET /api/gankcheck/detail?system=30000142
func (s *Server) handleGankCheckDetail(w http.ResponseWriter, r *http.Request) {
	sysStr := r.URL.Query().Get("system")
	sysID, err := strconv.ParseInt(sysStr, 10, 32)
	if err != nil || sysID == 0 {
		http.Error(w, `{"error":"invalid system"}`, http.StatusBadRequest)
		return
	}

	summaries, err := s.ganker.CheckSystemDetail(int32(sysID))
	if err != nil {
		http.Error(w, `{"error":"detail_fetch_failed"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summaries)
}

// GET /api/gankcheck/batch?pairs=30000142:30002187,30000140:30002187&min_sec=0
func (s *Server) handleGankCheckBatch(w http.ResponseWriter, r *http.Request) {
	pairsStr := r.URL.Query().Get("pairs")
	if pairsStr == "" {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("[]"))
		return
	}
	minSec := 0.0
	if ms := r.URL.Query().Get("min_sec"); ms != "" {
		if v, err := strconv.ParseFloat(ms, 64); err == nil {
			minSec = v
		}
	}

	type pair struct{ from, to int32 }
	var pairs []pair
	for _, p := range strings.Split(pairsStr, ",") {
		parts := strings.SplitN(strings.TrimSpace(p), ":", 2)
		if len(parts) != 2 {
			continue
		}
		from, err1 := strconv.ParseInt(parts[0], 10, 32)
		to, err2 := strconv.ParseInt(parts[1], 10, 32)
		if err1 != nil || err2 != nil || from == 0 || to == 0 || from == to {
			continue
		}
		pairs = append(pairs, pair{int32(from), int32(to)})
	}
	if len(pairs) == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("[]"))
		return
	}

	type RouteSummary struct {
		Key      string  `json:"key"`
		Danger   string  `json:"danger"`
		Kills    int     `json:"kills"`
		TotalISK float64 `json:"totalISK"`
	}

	results := make([]RouteSummary, len(pairs))
	var wg sync.WaitGroup
	for i, p := range pairs {
		wg.Add(1)
		go func(idx int, pr pair) {
			defer wg.Done()
			key := fmt.Sprintf("%d:%d", pr.from, pr.to)
			systems, err := s.ganker.CheckRoute(pr.from, pr.to, minSec)
			if err != nil || systems == nil {
				results[idx] = RouteSummary{Key: key, Danger: "green"}
				return
			}
			totalKills := 0
			totalISK := 0.0
			worstDanger := "green"
			for _, sd := range systems {
				totalKills += sd.KillsTotal
				totalISK += sd.TotalISK
				if sd.DangerLevel == "red" {
					worstDanger = "red"
				} else if sd.DangerLevel == "yellow" && worstDanger == "green" {
					worstDanger = "yellow"
				}
			}
			results[idx] = RouteSummary{Key: key, Danger: worstDanger, Kills: totalKills, TotalISK: totalISK}
		}(i, p)
	}
	wg.Wait()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
