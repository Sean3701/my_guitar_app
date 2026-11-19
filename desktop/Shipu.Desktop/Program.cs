using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace Shipu.Desktop;

internal static class Program
{
    private const string MutexName = "Shipu.Desktop.SingleInstance";
    private const string WindowTitle = "拾谱";

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindow(string? className, string windowName);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int cmdShow);

    [STAThread]
    private static void Main()
    {
        using var mutex = new Mutex(true, MutexName, out var isFirst);
        if (!isFirst)
        {
            // 已经开着一个：把那个窗口叫到前台，别再开第二个
            var existing = FindWindow(null, WindowTitle);
            if (existing != IntPtr.Zero)
            {
                ShowWindow(existing, 9);
                SetForegroundWindow(existing);
            }
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}
