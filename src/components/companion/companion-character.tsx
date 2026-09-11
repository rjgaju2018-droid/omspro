import type { CSSProperties } from "react";
import type { CompanionStateId, OutfitId, HairId, MakeupLook } from "./companion-config";
import { COMPANION_OUTFITS, type OutfitKind } from "./companion-config";

// The Virtual Assistant herself — one inline SVG, no image assets, no
// canvas library. 2026-09-12 redesign: a stylized Indian-girl assistant
// with a real ladies wardrobe (salwar suit, sharara, jeans-top, saree —
// each in 2 colorways), a Bollywood dance pose, and a daily makeup look
// (lipstick + bindi + eyeshadow). Everything visual (pose, face,
// decorations) is driven off `state`; the wardrobe props recolor/reshape
// the garment layer per outfit `kind` — 8 outfits come from 4 garment
// drawings, never a free-form layer.
//
// Animation is applied via CSS classes keyed off `data-companion-state` on
// the outer <g> (see the .oms-companion-* rules in globals.css) rather than
// inline @keyframes, so the reduced-motion override lives in one place
// alongside every other animation in the app.

const SKIN = "#ffcf8a";
const SKIN_SHADE = "#f0b464";
const INK = "#3a2416";
const HAIR_COLOR = "#3b2314";
const HAIR_HIGHLIGHT = "#5b3a29";

// Arm rotation (degrees) around each shoulder pivot, per state. The arm is
// drawn hanging straight down at rest; negative rotates the left arm
// up/out, positive the mirrored right arm up/out (see renderArm below).
const ARM_POSE: Record<CompanionStateId, { left: number; right: number }> = {
  punch_in: { left: -95, right: 95 },
  task_completed: { left: -130, right: 70 },
  overdue: { left: 18, right: -18 },
  idle_night: { left: 28, right: -22 },
  focused: { left: 6, right: -6 },
  // Dance: one arm up over the head (classic Bollywood pose), one out.
  dance: { left: -150, right: 110 },
};

interface CompanionCharacterProps {
  state: CompanionStateId;
  outfit: OutfitId;
  hair: HairId;
  glasses?: boolean;
  className?: string;
  // 2026-09-05 — "REAL AI-GENERATED IMAGE BANWAO": once an Admin/MD has
  // generated one from /dashboard/admin/companion-access (companion_
  // character_image table), the live widget passes its public URL here and
  // this component shows THAT instead of the hand-drawn SVG below — pure
  // upgrade, nothing else about how this component is called needs to
  // change. Wardrobe props (outfit/hair/glasses) have no effect on a real
  // photo, so they're simply ignored in this branch — the companion-
  // preview/lab page never passes imageUrl, so it keeps testing the SVG
  // wardrobe exactly as before.
  imageUrl?: string | null;
  // 2026-09-12 — the day's makeup look (rotates daily alongside the
  // outfit); optional so the preview page can omit it.
  makeup?: MakeupLook;
}

