# 注册开机自启（当前用户登录时启动，隐藏窗口），并立即启动一次。
# 卸载：Unregister-ScheduledTask -TaskName 'ShipuLocalServer' -Confirm:$false

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs = Join-Path $here 'start-hidden.vbs'
if (-not (Test-Path $vbs)) { throw "找不到 $vbs" }

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`"" -WorkingDirectory $here
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName 'ShipuLocalServer' -Action $action -Trigger $trigger -Settings $settings -Force `
  -Description '拾谱本地常驻服务 http://127.0.0.1:8080' | Out-Null

Start-ScheduledTask -TaskName 'ShipuLocalServer'
Start-Sleep -Seconds 3
$info = Get-ScheduledTask -TaskName 'ShipuLocalServer'
$run = Get-ScheduledTaskInfo -TaskName 'ShipuLocalServer'
Write-Output ("任务状态: {0} / 上次结果: 0x{1:X}" -f $info.State, $run.LastTaskResult)
