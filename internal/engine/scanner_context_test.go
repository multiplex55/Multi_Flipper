package engine

import (
	"context"
	"errors"
	"runtime"
	"testing"
	"time"

	"eve-flipper/internal/esi"
	"eve-flipper/internal/graph"
	"eve-flipper/internal/sde"
)

func testScannerWithBlockingLikeDeps() *Scanner {
	u := graph.NewUniverse()
	u.SetRegion(30000142, 10000002)
	data := &sde.Data{Universe: u}
	return &Scanner{SDE: data, ESI: esi.NewClient(nil)}
}

func TestScanWithContext_ReturnsPromptlyWhenCanceled(t *testing.T) {
	s := testScannerWithBlockingLikeDeps()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	start := time.Now()
	_, err := s.ScanWithContext(ctx, ScanParams{CurrentSystemID: 30000142, BuyRadius: 1, SellRadius: 1}, func(string) {})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
	if time.Since(start) > 100*time.Millisecond {
		t.Fatalf("ScanWithContext did not return promptly after cancel")
	}
}

func TestScanWithContext_ReturnsPromptlyWhenDeadlineExceeded(t *testing.T) {
	s := testScannerWithBlockingLikeDeps()
	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()

	start := time.Now()
	_, err := s.ScanWithContext(ctx, ScanParams{CurrentSystemID: 30000142, BuyRadius: 1, SellRadius: 1}, func(string) {})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected context.DeadlineExceeded, got %v", err)
	}
	if time.Since(start) > 100*time.Millisecond {
		t.Fatalf("ScanWithContext did not return promptly after deadline")
	}
}

func TestFetchOrdersStream_CanceledContext_ClosesAndUnblocks(t *testing.T) {
	s := &Scanner{ESI: esi.NewClient(nil)}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	ch := s.fetchOrdersStream(ctx, map[int32]bool{10000002: true, 10000043: true}, "sell", map[int32]int{30000142: 0})
	_, ok := <-ch
	if ok {
		t.Fatalf("expected closed channel")
	}
}

func TestFetchOrdersStream_RepeatedCanceledContexts_NoUnboundedGoroutineGrowth(t *testing.T) {
	s := &Scanner{ESI: esi.NewClient(nil)}
	baseline := runtime.NumGoroutine()

	for i := 0; i < 200; i++ {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		ch := s.fetchOrdersStream(ctx, map[int32]bool{10000002: true, 10000043: true, 10000030: true}, "buy", map[int32]int{30000142: 0})
		for range ch {
		}
	}

	time.Sleep(50 * time.Millisecond)
	after := runtime.NumGoroutine()
	if after > baseline+20 {
		t.Fatalf("goroutine growth too high: baseline=%d after=%d", baseline, after)
	}
}
