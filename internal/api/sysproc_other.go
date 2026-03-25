//go:build !windows

package api

import "os/exec"

func hideConsoleWindow(_ *exec.Cmd) {}
