

## Plan: Auto-save voice changes and show persistent save indicator

### Problem
The WaveSpeed voice generation already saves to the database, but there's no visible "auto-saved" confirmation. The save banner only appears for text field changes, so users don't know their voice is persisted.

### Changes — `src/components/ai-twin/TwinDetailPanel.tsx`

1. **Add an "auto-saved" indicator after WaveSpeed voice generation**
   - After the WaveSpeed voice badge ("WaveSpeed Voice Ready"), add a small text line: "✓ Voice changes are auto-saved"
   - This appears whenever `voiceCloningKey` is set and engine is `wavespeed`

2. **Add auto-saved indicator in TwinSpeaker section**
   - After the TwinSpeaker component, show a subtle "Voice engine and settings are auto-saved" note so users know closing the dialog won't lose their voice config

3. **Make the Save All banner always visible (not conditional)**
   - Show the save bar at the top always, but with two states:
     - When `hasUnsavedChanges` is true: "You have unsaved changes" + enabled Save button
     - When false: "✓ All changes saved" in muted style (no button or disabled button)
   - This gives users persistent confirmation that their work is saved

### Files
- **`src/components/ai-twin/TwinDetailPanel.tsx`** — all changes in this single file

