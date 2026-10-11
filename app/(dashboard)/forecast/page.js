"use client";

import { useState } from "react";
import { DailyForecastChart, RainChart, TempRangeChart, YearUsageChart } from "@/components/charts";
import PageHeader from "@/components/PageHeader";
import { AnimatedNumber, Badge, Card, ErrorNote, Skeleton, Stat, Tabs } from "@/components/ui";
import { fmtDay, fmtNum, fmtRs, WEATHER_EMOJI } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const SUGGESTION_ICON = {
  rising: "📈", falling: "📉", steady: "➖", slab: "💡", heat: "🔥", mild: "🌤️",
  storm: "⛈️", lighting: "💡", heating: "🧣",
};

const BASIS = {
  forecast: { status: "good", label: "Seasonal forecast" },
  mixed: { status: "warning", label: "Partly forecast" },
  normals: { status: "info", label: "Typical year" },
};

function DayDetail({ d }) {
  return (
    <div key={d.date} className="animate-fade-up grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label="Sky">{WEATHER_EMOJI[d.icon]} {d.condition}</Stat>
      <Stat label="High / low">{fmtNum(d.temp_max_c, 1)}° / {fmtNum(d.temp_min_c, 1)}°</Stat>
      <Stat label="Rain">{d.rain_chance_pct ?? "–"}% · {fmtNum(d.rain_mm, 1)} mm</Stat>
      <Stat label="Predicted use">{fmtNum(d.predicted_kwh, 1)} kWh</Stat>
      <Stat label="Wind">{fmtNum(d.wind_max_kmh)} km/h</Stat>
      <Stat label="Humidity">{fmtNum(d.humidity_pct)}%</Stat>
      <Stat label="Sunrise">{d.sunrise ?? "–"}</Stat>
      <Stat label="Sunset">{d.sunset ?? "–"}</Stat>
    </div>
  );
}

