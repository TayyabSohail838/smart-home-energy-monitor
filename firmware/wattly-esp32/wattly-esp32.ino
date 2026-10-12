// Wattly ESP32: reads a PZEM-004T v3.0 every 10 s and POSTs it to /api/readings.
//
// Wiring (PZEM TTL side -> ESP32):  5V -> 3V3 (or VIN, see README)  RX -> GPIO17
//                                   TX -> GPIO16                     GND -> GND
// Arduino libraries: "PZEM-004T-v30" by Jakub Mandula (ESP32 core includes WiFi/HTTPClient).
//
// Body sent (one reading, or an array when catching up after Wi-Fi drops):
//   { device_id, ts, current_a, power_w, energy_wh, voltage_v }
// energy_wh is the energy in this window (power x elapsed time), as the API expects.
// voltage_v is the mains voltage; the server emails an alert above 250 V.
//
// Where a reading comes from, best first:
//   1. the PZEM (real mains watts + volts)
//   2. a laptop over USB: scripts/laptop-meter.ps1 sends "W <watts>" lines with the
//      laptop's real battery power (battery volts aren't mains: TEST_MODE voltage, or none)
//   3. TEST_MODE values

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PZEM004Tv30.h>
#include <time.h>
#include "secrets.h"

#define PZEM_RX_PIN 16  // ESP32 pin that receives from PZEM TX
#define PZEM_TX_PIN 17  // ESP32 pin that sends to PZEM RX

// TEST MODE: while the PZEM has no mains power (no reading), send a made-up 30-65 W,
// 225-235 V value so the dashboard shows the ESP32 -> Wi-Fi -> server path working.
// Real PZEM readings always win. Set to false before the real demo.
#define TEST_MODE true
const float TEST_MIN_W = 30, TEST_MAX_W = 65;    // like a laptop charging
const float TEST_MIN_V = 225, TEST_MAX_V = 235;  // normal Pakistani mains

const uint32_t LAPTOP_FRESH_MS = 25000;          // a laptop reading counts for 25 s
const float LAPTOP_VOLTS = 230;                  // only to turn watts into amps for current_a

const uint32_t INTERVAL_MS = 10000;
const int MAX_BACKLOG = 60;  // 10 minutes of readings kept while offline
const int MAX_BATCH = 30;    // readings per POST when catching up

PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);

struct Reading {
  time_t ts;
  float current_a, power_w, energy_wh, voltage_v;
};
Reading backlog[MAX_BACKLOG];
int backlogCount = 0;
uint32_t lastReadMs = 0;
float laptopWatts = NAN;
uint32_t laptopAtMs = 0;
String serialLine;

// Reads "W 10.6" lines from the laptop script over USB.
void readLaptop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      serialLine.trim();
      if (serialLine.startsWith("W ")) {
        float w = serialLine.substring(2).toFloat();
        if (w >= 0 && w < 500) {
          laptopWatts = w;
          laptopAtMs = millis();
        }
      }
      serialLine = "";
    } else if (serialLine.length() < 40) {
      serialLine += c;
    }
  }
}

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

float randomBetween(float lo, float hi) { return lo + (hi - lo) * (esp_random() / 4294967295.0f); }

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
    char volts[24] = "";
    if (!isnan(backlog[i].voltage_v)) snprintf(volts, sizeof(volts), ",\"voltage_v\":%.1f", backlog[i].voltage_v);
    char item[260];
    snprintf(item, sizeof(item),
             "%s{\"device_id\":\"%s\",\"ts\":\"%s\",\"current_a\":%.3f,\"power_w\":%.1f,\"energy_wh\":%.4f%s}",
             i ? "," : "", DEVICE_ID, ts, backlog[i].current_a, backlog[i].power_w, backlog[i].energy_wh, volts);
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
  readLaptop();

  uint32_t now = millis();
  if (now - lastReadMs >= INTERVAL_MS || lastReadMs == 0) {
    float elapsedS = lastReadMs == 0 ? INTERVAL_MS / 1000.0 : (now - lastReadMs) / 1000.0;
    lastReadMs = now;

    float current = pzem.current();
    float power = pzem.power();
    float voltage = pzem.voltage();
    bool noReading = isnan(current) || isnan(power) || isnan(voltage);
    bool test = false, laptop = false;
    if (noReading && !isnan(laptopWatts) && millis() - laptopAtMs < LAPTOP_FRESH_MS) {
      power = laptopWatts;
      current = power / LAPTOP_VOLTS;
      // Battery volts aren't mains voltage. With TEST_MODE on, send a labelled test mains
      // voltage so the voltage chart has a line; otherwise send none.
      voltage = TEST_MODE ? randomBetween(TEST_MIN_V, TEST_MAX_V) : NAN;
      laptop = true;
      noReading = false;
    }
    if (noReading && TEST_MODE) {
      power = randomBetween(TEST_MIN_W, TEST_MAX_W);
      voltage = randomBetween(TEST_MIN_V, TEST_MAX_V);
      current = power / voltage;
      test = true;
      noReading = false;
    }
    if (noReading) {
      Serial.println("PZEM: no reading (check wiring and that the PZEM has mains power)");
    } else if (!clockReady()) {
      Serial.println("Waiting for internet time before sending...");
    } else {
      Reading r = {time(nullptr), current, power, power * elapsedS / 3600.0f, voltage};
      if (laptop) {
        Serial.printf("LAPTOP (real, via USB): %.1f W  %.4f Wh", r.power_w, r.energy_wh);
        if (!isnan(r.voltage_v)) Serial.printf("  | TEST voltage %.1f V", r.voltage_v);
        Serial.println();
      } else {
        Serial.printf("%s%.1f V  %.3f A  %.1f W  %.4f Wh\n", test ? "TEST (no PZEM reading): " : "",
                      r.voltage_v, r.current_a, r.power_w, r.energy_wh);
      }
      addToBacklog(r);
    }
    // Catch up a few batches per cycle after an outage.
    for (int i = 0; i < 3 && sendBacklog(); i++) {}
  }
  delay(50);
}
