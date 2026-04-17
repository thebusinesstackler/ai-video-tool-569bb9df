/**
 * SmartOverlay
 * ------------
 * DOM-rendered, brand-aware motion graphic for Chatcut AI.
 * Replaces the old "always generate a PNG" pipeline for most overlay types,
 * because a Nano-Banana button often:
 *  - has visible transparent-checkerboard artifacts
 *  - sits awkwardly over the video (random padding around the shape)
 *  - can't render multi-line lists / stats / numbered scenes well
 *
 * SmartOverlay renders crisp, animated, brand-coloured cards directly in React.
 * It supports multiple "intents" so Marco can pick the perfect graphic for the
 * script beat (stat callout, benefit list, quote pop, numbered list, full-screen
 * "ingredients" card, lower third, CTA button, etc).
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

export interface SmartOverlayProps {
  type: SmartOverlayType | string;
  /** Primary text (single line). For lists this is the "title". */
  text: string;
  /** Optional list of bullets / steps / features (for benefit_list, numbered_list, feature_grid, comparison). */
  items?: string[];
  /** Brand color (hex) used as the dominant fill / accent. */
  brandColor: string;
  /** Brand text color (hex) for text on the brand fill. */
  brandTextColor: string;
  /** Brand font name (CSS family). */
  brandFont?: string;
  /** Optional sub / kicker text under the headline (e.g. URL under "Shop Now"). */
  subtext?: string;
  /** Style preset (visual treatment). */
  style?: 'glass' | 'bold' | 'minimal' | 'neon' | 'broadcast';
  /** Scale 1-5; 5 = full screen take-over. */
  scale?: number;
  /** Whether to render with full-screen take-over layout (used for full_coverage scenes). */
  fullCoverage?: boolean;
}

/** Subtle helper — convert hex → rgba string. */
function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pick reasonable text color given the chosen surface. */
function readableOn(brandColor: string): string {
  const h = brandColor.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // YIQ luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#0a0a0a' : '#ffffff';
}

const fontStack = (font?: string) =>
  font
    ? `'${font}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
    : `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

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
}) => {
  const family = fontStack(brandFont);
  const onBrand = brandTextColor || readableOn(brandColor);

  // Surface treatments
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

  // === FULL-COVERAGE / FULL-SCREEN SCENES ====================================
  // Used when Marco wants a take-over scene that *replaces* the video for a few
  // seconds — e.g. "3 Reasons", "Ingredients", numbered bullet list, comparison.
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
        {/* Headline */}
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

        {/* List body */}
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
                style={{
                  animation: `smartOvSlide 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${0.18 + i * 0.13}s forwards`,
                }}
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
                    style={{
                      width: 48,
                      height: 48,
                      background: brandColor,
                      color: onBrand,
                    }}
                  >
                    {isNumbered ? i + 1 : '✓'}
                  </div>
                  <div
                    className="text-white text-base md:text-2xl font-semibold leading-snug"
                    style={{ fontFamily: family }}
                  >
                    {item}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA bottom */}
        {!list.length && type === 'title_card' && (
          <div className="text-white text-3xl md:text-5xl font-extrabold text-center">
            {text}
          </div>
        )}

        <style>{`
          @keyframes smartOvSlide {
            from { transform: translateY(28px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // === COMPACT OVERLAYS (sit ON TOP of the video) ============================
  const sizeClass =
    scale <= 1 ? 'text-xs md:text-sm px-3 py-1.5' :
    scale === 2 ? 'text-sm md:text-base px-4 py-2.5' :
    scale === 3 ? 'text-base md:text-xl px-6 py-3' :
    'text-lg md:text-2xl px-7 py-4';

  // CTA button — pill with optional URL underneath (multi-line via subtext)
  if (type === 'cta_button' || /shop now|buy|order|get yours|learn more/i.test(text || '')) {
    return (
      <div
        className="rounded-full inline-flex flex-col items-center justify-center text-center"
        style={{
          ...surface,
          fontFamily: family,
          padding: scale >= 3 ? '14px 32px' : '10px 24px',
          minWidth: scale >= 3 ? 200 : 160,
        }}
      >
        <div
          style={{
            fontSize: scale >= 3 ? 22 : 16,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '0.01em',
          }}
        >
          {text}
        </div>
        {subtext && (
          <div style={{ fontSize: scale >= 3 ? 13 : 11, opacity: 0.85, marginTop: 2 }}>
            {subtext}
          </div>
        )}
      </div>
    );
  }

  // Stat callout — large number + label underneath
  if (type === 'stat_callout') {
    // Try to split "97% absorption" → ["97%", "absorption"]
    const m = text.match(/^\s*([\d.,]+\s*[%xX+]?|\d+\s*\w+)\s+(.*)$/);
    const big = m ? m[1] : text.split(' ')[0];
    const small = m ? m[2] : text.split(' ').slice(1).join(' ');
    return (
      <div
        className="rounded-2xl text-center"
        style={{ ...surface, fontFamily: family, padding: '14px 22px', minWidth: 160 }}
      >
        <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {big}
        </div>
        {small && (
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9, marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {small}
          </div>
        )}
      </div>
    );
  }

  // Quote pop
  if (type === 'quote_pop') {
    return (
      <div
        className="rounded-2xl text-center max-w-md"
        style={{ ...surface, fontFamily: family, padding: '18px 26px' }}
      >
        <div style={{ fontSize: 32, lineHeight: 0, marginBottom: 8, opacity: 0.7 }}>"</div>
        <div style={{ fontSize: 18, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.3 }}>
          {text}
        </div>
        {subtext && (
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>— {subtext}</div>
        )}
      </div>
    );
  }

  // Benefit list (compact, sits on right side)
  if (type === 'benefit_list' || type === 'numbered_list') {
    const list = (items || text.split(/[•|·\n,]/).map(s => s.trim()).filter(Boolean)).slice(0, 4);
    const numbered = type === 'numbered_list';
    return (
      <div
        className="rounded-2xl"
        style={{ ...surface, fontFamily: family, padding: '14px 18px', minWidth: 220 }}
      >
        {text && (
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 8 }}>
            {text}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {list.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span
                className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-[11px] font-extrabold"
                style={{
                  width: 20, height: 20,
                  background: brandColor,
                  color: onBrand,
                }}
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

  // Lower third — slim filled bar bottom
  if (type === 'lower_third') {
    return (
      <div
        className="rounded-xl flex items-center gap-3"
        style={{ ...surface, fontFamily: family, padding: '10px 18px', minWidth: 220 }}
      >
        <div
          className="rounded-full flex-shrink-0"
          style={{ width: 8, height: 32, background: brandColor }}
        />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>{text}</div>
          {subtext && (
            <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 500 }}>{subtext}</div>
          )}
        </div>
      </div>
    );
  }

  // Default badge / chip / motion_graphic / animated_text (DOM render)
  return (
    <div
      className={cn('rounded-full whitespace-nowrap font-extrabold', sizeClass)}
      style={{
        ...surface,
        fontFamily: family,
        letterSpacing: '0.01em',
      }}
    >
      {text}
    </div>
  );
};
