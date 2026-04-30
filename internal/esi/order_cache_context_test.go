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

func TestFetchRegionOrdersCachedWithContext_SingleflightWaiterCancelIndependent(t *testing.T) {
	c := NewClient(nil)

	ctxA, cancelA := context.WithCancel(context.Background())
	ctxB, cancelB := context.WithCancel(context.Background())
	defer cancelA()
	defer cancelB()

	key := "10000002:sell"
	resCh := c.orderCache.group.DoChan(key, func() (interface{}, error) {
		<-ctxA.Done()
		return nil, ctxA.Err()
	})

	cancelB()
	start := time.Now()
	select {
	case <-ctxB.Done():
	case <-time.After(50 * time.Millisecond):
		t.Fatal("expected canceled waiter to stop immediately")
	}
	if time.Since(start) > 50*time.Millisecond {
		t.Fatalf("canceled waiter took too long to stop")
	}

	cancelA()
	select {
	case <-resCh:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("singleflight worker did not finish after owner cancellation")
	}
}
