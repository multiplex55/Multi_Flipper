package logger

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInfo_Success_Warn_Error_NoPanic(t *testing.T) {
	// Redirect stdout so we don't spam the test output
	old := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w
	defer func() { os.Stdout = old }()

	Info("TAG", "message")
	Success("TAG", "message")
	Warn("TAG", "message")
	Error("TAG", "message")

	w.Close()
	var buf bytes.Buffer
	buf.ReadFrom(r)
	// Just ensure we didn't panic; output is environment-dependent (colors, etc.)
}

func TestBanner_NoPanic(t *testing.T) {
	old := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w
	defer func() { os.Stdout = old }()

	Banner("v1.0.0")
	Banner("")

	w.Close()
	var buf bytes.Buffer
	buf.ReadFrom(r)
}

func TestSectionAndStats_NoPanic(t *testing.T) {
	old := os.Stdout
	_, w, _ := os.Pipe()
	os.Stdout = w
	defer func() { os.Stdout = old }()
	Section("Test")
	Stats("key", 42)
	w.Close()
}

func TestInitFileLogging_WritesCustomAndStdLogs(t *testing.T) {
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w
	defer func() { os.Stdout = oldStdout }()

	dir := t.TempDir()
	if err := InitFileLogging(dir); err != nil {
		t.Fatalf("InitFileLogging failed: %v", err)
	}
	defer CloseFileLogging()

	Info("TEST", "custom logger line")
	log.Printf("[TEST] standard logger line")

	w.Close()
	var sink bytes.Buffer
	_, _ = sink.ReadFrom(r)

	prodData, err := os.ReadFile(filepath.Join(dir, "eve-flipper-prod.log"))
	if err != nil {
		t.Fatalf("read prod log: %v", err)
	}
	debugData, err := os.ReadFile(filepath.Join(dir, "eve-flipper-debug.log"))
	if err != nil {
		t.Fatalf("read debug log: %v", err)
	}

	prodText := string(prodData)
	debugText := string(debugData)

	if !strings.Contains(prodText, "custom logger line") {
		t.Fatalf("prod log missing custom logger line: %q", prodText)
	}
	if !strings.Contains(debugText, "custom logger line") {
		t.Fatalf("debug log missing custom logger line: %q", debugText)
	}
	if !strings.Contains(prodText, "standard logger line") {
		t.Fatalf("prod log missing standard logger line: %q", prodText)
	}
	if !strings.Contains(debugText, "standard logger line") {
		t.Fatalf("debug log missing standard logger line: %q", debugText)
	}
}
