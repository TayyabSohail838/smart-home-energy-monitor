// Wattly ESP32: reads a PZEM-004T v3.0 every 10 s and POSTs it to /api/readings.
//
// Wiring (PZEM TTL side -> ESP32):  5V -> 3V3 (or VIN, see README)  RX -> GPIO17
//                                   TX -> GPIO16                     GND -> GND
// Arduino libraries: "PZEM-004T-v30" by Jakub Mandula (ESP32 core includes WiFi/HTTPClient).
//
// Body sent (one reading, or an array when catching up after Wi-Fi drops):
//   { device_id, ts, current_a, power_w, energy_wh }
// energy_wh is the energy in this window (power x elapsed time), as the API expects.
// The PZEM's voltage is not sent: voltage tracking is out of scope.

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PZEM004Tv30.h>
#include <time.h>
#include "secrets.h"

#define PZEM_RX_PIN 16  // ESP32 pin that receives from PZEM TX
#define PZEM_TX_PIN 17  // ESP32 pin that sends to PZEM RX

// TEST MODE: while the PZEM has no mains power (no reading), send a made-up 200-230 W
// value so the dashboard shows the ESP32 -> Wi-Fi -> server path working. Real PZEM
// readings always win. Set to false before the real demo.
#define TEST_MODE true
const float TEST_MIN_W = 200, TEST_MAX_W = 230, TEST_VOLTS = 230;

const uint32_t INTERVAL_MS = 10000;
const int MAX_BACKLOG = 60;  // 10 minutes of readings kept while offline
const int MAX_BATCH = 30;    // readings per POST when catching up

PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);

struct Reading {
  time_t ts;
  float current_a, power_w, energy_wh;
};
Reading backlog[MAX_BACKLOG];
int backlogCount = 0;
uint32_t lastReadMs = 0;

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Wi-Fi: connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(250);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " ok" : " failed (will retry)");
}

bool clockReady() { return time(nullptr) > 1700000000; }  // NTP has set a real date

void isoTime(time_t t, char *out, size_t len) {
  struct tm utc;
  gmtime_r(&t, &utc);
  strftime(out, len, "%Y-%m-%dT%H:%M:%SZ", &utc);
}

void addToBacklog(const Reading &r) {
  if (backlogCount == MAX_BACKLOG) {  // full: drop the oldest
    memmove(backlog, backlog + 1, sizeof(Reading) * (MAX_BACKLOG - 1));
    backlogCount--;
  }
  backlog[backlogCount++] = r;
}

// Sends up to MAX_BATCH of the oldest readings. Returns true if they were accepted.
bool sendBacklog() {
  if (backlogCount == 0 || WiFi.status() != WL_CONNECTED) return false;
  int n = min(backlogCount, MAX_BATCH);

  String body = "[";
  char ts[25];
  for (int i = 0; i < n; i++) {
    isoTime(backlog[i].ts, ts, sizeof(ts));
    char item[220];
    snprintf(item, sizeof(item),
             "%s{\"device_id\":\"%s\",\"ts\":\"%s\",\"current_a\":%.3f,\"power_w\":%.1f,\"energy_wh\":%.4f}",
             i ? "," : "", DEVICE_ID, ts, backlog[i].current_a, backlog[i].power_w, backlog[i].energy_wh);
    body += item;
  }
  body += "]";

  WiFiClientSecure tls;
  tls.setInsecure();  // hackathon shortcut: skips certificate checks
  HTTPClient http;
  bool https = String(API_URL).startsWith("https");
  WiFiClient plain;
  if (https) http.begin(tls, API_URL); else http.begin(plain, API_URL);
  http.addHeader("content-type", "application/json");
  http.addHeader("x-device-key", DEVICE_SECRET);
  http.setTimeout(8000);
  int status = http.POST(body);
  http.end();

  Serial.printf("POST %d reading(s) -> %d\n", n, status);
  // 201 = stored. 400/401 won't succeed on retry either (bad body or key), so drop them.
  if (status == 201 || status == 400 || status == 401) {
    if (status != 201) Serial.println("  rejected: check DEVICE_ID / DEVICE_SECRET");
    memmove(backlog, backlog + n, sizeof(Reading) * (backlogCount - n));
    backlogCount -= n;
    return status == 201;
  }
  return false;  // network/server error: keep them and retry next time
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nWattly ESP32 starting");
  connectWifi();
  configTime(0, 0, "pool.ntp.org", "time.google.com");  // timestamps are sent in UTC
}

void loop() {
  connectWifi();

  uint32_t now = millis();
  if (now - lastReadMs >= INTERVAL_MS || lastReadMs == 0) {
    float elapsedS = lastReadMs == 0 ? INTERVAL_MS / 1000.0 : (now - lastReadMs) / 1000.0;
    lastReadMs = now;

    float current = pzem.current();
    float power = pzem.power();
    bool test = false;
    if ((isnan(current) || isnan(power)) && TEST_MODE) {
      power = TEST_MIN_W + (TEST_MAX_W - TEST_MIN_W) * (esp_random() / 4294967295.0f);
      current = power / TEST_VOLTS;
      test = true;
    }
    if (isnan(current) || isnan(power)) {
      Serial.println("PZEM: no reading (check wiring and that the PZEM has mains power)");
    } else if (!clockReady()) {
      Serial.println("Waiting for internet time before sending...");
    } else {
      Reading r = {time(nullptr), current, power, power * elapsedS / 3600.0f};
      Serial.printf("%s%.3f A  %.1f W  %.4f Wh\n", test ? "TEST (no PZEM reading): " : "", r.current_a, r.power_w, r.energy_wh);
      addToBacklog(r);
    }
    // Catch up a few batches per cycle after an outage.
    for (int i = 0; i < 3 && sendBacklog(); i++) {}
  }
  delay(50);
}
