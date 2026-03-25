package api

import (
	"os/exec"
	"syscall"
)

// hideConsoleWindow prevents a child process from creating a visible console
// window on Windows (avoids focus-stealing flicker during background operations).
func hideConsoleWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
