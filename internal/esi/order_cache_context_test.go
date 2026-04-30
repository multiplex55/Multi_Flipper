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
	if got := err.Error(); got == context.Canceled.Error() {
		t.Fatalf("expected wrapped error, got bare context error: %q", got)
	}
	if time.Since(start) > 50*time.Millisecond {
		t.Fatalf("conditionalCheck did not fail immediately")
	}
}

func TestFetchRegionOrdersWithContext_PreCanceled(t *testing.T) {
	c := NewClient(nil)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := c.FetchRegionOrdersWithContext(ctx, 10000002, "sell")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context canceled, got %v", err)
	}
	if got := err.Error(); got == context.Canceled.Error() {
		t.Fatalf("expected wrapped error, got bare context error: %q", got)
	}
}
