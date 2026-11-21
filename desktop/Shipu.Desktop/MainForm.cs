using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Shipu.Desktop;

/// <summary>
/// 主窗口：把打包好的前端放进 WebView2 里跑，前端域名用虚拟主机映射，
/// 不启动任何本地 HTTP 服务，双击图标就能用。
/// </summary>
internal sealed class MainForm : Form
{
    private const string Host = "app.shipu.local";
    private static readonly string WebRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
    // 琴谱数据（IndexedDB 与窗口状态）跟程序放在同一个文件夹，便于整体备份到 D 盘
    private static readonly string DataDir = Path.Combine(AppContext.BaseDirectory, "data");
    private static readonly string StatePath = Path.Combine(DataDir, "window.json");

    private readonly WebView2 _view = new() { Dock = DockStyle.Fill };
    private readonly Label _splash = new()
    {
        Dock = DockStyle.Fill,
        TextAlign = ContentAlignment.MiddleCenter,
        Text = "正在打开拾谱…",
        ForeColor = Color.FromArgb(120, 118, 112),
        BackColor = Color.FromArgb(246, 245, 242),
        Font = new Font("Microsoft YaHei UI", 11f),
    };

    public MainForm()
    {
        Text = "拾谱";
        BackColor = Color.FromArgb(246, 245, 242);
        MinimumSize = new Size(880, 620);
        StartPosition = FormStartPosition.CenterScreen;
        // 默认尺寸，屏幕比这小时自动收一点，别让窗口一开就超出屏幕
        var area = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1280, 800);
        Size = new Size(Math.Min(1180, area.Width - 80), Math.Min(840, area.Height - 80));
        ApplySavedBounds();

        Controls.Add(_view);
        Controls.Add(_splash);
        _view.Visible = false;

        Shown += async (_, _) => await InitializeAsync();
        FormClosing += (_, _) => SaveBounds();
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        var iconPath = Path.Combine(AppContext.BaseDirectory, "app.ico");
        if (!File.Exists(iconPath)) return;
        using var icon = new Icon(iconPath);
        Icon = (Icon)icon.Clone();
    }

    private async Task InitializeAsync()
    {
        try
        {
            if (!Directory.Exists(WebRoot))
            {
                MessageBox.Show(this, "缺少 wwwroot 目录，请重新生成应用。", "拾谱", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
                return;
            }

            Directory.CreateDirectory(DataDir);
            var profile = Path.Combine(DataDir, "WebView2");
            var options = new CoreWebView2EnvironmentOptions
            {
                // 调音器的标准音要从点击里直接出声，避免被自动播放策略拦掉
                AdditionalBrowserArguments = "--autoplay-policy=no-user-gesture-required",
            };
            var environment = await CoreWebView2Environment.CreateAsync(null, profile, options);
            await _view.EnsureCoreWebView2Async(environment);

            var core = _view.CoreWebView2;
            // 虚拟主机映射：/assets/... 直接读 wwwroot，等价于一个静态站点但不占端口
            core.SetVirtualHostNameToFolderMapping(Host, WebRoot, CoreWebView2HostResourceAccessKind.Allow);

            // 刷新 /score/xxx 这类前端路由时磁盘上没有对应文件：
            // 拦下来改走 index.html?path=...，由前端把地址还原成真实路由（见 src/main.tsx）
            core.NavigationStarting += (_, args) =>
            {
                if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) || uri.Host != Host) return;
                var path = Uri.UnescapeDataString(uri.AbsolutePath);
                if (Path.HasExtension(path)) return;
                if (File.Exists(Path.Combine(WebRoot, path.TrimStart('/')))) return;
                if (uri.Query.Contains("path=")) return;
                args.Cancel = true;
                core.Navigate($"https://{Host}/index.html?path={Uri.EscapeDataString(path)}");
            };

            core.Settings.AreDevToolsEnabled = Environment.GetEnvironmentVariable("SHIPU_DEV") == "1";
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsZoomControlEnabled = true;
            core.Settings.AreBrowserAcceleratorKeysEnabled = true;

            // 麦克风/剪贴板这类权限直接放行，省掉 Chromium 的原生弹窗
            core.PermissionRequested += (_, args) =>
            {
                if (args.PermissionKind is CoreWebView2PermissionKind.Microphone or CoreWebView2PermissionKind.ClipboardRead)
                {
                    args.State = CoreWebView2PermissionState.Allow;
                }
            };

            // 站内的外链（如 GitHub）交给系统浏览器，不要在应用窗口里漂走
            core.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                if (Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) && uri.Host != Host)
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(uri.ToString()) { UseShellExecute = true });
                }
            };

            core.NavigationCompleted += (_, _) =>
            {
                _splash.Visible = false;
                _view.Visible = true;
                _view.Focus();
            };

            var start = Environment.GetEnvironmentVariable("SHIPU_START") ?? "index.html";
            core.Navigate($"https://{Host}/{start}");
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(this,
                "这台电脑缺少 Microsoft Edge WebView2 运行时，无法打开拾谱。\n请安装后再试：https://go.microsoft.com/fwlink/p/?LinkId=2124703",
                "拾谱", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            Close();
        }
        catch (Exception error)
        {
            MessageBox.Show(this, $"启动失败：{error.Message}", "拾谱", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (keyData == Keys.F5 && _view.CoreWebView2 is not null)
        {
            _view.CoreWebView2.Reload();
            return true;
        }
        return base.ProcessCmdKey(ref msg, keyData);
    }

    private void ApplySavedBounds()
    {
        try
        {
            if (!File.Exists(StatePath)) return;
            var state = JsonSerializer.Deserialize<WindowBounds>(File.ReadAllText(StatePath));
            if (state is null || state.Width < MinimumSize.Width || state.Height < MinimumSize.Height) return;

            var area = Screen.AllScreens.Any(s => s.WorkingArea.IntersectsWith(new Rectangle(state.X, state.Y, state.Width, state.Height)))
                ? new Rectangle(state.X, state.Y, state.Width, state.Height)
                : new Rectangle(0, 0, state.Width, state.Height);
            StartPosition = FormStartPosition.Manual;
            Bounds = area;
            if (state.Maximized) WindowState = FormWindowState.Maximized;
        }
        catch
        {
            // 配置损坏就按默认尺寸开，不影响使用
        }
    }

    private void SaveBounds()
    {
        try
        {
            var bounds = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            Directory.CreateDirectory(DataDir);
            File.WriteAllText(StatePath, JsonSerializer.Serialize(new WindowBounds
            {
                X = bounds.X, Y = bounds.Y, Width = bounds.Width, Height = bounds.Height,
                Maximized = WindowState == FormWindowState.Maximized,
            }));
        }
        catch
        {
            // 记不住窗口大小不是致命问题
        }
    }

    private sealed class WindowBounds
    {
        public int X { get; set; }
        public int Y { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public bool Maximized { get; set; }
    }
}
