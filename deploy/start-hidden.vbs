' Launch run-server.cmd with no console window (used by the logon scheduled task).
' Waits for the server to exit so the task keeps "Running" state and the
' restart-on-failure policy in Task Scheduler actually applies.
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
Set shell = CreateObject("WScript.Shell")
shell.Run """" & here & "\run-server.cmd""", 0, True
