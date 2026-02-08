

## Plan: Hide Narrator Voice Selection When Custom Audio is Uploaded

### Overview
When you select "Upload Audio" mode in the Lip Sync section, the narrator voice selection cards above should be hidden since you're using your own audio file instead of AI-generated voices.

### Current UI Structure
```
┌─────────────────────────────────────┐
│ Voice Selection (VoiceSelector)     │  ← Show/hide based on mode
│ OR AI Twin Cloned Voice Active      │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ Lip Sync Mode                       │
│   ├─ AI Twin Selector               │
│   ├─ Model Selection                │
│   └─ Voiceover Source               │
│       ├─ AI Voice (TTS)             │
│       └─ Upload Audio ← When selected, hide above
└─────────────────────────────────────┘
```

### Changes Required

**File: `src/pages/Reels.tsx`**

**Line ~2931-2966**: Wrap the voice selection section in a conditional that checks if custom audio mode is NOT 'upload':

**From:**
```tsx
{/* Voice Selection - Always Visible */}
{selectedTwinId && aiTwins.find(t => t.id === selectedTwinId)?.voice_cloning_key ? (
  <Card className="bg-card border-border">
    {/* AI Twin Cloned Voice Active card */}
  </Card>
) : (
  <VoiceSelector 
    selectedVoice={selectedVoice}
    onVoiceSelect={setSelectedVoice}
    disabled={isGenerating}
  />
)}
```

**To:**
```tsx
{/* Voice Selection - Hidden when using uploaded audio */}
{customAudioMode !== 'upload' && (
  <>
    {selectedTwinId && aiTwins.find(t => t.id === selectedTwinId)?.voice_cloning_key ? (
      <Card className="bg-card border-border">
        {/* AI Twin Cloned Voice Active card */}
      </Card>
    ) : (
      <VoiceSelector 
        selectedVoice={selectedVoice}
        onVoiceSelect={setSelectedVoice}
        disabled={isGenerating}
      />
    )}
  </>
)}
```

### Behavior
| Mode | Voice Selection UI |
|------|-------------------|
| `customAudioMode === 'tts'` | **Visible** - Shows VoiceSelector or AI Twin voice card |
| `customAudioMode === 'upload'` | **Hidden** - Your uploaded audio is the voiceover |

### Files to Modify
- `src/pages/Reels.tsx`: Add conditional wrapper around voice selection section (lines 2931-2966)

