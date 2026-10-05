# scripts/wallpaper-com.ps1
#
# Defines [CaseCalendar.DesktopWallpaper]: the Windows IDesktopWallpaper COM interface
# (CLSID C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD) plus monitor enumeration with real
# (physical) pixel sizes and display scaling. Dot-source it:  . "$PSScriptRoot\wallpaper-com.ps1"
#
# IDesktopWallpaper is IUnknown-only (no IDispatch), so PowerShell late binding cannot call
# it; the interface is declared via C# COM interop. Methods must be declared in vtable
# order: SetWallpaper, GetWallpaper, GetMonitorDevicePathAt, GetMonitorDevicePathCount,
# GetMonitorRECT (later slots are not used).
#
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

if (-not ('CaseCalendar.DesktopWallpaper' -as [Type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace CaseCalendar {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }

  [StructLayout(LayoutKind.Sequential)]
  internal struct POINT { public int X, Y; }

  [ComImport, Guid("B92B56A9-8B55-4E14-9A89-0199BBB6F93B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IDesktopWallpaper {
    void SetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID, [MarshalAs(UnmanagedType.LPWStr)] string wallpaper);
    [return: MarshalAs(UnmanagedType.LPWStr)]
    string GetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID);
    [return: MarshalAs(UnmanagedType.LPWStr)]
    string GetMonitorDevicePathAt(uint monitorIndex);
    uint GetMonitorDevicePathCount();
    RECT GetMonitorRECT([MarshalAs(UnmanagedType.LPWStr)] string monitorID);
  }

  [ComImport, Guid("C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD")]
  internal class DesktopWallpaperClass { }

  public class MonitorInfo {
    public string Id;
    public int Left, Top, Width, Height;  // physical pixels
    public double Scale;                  // Windows display scaling (1.0 = 100%)
    public bool Primary;
  }

  public static class DesktopWallpaper {
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromPoint(POINT pt, uint flags);
    [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr hmonitor, int dpiType, out uint dpiX, out uint dpiY);

    static bool dpiAware;
    // Per-monitor DPI aware (V2 = -4) so rectangles come back in physical pixels
    static void EnsureDpiAware() {
      if (dpiAware) return;
      try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { }
      dpiAware = true;
    }

    static IDesktopWallpaper Com() { return (IDesktopWallpaper)new DesktopWallpaperClass(); }

    // monitorId null/empty = all monitors (per Microsoft docs and CONTEXT.md decision)
    public static void Set(string path) { Com().SetWallpaper(null, path); }
    public static void SetOn(string monitorId, string path) { Com().SetWallpaper(string.IsNullOrEmpty(monitorId) ? null : monitorId, path); }
    public static string Get() { return Com().GetWallpaper(null); }

    public static List<MonitorInfo> Monitors() {
      EnsureDpiAware();
      var com = Com();
      var list = new List<MonitorInfo>();
      uint n = com.GetMonitorDevicePathCount();
      for (uint i = 0; i < n; i++) {
        string id = com.GetMonitorDevicePathAt(i);
        RECT r;
        try { r = com.GetMonitorRECT(id); } catch { continue; }  // inactive/disconnected monitor
        int w = r.Right - r.Left, h = r.Bottom - r.Top;
        if (w <= 0 || h <= 0) continue;
        double scale = 1.0;
        try {
          var hmon = MonitorFromPoint(new POINT { X = r.Left + w / 2, Y = r.Top + h / 2 }, 2 /* MONITOR_DEFAULTTONEAREST */);
          uint dx, dy;
          if (GetDpiForMonitor(hmon, 0 /* MDT_EFFECTIVE_DPI */, out dx, out dy) == 0 && dx > 0) scale = dx / 96.0;
        } catch { }
        list.Add(new MonitorInfo { Id = id, Left = r.Left, Top = r.Top, Width = w, Height = h, Scale = scale, Primary = (r.Left == 0 && r.Top == 0) });
      }
      return list;
    }
  }
}
'@
}
