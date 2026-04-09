

# Fix: UI Jank When Typing in Chatcut Project Name

## Problem

Every keystroke in the project name input triggers a full re-render of the entire `ChatcutAI` component (~1855 lines). This causes:
1. **Music bar jumps** — the music sync effect re-evaluates on every render
2. **Sidebar jumps and logo blinks** — the `Layout` component re-renders unnecessarily
3. **General visual instability** during text input

## Root Cause

`ChatcutAI` is a single monolithic component with ~30+ state variables. Changing `draftName` causes the entire tree (including Layout, Navigation, timeline, video player) to re-render. The `transition-all` class on some nav items amplifies the visual flash.

## Plan

### 1. Debounce the draft name input (src/pages/ChatcutAI.tsx)

Use an uncontrolled input with a local ref or a separate small component for the project name input. This prevents `setDraftName` from firing on every keystroke, only updating on blur or after a debounce delay (~500ms). This alone fixes all three symptoms.

**Approach**: Create a tiny `ProjectNameInput` component that manages its own local state and only calls `setDraftName` on blur. This isolates re-renders to just the input.

### 2. Fix Navigation transition flicker (src/components/Navigation.tsx)

Change `transition-all` (line 147-148) to `transition-colors` on nav items. `transition-all` animates every CSS property change (including layout reflows during parent re-render), causing the logo/sidebar to visually "jump."

### 3. Stabilize Layout margin transition (src/components/Layout.tsx)

The Layout already uses `transition-[margin]` which is correct. No changes needed here.

## Summary

| File | Change |
|------|--------|
| `src/pages/ChatcutAI.tsx` | Extract `ProjectNameInput` as isolated component with local state, sync on blur |
| `src/components/Navigation.tsx` | Replace `transition-all` with `transition-colors` on nav link items |

This is a minimal, targeted fix — two small changes that eliminate the jank without restructuring the whole component.

