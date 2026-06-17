import type { CSSProperties } from "react";
import type { ProgressIllustrationModel } from "../../types/progressIllustration";

const LEAVES = [
  { x: 538, y: 225, rotate: -35 },
  { x: 572, y: 211, rotate: 30 },
  { x: 523, y: 193, rotate: -42 },
  { x: 590, y: 178, rotate: 38 },
  { x: 545, y: 158, rotate: -30 },
  { x: 610, y: 142, rotate: 42 },
  { x: 568, y: 126, rotate: -28 },
  { x: 625, y: 108, rotate: 35 },
  { x: 588, y: 88, rotate: -22 },
  { x: 643, y: 75, rotate: 38 },
  { x: 610, y: 56, rotate: -18 },
  { x: 657, y: 45, rotate: 30 },
] as const;

const PAWS = [
  { x: 335, y: 388, rotate: -20 },
  { x: 405, y: 407, rotate: 15 },
  { x: 474, y: 382, rotate: -12 },
  { x: 543, y: 401, rotate: 18 },
  { x: 612, y: 373, rotate: -14 },
] as const;

export function ProgressIllustration({
  compact = false,
  model,
}: {
  compact?: boolean;
  model: ProgressIllustrationModel;
}) {
  const style = {
    "--progress-lamp-opacity": model.lampIntensity,
    "--progress-stage": model.stageIndex,
  } as CSSProperties;
  const bars = model.diagnosticBars.length
    ? model.diagnosticBars
    : [
        { id: "listening", label: "Listening", accuracy: 0 },
        { id: "structure", label: "Structure", accuracy: 0 },
        { id: "reading", label: "Reading", accuracy: 0 },
      ];

  return (
    <figure
      aria-label={`Ilustrasi progres: ${model.stageLabel}. ${model.message}`}
      className={`progressIllustration ${compact ? "progressIllustration--compact" : ""}`}
      data-progress-stage={model.stageId}
      style={style}
    >
      <svg role="img" viewBox="0 0 720 480">
        <title>{model.stageLabel}</title>
        <desc>{model.message}</desc>
        <defs>
          <linearGradient id="progress-scene-bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f7fcfa" />
            <stop offset="0.55" stopColor="#e9f5f1" />
            <stop offset="1" stopColor="#d6eee7" />
          </linearGradient>
          <linearGradient id="progress-window" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={model.stageIndex >= 3 ? "#84d8c7" : "#b9d9e4"} />
            <stop offset="1" stopColor={model.stageIndex >= 2 ? "#dff4e8" : "#ecf4f7"} />
          </linearGradient>
          <linearGradient id="progress-desk" x1="0" x2="1">
            <stop offset="0" stopColor="#173b52" />
            <stop offset="1" stopColor="#0a293f" />
          </linearGradient>
          <radialGradient id="progress-lamp-glow">
            <stop offset="0" stopColor="#ffe8a8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffe8a8" stopOpacity="0" />
          </radialGradient>
          <filter id="progress-soft-shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="9" floodColor="#10233f" floodOpacity="0.14" stdDeviation="10" />
          </filter>
          <filter id="progress-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect className="progressSceneBackground" x="10" y="10" width="700" height="460" rx="34" fill="url(#progress-scene-bg)" />
        <path className="progressSceneWindow" d="M250 46C250 22 269 10 293 10h196c24 0 43 12 43 36v208H250Z" fill="url(#progress-window)" />
        <circle className="progressSceneSun" cx="454" cy="82" r="24" />
        <path className="progressSceneHill" d="M250 222c62-75 126-67 178-28 44-52 81-47 104-15v75H250Z" />

        <g className="progressShelf" filter="url(#progress-soft-shadow)">
          <rect x="54" y="82" width="176" height="14" rx="7" fill="#173b52" />
          <rect x="68" y="96" width="8" height="93" rx="4" fill="#c0d8d2" />
          <rect x="208" y="96" width="8" height="93" rx="4" fill="#c0d8d2" />
          {Array.from({ length: model.bookCount }, (_, index) => {
            const colors = ["#4d7b96", "#3b9b86", "#d19b55", "#6c79bd", "#315f73", "#8fb9aa"];
            const height = 35 + (index % 3) * 10;
            return (
              <g className="progressBook" key={index} style={{ animationDelay: `${index * 80}ms` }}>
                <rect x={82 + index * 20} y={166 - height} width="15" height={height} rx="3" fill={colors[index]} />
                <path d={`M${85 + index * 20} ${143 - height / 2}h9`} stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
              </g>
            );
          })}
        </g>

        <g className="progressLamp">
          <circle className="progressLampGlow" cx="142" cy="255" r="105" fill="url(#progress-lamp-glow)" />
          <path d="M103 330h82" stroke="#173b52" strokeLinecap="round" strokeWidth="12" />
          <path d="M144 330v-91l-38-53" fill="none" stroke="#173b52" strokeLinecap="round" strokeLinejoin="round" strokeWidth="11" />
          <path d="m77 181 55-35 22 44-55 35Z" fill="#f5c567" stroke="#173b52" strokeLinejoin="round" strokeWidth="6" />
          <path d="m98 218 52 16" stroke="#ffe9a7" strokeLinecap="round" strokeWidth="7" />
        </g>

        <g className="progressPlant" filter="url(#progress-soft-shadow)">
          <path d="M579 294c-6-74 15-140 52-207" fill="none" stroke="#397b64" strokeLinecap="round" strokeWidth="8" />
          <path d="M580 285c-28-49-50-84-67-123m74 89c27-45 45-83 58-124" fill="none" stroke="#397b64" strokeLinecap="round" strokeWidth="5" />
          {LEAVES.slice(0, model.plantLeafCount).map((leaf, index) => (
            <ellipse
              className="progressLeaf"
              cx={leaf.x}
              cy={leaf.y}
              fill={index % 2 ? "#3e816b" : "#5a9a78"}
              key={`${leaf.x}-${leaf.y}`}
              rx="20"
              ry="9"
              style={{ animationDelay: `${index * 110}ms` }}
              transform={`rotate(${leaf.rotate} ${leaf.x} ${leaf.y})`}
            />
          ))}
          <path d="M535 280h92l-10 72h-72Z" fill="#f8fbfa" stroke="#aac8c0" strokeWidth="5" />
          <path d="M549 300h64" stroke="#d7e8e3" strokeWidth="5" />
        </g>

        <g className="progressDesk" filter="url(#progress-soft-shadow)">
          <rect x="35" y="342" width="650" height="40" rx="16" fill="url(#progress-desk)" />
          <path d="M80 380v65m560-65v65" stroke="#173b52" strokeLinecap="round" strokeWidth="16" />
        </g>

        <g className="progressLaptop" filter="url(#progress-soft-shadow)">
          <path d="M250 176h215a14 14 0 0 1 14 14v142H236V190a14 14 0 0 1 14-14Z" fill="#0c2e46" stroke="#173b52" strokeWidth="7" />
          <rect x="255" y="197" width="205" height="116" rx="8" fill="#102f46" />
          <circle cx="357" cy="186" r="3" fill="#7fb9aa" />
          <path d="M215 332h282l-18 19H235Z" fill="#d9e5e4" stroke="#173b52" strokeLinejoin="round" strokeWidth="6" />
          <path d="M283 284h142" stroke="#31536a" strokeWidth="4" />
          {bars.map((bar, index) => {
            const width = Math.max(8, Math.round((bar.accuracy / 100) * 120));
            return (
              <g className="progressDiagnosticBar" key={bar.id} style={{ animationDelay: `${index * 120}ms` }}>
                <circle cx="280" cy={220 + index * 27} r="5" fill={["#7cd5c0", "#f2c36c", "#8b9fe5"][index]} />
                <rect x="294" y={215 + index * 27} width="130" height="10" rx="5" fill="#284b61" />
                <rect x="294" y={215 + index * 27} width={width} height="10" rx="5" fill={["#7cd5c0", "#f2c36c", "#8b9fe5"][index]} />
              </g>
            );
          })}
          <g className="progressTargetMark" transform="translate(438 250)">
            <circle r="20" fill="none" stroke="#74d8c2" strokeOpacity="0.45" strokeWidth="4" />
            <circle r="11" fill="none" stroke="#74d8c2" strokeWidth="4" />
            <circle r="3" fill="#74d8c2" />
          </g>
        </g>

        <g className="progressVetNotes">
          <path d="M120 348h104l-9-68H111Z" fill="#fff" stroke="#b7cbc8" strokeWidth="4" />
          <path d="M128 299h65m-61 12h72m-68 12h45" stroke="#98adae" strokeLinecap="round" strokeWidth="4" />
          <path d="M184 282c9 4 15 10 18 20m-7-21-7 8" fill="none" stroke="#3b8b75" strokeLinecap="round" strokeWidth="4" />
        </g>

        <g className="progressStethoscope" fill="none" stroke="#c4d3d7" strokeLinecap="round" strokeWidth="6">
          <path d="M485 342c11-33 51-34 61-4 10 31-21 55-49 39-27-16-10-51 20-41" />
          <circle cx="481" cy="342" r="8" fill="#e8f0f1" stroke="#8fa5ac" />
        </g>

        <g className="progressPetSilhouette" transform="translate(177 260)">
          <path d="M0 44c5-34 20-51 42-50 18 1 28 14 30 34 14 4 23 14 26 29H0Z" fill="#31536a" opacity="0.9" />
          <path d="m22-2 5-18 13 14m8 1 13-15 3 20" fill="#31536a" stroke="#31536a" strokeLinejoin="round" strokeWidth="5" />
          <path d="M70 29c24-23 34-7 19 12" fill="none" stroke="#31536a" strokeLinecap="round" strokeWidth="7" />
          <circle cx="36" cy="8" r="2.5" fill="#dcefe9" />
          <circle cx="53" cy="8" r="2.5" fill="#dcefe9" />
        </g>

        <g className="progressPawPath">
          {PAWS.map((paw, index) => (
            <g
              className={index < model.pawStepCount ? "progressPaw progressPaw--active" : "progressPaw"}
              key={`${paw.x}-${paw.y}`}
              style={{ animationDelay: `${index * 140}ms` }}
              transform={`translate(${paw.x} ${paw.y}) rotate(${paw.rotate})`}
            >
              <ellipse cx="0" cy="5" rx="9" ry="7" />
              <circle cx="-10" cy="-5" r="4" />
              <circle cx="-3" cy="-10" r="4" />
              <circle cx="5" cy="-10" r="4" />
              <circle cx="12" cy="-4" r="4" />
            </g>
          ))}
          <g className={`progressGoalBeacon ${model.stageId === "achieved" ? "progressGoalBeacon--achieved" : ""}`} transform="translate(652 351)">
            <circle r="31" />
            <circle r="18" />
            <circle r="6" />
          </g>
        </g>
      </svg>
      <figcaption>
        <span>Fase {model.stageIndex + 1}/5</span>
        <strong>{model.stageLabel}</strong>
        <small>Berikutnya: {model.nextMilestone}</small>
      </figcaption>
    </figure>
  );
}
