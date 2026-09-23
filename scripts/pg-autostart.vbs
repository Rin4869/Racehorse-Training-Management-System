' Starts the project's portable PostgreSQL instance at Windows logon, hidden.
' A copy of this file lives in the current user's Startup folder:
'   %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\pg-autostart.vbs
' Remove that copy to disable autostart. pg_ctl start is a no-op if already running.
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run """C:\Users\Lenovo\pgsql\bin\pg_ctl.exe"" start -D ""C:\Users\Lenovo\pgdata"" -s -o ""-p 5432""", 0, False
