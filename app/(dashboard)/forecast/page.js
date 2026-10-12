"use client";

import { useState } from "react";
import Stamp from "@/components/auth/Stamp";
import CalibrationPlate from "@/components/meter/CalibrationPlate";
import DayTiles from "@/components/meter/DayTiles";
import YearTape from "@/components/meter/YearTape";
import PageHeader from "@/components/PageHeader";
import { ErrorNote, Skeleton, Tabs } from "@/components/ui";
import { fmtNum, fmtRs, WEATHER_EMOJI } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const MONTH_OPTIONS = [
  { value: 3, label: "3 MO" },
  { value: 6, label: "6 MO" },
  { value: 12, label: "12 MO" },
];

// The first suggestion buildSuggestions() returns is always a recap of
// this-month-vs-next-month units/Rs/change% - exactly what the answer strip
// already shows, so it's dropped here rather than repeated as a tip.
const RECAP_TYPES = new Set(["rising", "falling", "steady"]);

// Advisory stamp by suggestion type (dashboard-design.md §6.4): HEAT WARNING
// (red) for hot days ahead, STORM (blue) for thunderstorms, ADVISORY (ink)
// for everything else (slab, lighting, heating).
function stampFor(type) {
  if (type === "heat") return { label: "HEAT WARNING", tone: "red" };
  if (type === "storm") return { label: "STORM", tone: "blue" };
  return { label: "ADVISORY", tone: "ink" };
}

// outlook.headline is a short paragraph built for the old full-size display;
// the answer strip shows only its first sentence, trimmed to ~10 words so the
// large type never runs past one line.
function shortHeadline(full) {
  const first = full.split(/\.\s/)[0].replace(/\.$/, "").trim();
  const words = first.split(/\s+/);
  return words.length <= 10 ? `${first}.` : `${words.slice(0, 9).join(" ")}…`;
}

// outlook.decreasing/increasing detail strings are full explanations; the
// compact "what changes" list shows just the first clause as a one-line
// summary and keeps the rest behind a per-item "Why?" toggle.
function shortSummary(detail, max = 68) {
  const stripped = detail.replace(/\s*\(estimate\)\.?\s*$/, "").trim();
  const sentence = stripped.split(/\.\s/)[0].replace(/\.$/, "");
  return sentence.length <= max ? sentence : `${sentence.slice(0, max - 1).trimEnd()}…`;
}

