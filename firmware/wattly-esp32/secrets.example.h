// Copy this file to secrets.h (same folder) and fill it in. secrets.h is git-ignored.
#pragma once

#define WIFI_SSID     "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// From energy-monitor/.env.local (DEVICE_ID, DEVICE_SECRET).
#define DEVICE_ID     "31ca46ea-...."
#define DEVICE_SECRET "...."

// Live site, or http://<your-laptop-ip>:3000/api/readings while testing on Wi-Fi.
#define API_URL       "https://smart-home-energy-monitor-bay.vercel.app/api/readings"
