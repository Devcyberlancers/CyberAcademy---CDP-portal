$ErrorActionPreference = "SilentlyContinue"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$nextDirs = @(
  (Join-Path $projectRoot "frontend\.next"),
  (Join-Path $projectRoot "frontend\.next-dev")
)

foreach ($nextDir in $nextDirs) {
  if (Test-Path -LiteralPath $nextDir) {
    Remove-Item -LiteralPath $nextDir -Recurse -Force
  }
}
