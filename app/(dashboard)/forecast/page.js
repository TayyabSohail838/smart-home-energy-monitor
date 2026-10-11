"use client";

import { useState } from "react";
import { DailyForecastChart, RainChart, TempRangeChart, YearUsageChart } from "@/components/charts";
import Stamp from "@/components/auth/Stamp";
import CalibrationPlate from "@/components/meter/CalibrationPlate";
import DayTiles from "@/components/meter/DayTiles";
import YearTape from "@/components/meter/YearTape";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, ErrorNote, Skeleton, Stat, Tabs } from "@/components/ui";
import { fmtNum, fmtRs, WEATHER_EMOJI } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const MONTH_OPTIONS = [
  { value: 3, label: "3 MO" },
  { value: 6, label: "6 MO" },
  { value: 12, label: "12 MO" },
];

const BASIS = {
  forecast: { status: "good", label: "Seasonal forecast" },
  mixed: { status: "warning", label: "Partly forecast" },
  normals: { status: "info", label: "Typical year" },
};

// Advisory stamp by suggestion type (dashboard-design.md §6.4): HEAT WARNING
// (red) for hot days ahead, STORM (blue) for thunderstorms, ADVISORY (ink)
// for everything else (rising/falling/steady usage, slab, lighting, heating).
function stampFor(type) {
  if (type === "heat") return { label: "HEAT WARNING", tone: "red" };
  if (type === "storm") return { label: "STORM", tone: "blue" };
  return { label: "ADVISORY", tone: "ink" };
}

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
        <Stat label="vs this month" hint={m.change_pct == null ? "no usage this month yet" : null}>
          {m.change_pct == null ? (
            <span className="text-ink-3">–</span>
          ) : (
            <span style={{ color: m.change_pct <= 0 ? "#006300" : "var(--critical)" }}>
              {m.change_pct <= 0 ? "▼" : "▲"} {fmtNum(Math.abs(m.change_pct))}%
            </span>
          )}
        </Stat>
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [view, setView] = useState("days");
  const [dayIdx, setDayIdx] = useState(0);
  const [monthIdx, setMonthIdx] = useState(0);
  const [monthsParam, setMonthsParam] = useState(12);
  const [showAllTips, setShowAllTips] = useState(false);
  // keepDataOnError: a 422 (fewer than 7 days of usage) still carries next_days
  // (dashboard-design.md §6.5) - the page then shows weather only, no kWh model.
  const f = useApi(`/api/forecast?months=${monthsParam}`, { keepDataOnError: true });
  const data = f.data;
  const calibrating = Boolean(data && !data.model);

  function changeMonths(v) {
    setMonthsParam(v);
    setMonthIdx(0);
  }

  return (
    <>
      <PageHeader title="Forecast" subtitle="Weather for Faisalabad and what it means for your bill">
        {!calibrating && (
          <Tabs options={[{ value: "days", label: "Next 14 days" }, { value: "year", label: "12 months" }]} value={view} onChange={setView} />
        )}
      </PageHeader>
      {!data && <ErrorNote message={f.error} onRetry={f.reload} />}

      {!data ? (
        <div className="grid gap-5">
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
          <p className="text-center text-xs text-ink-3">Fetching weather and seasonal forecast…</p>
        </div>
      ) : calibrating ? (
        <div className="grid gap-5">
          <p className="text-sm leading-relaxed text-ink-soft">
            Weather is live below. Predicted kWh needs at least 7 days of your own readings first.
          </p>
          <div>
            <p className="mb-3 font-bill text-[11px] uppercase tracking-wide text-ink-soft">Next 14 days</p>
            <DayTiles days={data.next_days} selected={dayIdx} onSelect={setDayIdx} />
            <div className="mt-4 rounded-md border border-ink/15 p-4">
              <DayDetail d={data.next_days[dayIdx]} />
            </div>
          </div>
          <CalibrationPlate model={null} />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Outlook board (dashboard-design.md §6.3) */}
          <Card delay={0} className="lg:col-span-3" hover={false}>
            <p className="font-display text-[clamp(26px,5vw,44px)] font-black uppercase leading-[1.05] text-ink">
              {data.outlook.headline}
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 font-bill text-[11px] uppercase tracking-wide text-ok">▼ Going down</p>
                <div className="space-y-3">
                  {data.outlook.decreasing.map((x) => (
                    <div key={x.item} className="border-t border-dotted border-rule pt-2 first:border-t-0 first:pt-0">
                      <p className="text-sm font-medium text-ink">{x.item}</p>
                      <p className="text-sm text-ink-soft">{x.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-bill text-[11px] uppercase tracking-wide text-ac">▲ Going up</p>
                <div className="space-y-3">
                  {data.outlook.increasing.map((x) => (
                    <div key={x.item} className="border-t border-dotted border-rule pt-2 first:border-t-0 first:pt-0">
                      <p className="text-sm font-medium text-ink">{x.item}</p>
                      <p className="text-sm text-ink-soft">{x.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {view === "days" ? (
            <>
              <Card delay={60} className="lg:col-span-3" title="Next 14 days" subtitle="Tap a day for details">
                <DayTiles days={data.next_days} selected={dayIdx} onSelect={setDayIdx} />
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
              <Card
                delay={60}
                className="lg:col-span-2"
                title="Units by month"
                subtitle="Click a month · blue bars = predicted kWh, orange line = temperature"
                action={<Tabs size="sm" options={MONTH_OPTIONS} value={monthsParam} onChange={changeMonths} />}
              >
                <YearTape months={data.outlook.months} selected={monthIdx} onSelect={setMonthIdx} />
              </Card>
              <Card delay={100}>
                <MonthDetail m={data.outlook.months[monthIdx]} />
              </Card>

              <Card delay={120} className="lg:col-span-3" title="Base load vs AC (est.)" subtitle="Same months · click to select">
                <YearUsageChart months={data.outlook.months} selected={monthIdx} onSelect={setMonthIdx} />
              </Card>

              <Card delay={140} className="lg:col-span-2" title="Temperature range" subtitle="Average low → average high · click a month">
                <TempRangeChart months={data.outlook.months} selected={monthIdx} onSelect={setMonthIdx} />
              </Card>
              <Card delay={180} title="Rainfall" subtitle="mm per month">
                <RainChart months={data.outlook.months} />
              </Card>

              {data.year && (
                <Card
                  delay={220}
                  className="lg:col-span-3"
                  title="The year ahead"
                  subtitle={`Forecast ${data.year.weather_basis.seasonal_forecast} · typical year ${data.year.weather_basis.mostly_normals}`}
                  hover={false}
                >
                  <p className="text-sm leading-relaxed text-ink-soft">{data.year.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-y-2 border-dotted border-rule py-3 font-bill text-[11px] uppercase tracking-wide">
                    <p><span className="text-ink-soft">Total units</span> <span className="text-ink">{fmtNum(data.year.total_kwh)}</span></p>
                    <p><span className="text-ink-soft">Total energy charge</span> <span className="text-ink">{fmtRs(data.year.total_bill)}</span></p>
                    <p><span className="text-ink-soft">Cheapest</span> <span className="text-ink">{data.year.cheapest_month.month} · {fmtRs(data.year.cheapest_month.predicted_bill)}</span></p>
                    <p><span className="text-ink-soft">Most expensive</span> <span className="text-ink">{data.year.most_expensive_month.month} · {fmtRs(data.year.most_expensive_month.predicted_bill)}</span></p>
                  </div>
                  <p className="mt-3 text-xs text-ink-3">Warming trend: {data.year.weather_basis.warming_trend}</p>
                </Card>
              )}
            </>
          )}

          {/* Advisories (dashboard-design.md §6.4) */}
          <Card
            delay={260}
            className="lg:col-span-3"
            title="Suggestions"
            subtitle="Rule-based, from your data and the weather"
            action={
              data.suggestions.length > 4 && (
                <button
                  onClick={() => setShowAllTips((v) => !v)}
                  className="font-bill text-[11px] uppercase tracking-wide text-ink-soft hover:text-ink"
                >
                  {showAllTips ? "Show less" : "Show all"}
                </button>
              )
            }
          >
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(showAllTips ? data.suggestions : data.suggestions.slice(0, 4)).map((s, i) => {
                const stamp = stampFor(s.type);
                return (
                  <li
                    key={i}
                    className="animate-fade-up rounded-md border border-ink/20 p-3"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <Stamp tone={stamp.tone} className="text-[9px]">{stamp.label}</Stamp>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.message}</p>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card delay={300} className="lg:col-span-3" title="How the forecast works" hover={false}>
            <div className="mx-auto max-w-sm">
              <CalibrationPlate model={data.model} />
            </div>
            <p className="mt-4 text-xs text-ink-3">
              Fit on {data.model.training_days} days of your data. {data.model.note} AC values are estimates from the
              temperature pattern; the clamp measures total use. Energy charge only, excluding taxes and fuel adjustment.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
