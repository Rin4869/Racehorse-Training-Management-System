# Stop the local PostgreSQL instance for this project.
$PgBin  = 'C:\Users\Lenovo\pgsql\bin'
$PgData = 'C:\Users\Lenovo\pgdata'
& "$PgBin\pg_ctl.exe" -D $PgData -m fast stop
Write-Host 'PostgreSQL stopped'
