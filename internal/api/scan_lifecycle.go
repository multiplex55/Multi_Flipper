package api

import (
	"context"
	"sync"
	"time"
)

type scanTerminalStatus string

const (
	scanTerminalCompleted scanTerminalStatus = "completed"
	scanTerminalCanceled  scanTerminalStatus = "canceled"
	scanTerminalTimedOut  scanTerminalStatus = "timed_out"
	scanTerminalFailed    scanTerminalStatus = "failed"
)

type activeScanState struct {
	ScanID         string             `json:"scan_id"`
	Kind           string             `json:"kind"`
	StartedAt      time.Time          `json:"started_at"`
	LastProgressAt time.Time          `json:"last_progress_at"`
	Stage          string             `json:"stage"`
	TerminalStatus scanTerminalStatus `json:"terminal_status,omitempty"`
	Active         bool               `json:"active"`
}

type activeScanEntry struct {
	state  activeScanState
	cancel context.CancelFunc
}

type scanLifecycleRegistry struct {
	mu     sync.RWMutex
	byUser map[string]activeScanEntry
}

func newScanLifecycleRegistry() *scanLifecycleRegistry {
	return &scanLifecycleRegistry{byUser: make(map[string]activeScanEntry)}
}

func (r *scanLifecycleRegistry) register(userID, scanID, kind, stage string, cancel context.CancelFunc) {
	now := time.Now().UTC()
	r.mu.Lock()
	defer r.mu.Unlock()
	r.byUser[userID] = activeScanEntry{state: activeScanState{ScanID: scanID, Kind: kind, StartedAt: now, LastProgressAt: now, Stage: stage, Active: true}, cancel: cancel}
}

func (r *scanLifecycleRegistry) progress(userID, stage string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry, ok := r.byUser[userID]
	if !ok {
		return
	}
	entry.state.LastProgressAt = time.Now().UTC()
	entry.state.Stage = stage
	r.byUser[userID] = entry
}

func (r *scanLifecycleRegistry) finalize(userID, stage string, terminal scanTerminalStatus) {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry, ok := r.byUser[userID]
	if !ok {
		return
	}
	entry.state.Active = false
	entry.state.TerminalStatus = terminal
	entry.state.Stage = stage
	entry.cancel = nil
	r.byUser[userID] = entry
}

func (r *scanLifecycleRegistry) get(userID string) (activeScanState, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	entry, ok := r.byUser[userID]
	if !ok {
		return activeScanState{}, false
	}
	return entry.state, true
}

func (r *scanLifecycleRegistry) cancel(userID string) bool {
	r.mu.Lock()
	entry, ok := r.byUser[userID]
	if !ok || !entry.state.Active || entry.cancel == nil {
		r.mu.Unlock()
		return false
	}
	cancel := entry.cancel
	entry.state.Stage = "cancel requested"
	r.byUser[userID] = entry
	r.mu.Unlock()
	cancel()
	return true
}