export function CompanionCharacter({ state, outfit, hair, glasses = false, className, imageUrl, makeup }: CompanionCharacterProps) {
  const outfitConfig = COMPANION_OUTFITS.find((o) => o.id === outfit) ?? COMPANION_OUTFITS[0];
  const pose = ARM_POSE[state];

  if (imageUrl) {
    return (
      <div className={className} data-companion-state={state} style={{ position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local/optimizable asset */}
        <img src={imageUrl} alt={`Virtual assistant, currently ${state.replace(/_/g, " ")}`} className="oms-companion-photo" />
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 200 240"
      className={className}
      role="img"
      aria-label={`Virtual assistant, currently ${state.replace(/_/g, " ")}, wearing ${outfitConfig.label}`}
      data-companion-state={state}
    >
      {/* Soft aura behind the character — color is set inline per state via
          --companion-aura on the wrapper, so this shape just reads the
          variable rather than hardcoding a color per state itself. */}
      <circle cx={100} cy={130} r={92} fill="var(--companion-aura, transparent)" opacity={0.16} className="oms-companion-aura" />

      {renderBackDecor(state)}

      <g className="oms-companion-body-group">
        {/* Shoes */}
        <ellipse cx={80} cy={212} rx={14} ry={9} fill={outfitConfig.shoeColor} />
        <ellipse cx={120} cy={212} rx={14} ry={9} fill={outfitConfig.shoeColor} />

        {/* Arms (drawn behind the body so only the lower "hand" half peeks
            out past the torso silhouette) */}
        {renderArm(46, 122, pose.left, "left")}
        {renderArm(154, 122, pose.right, "right")}

        {/* Legs / lower garment — drawn first so the kameez/top drapes over */}
        {renderLegs(outfitConfig)}

        {/* Torso garment per outfit kind */}
        {renderTorso(outfitConfig)}

        {/* Neck + face base */}
        <rect x={92} y={78} width={16} height={14} rx={6} fill={SKIN_SHADE} />
        <ellipse cx={100} cy={106} rx={17} ry={17} fill={SKIN_SHADE} opacity={0} />

        {renderHair(hair)}
        {renderHead(state, makeup)}
        {glasses ? renderGlasses() : null}
      </g>

      {renderFrontDecor(state)}
    </svg>
  );
}

function renderArm(shoulderX: number, shoulderY: number, rotateDeg: number, side: "left" | "right") {
  const dx = side === "left" ? -14 : 14;
  const style: CSSProperties = {
    transformOrigin: `${shoulderX}px ${shoulderY}px`,
    transform: `rotate(${rotateDeg}deg)`,
  };
  return (
    <line
      x1={shoulderX}
      y1={shoulderY}
      x2={shoulderX + dx}
      y2={shoulderY + 40}
      stroke={SKIN}
      strokeWidth={11}
      strokeLinecap="round"
      style={style}
      className="oms-companion-arm"
    />
  );
}

/** Legs / lower garment — differs per outfit kind. */
function renderLegs(outfit: (typeof COMPANION_OUTFITS)[number]) {
  if (outfit.kind === "salwar") {
    // Patiala-style salwar: two billowy legs gathered at the ankle.
    return (
      <g fill={outfit.accent} stroke={outfit.shade} strokeWidth={1.5}>
        <path d="M84,168 Q74,190 78,204 L92,204 Q94,186 96,172 Z" />
        <path d="M116,168 Q126,190 122,204 L108,204 Q106,186 104,172 Z" />
      </g>
    );
  }
  if (outfit.kind === "sharara") {
    // Flowing wide sharara pants — flaring out from the knee.
    return (
      <g fill={outfit.primary} stroke={outfit.shade} strokeWidth={1.5}>
        <path d="M84,166 Q66,186 60,206 L86,206 Q94,186 97,170 Z" />
        <path d="M116,166 Q134,186 140,206 L114,206 Q106,186 103,170 Z" />
      </g>
    );
  }
  if (outfit.kind === "jeans_top") {
    // Straight denim jeans.
    return (
      <g fill={outfit.accent} stroke={outfit.shade} strokeWidth={1.5}>
        <rect x={84} y={166} width={14} height={38} rx={5} />
        <rect x={102} y={166} width={14} height={38} rx={5} />
      </g>
    );
  }
  // saree: the pleated lower drape with a gold border.
  return (
    <g>
      <path d="M78,162 Q70,190 66,208 L134,208 Q130,190 122,162 Q100,172 78,162 Z" fill={outfit.primary} stroke={outfit.shade} strokeWidth={1.5} />
      <path d="M67,202 L133,202 L134,208 L66,208 Z" fill={outfit.accent} opacity={0.9} />
    </g>
  );
}

/** Torso garment per outfit kind. */
function renderTorso(outfit: (typeof COMPANION_OUTFITS)[number]) {
  const kind: OutfitKind = outfit.kind;
  if (kind === "salwar") {
    // Knee-length kameez with a side slit + dupatta across one shoulder.
    return (
      <g>
        <path d="M76,104 Q100,96 124,104 L130,176 Q100,186 70,176 Z" fill={outfit.primary} stroke={outfit.shade} strokeWidth={1.5} />
        <path d="M96,110 L90,176 M104,110 L110,176" stroke={outfit.shade} strokeWidth={1.2} opacity={0.5} fill="none" />
        <path d="M120,102 Q138,120 132,158 L124,150 Q128,122 114,108 Z" fill={outfit.accent} opacity={0.95} />
      </g>
    );
  }
  if (kind === "sharara") {
    // Short fancy kurti + gold waist band.
    return (
      <g>
        <path d="M78,104 Q100,96 122,104 L126,150 Q100,160 74,150 Z" fill={outfit.primary} stroke={outfit.shade} strokeWidth={1.5} />
        <path d="M76,148 Q100,158 124,148 L124,156 Q100,166 76,156 Z" fill={outfit.accent} opacity={0.9} />
      </g>
    );
  }
  if (kind === "jeans_top") {
    // Fitted modern top.
    return (
      <g>
        <path d="M80,104 Q100,97 120,104 L124,158 Q100,166 76,158 Z" fill={outfit.primary} stroke={outfit.shade} strokeWidth={1.5} />
        <path d="M84,104 Q100,116 116,104" stroke={outfit.accent} strokeWidth={2} fill="none" opacity={0.8} />
      </g>
    );
  }
  // saree blouse + pallu over the shoulder.
  return (
    <g>
      <path d="M82,104 Q100,98 118,104 L122,158 Q100,166 78,158 Z" fill={outfit.shade} stroke={outfit.shade} strokeWidth={1.5} />
      <path d="M116,102 Q136,124 130,170 L120,160 Q126,126 108,108 Z" fill={outfit.primary} />
      <path d="M120,158 Q128,166 130,172" stroke={outfit.accent} strokeWidth={2.5} fill="none" />
    </g>
  );
}

function renderHair(hair: HairId) {
  if (hair === "braid") {
    return (
      <g fill={HAIR_COLOR}>
        <path d="M60,84 C58,48 82,28 100,28 C118,28 142,48 140,84 C134,68 120,60 100,60 C80,60 66,68 60,84 Z" />
        <path d="M138,86 Q154,110 150,150 Q148,166 140,176 Q136,160 138,144 Q140,112 132,92 Z" />
        <path d="M132,100 Q148,118 146,140 M136,116 Q150,130 148,152 M138,132 Q150,144 148,164" stroke={HAIR_HIGHLIGHT} strokeWidth={2} fill="none" />
      </g>
    );
  }
  if (hair === "bun") {
    return (
      <g fill={HAIR_COLOR}>
        <circle cx={100} cy={22} r={13} />
        <path d="M62,86 C60,50 82,32 100,32 C118,32 140,50 138,86 C132,70 118,62 100,62 C82,62 68,70 62,86 Z" />
      </g>
    );
  }
  if (hair === "wavy") {
    // Legacy shoulder-length wavy shape (kept for old saved choices).
    return (
      <g fill={HAIR_COLOR}>
        <path d="M62,78 C58,44 82,26 100,26 C118,26 142,44 138,78 C132,66 122,58 100,58 C78,58 68,66 62,78 Z" />
        <path d="M58,80 C48,96 50,120 46,140 C58,132 62,112 66,96 C64,132 58,158 50,178 C64,168 74,138 76,108 C74,98 66,86 58,80 Z" />
        <path d="M142,80 C152,96 150,120 154,140 C142,132 138,112 134,96 C136,132 142,158 150,178 C136,168 126,138 124,108 C126,98 134,86 142,80 Z" />
      </g>
    );
  }
  // long_wavy (default) — waist-length flowing waves past both shoulders.
  return (
    <g fill={HAIR_COLOR}>
      <path d="M58,86 C54,44 80,24 100,24 C120,24 146,44 142,86 C134,66 120,58 100,58 C80,58 66,66 58,86 Z" />
      <path d="M56,88 C44,108 46,140 40,176 C56,170 66,146 68,116 C66,102 62,94 56,88 Z" />
      <path d="M144,88 C156,108 154,140 160,176 C144,170 134,146 132,116 C134,102 138,94 144,88 Z" />
      <path d="M46,150 Q52,166 44,178 M154,150 Q148,166 156,178" stroke={HAIR_HIGHLIGHT} strokeWidth={2} fill="none" opacity={0.6} />
    </g>
  );
}

function renderGlasses() {
  return (
    <g className="oms-companion-glasses" fill="none" stroke="#3a2416" strokeWidth={3} opacity={0.85}>
      <circle cx={78} cy={128} r={17} />
      <circle cx={122} cy={128} r={17} />
      <line x1={95} y1={126} x2={105} y2={126} />
      <line x1={61} y1={124} x2={50} y2={120} strokeLinecap="round" />
      <line x1={139} y1={124} x2={150} y2={120} strokeLinecap="round" />
    </g>
  );
}

/** Face + the day's makeup (lipstick / eyeshadow / bindi). */
function renderHead(state: CompanionStateId, makeup?: MakeupLook) {
  const face = renderFace(state);
  if (!makeup) return face;
  const leftX = 78;
  const rightX = 122;
  const eyeY = 128;
  return (
    <g>
      {/* Head base + ears (face path below draws on top of the head oval) */}
      <ellipse cx={100} cy={112} rx={34} ry={36} fill="#ffcf8a" stroke="#f0b464" strokeWidth={2} />
      <ellipse cx={64} cy={116} rx={5} ry={8} fill="#ffcf8a" />
      <ellipse cx={136} cy={116} rx={5} ry={8} fill="#ffcf8a" />
      {face}
      {/* Makeup layer sits above the face features */}
      <g pointerEvents="none">
        {/* Eyeshadow arcs just above the eyes */}
        <path d={`M${leftX - 12},${eyeY - 10} Q${leftX},${eyeY - 18} ${leftX + 12},${eyeY - 10}`} stroke={makeup.eyeshadow} strokeWidth={5} fill="none" opacity={0.55} strokeLinecap="round" />
        <path d={`M${rightX - 12},${eyeY - 10} Q${rightX},${eyeY - 18} ${rightX + 12},${eyeY - 10}`} stroke={makeup.eyeshadow} strokeWidth={5} fill="none" opacity={0.55} strokeLinecap="round" />
        {/* Bindi */}
        <circle cx={100} cy={100} r={3.2} fill={makeup.bindi} />
        {/* Lips */}
        <path d="M88,152 Q100,162 112,152 Q100,158 88,152 Z" fill={makeup.lipstick} />
      </g>
    </g>
  );
}

function renderFace(state: CompanionStateId) {
  const leftX = 78;
  const rightX = 122;
  const eyeY = 128;

  switch (state) {
    case "punch_in":
      return (
        <g>
          <path d={brow(leftX, eyeY - 18, -8)} stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          <path d={brow(rightX, eyeY - 18, 8)} stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          {eyeCircle(leftX, eyeY, 14, true)}
          {eyeCircle(rightX, eyeY, 14, true)}
          <path d="M76,150 Q100,180 124,150 L120,150 Q100,168 80,150 Z" fill="#8a3b1f" />
        </g>
      );
    case "task_completed":
      return (
        <g>
          <path d={happyArc(leftX)} stroke={INK} strokeWidth={4.5} fill="none" strokeLinecap="round" className="oms-companion-cheer-eye" />
          <path d={happyArc(rightX)} stroke={INK} strokeWidth={4.5} fill="none" strokeLinecap="round" className="oms-companion-cheer-eye" />
          <ellipse cx={leftX} cy={eyeY + 10} rx={7} ry={4} fill="#ff9d7a" opacity={0.7} />
          <ellipse cx={rightX} cy={eyeY + 10} rx={7} ry={4} fill="#ff9d7a" opacity={0.7} />
          <path d="M78,150 Q100,184 122,150 Q100,172 78,150 Z" fill="#8a3b1f" />
        </g>
      );
    case "overdue":
      return (
        <g>
          <line x1={leftX - 12} y1={eyeY - 20} x2={leftX + 6} y2={eyeY - 12} stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <line x1={rightX + 12} y1={eyeY - 20} x2={rightX - 6} y2={eyeY - 12} stroke={INK} strokeWidth={4} strokeLinecap="round" />
          {eyeCircle(leftX, eyeY, 10, false)}
          {eyeCircle(rightX, eyeY, 10, false)}
          <path d="M84,166 Q100,156 116,166" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
        </g>
      );
    case "idle_night":
      return (
        <g>
          <path d={`M66,${eyeY} Q78,${eyeY + 5} 90,${eyeY}`} stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          <path d={`M110,${eyeY} Q122,${eyeY + 5} 134,${eyeY}`} stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          <ellipse cx={100} cy={160} rx={7} ry={9} fill="#8a3b1f" />
        </g>
      );
    case "dance":
      // Big open smile + sparkling half-moon eyes — pure celebration.
      return (
        <g>
          <path d={happyArc(leftX)} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" className="oms-companion-cheer-eye" />
          <path d={happyArc(rightX)} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" className="oms-companion-cheer-eye" />
          <path d="M74,148 Q100,190 126,148 Q100,164 74,148 Z" fill="#8a3b1f" />
          <circle cx={70} cy={142} r={4} fill="#ff9d7a" opacity={0.75} />
          <circle cx={130} cy={142} r={4} fill="#ff9d7a" opacity={0.75} />
        </g>
      );
    case "focused":
    default:
      return (
        <g>
          {eyeCircle(leftX, eyeY, 11, false, true)}
          {eyeCircle(rightX, eyeY, 11, false, true)}
          <path d="M86,154 Q100,161 114,154" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

function eyeCircle(cx: number, cy: number, r: number, wide: boolean, blinking = false) {
  return (
    <g key={`${cx}-eye`}>
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#e7c9a3" strokeWidth={1.5} />
      <circle cx={cx} cy={cy + (wide ? 1 : 2)} r={wide ? r * 0.55 : r * 0.48} fill={INK} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.35} r={r * 0.18} fill="#fff" />
      {blinking ? (
        <rect
          x={cx - r - 1}
          y={cy - r - 1}
          width={r * 2 + 2}
          height={r * 2 + 2}
          fill={SKIN}
          className="oms-companion-eyelid"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      ) : null}
    </g>
  );
}

function brow(cx: number, cy: number, tilt: number) {
  const dir = tilt < 0 ? -1 : 1;
  return `M${cx - 12},${cy + (dir < 0 ? 4 : -4)} Q${cx},${cy - 6} ${cx + 12},${cy + (dir < 0 ? -4 : 4)}`;
}

function happyArc(cx: number) {
  return `M${cx - 13},${132} Q${cx},${116} ${cx + 13},${132}`;
}

function renderBackDecor(state: CompanionStateId) {
  if (state !== "punch_in") return null;
  // A few short "energy" rays behind the body for the punch-in state.
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g className="oms-companion-rays" stroke="#f59e0b" strokeWidth={4} strokeLinecap="round" opacity={0.55}>
      {rays.map((deg) => (
        <line
          key={deg}
          x1={100}
          y1={140}
          x2={100}
          y2={62}
          style={{ transformOrigin: "100px 140px", transform: `rotate(${deg}deg)` }}
        />
      ))}
    </g>
  );
}

function renderFrontDecor(state: CompanionStateId) {
  switch (state) {
    case "task_completed":
    case "dance":
      return (
        <g className="oms-companion-sparkles" fill={state === "dance" ? "#ec4899" : "#f59e0b"}>
          <Sparkle x={40} y={54} size={10} delay="0s" />
          <Sparkle x={166} y={44} size={8} delay="0.25s" />
          <Sparkle x={150} y={90} size={7} delay="0.5s" />
          <Sparkle x={30} y={96} size={6} delay="0.75s" />
          {state === "dance" ? (
            <>
              <Sparkle x={172} y={130} size={7} delay="1s" />
              <Sparkle x={26} y={140} size={7} delay="1.25s" />
              {/* Music notes floating around the dance */}
              <text x={168} y={70} fontSize={16} fill="#8b5cf6" className="oms-companion-note" style={{ animationDelay: "0s" }}>
                ♪
              </text>
              <text x={22} y={60} fontSize={13} fill="#ec4899" className="oms-companion-note" style={{ animationDelay: "0.7s" }}>
                ♫
              </text>
            </>
          ) : null}
        </g>
      );
    case "overdue":
      return (
        <g>
          <path
            d="M148,84 C154,94 148,104 142,102 C136,100 138,88 148,84 Z"
            fill="#7dd3fc"
            className="oms-companion-sweat"
          />
          <g className="oms-companion-alert" style={{ transformOrigin: "100px 30px" }}>
            <circle cx={100} cy={30} r={14} fill="#ef4444" />
            <text x={100} y={35} textAnchor="middle" fontSize={16} fontWeight={700} fill="#fff">
              !
            </text>
          </g>
        </g>
      );
    case "idle_night":
      return (
        <g>
          <path d="M160,32 a12,12 0 1 0 0.2,0 a9,9 0 1 1 -0.2,0" fill="#c7d2fe" opacity={0.9} />
          <text x={30} y={40} fontSize={14} fill="#818cf8" className="oms-companion-zzz" style={{ animationDelay: "0s" }}>
            Z
          </text>
          <text x={42} y={26} fontSize={11} fill="#a5b4fc" className="oms-companion-zzz" style={{ animationDelay: "0.6s" }}>
            z
          </text>
          <text x={52} y={16} fontSize={8} fill="#c7d2fe" className="oms-companion-zzz" style={{ animationDelay: "1.2s" }}>
            z
          </text>
        </g>
      );
    default:
      return null;
  }
}

function Sparkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: string }) {
  const s = size;
  return (
    <polygon
      points={`${x},${y - s} ${x + s * 0.28},${y - s * 0.28} ${x + s},${y} ${x + s * 0.28},${y + s * 0.28} ${x},${y + s} ${x - s * 0.28},${y + s * 0.28} ${x - s},${y} ${x - s * 0.28},${y - s * 0.28}`}
      className="oms-companion-sparkle"
      style={{ animationDelay: delay, transformOrigin: `${x}px ${y}px` }}
    />
  );
}
