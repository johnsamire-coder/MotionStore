Add-Type -Name ConsoleQE -Namespace MS -MemberDefinition '[DllImport("kernel32.dll")] public static extern System.IntPtr GetStdHandle(int h); [DllImport("kernel32.dll")] public static extern bool GetConsoleMode(System.IntPtr h, out uint m); [DllImport("kernel32.dll")] public static extern bool SetConsoleMode(System.IntPtr h, uint m);' -ErrorAction SilentlyContinue
$h = [MS.ConsoleQE]::GetStdHandle(-10); $m = 0
[void][MS.ConsoleQE]::GetConsoleMode($h, [ref]$m)
[void][MS.ConsoleQE]::SetConsoleMode($h, (($m -band (-bnot 0x40)) -bor 0x80))
