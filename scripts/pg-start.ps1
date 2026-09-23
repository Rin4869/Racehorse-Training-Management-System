# Start the local PostgreSQL instance installed for this project.
# Portable install (no admin, not a Windows service) — run this after each reboot.
$ErrorActionPreference = 'Stop'
$PgBin  = 'C:\Users\Lenovo\pgsql\bin'
$PgData = 'C:\Users\Lenovo\pgdata'

& "$PgBin\pg_ctl.exe" -D $PgData -l "$PgData\server.log" -o "-p 5432" status
if ($LASTEXITCODE -eq 0) {
    Write-Host 'PostgreSQL already running on :5432'
    exit 0
}
& "$PgBin\pg_ctl.exe" -D $PgData -l "$PgData\server.log" -o "-p 5432" start
Write-Host 'PostgreSQL started on localhost:5432 (db: racehorse, user: postgres / postgres)'
