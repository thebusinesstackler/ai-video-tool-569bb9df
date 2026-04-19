/**
 * SmartOverlay
 * ------------
 * DOM-rendered, brand-aware motion graphic for Chatcut AI's Commercial Director mode.
 *
 * Two render paths:
 *   1. LEGACY (compact cards) — stat_callout, benefit_chip, benefit_list, lower_third,
 *      cta_button, quote_pop, numbered_list, feature_grid, comparison, title_card.
 *      Auto-positioned, animated, brand-coloured. Same as before.
 *
 *   2. COMMERCIAL DIRECTOR (`treatment` prop) — the new layered system Marco emits via
 *      `add_motion_graphic`:
 *        - kinetic_headline   → big word-by-word reveal
 *        - masked_typography  → oversized brand-coloured word *behind* the speaker
 *                                (faked depth via blend-mode + radial vignette)
 *        - stat_card          → glass card with big number + count-up tick
 *        - side_notes         → right-rail stacked callouts with check icons
 *        - bullet_stack       → numbered bullets that hold and stack (educational)
 *        - quote_pop          → polished quote card
 *        - cta_lockup         → centered CTA button + URL + brand
 *        - lower_third_pro    → refined animated bar with brand accent
 *        - floating_note      → sticky-note style with subtle tilt
 *
 *   Plus a `placement` engine maps semantic positions
 *   (behind_subject / left_panel / right_panel / lower_third / center_takeover /
 *    top_banner / floating_note) to absolute CSS coords with safe-zone padding.
 */
import React from 'react';
import { cn } from '@/lib/utils';

export type SmartOverlayType =
  | 'lower_third'
  | 'stat_callout'
  | 'benefit_chip'
  | 'benefit_list'
  | 'numbered_list'
  | 'feature_grid'
  | 'quote_pop'
  | 'cta_button'
  | 'title_card'
  | 'animated_text'
  | 'comparison'
  | 'motion_graphic';

export type CommercialTreatment =
  | 'kinetic_headline'
  | 'masked_typography'
  | 'stat_card'
  | 'side_notes'
  | 'bullet_stack'
  | 'quote_pop'
  | 'cta_lockup'
  | 'lower_third_pro'
  | 'floating_note';

export type CommercialPlacement =
  | 'behind_subject'
  | 'left_panel'
  | 'right_panel'
  | 'lower_third'
  | 'center_takeover'
  | 'top_banner'
  | 'floating_note';

export interface SmartOverlayProps {
  type: SmartOverlayType | string;
  /** Primary text (single line). For lists this is the "title". */
  text: string;
  /** Optional list of bullets / steps / features. */
  items?: string[];
  /** Brand color (hex) used as the dominant fill / accent. */
  brandColor: string;
  /** Brand text color (hex) for text on the brand fill. */
  brandTextColor: string;
  /** Brand font name (CSS family). */
  brandFont?: string;
  /** Optional sub / kicker text under the headline. */
  subtext?: string;
  /** Style preset (visual treatment). */
  style?: 'glass' | 'bold' | 'minimal' | 'neon' | 'broadcast';
  /** Scale 1-5; 5 = full screen take-over. */
  scale?: number;
  /** Whether to render with full-screen take-over layout. */
  fullCoverage?: boolean;
  /** ── Commercial Director extensions ─────────────────────────── */
  /** Director-grade treatment (overrides the legacy `type` rendering when set). */
  treatment?: CommercialTreatment;
  /** Semantic placement; the engine maps it to absolute CSS coords. */
  placement?: CommercialPlacement;
}

