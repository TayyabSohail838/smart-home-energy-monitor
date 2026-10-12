# Sends this laptop's real power use to the ESP32 over USB every 2 s (it posts every 5 s,
# or at once when the watts jump); the ESP32 posts it to /api/readings over its own
# Wi-Fi (firmware/wattly-esp32, source "laptop").
# A safe live demo load: the battery sensor measures it, so the charger must be unplugged.
# If the USB cable is pulled or the ESP32 resets, it waits and reconnects by itself.
#
# Usage (from energy-monitor/, ESP32 plugged in, Arduino Serial Monitor closed):
#   powershell -ExecutionPolicy Bypass -File scripts/laptop-meter.ps1            # auto-finds the port
#   powershell -ExecutionPolicy Bypass -File scripts/laptop-meter.ps1 -Port COM3
param([string]$Port = "", [int]$Seconds = 2)

function Find-Port {
  if ($Port) { return $Port }
  $dev = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\((COM\d+)\)' } | Select-Object -First 1
  if ($dev) { return [regex]::Match($dev.Name, 'COM\d+').Value }
  return $null
}

# DTR/RTS off so opening the port doesn't reset the ESP32. Returns $null if it can't open.
function Open-Esp32 {
  $name = Find-Port
  if (-not $name) { return $null }
  try {
    $s = New-Object System.IO.Ports.SerialPort $name, 115200
    $s.DtrEnable = $false
    $s.RtsEnable = $false
    $s.NewLine = "`n"
    $s.Open()
    Write-Host "Connected to ESP32 on $name. Sending every $Seconds s. Ctrl+C to stop."
    return $s
  } catch {
    return $null
  }
}

$serial = $null
try {
  while ($true) {
    if (-not $serial -or -not $serial.IsOpen) {
      $serial = Open-Esp32
      if (-not $serial) {
        Write-Host "ESP32 not connected (check the USB cable, red light on): retrying..."
        Start-Sleep -Seconds 3
        continue
      }
    }

    try {
      $b = Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus | Select-Object -First 1
      if ($b.PowerOnline) {
        Write-Host "Charger is plugged in: unplug it so the battery sensor can measure the laptop."
      } elseif ($b.DischargeRate -le 0) {
        Write-Host "Battery sensor settling (reads 0 W just after unplugging): waiting..."
      } else {
        $watts = [math]::Round($b.DischargeRate / 1000, 1)   # mW -> W
        $serial.WriteLine("W $watts")
        Write-Host ("{0:HH:mm:ss}  laptop {1} W -> ESP32" -f (Get-Date), $watts)
      }
      Start-Sleep -Milliseconds 300
      $out = $serial.ReadExisting()   # show what the ESP32 says (POST ... -> 201)
      if ($out) { $out.Trim().Split("`n") | Where-Object { $_ -match 'POST|LAPTOP|Wi-Fi|rejected' } | ForEach-Object { Write-Host "   ESP32: $($_.Trim())" } }
    } catch {
      Write-Host "Lost the ESP32 connection (USB unplugged or reset): reconnecting..."
      try { $serial.Close() } catch {}
      $serial = $null
    }
    Start-Sleep -Milliseconds ($Seconds * 1000 - 300)
  }
} finally {
  if ($serial) { $serial.Close() }
}