function MonthDetail({ m }) {
  const basis = BASIS[m.weather_basis];
  return (
    <div key={`${m.month}${m.year}`} className="animate-fade-up">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-medium">{m.month} {m.year}</h3>
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium capitalize text-ink">{m.season}</span>
        <Badge status={basis.status}>{basis.label}</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-3">{m.weather_source}</p>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <Stat label="Average temperature" hint={m.likely_range_c ? `likely ${m.likely_range_c[0]}–${m.likely_range_c[1]}°` : `normal ${m.normal_temp_c}°`}>
          {fmtNum(m.forecast_temp_c, 1)}°
        </Stat>
        <Stat label="vs a normal year">{m.vs_normal_c > 0 ? "+" : ""}{fmtNum(m.vs_normal_c, 1)}°</Stat>
        <Stat label="Highs / lows">{fmtNum(m.avg_high_c, 0)}° / {fmtNum(m.avg_low_c, 0)}°</Stat>
        <Stat label="Rain">{fmtNum(m.rain_mm)} mm · {m.rainy_days} days</Stat>
        <Stat label="Sunset" hint={`${fmtNum(m.daylight_h, 1)} h daylight`}>{m.sunset}</Stat>
        <Stat label="Units" hint={`AC (est.) ${fmtNum(m.ac_kwh_est)} kWh`}>{fmtNum(m.predicted_kwh)}</Stat>
        <Stat label="Bill (energy)" hint={`Slab ${m.predicted_slab}`}>{fmtRs(m.predicted_bill)}</Stat>
        <Stat label="vs this month">
          <span style={{ color: m.change_pct <= 0 ? "#006300" : "var(--critical)" }}>
            {m.change_pct <= 0 ? "▼" : "▲"} {fmtNum(Math.abs(m.change_pct))}%
          </span>
        </Stat>
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [view, setView] = useState("days");
  const [dayIdx, setDayIdx] = useState(0);
  const [monthIdx, setMonthIdx] = useState(0);
  const f = useApi("/api/forecast?months=12");
  const data = f.data;

  return (
    <>
      <PageHeader title="Forecast" subtitle="Weather for Faisalabad and what it means for your bill">
        <Tabs options={[{ value: "days", label: "Next 14 days" }, { value: "year", label: "12 months" }]} value={view} onChange={setView} />
      </PageHeader>
      <ErrorNote message={f.error} onRetry={f.reload} />

      {!data ? (
        <div className="grid gap-5">
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
          <p className="text-center text-xs text-ink-3">Fetching weather and seasonal forecast…</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Headline */}
          <Card delay={0} className="lg:col-span-3" hover={false}>
            <div className="flex flex-wrap items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl">🌡️</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-3">Outlook</p>
                <p className="mt-1 text-lg leading-snug text-ink sm:text-xl">{data.outlook.headline}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.outlook.decreasing.map((x) => (
                <div key={x.item} className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/5">
                  <p className="text-sm font-medium" style={{ color: "#006300" }}>▼ Going down · {x.item}</p>
                  <p className="mt-1 text-sm text-ink-2">{x.detail}</p>
                </div>
              ))}
              {data.outlook.increasing.map((x) => (
                <div key={x.item} className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/5">
                  <p className="text-sm font-medium" style={{ color: "#b07800" }}>▲ Going up · {x.item}</p>
                  <p className="mt-1 text-sm text-ink-2">{x.detail}</p>
                </div>
              ))}
            </div>
          </Card>

          {view === "days" ? (
            <>
              <Card delay={60} className="lg:col-span-3" title="Next 14 days" subtitle="Tap a day for details">
                <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                  {data.next_days.map((d, i) => (
                    <button
                      key={d.date}
                      onClick={() => setDayIdx(i)}
                      style={{ animationDelay: `${i * 30}ms` }}
                      className={`animate-fade-up min-w-[92px] rounded-2xl p-3 text-center transition-all duration-200 ${
                        i === dayIdx ? "bg-ink text-white shadow-lg" : "bg-white/70 ring-1 ring-black/5 hover:-translate-y-0.5 hover:bg-white"
                      }`}
                    >
                      <p className={`text-xs ${i === dayIdx ? "text-white/70" : "text-ink-3"}`}>{i === 0 ? "Tomorrow" : d.weekday}</p>
                      <p className={`text-[11px] ${i === dayIdx ? "text-white/60" : "text-ink-3"}`}>{fmtDay(d.date)}</p>
                      <p className="my-1.5 text-3xl" aria-label={d.condition}>{WEATHER_EMOJI[d.icon]}</p>
                      <p className="text-sm font-medium">{Math.round(d.temp_max_c)}° <span className={i === dayIdx ? "text-white/60" : "text-ink-3"}>{Math.round(d.temp_min_c)}°</span></p>
                      <p className={`mt-0.5 text-[11px] ${i === dayIdx ? "text-white/70" : "text-ink-3"}`}>💧 {d.rain_chance_pct ?? 0}%</p>
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-white/50 p-4 ring-1 ring-black/5">
                  <DayDetail d={data.next_days[dayIdx]} />
                </div>
              </Card>

              <Card delay={120} className="lg:col-span-3" title="Predicted use per day" subtitle={`From your model: ${data.model.formula}`}>
                <DailyForecastChart days={data.next_days} />
              </Card>
            </>
          ) : (
            <>
              <Card delay={60} className="lg:col-span-2" title="Units by month" subtitle="Click a month · base load vs estimated AC">
                <YearUsageChart months={data.outlook.months} selected={monthIdx} onSelect={setMonthIdx} />
              </Card>
              <Card delay={100}>
                <MonthDetail m={data.outlook.months[monthIdx]} />
              </Card>

              <Card delay={140} className="lg:col-span-2" title="Temperature range" subtitle="Average low → average high · click a month">
                <TempRangeChart months={data.outlook.months} selected={monthIdx} onSelect={setMonthIdx} />
              </Card>
              <Card delay={180} title="Rainfall" subtitle="mm per month">
                <RainChart months={data.outlook.months} />
              </Card>

              {data.year && (
                <Card delay={220} className="lg:col-span-3" title="The year ahead" subtitle={`Forecast ${data.year.weather_basis.seasonal_forecast} · typical year ${data.year.weather_basis.mostly_normals}`}>
                  <p className="text-sm leading-relaxed text-ink-2">{data.year.summary}</p>
                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat label="Total units"><AnimatedNumber value={data.year.total_kwh} /></Stat>
                    <Stat label="Total energy charge"><AnimatedNumber value={data.year.total_bill} format={fmtRs} /></Stat>
                    <Stat label="Cheapest month" hint={fmtRs(data.year.cheapest_month.predicted_bill)}>{data.year.cheapest_month.month}</Stat>
                    <Stat label="Most expensive" hint={fmtRs(data.year.most_expensive_month.predicted_bill)}>{data.year.most_expensive_month.month}</Stat>
                  </div>
                  <p className="mt-4 text-xs text-ink-3">Warming trend: {data.year.weather_basis.warming_trend}</p>
                </Card>
              )}
            </>
          )}

          <Card delay={260} className="lg:col-span-3" title="Suggestions" subtitle="Rule-based, from your data and the weather">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.suggestions.map((s, i) => (
                <li key={i} className="flex gap-3 rounded-2xl bg-white/70 p-3 text-sm text-ink-2 ring-1 ring-black/5 animate-fade-up" style={{ animationDelay: `${300 + i * 50}ms` }}>
                  <span aria-hidden className="text-lg">{SUGGESTION_ICON[s.type] ?? "💡"}</span>
                  <span>{s.message}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card delay={300} className="lg:col-span-3" title="How the forecast works" hover={false}>
            <div className="grid gap-4 sm:grid-cols-4">
              <Stat label="Model">{data.model.formula}</Stat>
              <Stat label="Base use" hint="fridge, fans, lights">{fmtNum(data.model.base_kwh_per_day, 1)} kWh/day</Stat>
              <Stat label="Per degree above 24 °C" hint="mostly AC">+{fmtNum(data.model.kwh_per_degree, 2)} kWh</Stat>
              <Stat label="Fit (R²)" hint={`${data.model.training_days} days of your data`}>{fmtNum(data.model.r2, 2)}</Stat>
            </div>
            <p className="mt-4 text-xs text-ink-3">
              {data.model.note} AC values are estimates from the temperature pattern; the clamp measures total use. Energy charge only, excluding taxes and fuel adjustment.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