/** Subtle helper — convert hex → rgba string. */
function hexA(hex: string, alpha: number): string {
  const h = (hex || '#000000').replace('#', '').padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pick reasonable text color given the chosen surface. */
function readableOn(brandColor: string): string {
  const h = (brandColor || '#000000').replace('#', '').padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#0a0a0a' : '#ffffff';
}

const fontStack = (font?: string) =>
  font
    ? `'${font}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
    : `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

/** Map semantic placement → absolute CSS positioning (safe-zone padded). */
function placementStyle(p?: CommercialPlacement): React.CSSProperties {
  // Note: max-width values use cqw so they scale to the preview container, not the viewport.
  switch (p) {
    case 'behind_subject':
      // z-index 0 keeps the masked text BEHIND the speaker layer (main <video> sits at z-index 1+
      // while the overlay layer normally renders above the video). The overlay container will
      // also receive `mix-blend-mode: screen` via MaskedTypography for the see-through illusion.
      return { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6%', zIndex: 0 };
    case 'left_panel':
      return { position: 'absolute', left: '4%', top: '50%', transform: 'translateY(-50%)', maxWidth: '38cqw' };
    case 'right_panel':
      return { position: 'absolute', right: '4%', top: '50%', transform: 'translateY(-50%)', maxWidth: '38cqw' };
    case 'lower_third':
      return { position: 'absolute', left: '50%', bottom: '8%', transform: 'translateX(-50%)', maxWidth: '88cqw' };
    case 'center_takeover':
      return { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8%' };
    case 'top_banner':
      return { position: 'absolute', left: '50%', top: '8%', transform: 'translateX(-50%)', maxWidth: '88cqw' };
    case 'floating_note':
      return { position: 'absolute', right: '4%', top: '14%', transform: 'rotate(-2deg)', maxWidth: '34cqw' };
    default:
      return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════
// COMMERCIAL DIRECTOR TREATMENTS (new system, used when `treatment` is set)
// ═══════════════════════════════════════════════════════════════════════

const KineticHeadline: React.FC<{
  text: string; subtext?: string; brandColor: string; onBrand: string; family: string;
}> = ({ text, subtext, brandColor, onBrand, family }) => {
  const words = (text || '').split(/\s+/).filter(Boolean);
  return (
    <div className="text-center" style={{ fontFamily: family, maxWidth: '90%', overflow: 'hidden' }}>
      <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1" style={{ maxWidth: '100%' }}>
        {words.map((w, i) => (
          <span
            key={i}
            className="inline-block opacity-0"
            style={{
              fontSize: 'clamp(20px, 5.5cqw, 56px)',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: '#ffffff',
              textShadow: `0 4px 24px ${hexA(brandColor, 0.5)}, 0 1px 0 rgba(0,0,0,0.4)`,
              animation: `smartOvKinetic 0.55s cubic-bezier(.2,1,.36,1) ${0.08 * i + 0.05}s forwards`,
              wordBreak: 'keep-all',
            }}
          >
            {w}
          </span>
        ))}
      </div>
      {subtext && (
        <div
          className="mt-3 inline-block px-4 py-1 rounded-full opacity-0"
          style={{
            background: brandColor,
            color: onBrand,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            fontSize: 13,
            animation: `smartOvKinetic 0.5s cubic-bezier(.2,1,.36,1) ${0.08 * words.length + 0.15}s forwards`,
          }}
        >
          {subtext}
        </div>
      )}
      <style>{`@keyframes smartOvKinetic { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
};

const MaskedTypography: React.FC<{
  text: string; brandColor: string; family: string;
}> = ({ text, brandColor, family }) => {
  // Faked depth: oversized word in brand colour, blended behind the subject via mix-blend-mode,
  // with a soft radial vignette mask to "hug" the centre. True person-segmentation is a future
  // enhancement (MediaPipe / matting model).
  return (
    <>
      {/* Subtle vignette to push the speaker forward visually */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 50% 55%, transparent 28%, ${hexA('#000000', 0.6)} 78%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          fontFamily: family,
          fontSize: 'clamp(48px, 14cqw, 180px)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 0.85,
          color: brandColor,
          textTransform: 'uppercase',
          mixBlendMode: 'screen',
          opacity: 0.6,
          textAlign: 'center',
          textShadow: `0 0 60px ${hexA(brandColor, 0.5)}`,
          animation: 'smartOvMasked 0.7s cubic-bezier(.2,1,.36,1) forwards',
          maxWidth: '90%',
          wordBreak: 'keep-all',
          overflow: 'hidden',
        }}
      >
        {text}
      </div>
      <style>{`@keyframes smartOvMasked { from { opacity: 0; transform: scale(1.08); } to { opacity: 0.9; transform: scale(1); } }`}</style>
    </>
  );
};

const StatCard: React.FC<{
  text: string; subtext?: string; brandColor: string; onBrand: string; family: string;
}> = ({ text, subtext, brandColor, onBrand, family }) => {
  const m = (text || '').match(/^\s*([\d.,]+\s*[%xX+]?|\d+\s*\w+)\s*(.*)$/);
  const big = m ? m[1] : (text || '').split(' ')[0];
  const small = m ? m[2] : (text || '').split(' ').slice(1).join(' ');
  return (
    <div
      className="rounded-2xl text-center"
      style={{
        fontFamily: family,
        background: hexA(brandColor, 0.92),
        color: onBrand,
        padding: '22px 30px',
        minWidth: 180,
        maxWidth: 'min(420px, 86%)',
        boxShadow: `0 18px 50px ${hexA(brandColor, 0.45)}, 0 1px 0 rgba(255,255,255,0.18) inset`,
        backdropFilter: 'blur(10px)',
        animation: 'smartOvStat 0.6s cubic-bezier(.2,1,.36,1)',
      }}
    >
      <div style={{ fontSize: 'clamp(32px, 6cqw, 78px)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' }}>{big}</div>
      {small && (
        <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.92, marginTop: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{small}</div>
      )}
      {subtext && (
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{subtext}</div>
      )}
      <style>{`@keyframes smartOvStat { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
    </div>
  );
};

const SideNotes: React.FC<{
  text?: string; items: string[]; brandColor: string; onBrand: string; family: string; numbered?: boolean;
}> = ({ text, items, brandColor, onBrand, family, numbered }) => (
  <div
    className="rounded-3xl"
    style={{
      fontFamily: family,
      background: `linear-gradient(160deg, ${hexA('#0a0a0a', 0.82)}, ${hexA(brandColor, 0.18)})`,
      backdropFilter: 'blur(14px) saturate(140%)',
      WebkitBackdropFilter: 'blur(14px) saturate(140%)',
      padding: '16px 18px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      borderLeft: `4px solid ${brandColor}`,
      boxShadow: `0 18px 50px rgba(0,0,0,0.55), 0 0 0 1px ${hexA('#ffffff', 0.06)}`,
      overflow: 'hidden',
    }}
  >
    {text && (
      <div style={{ color: '#fff', fontSize: 'clamp(10px, 1.6cqw, 13px)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.92, marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </div>
    )}
    <div className="flex flex-col gap-2.5">
      {items.slice(0, 5).map((it, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 opacity-0"
          style={{ animation: `smartOvNote 0.45s cubic-bezier(.2,1,.36,1) ${0.12 + i * 0.12}s forwards`, minWidth: 0 }}
        >
          <span
            className="inline-flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 22, height: 22,
              background: brandColor, color: onBrand,
              fontSize: 12, fontWeight: 900,
              boxShadow: `0 4px 12px ${hexA(brandColor, 0.5)}`,
            }}
          >
            {numbered ? i + 1 : '✓'}
          </span>
          <span style={{ color: '#fff', fontSize: 'clamp(12px, 2cqw, 16px)', fontWeight: 600, lineHeight: 1.25, overflowWrap: 'break-word', minWidth: 0, flex: 1 }}>{it}</span>
        </div>
      ))}
    </div>
    <style>{`@keyframes smartOvNote { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }`}</style>
  </div>
);

const QuotePop: React.FC<{
  text: string; subtext?: string; brandColor: string; family: string;
}> = ({ text, subtext, brandColor, family }) => (
  <div
    className="rounded-2xl text-center"
    style={{
      fontFamily: family,
      background: hexA('#0a0a0a', 0.78),
      backdropFilter: 'blur(10px)',
      padding: '22px 30px',
      maxWidth: 520,
      borderTop: `3px solid ${brandColor}`,
      boxShadow: `0 12px 40px rgba(0,0,0,0.5)`,
      animation: 'smartOvQuote 0.6s cubic-bezier(.2,1,.36,1)',
    }}
  >
    <div style={{ color: brandColor, fontSize: 44, lineHeight: 0.6, marginBottom: 8, fontWeight: 900 }}>"</div>
    <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.35 }}>{text}</div>
    {subtext && (
      <div style={{ color: '#fff', fontSize: 12, opacity: 0.75, marginTop: 12, letterSpacing: '0.05em' }}>— {subtext}</div>
    )}
    <style>{`@keyframes smartOvQuote { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
  </div>
);

const CtaLockup: React.FC<{
  text: string; subtext?: string; brandColor: string; onBrand: string; family: string; fullCoverage?: boolean;
}> = ({ text, subtext, brandColor, onBrand, family, fullCoverage }) => (
  <>
    {/* Soft full-frame dim ONLY for end-frame CTAs so the underlying video doesn't compete */}
    {fullCoverage && (
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
    )}
    <div
      className="flex flex-col items-center"
      style={{
        fontFamily: family,
        animation: 'smartOvCta 0.6s cubic-bezier(.2,1,.36,1)',
        gap: 14,
        maxWidth: '92%',
        position: 'relative',
      }}
    >
      <div
        className="rounded-2xl"
        style={{
          // Solid black backing so headline pops on any background
          background: 'rgba(0,0,0,0.82)',
          color: '#ffffff',
          padding: '18px 28px',
          maxWidth: '100%',
          fontSize: 'clamp(22px, 6cqw, 56px)',
          fontWeight: 900,
          letterSpacing: '0.005em',
          lineHeight: 1.08,
          textAlign: 'center',
          whiteSpace: 'normal',           // wrap, never clip
          wordBreak: 'break-word',
          // Brand-colour border + glow for personality
          border: `2.5px solid ${brandColor}`,
          boxShadow: `0 0 0 1.5px ${hexA('#ffffff', 0.06)} inset, 0 24px 60px ${hexA(brandColor, 0.55)}, 0 0 40px ${hexA(brandColor, 0.35)}`,
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}
      >
        {text}
      </div>
      {subtext && (
        <div
          className="rounded-lg"
          style={{
            color: onBrand,
            background: brandColor,
            padding: '8px 18px',
            fontSize: 'clamp(14px, 3cqw, 22px)',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textShadow: '0 1px 0 rgba(0,0,0,0.18)',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            maxWidth: '100%',
            textAlign: 'center',
            boxShadow: `0 8px 24px ${hexA(brandColor, 0.4)}`,
          }}
        >
          {subtext}
        </div>
      )}
      <style>{`@keyframes smartOvCta { from { opacity: 0; transform: translateY(20px) scale(0.94); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </div>
  </>
);

const LowerThirdPro: React.FC<{
  text: string; subtext?: string; brandColor: string; family: string;
}> = ({ text, subtext, brandColor, family }) => (
  <div
    className="flex items-center gap-4 rounded-xl"
    style={{
      fontFamily: family,
      background: hexA('#0a0a0a', 0.78),
      backdropFilter: 'blur(10px)',
      padding: '14px 22px',
      minWidth: 260,
      boxShadow: `0 12px 40px rgba(0,0,0,0.5)`,
      animation: 'smartOvLT 0.5s cubic-bezier(.2,1,.36,1)',
    }}
  >
    <div className="rounded-full" style={{ width: 6, height: 44, background: brandColor }} />
    <div>
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{text}</div>
      {subtext && (
        <div style={{ color: '#fff', fontSize: 12, opacity: 0.75, marginTop: 2, letterSpacing: '0.04em' }}>{subtext}</div>
      )}
    </div>
    <style>{`@keyframes smartOvLT { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }`}</style>
  </div>
);

const FloatingNote: React.FC<{
  text: string; subtext?: string; brandColor: string; onBrand: string; family: string;
}> = ({ text, subtext, brandColor, onBrand, family }) => (
  <div
    className="rounded-xl"
    style={{
      fontFamily: family,
      background: '#fffbe8',
      color: '#1a1a1a',
      padding: '14px 18px',
      maxWidth: 280,
      boxShadow: `0 12px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(0,0,0,0.05)`,
      borderLeft: `4px solid ${brandColor}`,
      animation: 'smartOvNoteFloat 0.55s cubic-bezier(.2,1,.36,1)',
    }}
  >
    <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>{text}</div>
    {subtext && (
      <div style={{ fontSize: 12, marginTop: 4, color: brandColor, fontWeight: 700 }}>{subtext}</div>
    )}
    <style>{`@keyframes smartOvNoteFloat { from { opacity: 0; transform: translateY(-8px) rotate(-2deg) scale(0.96); } to { opacity: 1; transform: translateY(0) rotate(-2deg) scale(1); } }`}</style>
  </div>
);

const BulletStack: React.FC<{
  text?: string; items: string[]; brandColor: string; onBrand: string; family: string;
}> = ({ text, items, brandColor, onBrand, family }) => (
  <div className="text-left" style={{ fontFamily: family, maxWidth: 'min(720px, 90%)', width: '100%' }}>
    {text && (
      <div style={{ color: '#fff', fontSize: 'clamp(18px, 3.6cqw, 36px)', fontWeight: 900, marginBottom: 18, letterSpacing: '-0.01em', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
        {text}
      </div>
    )}
    <div className="flex flex-col gap-3">
      {items.slice(0, 6).map((it, i) => (
        <div
          key={i}
          className="flex items-center gap-4 opacity-0 rounded-2xl px-5 py-3"
          style={{
            background: hexA('#000000', 0.55),
            backdropFilter: 'blur(8px)',
            border: `1px solid ${hexA(brandColor, 0.4)}`,
            animation: `smartOvBullet 0.5s cubic-bezier(.2,1,.36,1) ${0.18 + i * 0.18}s forwards`,
          }}
        >
          <span
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 38, height: 38, background: brandColor, color: onBrand, fontWeight: 900, fontSize: 18 }}
          >
            {i + 1}
          </span>
          <span style={{ color: '#fff', fontSize: 'clamp(14px, 2.4cqw, 22px)', fontWeight: 700, lineHeight: 1.25 }}>{it}</span>
        </div>
      ))}
    </div>
    <style>{`@keyframes smartOvBullet { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export const SmartOverlay: React.FC<SmartOverlayProps> = ({
  type,
  text,
  items,
  brandColor,
  brandTextColor,
  brandFont,
  subtext,
  style = 'glass',
  scale = 2,
  fullCoverage,
  treatment,
  placement,
}) => {
  const family = fontStack(brandFont);
  const onBrand = brandTextColor || readableOn(brandColor);

  // ─── COMMERCIAL DIRECTOR PATH ───────────────────────────────────────
  if (treatment) {
    const wrapperStyle: React.CSSProperties = placement
      ? placementStyle(placement)
      : { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };

    let body: React.ReactNode = null;
    switch (treatment) {
      case 'kinetic_headline':
        body = <KineticHeadline text={text} subtext={subtext} brandColor={brandColor} onBrand={onBrand} family={family} />;
        break;
      case 'masked_typography':
        body = <MaskedTypography text={text} brandColor={brandColor} family={family} />;
        break;
      case 'stat_card':
        body = <StatCard text={text} subtext={subtext} brandColor={brandColor} onBrand={onBrand} family={family} />;
        break;
      case 'side_notes':
        body = <SideNotes text={text} items={items || []} brandColor={brandColor} onBrand={onBrand} family={family} />;
        break;
      case 'bullet_stack':
        body = <BulletStack text={text} items={items || []} brandColor={brandColor} onBrand={onBrand} family={family} />;
        break;
      case 'quote_pop':
        body = <QuotePop text={text} subtext={subtext} brandColor={brandColor} family={family} />;
        break;
      case 'cta_lockup':
        body = <CtaLockup text={text} subtext={subtext} brandColor={brandColor} onBrand={onBrand} family={family} fullCoverage={fullCoverage || placement === 'center_takeover'} />;
        break;
      case 'lower_third_pro':
        body = <LowerThirdPro text={text} subtext={subtext} brandColor={brandColor} family={family} />;
        break;
      case 'floating_note':
        body = <FloatingNote text={text} subtext={subtext} brandColor={brandColor} onBrand={onBrand} family={family} />;
        break;
    }
    return <div style={wrapperStyle}>{body}</div>;
  }

  // ─── LEGACY PATH (unchanged behaviour for back-compat) ──────────────
  const surfaces: Record<string, React.CSSProperties> = {
    glass: {
      background: hexA(brandColor, 0.85),
      color: onBrand,
      backdropFilter: 'blur(12px) saturate(140%)',
      WebkitBackdropFilter: 'blur(12px) saturate(140%)',
      boxShadow: `0 10px 40px ${hexA(brandColor, 0.35)}, 0 1px 0 ${hexA('#ffffff', 0.18)} inset`,
      border: `1px solid ${hexA('#ffffff', 0.18)}`,
    },
    bold: {
      background: brandColor,
      color: onBrand,
      boxShadow: `0 12px 40px ${hexA(brandColor, 0.55)}, 0 0 0 2px ${hexA('#ffffff', 0.08)} inset`,
    },
    minimal: {
      background: hexA('#000000', 0.55),
      color: '#ffffff',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderLeft: `4px solid ${brandColor}`,
    },
    neon: {
      background: hexA('#0b0b12', 0.72),
      color: '#ffffff',
      boxShadow: `0 0 0 1.5px ${brandColor}, 0 0 24px ${brandColor}, 0 0 60px ${hexA(brandColor, 0.5)}`,
    },
    broadcast: {
      background: hexA('#0a0a0a', 0.85),
      color: '#ffffff',
      borderLeft: `6px solid ${brandColor}`,
    },
  };
  const surface = surfaces[style] || surfaces.glass;

  // Full-coverage / take-over scenes
  if (fullCoverage || scale >= 5) {
    const list = (items && items.length > 0 ? items : []).slice(0, 6);
    const isNumbered = type === 'numbered_list';
    const isGrid = type === 'feature_grid';
    const isComparison = type === 'comparison';

    return (
      <div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-8 px-[8%] py-[6%]"
        style={{
          fontFamily: family,
          background: `radial-gradient(ellipse at 50% 30%, ${hexA(brandColor, 0.35)}, ${hexA('#000000', 0.95)} 70%)`,
          color: '#ffffff',
        }}
      >
        <div className="text-center w-full">
          <div
            className="inline-block px-6 py-2 rounded-full mb-4"
            style={{ background: brandColor, color: onBrand, fontWeight: 800, letterSpacing: '0.05em' }}
          >
            {(text || 'Featured').toUpperCase()}
          </div>
          {subtext && (
            <div className="text-white/70 text-lg md:text-2xl font-medium">{subtext}</div>
          )}
        </div>

        {list.length > 0 && (
          <div
            className={cn(
              'w-full max-w-5xl',
              isGrid ? 'grid grid-cols-2 gap-5' : 'flex flex-col gap-4',
              isComparison && 'grid grid-cols-2 gap-5'
            )}
          >
            {list.map((item, i) => (
              <div
                key={i}
                className="opacity-0"
                style={{ animation: `smartOvSlide 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${0.18 + i * 0.13}s forwards` }}
              >
                <div
                  className="flex items-center gap-4 px-6 py-4 rounded-2xl"
                  style={{
                    background: hexA('#ffffff', 0.06),
                    border: `1px solid ${hexA(brandColor, 0.5)}`,
                    boxShadow: `0 8px 28px ${hexA('#000000', 0.4)}`,
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full text-lg md:text-2xl font-extrabold flex-shrink-0"
                    style={{ width: 48, height: 48, background: brandColor, color: onBrand }}
                  >
                    {isNumbered ? i + 1 : '✓'}
                  </div>
                  <div className="text-white text-base md:text-2xl font-semibold leading-snug" style={{ fontFamily: family }}>
                    {item}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!list.length && type === 'title_card' && (
          <div className="text-white text-3xl md:text-5xl font-extrabold text-center">{text}</div>
        )}

        <style>{`@keyframes smartOvSlide { from { transform: translateY(28px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      </div>
    );
  }

  // Compact overlays (legacy)
  const sizeClass =
    scale <= 1 ? 'text-xs md:text-sm px-3 py-1.5' :
    scale === 2 ? 'text-sm md:text-base px-4 py-2.5' :
    scale === 3 ? 'text-base md:text-xl px-6 py-3' :
    'text-lg md:text-2xl px-7 py-4';

  if (type === 'cta_button' || /shop now|buy|order|get yours|learn more/i.test(text || '')) {
    return (
      <div
        className="rounded-full inline-flex flex-col items-center justify-center text-center"
        style={{ ...surface, fontFamily: family, padding: scale >= 3 ? '14px 32px' : '10px 24px', minWidth: scale >= 3 ? 200 : 160 }}
      >
        <div style={{ fontSize: scale >= 3 ? 22 : 16, fontWeight: 800, lineHeight: 1.1, letterSpacing: '0.01em' }}>{text}</div>
        {subtext && (
          <div style={{ fontSize: scale >= 3 ? 13 : 11, opacity: 0.85, marginTop: 2 }}>{subtext}</div>
        )}
      </div>
    );
  }

  if (type === 'stat_callout') {
    const m = text.match(/^\s*([\d.,]+\s*[%xX+]?|\d+\s*\w+)\s+(.*)$/);
    const big = m ? m[1] : text.split(' ')[0];
    const small = m ? m[2] : text.split(' ').slice(1).join(' ');
    return (
      <div className="rounded-2xl text-center" style={{ ...surface, fontFamily: family, padding: '14px 22px', minWidth: 160 }}>
        <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>{big}</div>
        {small && (
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9, marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{small}</div>
        )}
      </div>
    );
  }

  if (type === 'quote_pop') {
    return (
      <div className="rounded-2xl text-center max-w-md" style={{ ...surface, fontFamily: family, padding: '18px 26px' }}>
        <div style={{ fontSize: 32, lineHeight: 0, marginBottom: 8, opacity: 0.7 }}>"</div>
        <div style={{ fontSize: 18, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.3 }}>{text}</div>
        {subtext && (
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>— {subtext}</div>
        )}
      </div>
    );
  }

  if (type === 'benefit_list' || type === 'numbered_list') {
    const list = (items || text.split(/[•|·\n,]/).map(s => s.trim()).filter(Boolean)).slice(0, 4);
    const numbered = type === 'numbered_list';
    return (
      <div className="rounded-2xl" style={{ ...surface, fontFamily: family, padding: '14px 18px', minWidth: 220 }}>
        {text && (
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 8 }}>{text}</div>
        )}
        <div className="flex flex-col gap-1.5">
          {list.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span
                className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-[11px] font-extrabold"
                style={{ width: 20, height: 20, background: brandColor, color: onBrand }}
              >
                {numbered ? i + 1 : '✓'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'lower_third') {
    return (
      <div className="rounded-xl flex items-center gap-3" style={{ ...surface, fontFamily: family, padding: '10px 18px', minWidth: 220 }}>
        <div className="rounded-full flex-shrink-0" style={{ width: 8, height: 32, background: brandColor }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>{text}</div>
          {subtext && (
            <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 500 }}>{subtext}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-full whitespace-nowrap font-extrabold', sizeClass)}
      style={{ ...surface, fontFamily: family, letterSpacing: '0.01em' }}
    >
      {text}
    </div>
  );
};
