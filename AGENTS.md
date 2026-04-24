# AGENTS.md

## Project Guardrails

- **Never use `go run` for this project.** Do not start the application as part of verification.
- Do not use runtime/dev commands that launch the app or frontend server, including:
  - `go run ...`
  - `make run`
  - `make wails-run`
  - `./build/eve-flipper`, `./build/eve-flipper-wails`, or any compiled app binary
  - `npm run dev`, `npm run dev:wails`, `npm run preview`
  - `wails dev`, `wails run`, `tauri dev`
- Agents may build, test, lint, and type-check only. Verification should prove the code compiles without launching the app.

## Canonical Verification Commands

Use these commands when validating changes:

```bash
# Go compile check only; writes a disposable binary and does not run it.
go build -v ./...
go build -v -o /tmp/eve-flipper-check .

# Go static checks.
go vet ./...

# Go tests, when relevant to the change.
go test ./...

# Frontend install/build/type-check through the existing build script.
npm -C frontend install
npm -C frontend run build

# Frontend tests, when relevant to the change.
npm -C frontend run test
```

For Wails-specific changes, build only:

```bash
npm -C frontend install
npm -C frontend run build:wails
go build -tags wails,production -v -o /tmp/eve-flipper-wails-check .
```

On Windows PowerShell, prefer disposable output paths that are outside the repo or ignored by git:

```powershell
go build -v ./...
go build -v -o "$env:TEMP\eve-flipper-check.exe" .
go vet ./...
go test ./...
npm -C frontend install
npm -C frontend run build
```

## Dependency Rules

- Do not run `go mod tidy` casually. Use it only when imports or module dependencies actually changed.
- If `go mod tidy` changes `go.mod` or `go.sum`, mention why in the final response.
- Do not upgrade dependencies opportunistically.
- Prefer the Go standard library unless an existing project dependency already solves the problem cleanly.
- For frontend work, do not add new npm packages unless the feature clearly requires it.

## Build Artifact Rules

- Do not commit or intentionally modify generated/runtime artifacts, including:
  - `build/`
  - `dist/`
  - `frontend/dist/`
  - `node_modules/`
  - compiled binaries such as `eve-flipper.exe`
  - local databases such as `*.db`, `*.sqlite`, `*.sqlite3`
- If a verification build creates an artifact inside the repo, delete it before finishing.
- Prefer `go build -o /tmp/...` or `$env:TEMP\...` so build outputs stay outside the working tree.

## Go Coding Standards

- Write idiomatic, production-quality Go.
- Keep functions focused and readable; avoid clever abstractions.
- Use `gofmt` on modified Go files.
- Handle errors explicitly and wrap them with context:

```go
if err != nil {
    return fmt.Errorf("operation failed: %w", err)
}
```

- Use `errors.Is` and `errors.As` for wrapped error checks.
- Pass `context.Context` through network, API, database, and long-running operations.
- Set timeouts for HTTP clients, servers, and external requests.
- Always close response bodies.
- Avoid global mutable state.
- Do not log secrets, tokens, cookies, authorization headers, or EVE auth material.
- Validate external input at boundaries.

## Frontend Coding Standards

- Keep React/TypeScript changes typed and local to the relevant component or shared helper.
- Prefer existing components, hooks, table helpers, formatters, and CSS/Tailwind conventions before adding new patterns.
- Avoid duplicating business logic between tabs; extract shared route/scan/workbench logic when multiple views need the same state or behavior.
- Preserve compact, data-dense UI behavior used throughout the Flipper/Route workflows.
- Treat table sorting, filtering, grouping, and column visibility as user-facing behavior; do not change defaults without documenting the reason.

## Testing Expectations

- Add or update tests for reusable logic, parsers, ranking/scoring calculations, route/workbench state, and bug fixes.
- Prefer table-driven Go tests.
- Prefer deterministic tests that do not depend on live ESI, zKillboard, external network access, local user auth, or wall-clock timing.
- For UI logic, test pure helpers and state transitions where possible.
- When a full test run is too expensive, run the narrow relevant test command and clearly state what was and was not verified.

## Agent Workflow

- Before editing, inspect the current files and use the uploaded/current project version as source of truth.
- Make the smallest cohesive change that satisfies the request.
- Avoid unrelated refactors.
- Preserve existing public behavior unless the task explicitly changes it.
- After editing, summarize:
  - files changed
  - commands run
  - whether build/test verification passed
  - any commands intentionally not run because they would launch the app
