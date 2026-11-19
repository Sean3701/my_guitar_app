# 把发布产物装到 %LOCALAPPDATA%\Programs\Shipu，并创建桌面 / 开始菜单快捷方式。
# 用法：右键「使用 PowerShell 运行」，或 powershell -ExecutionPolicy Bypass -File install.ps1
# 卸载：Stop-Process -Name Shipu -ErrorAction SilentlyContinue; Remove-Item "$env:LOCALAPPDATA\Programs\Shipu" -Recurse -Force; Remove-Item "$env:USERPROFILE\Desktop\拾谱.lnk","$env:APPDATA\Microsoft\Windows\Start Menu\Programs\拾谱.lnk"

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $here 'Shipu.Desktop\publish'
if (-not (Test-Path (Join-Path $src 'Shipu.exe'))) { throw "找不到发布产物：$src\Shipu.exe，请先运行 build.cmd" }

$dst = Join-Path $env:LOCALAPPDATA 'Programs\Shipu'
Get-Process Shipu -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 400

if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Copy-Item (Join-Path $src '*') $dst -Recurse -Force

$exe = Join-Path $dst 'Shipu.exe'
$shell = New-Object -ComObject WScript.Shell
$targets = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) '拾谱.lnk'),
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\拾谱.lnk')
)
foreach ($link in $targets) {
  $shortcut = $shell.CreateShortcut($link)
  $shortcut.TargetPath = $exe
  $shortcut.WorkingDirectory = $dst
  $shortcut.IconLocation = "$exe,0"
  $shortcut.Description = '拾谱 · 民谣吉他谱'
  $shortcut.Save()
  Write-Output "快捷方式: $link"
}

Write-Output "已安装到: $dst"
Write-Output "双击桌面「拾谱」即可打开。"
