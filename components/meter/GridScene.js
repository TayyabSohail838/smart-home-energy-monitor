// Decorative "grid → home" illustration for the Overview page: flat outlined
// infographic style, no data, pure CSS-animated SVG (dashboard-design.md
// doesn't yet cover this card; palette/shapes below are intentionally
// separate from the Meter Room tokens in app/globals.css since this is a
// one-off illustration rather than a themed UI surface).
const NAVY = "#2B3A55";
const BLUE = "#2a78d6";
const YELLOW = "#F7D774";
const GREEN_LIGHT = "#7BC67B";
const GREEN_DARK = "#4FA36A";
const BROWN = "#B07A4F";
const GREY = "#E4E8EE";
const GROUND_Y = 300;

function Cloud({ x, y, scale = 1 }) {
  return (
    <g className="grid-cloud" transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M -28 6 C -28 -8 -14 -14 -6 -10 C -2 -20 16 -20 20 -8 C 32 -10 36 6 26 8 L -24 8 Z"
        fill="#FFFFFF"
        stroke={NAVY}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Bird({ x, y }) {
  return <path d={`M ${x - 6} ${y} Q ${x} ${y - 5} ${x + 6} ${y}`} fill="none" stroke={NAVY} strokeWidth="1.4" strokeLinecap="round" />;
}

function Sparkle({ x, y }) {
  return (
    <g className="grid-sparkle" transform={`translate(${x} ${y})`}>
      <path d="M 0 -5 L 0 5 M -5 0 L 5 0" stroke={YELLOW} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function RoundTree({ x }) {
  return (
    <g transform={`translate(${x} ${GROUND_Y})`}>
      <rect x={-2.5} y={-16} width={5} height={16} fill={BROWN} stroke={NAVY} strokeWidth="1.2" />
      <circle cx={0} cy={-28} r={16} fill={GREEN_LIGHT} stroke={NAVY} strokeWidth="1.4" />
    </g>
  );
}

function PineTree({ x }) {
  return (
    <g transform={`translate(${x} ${GROUND_Y})`}>
      <rect x={-2} y={-10} width={4} height={10} fill={BROWN} stroke={NAVY} strokeWidth="1.2" />
      <path d="M 0 -52 L 15 -28 L -15 -28 Z" fill={GREEN_DARK} stroke={NAVY} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M 0 -38 L 13 -16 L -13 -16 Z" fill={GREEN_DARK} stroke={NAVY} strokeWidth="1.4" strokeLinejoin="round" />
    </g>
  );
}

function SteamPuffs({ x, y }) {
  return (
    <g aria-hidden>
      {[0, 1, 2].map((i) => (
        <ellipse
          key={i}
          className="grid-steam"
          cx={x + i * 7 - 7}
          cy={y - i * 3}
          rx={8}
          ry={6}
          fill="#FFFFFF"
          stroke={NAVY}
          strokeWidth="1"
          style={{ animationDelay: `${i * 1.1}s` }}
        />
      ))}
    </g>
  );
}

function CoolingTower({ x, scale = 1, height = 120 }) {
  const baseHalf = 24 * scale;
  const waistHalf = 13 * scale;
  const topHalf = 17 * scale;
  const h = height;
  const topY = GROUND_Y - h;
  const waistY = topY + h * 0.55;
  return (
    <g transform={`translate(${x} 0)`}>
      <path
        d={`M ${-baseHalf} ${GROUND_Y} C ${-baseHalf - 4} ${waistY + 20} ${-waistHalf} ${waistY + 10} ${-waistHalf} ${waistY}
            C ${-waistHalf} ${waistY - 10} ${-topHalf} ${waistY - 16} ${-topHalf} ${topY}
            L ${topHalf} ${topY}
            C ${topHalf} ${waistY - 16} ${waistHalf} ${waistY - 10} ${waistHalf} ${waistY}
            C ${waistHalf} ${waistY + 10} ${baseHalf + 4} ${waistY + 20} ${baseHalf} ${GROUND_Y} Z`}
        fill={GREY}
        stroke={NAVY}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <SteamPuffs x={0} y={topY - 4} />
    </g>
  );
}

// Lattice transmission pylon. Returns both the markup and the arm's attach
// points (world coords) so the wire layer can start/end exactly on them.
function pylonGeometry({ x, topY, scale = 1 }) {
  const baseHalf = 26 * scale;
  const topHalf = 5 * scale;
  const armY = topY + 14 * scale;
  const armHalf = 38 * scale;
  const legX = (f) => topHalf + (baseHalf - topHalf) * f; // f: 0 at top, 1 at base
  return {
    baseHalf,
    topHalf,
    armY,
    armHalf,
    legX,
    leftArm: { x: x - armHalf, y: armY + 10 * scale },
    rightArm: { x: x + armHalf, y: armY + 10 * scale },
  };
}

function Pylon({ x, topY, scale = 1 }) {
  const { baseHalf, armY, armHalf, legX } = pylonGeometry({ x, topY, scale });
  const rungFracs = [0.28, 0.56, 0.84];
  return (
    <g transform={`translate(${x} 0)`} stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={`M ${-baseHalf} ${GROUND_Y} L 0 ${topY} L ${baseHalf} ${GROUND_Y}`} />
      {rungFracs.map((f, i) => {
        const y = topY + (GROUND_Y - topY) * f;
        const half = legX(f);
        return <line key={i} x1={-half} y1={y} x2={half} y2={y} />;
      })}
      {rungFracs.map((f, i) => {
        if (i === rungFracs.length - 1) return null;
        const y0 = topY + (GROUND_Y - topY) * f;
        const y1 = topY + (GROUND_Y - topY) * rungFracs[i + 1];
        const h0 = legX(f);
        const h1 = legX(rungFracs[i + 1]);
        return (
          <g key={`x-${i}`}>
            <line x1={-h0} y1={y0} x2={h1} y2={y1} />
            <line x1={h0} y1={y0} x2={-h1} y2={y1} />
          </g>
        );
      })}
      {/* arm + insulators */}
      <line x1={-armHalf} y1={armY} x2={armHalf} y2={armY} strokeWidth="2" />
      {[-armHalf, 0, armHalf].map((ax, i) => (
        <g key={i}>
          <line x1={ax} y1={armY} x2={ax} y2={armY + 10 * scale} />
          <ellipse cx={ax} cy={armY + 10 * scale} rx={3 * scale} ry={4 * scale} fill={GREY} />
        </g>
      ))}
    </g>
  );
}

function TransformerBox({ x }) {
  const w = 28;
  const h = 40;
  const top = GROUND_Y - h;
  return (
    <g transform={`translate(${x} 0)`} stroke={NAVY} strokeWidth="1.4">
      <rect x={-w / 2} y={top} width={w} height={h} fill={GREY} />
      {[-7, 0, 7].map((lx, i) => (
        <line key={i} x1={lx} y1={top + 6} x2={lx} y2={GROUND_Y - 6} />
      ))}
    </g>
  );
}

function UtilityPole({ x, topY, armHalf = 25, hasTransformer = false }) {
  return (
    <g transform={`translate(${x} 0)`} stroke={NAVY} strokeWidth="1.5" strokeLinecap="round">
      <line x1={0} y1={topY} x2={0} y2={GROUND_Y} fill="none" />
      <line x1={-armHalf} y1={topY} x2={armHalf} y2={topY} fill="none" strokeWidth="2" />
      {[-armHalf, 0, armHalf].map((ax, i) => (
        <g key={i}>
          <line x1={ax} y1={topY} x2={ax} y2={topY + 8} />
          <ellipse cx={ax} cy={topY + 8} rx={2.6} ry={3.6} fill={GREY} />
        </g>
      ))}
      {hasTransformer && (
        <rect x={-18} y={topY + 14} width={16} height={10} rx={3} fill={GREY} stroke={NAVY} strokeWidth="1.2" />
      )}
    </g>
  );
}

function House({ x }) {
  const w = 100;
  const bodyTop = GROUND_Y - 60;
  const roofApex = bodyTop - 36;
  return (
    <g transform={`translate(${x} 0)`}>
      <path
        d={`M ${-w / 2 - 6} ${bodyTop} L 0 ${roofApex} L ${w / 2 + 6} ${bodyTop} Z`}
        fill={GREEN_DARK}
        stroke={NAVY}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x={-w / 2} y={bodyTop} width={w} height={60} fill={GREY} stroke={NAVY} strokeWidth="1.6" />
      <rect x={-14} y={GROUND_Y - 36} width={28} height={36} fill={BROWN} stroke={NAVY} strokeWidth="1.4" />
      <rect
        className="grid-window"
        x={22}
        y={bodyTop + 14}
        width={18}
        height={18}
        fill={YELLOW}
        stroke={NAVY}
        strokeWidth="1.4"
      />
    </g>
  );
}

function ClampDot({ x, y }) {
  return (
    <rect
      className="grid-clamp"
      x={x - 5}
      y={y - 3}
      width={10}
      height={6}
      rx={1.5}
      fill="#eb6834"
      stroke={NAVY}
      strokeWidth="1.2"
    />
  );
}

function GroundDashes() {
  const dashes = [];
  for (let x = 16; x < 744; x += 34) dashes.push(x);
  return (
    <g stroke={NAVY} strokeWidth="1.2" strokeLinecap="round" opacity="0.55">
      {dashes.map((x, i) => (
        <line key={i} x1={x} y1={GROUND_Y + 5} x2={x + 7} y2={GROUND_Y + 2} />
      ))}
    </g>
  );
}

// A sagging wire, drawn twice: a plain navy conductor, and a bright dashed
// "flow" overlay animated on top (CSS keyframes in app/globals.css).
function Wire({ from, to, sag = 14, delay = 0, double = false, offset = 7 }) {
  const seg = (p1, p2) => {
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2 + sag;
    return `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
  };
  const paths = double
    ? [
        seg({ ...from, y: from.y - offset / 2 }, { ...to, y: to.y - offset / 2 }),
        seg({ ...from, y: from.y + offset / 2 }, { ...to, y: to.y + offset / 2 }),
      ]
    : [seg(from, to)];
  return (
    <>
      {paths.map((d, i) => (
        <path key={`base-${i}`} d={d} fill="none" stroke={NAVY} strokeWidth="1.3" />
      ))}
      {paths.map((d, i) => (
        <path key={`flow-${i}`} d={d} className="grid-wire-flow" style={{ animationDelay: `${delay + i * 0.4}s` }} />
      ))}
    </>
  );
}

export default function GridScene() {
  const plant = { x: 95 };
  const plantOut = { x: 128, y: 227 };

  const p1 = { x: 235, topY: 130, scale: 1 };
  const p1Geo = pylonGeometry(p1);
  const p2 = { x: 352, topY: 168, scale: 0.78 };
  const p2Geo = pylonGeometry(p2);

  const xfmr = { x: 408 };
  const xfmrTop = { x: 408, y: GROUND_Y - 40 };

  const pole1 = { x: 482, topY: 206 };
  const pole1Arms = { left: { x: 482 - 25, y: 206 }, right: { x: 482 + 25, y: 206 } };
  const pole2 = { x: 576, topY: 212 };
  const pole2Arms = { left: { x: 576 - 25, y: 212 }, right: { x: 576 + 25, y: 212 } };

  const house = { x: 682 };
  const clamp = { x: 636, y: 246 };

  return (
    <svg
      viewBox="0 15 760 295"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      {/* background blobs */}
      <g opacity="0.8">
        <path d="M -20 300 C 60 240 180 260 260 290 C 340 260 440 250 520 285 C 600 255 700 260 780 300 L 780 340 L -20 340 Z" fill="#DCE9F7" />
        <path d="M -20 310 C 100 280 240 300 360 300 C 480 280 620 300 780 305 L 780 340 L -20 340 Z" fill="#C9DCF2" />
        <circle cx={420} cy={262} r={90} fill="#F7D774" opacity="0.18" />
      </g>

      {/* sky decor (hidden on small screens via CSS). Pulled down close to the
          pylon tops/sparkles below, instead of floating in a mostly-empty
          upper band, so the sky reads as populated rather than as a gap. */}
      <g className="grid-decor-sm-hide">
        <Cloud x={140} y={88} scale={1} />
        <Cloud x={380} y={70} scale={0.85} />
        <Cloud x={610} y={95} scale={0.95} />
        <Bird x={260} y={100} />
        <Bird x={470} y={80} />
        <Bird x={300} y={115} />
      </g>

      <GroundDashes />

      {/* wires, drawn before the poles/pylons so the lattice sits on top */}
      <Wire from={plantOut} to={p1Geo.leftArm} sag={10} delay={0} double offset={8} />
      <Wire from={p1Geo.rightArm} to={p2Geo.leftArm} sag={10} delay={0.3} double offset={8} />
      <Wire from={p2Geo.rightArm} to={xfmrTop} sag={10} delay={0.6} />
      <Wire from={xfmrTop} to={pole1Arms.left} sag={8} delay={0.9} />
      <Wire from={pole1Arms.right} to={pole2Arms.left} sag={8} delay={1.2} />
      <Wire from={pole2Arms.right} to={clamp} sag={6} delay={1.5} />
      <Wire from={clamp} to={{ x: house.x - 56, y: 238 }} sag={3} delay={1.8} />

      <CoolingTower x={plant.x} scale={1} height={118} />
      <CoolingTower x={plant.x + 42} scale={0.82} height={96} />

      <RoundTree x={178} />
      <Pylon x={p1.x} topY={p1.topY} scale={p1.scale} />
      <g className="grid-decor-sm-hide">
        <Sparkle x={p1.x - 14} y={p1.topY - 10} />
        <Sparkle x={p1.x + 16} y={p1.topY - 4} />
      </g>

      <Pylon x={p2.x} topY={p2.topY} scale={p2.scale} />
      <g className="grid-decor-sm-hide">
        <Sparkle x={p2.x + 6} y={p2.topY - 8} />
      </g>

      <TransformerBox x={xfmr.x} />
      <RoundTree x={445} />

      <UtilityPole x={pole1.x} topY={pole1.topY} />
      <PineTree x={528} />
      <UtilityPole x={pole2.x} topY={pole2.topY} hasTransformer />

      <ClampDot x={clamp.x} y={clamp.y} />
      <House x={house.x} />
    </svg>
  );
}
