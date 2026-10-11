"use client";

import { fmtNum } from "@/lib/format";

// Brushed-metal engraved plate (dashboard-design.md §6.5). `model` is null
// while there are fewer than 7 days of usage (the API's 422 case) - the plate
// then shows CALIBRATING instead of the regression stats.
export default function CalibrationPlate({ model }) {
  return (
    <div
      className="relative rounded-md p-4 font-bill text-[11px]"
      style={{
        background: "linear-gradient(155deg, #d8d9db 0%, #a8aaad 35%, #c4c5c8 55%, #8e9093 100%)",
        color: "#2a2c30",
      }}
    >
      <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-black/30" aria-hidden />
      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-black/30" aria-hidden />
      <span className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-black/30" aria-hidden />
      <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-black/30" aria-hidden />

      {model ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-2">
          <dt className="uppercase tracking-wide opacity-70">Model</dt>
          <dd className="tabular-nums">{model.formula}</dd>
          <dt className="uppercase tracking-wide opacity-70">Base load</dt>
          <dd className="tabular-nums">{fmtNum(model.base_kwh_per_day, 1)} kWh/day</dd>
          <dt className="uppercase tracking-wide opacity-70">Per °C</dt>
          <dd className="tabular-nums">{fmtNum(model.kwh_per_degree, 2)} kWh</dd>
          <dt className="uppercase tracking-wide opacity-70">Fit (R²)</dt>
          <dd className="tabular-nums">{fmtNum(model.r2, 2)}</dd>
        </dl>
      ) : (
        <p className="px-2 py-2 text-center uppercase tracking-wide">CALIBRATING · needs 7 days of readings</p>
      )}

      <p className="mt-3 px-2 text-center text-[10px] uppercase tracking-wide opacity-70">Weather-driven usage (est.)</p>
    </div>
  );
}
