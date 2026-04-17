
The user wants to restyle dark mode to a "Black Chrome" dark glassmorphism aesthetic with glossy highlights. This is a pure visual/theming change — design tokens in `src/index.css` plus possibly the `.glass` utility and a few surface treatments (cards, sidebar, buttons).

Scope: dark mode only. Light mode untouched.

## Plan: Black Chrome Dark Mode

**1. Update dark mode tokens in `src/index.css`**
- Background: deep near-black with subtle blue undertone (`220 15% 4%`)
- Card/popover: translucent dark (`220 15% 8%` at lower opacity feel via glass)
- Borders: brighter chrome edge (`220 15% 22%`) for that polished bevel look
- Primary: keep purple but add a chrome-silver accent variable for highlights
- Add `--chrome-highlight: 0 0% 100% / 0.08` for glossy top-edge gloss

**2. Replace the dark body background**
- Swap the flat gradient for a richer multi-stop radial + linear combo: deep black base with a faint purple glow top-left and a subtle chrome sheen.

**3. Upgrade the `.glass` utility (dark mode variant)**
- Darker translucent fill: `hsl(220 15% 8% / 0.6)`
- Stronger backdrop blur (24px)
- Inset top highlight: `inset 0 1px 0 hsl(0 0% 100% / 0.08)` for the glossy edge
- Subtle outer glow shadow

**4. Add glossy treatment to Cards in dark mode**
- Use `::before` pseudo for a subtle top gradient sheen
- Add `inset 0 1px 0 white/5%` for chrome bevel
- Slightly translucent background

**5. Sidebar (Navigation) glossy chrome**
- Apply glass + inset highlights so the sidebar feels like brushed black chrome
- Add a faint right-edge gradient

**6. Button refinement**
- Default buttons in dark mode get a subtle inset highlight + slightly darker base for glossy depth (no API change)

### Files to modify
- `src/index.css` — token updates, body background, `.glass` enhancement, add `.chrome-surface` utility, dark-mode card sheen
- `src/components/ui/card.tsx` — add `chrome-surface` class so cards get the gloss in dark mode
- `src/components/Navigation.tsx` — add `glass chrome-surface` to the sidebar `<nav>` (dark only via CSS)

No logic changes, no new dependencies. Light mode remains identical.
