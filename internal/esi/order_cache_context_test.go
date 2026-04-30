package esi

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestConditionalCheck_ContextCanceledBeforeSemaphoreSlot(t *testing.T) {
	c := NewClient(nil)
	c.scanSem = make(chan struct{}, 1)
	c.scanSem <- struct{}{} // occupy only slot

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	start := time.Now()
	_, _, err := c.conditionalCheck(ctx, "https://example.invalid/page=1", "etag")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context canceled, got %v", err)
	}
	if time.Since(start) > 50*time.Millisecond {
		t.Fatalf("conditionalCheck did not fail immediately")
	}
}
