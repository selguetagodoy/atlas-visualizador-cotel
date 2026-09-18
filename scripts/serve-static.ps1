param(
    [string]$Root = (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)),
    [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$listener = [System.Net.HttpListener]::new()
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".css" = "text/css; charset=utf-8"
    ".js" = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".geojson" = "application/geo+json; charset=utf-8"
    ".png" = "image/png"
    ".jpg" = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".webp" = "image/webp"
    ".svg" = "image/svg+xml"
    ".pdf" = "application/pdf"
}

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        try {
            $urlPath = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
            if ([string]::IsNullOrWhiteSpace($urlPath)) { $urlPath = "index.html" }
            $relative = $urlPath -replace "/", [System.IO.Path]::DirectorySeparatorChar
            $target = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))
            $rootFull = [System.IO.Path]::GetFullPath($Root)

            if (-not $target.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $target -PathType Leaf)) {
                $ctx.Response.StatusCode = 404
                $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
                $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $ext = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
                $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
                $bytes = [System.IO.File]::ReadAllBytes($target)
                $ctx.Response.ContentLength64 = $bytes.Length
                $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } catch {
            $ctx.Response.StatusCode = 500
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } finally {
            $ctx.Response.OutputStream.Close()
        }
    }
} finally {
    $listener.Stop()
}
