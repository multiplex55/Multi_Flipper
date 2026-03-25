package gankcheck

import (
	"sync"
	"time"
)

const cacheTTL = 5 * time.Minute

type cacheEntry struct {
	data      *SystemDanger
	expiresAt time.Time
}

type systemDangerCache struct {
	mu      sync.RWMutex
	entries map[int32]*cacheEntry
}

func newSystemDangerCache() *systemDangerCache {
	return &systemDangerCache{
		entries: make(map[int32]*cacheEntry),
	}
}

func (c *systemDangerCache) get(systemID int32) *SystemDanger {
	c.mu.RLock()
	e, ok := c.entries[systemID]
	c.mu.RUnlock()
	if !ok || time.Now().After(e.expiresAt) {
		return nil
	}
	return e.data
}

func (c *systemDangerCache) set(systemID int32, sd *SystemDanger) {
	c.mu.Lock()
	c.entries[systemID] = &cacheEntry{
		data:      sd,
		expiresAt: time.Now().Add(cacheTTL),
	}
	c.mu.Unlock()
}
