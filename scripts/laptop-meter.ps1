# Sends this laptop's real power use to the ESP32 over USB every 10 s; the ESP32 posts it
# to /api/readings over its own Wi-Fi (firmware/wattly-esp32, "LAPTOP" readings).
# A safe live demo load: the battery sensor measures it, so the charger must be unplugged.
#
# Usage (from energy-monitor/, ESP32 plugged in, Arduino Serial Monitor closed):
#   powershell -ExecutionPolicy Bypass -File scripts/laptop-meter.ps1            # auto-finds the port
#   powershell -ExecutionPolicy Bypass -File scripts/laptop-meter.ps1 -Port COM3
param([string]$Port = "", [int]$Seconds = 10)

if (-not $Port) {
  $dev = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\((COM\d+)\)' } | Select-Object -First 1
  if (-not $dev) { Write-Host "No ESP32 found: plug it in by USB (red light on) and try again."; exit 1 }
  $Port = [regex]::Match($dev.Name, 'COM\d+').Value
}

# DTR/RTS off so opening the port doesn't reset the ESP32.
$serial = New-Object System.IO.Ports.SerialPort $Port, 115200
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$serial.NewLine = "`n"
$serial.Open()
Write-Host "Laptop meter -> ESP32 on $Port every $Seconds s. Ctrl+C to stop."

try {
  while ($true) {
    $b = Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus | Select-Object -First 1
    if ($b.PowerOnline) {
      Write-Host "Charger is plugged in: unplug it so the battery sensor can measure the laptop."
    } else {
      $watts = [math]::Round($b.DischargeRate / 1000, 1)   # mW -> W
      $serial.WriteLine("W $watts")
      Write-Host ("{0:HH:mm:ss}  laptop {1} W -> ESP32" -f (Get-Date), $watts)
    }
    Start-Sleep -Milliseconds 300
    $out = $serial.ReadExisting()   # show what the ESP32 says (POST ... -> 201)
    if ($out) { $out.Trim().Split("`n") | Where-Object { $_ -match 'POST|LAPTOP|Wi-Fi|rejected' } | ForEach-Object { Write-Host "   ESP32: $($_.Trim())" } }
    Start-Sleep -Milliseconds ($Seconds * 1000 - 300)
  }
} finally {
  $serial.Close()
}