// Paper panel (dashboard-design.md's bordered boxed-panel idiom). min-w-0 so a
// wide child (the day-tile strip) can't force this panel - and the flex-col
// page stack it sits in - wider than the viewport; the child's own overflow
// handling (e.g. DayTiles' horizontal scroll) stays contained instead.
function Panel({ title, subtitle, action, children, className = "", delay = 0 }) {
  return (
    <section className={`min-w-0 animate-fade-up rounded-md border border-ink/15 p-5 ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <p className="font-bill text-[11px] uppercase tracking-wide text-ink-soft">{title}</p>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// Label/value block, the paper-surface equivalent of ui.js's glass-styled Stat.
function Fact({ label, children }) {
  return (
    <div>
      <p className="font-bill text-[10px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-bill text-sm text-ink">{children}</p>
    </div>
  );
}

// Collapsed by default: label + ▾ button, content only mounted while open.
function Accordion({ label, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="min-w-0 rounded-md border border-ink/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left font-bill text-[11px] uppercase tracking-wide text-ink-soft hover:text-ink"
      >
        {label}
        <span aria-hidden className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="animate-fade-up border-t border-ink/15 p-5">{children}</div>}
    </section>
  );
}

function DayDetail({ d }) {
  return (
    <div key={d.date} className="animate-fade-up grid grid-cols-2 gap-4 sm:grid-cols-3">
      <Fact label="Sky">{WEATHER_EMOJI[d.icon]} {d.condition}</Fact>
      <Fact label="High / low">{fmtNum(d.temp_max_c, 1)}° / {fmtNum(d.temp_min_c, 1)}°</Fact>
      <Fact label="Rain">{d.rain_chance_pct ?? "–"}% · {fmtNum(d.rain_mm, 1)} mm</Fact>
      <Fact label="Wind">{fmtNum(d.wind_max_kmh)} km/h</Fact>
      <Fact label="Humidity">{fmtNum(d.humidity_pct)}%</Fact>
      <Fact label="Sunrise / sunset">{d.sunrise ?? "–"} · {d.sunset ?? "–"}</Fact>
    </div>
  );
}

function ChangeReadout({ pct }) {
  if (pct == null) return <span className="text-ink-soft">–</span>;
  const down = pct <= 0;
  return (
    <span className={down ? "text-ok" : "text-ac"}>
      {down ? "▼" : "▲"} {fmtNum(Math.abs(pct))}%
    </span>
  );
}

function BigReadout({ label, value, sub }) {
  return (
    <div className="flex-1 border-t border-dotted border-rule pt-3 first:border-t-0 first:pt-0 sm:border-t-0 sm:border-l sm:border-ink/15 sm:pl-6 sm:pt-0 sm:first:border-l-0 sm:first:pl-0">
      <p className="font-bill text-[11px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-bill text-[26px] leading-none text-ink sm:text-[30px]">{value}</p>
      {sub && <p className="mt-1 font-bill text-sm text-ink-soft">{sub}</p>}
    </div>
  );
}

// Section 1 (always visible): one short headline, three readouts, one
// caption. Carries the one-sentence "fewer than 7 days of data" state too.
function AnswerStrip({ data, calibrating }) {
  if (calibrating) {
    return (
      <Panel>
        <p className="font-bill text-sm uppercase tracking-wide text-ink-soft">CALIBRATING · needs 7 days of readings</p>
      </Panel>
    );
  }

  const next = data.outlook.months[0];
  return (
    <Panel>
      <p className="font-display text-[clamp(22px,4vw,34px)] font-black uppercase leading-tight text-ink">
        {shortHeadline(data.outlook.headline)}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:gap-0">
        <BigReadout label="This month" value={`${fmtNum(data.this_month.projected_kwh)} kWh`} sub={fmtRs(data.this_month.projected_bill)} />
        <BigReadout
          label={`Next month · ${next.month}`}
          value={`${fmtNum(next.predicted_kwh)} kWh`}
          sub={fmtRs(next.predicted_bill)}
        />
        <BigReadout label="Change" value={<ChangeReadout pct={next.change_pct} />} />
      </div>
      <p className="mt-4 font-bill text-[10px] uppercase tracking-wide text-ink-soft">
        Weather-driven usage (est.) · energy charge only, excludes taxes
      </p>
    </Panel>
  );
}

// Section 3 (compact): one line per item, full explanation behind "Why?".
function ChangeColumn({ title, toneClass, items, openWhy, onToggleWhy }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <p className={`mb-2 font-bill text-[11px] uppercase tracking-wide ${toneClass}`}>{title}</p>
      <div className="space-y-2">
        {items.map((x) => {
          const open = openWhy.has(x.item);
          return (
            <div key={x.item} className="border-t border-dotted border-rule pt-2 first:border-t-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-ink">
                  <span className="font-medium">{x.item}</span> — <span className="text-ink-soft">{shortSummary(x.detail)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => onToggleWhy(x.item)}
                  aria-expanded={open}
                  className="shrink-0 font-bill text-[10px] uppercase tracking-wide text-ink-soft hover:text-ink"
                >
                  Why?
                </button>
              </div>
              {open && <p className="mt-1 animate-fade-up text-xs leading-relaxed text-ink-soft">{x.detail}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [view, setView] = useState("days");
  const [dayIdx, setDayIdx] = useState(null);
  const [monthsParam, setMonthsParam] = useState(12);
  const [showAllTips, setShowAllTips] = useState(false);
  const [openWhy, setOpenWhy] = useState(() => new Set());
  // keepDataOnError: a 422 (fewer than 7 days of usage) still carries next_days
  // (dashboard-design.md §6.5) - the page then shows weather only, no kWh model.
  const f = useApi(`/api/forecast?months=${monthsParam}`, { keepDataOnError: true });
  const data = f.data;
  const calibrating = Boolean(data && !data.model);

  function toggleDay(i) {
    setDayIdx((prev) => (prev === i ? null : i));
  }

  function toggleWhy(item) {
    setOpenWhy((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  const tips = data && !calibrating ? data.suggestions.filter((s) => !RECAP_TYPES.has(s.type)) : [];

  return (
    <>
      <PageHeader title="Forecast" subtitle="Weather for Faisalabad and what it means for your bill">
        {!calibrating && (
          <Tabs options={[{ value: "days", label: "Next 14 days" }, { value: "year", label: "12 months" }]} value={view} onChange={setView} />
        )}
      </PageHeader>
      {!data && <ErrorNote message={f.error} onRetry={f.reload} />}

      {!data ? (
        <div className="flex min-w-0 flex-col gap-5">
          <Skeleton className="h-28 w-full rounded-md" />
          <Skeleton className="h-64 w-full rounded-md" />
          <p className="text-center text-xs text-ink-soft">Fetching weather and seasonal forecast…</p>
        </div>
      ) : calibrating ? (
        <div className="flex min-w-0 flex-col gap-5">
          <AnswerStrip calibrating />

          <Panel title="Next 14 days" subtitle="Weather only - predicted kWh needs a few more days of your readings">
            <DayTiles days={data.next_days} selected={dayIdx} onSelect={toggleDay} showKwh={false} />
            {dayIdx != null && (
              <div id="day-detail-panel" role="region" aria-label="Day detail" className="mt-4 rounded-md border border-ink/15 p-4">
                <DayDetail d={data.next_days[dayIdx]} />
              </div>
            )}
          </Panel>

          <Accordion label="How the forecast works">
            <div className="mx-auto max-w-sm">
              <CalibrationPlate model={null} />
            </div>
          </Accordion>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          <AnswerStrip data={data} />

          {view === "days" ? (
            <Panel title="Next 14 days" subtitle="Tap a day for details">
              <DayTiles days={data.next_days} selected={dayIdx} onSelect={toggleDay} />
              {dayIdx != null && (
                <div id="day-detail-panel" role="region" aria-label="Day detail" className="mt-4 rounded-md border border-ink/15 p-4">
                  <DayDetail d={data.next_days[dayIdx]} />
                </div>
              )}
            </Panel>
          ) : (
            <Panel
              title="Units by month"
              subtitle="Bars = predicted kWh (hatched = typical-year estimate) · line = temperature"
              action={<Tabs size="sm" options={MONTH_OPTIONS} value={monthsParam} onChange={setMonthsParam} />}
            >
              <YearTape months={data.outlook.months} height={260} />
            </Panel>
          )}

          <Panel title="What changes" subtitle="Next 3 months">
            <div className="flex flex-col gap-6">
              <ChangeColumn
                title="▼ Going down"
                toneClass="text-ok"
                items={data.outlook.decreasing}
                openWhy={openWhy}
                onToggleWhy={toggleWhy}
              />
              <ChangeColumn
                title="▲ Going up"
                toneClass="text-ac"
                items={data.outlook.increasing}
                openWhy={openWhy}
                onToggleWhy={toggleWhy}
              />
            </div>
          </Panel>

          {tips.length > 0 && (
            <Panel
              title="Top tips"
              subtitle="Rule-based, from your data and the weather"
              action={
                tips.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTips((v) => !v)}
                    aria-expanded={showAllTips}
                    className="font-bill text-[11px] uppercase tracking-wide text-ink-soft hover:text-ink"
                  >
                    {showAllTips ? "Show less" : `Show all (${tips.length})`}
                  </button>
                )
              }
            >
              <ul className="flex flex-col gap-3">
                {(showAllTips ? tips : tips.slice(0, 2)).map((s, i) => {
                  const stamp = stampFor(s.type);
                  return (
                    <li
                      key={i}
                      className="animate-fade-up rounded-md border border-ink/20 p-3"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <Stamp tone={stamp.tone} className="text-[9px]">{stamp.label}</Stamp>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">{s.message}</p>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          <Accordion label="How the forecast works">
            <div className="mx-auto max-w-sm">
              <CalibrationPlate model={data.model} />
            </div>
            <p className="mt-4 text-xs text-ink-soft">
              Fit on {data.model.training_days} days of your data. {data.model.note} AC values are estimates from the
              temperature pattern; the clamp measures total use. Energy charge only, excluding taxes and fuel adjustment.
            </p>
          </Accordion>
        </div>
      )}
    </>
  );
}
