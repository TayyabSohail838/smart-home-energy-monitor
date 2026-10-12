// Pretends to be the ESP32: posts one reading every 10 s to /api/readings.
// Usage:
//   npm run fake-device                          -> localhost, ~300 W
//   npm run fake-device -- --watts 1500          -> simulate a heater
//   npm run fake-device -- --volts 262           -> simulate high mains voltage (alert above 250 V)
//   npm run fake-device -- --url https://<app>.vercel.app --once
// Needs DEVICE_ID and DEVICE_SECRET in .env.local.
const VOLTAGE = 230;
const INTERVAL_S = 10;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const url = (arg("url", "http://localhost:3000")).replace(/\/$/, "") + "/api/readings";
const watts = Number(arg("watts", 300));
const volts = Number(arg("volts", VOLTAGE));
const once = process.argv.includes("--once");
const { DEVICE_ID, DEVICE_SECRET } = process.env;

if (!DEVICE_ID || !DEVICE_SECRET) {
  console.error("Set DEVICE_ID and DEVICE_SECRET in .env.local");
  process.exit(1);
}

async function send() {
  const power_w = Math.max(0, watts * (0.95 + Math.random() * 0.1)); // +-5% noise
  const reading = {
    device_id: DEVICE_ID,
    ts: new Date().toISOString(),
    current_a: +(power_w / VOLTAGE).toFixed(3),
    voltage_v: +(volts + (Math.random() - 0.5) * 2).toFixed(1), // +-1 V noise
    power_w: +power_w.toFixed(1),
    energy_wh: +((power_w * INTERVAL_S) / 3600).toFixed(4),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-key": DEVICE_SECRET },
      body: JSON.stringify(reading),
    });
    console.log(`${reading.ts}  ${reading.power_w} W  -> ${res.status} ${await res.text()}`);
  } catch (err) {
    console.log(`${reading.ts}  send failed: ${err.message}`);
  }
}

send();
if (!once) setInterval(send, INTERVAL_S * 1000);
