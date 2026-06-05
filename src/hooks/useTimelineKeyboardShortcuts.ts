import { useEffect, useCallback } from 'react';

export interface TimelineKeyboardShortcutsConfig {
  // Playback
  onPlayPause?: () => void;
  onStepForward?: () => void;
  onStepBackward?: () => void;
  onJumpToStart?: () => void;
  onJumpToEnd?: () => void;

  // Editing
  onUndo?: () => void;
  onRedo?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;

  // Tools
  onToggleRazor?: () => void;
  onToggleSelection?: () => void;
  onSplitAtPlayhead?: () => void;

  // Zoom
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitToWindow?: () => void;
  onCenterPlayhead?: () => void;

  // Markers
  onSetInPoint?: () => void;
  onSetOutPoint?: () => void;

  // Nudge
  onNudgeLeft?: () => void;
  onNudgeRight?: () => void;
  onNudgeUp?: () => void;
  onNudgeDown?: () => void;

  // Save
  onSave?: () => void;

  // Disabled when editing text inputs
  disabled?: boolean;
}

/**
 * useTimelineKeyboardShortcuts
 * ----------------------------
 * Professional keyboard shortcuts for video editing.
 * Follows industry standards (Adobe Premiere, Final Cut Pro, DaVinci Resolve).
 * 
 * Shortcuts:
 * - Space: Play/Pause
 * - J/K/L: Shuttle (rewind/pause/forward)
 * - Left/Right Arrow: Step frame
 * - I/O: Set in/out points
 * - C: Razor/Cut tool
 * - V: Selection tool
 * - X: Split at playhead
 * - Delete/Backspace: Remove selected
 * - Cmd/Ctrl+Z: Undo
 * - Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y: Redo
 * - Cmd/Ctrl+C: Copy
 * - Cmd/Ctrl+V: Paste
 * - Cmd/Ctrl+X: Cut
 * - Cmd/Ctrl+A: Select all
 * - Cmd/Ctrl+S: Save
 * - Cmd/Ctrl + Plus/Minus: Zoom
 * - Shift+Z: Fit to window
 * - F: Center playhead
 * - Arrow keys (with selection): Nudge 1px
 * - Shift+Arrow keys: Nudge 10px
 */
export const useTimelineKeyboardShortcuts = (config: TimelineKeyboardShortcutsConfig) => {
  const {
    onPlayPause,
    onStepForward,
    onStepBackward,
    onJumpToStart,
    onJumpToEnd,
    onUndo,
    onRedo,
    onCut,
    onCopy,
    onPaste,
    onDelete,
    onSelectAll,
    onToggleRazor,
    onToggleSelection,
    onSplitAtPlayhead,
    onZoomIn,
    onZoomOut,
    onFitToWindow,
    onCenterPlayhead,
    onSetInPoint,
    onSetOutPoint,
    onNudgeLeft,
    onNudgeRight,
    onNudgeUp,
    onNudgeDown,
    onSave,
    disabled = false,
  } = config;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (disabled) return;
    
    const target = e.target as HTMLElement;
    const isEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                     target.isContentEditable;

    // Some shortcuts work even when editing
    const metaOrCtrl = e.metaKey || e.ctrlKey;

    // Save (works everywhere)
    if (metaOrCtrl && e.key === 's') {
      e.preventDefault();
      onSave?.();
      return;
    }

    // Don't process other shortcuts when editing
    if (isEditing && !metaOrCtrl) return;

    // Undo/Redo (works everywhere)
    if (metaOrCtrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      onUndo?.();
      return;
    }

    if ((metaOrCtrl && e.key === 'z' && e.shiftKey) || (metaOrCtrl && e.key === 'y')) {
      e.preventDefault();
      onRedo?.();
      return;
    }

    // Cut/Copy/Paste (works everywhere)
    if (metaOrCtrl && e.key === 'x') {
      e.preventDefault();
      onCut?.();
      return;
    }

    if (metaOrCtrl && e.key === 'c') {
      e.preventDefault();
      onCopy?.();
      return;
    }

    if (metaOrCtrl && e.key === 'v') {
      e.preventDefault();
      onPaste?.();
      return;
    }

    if (metaOrCtrl && e.key === 'a') {
      e.preventDefault();
      onSelectAll?.();
      return;
    }

    // Zoom shortcuts
    if (metaOrCtrl && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      onZoomIn?.();
      return;
    }

    if (metaOrCtrl && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      onZoomOut?.();
      return;
    }

    // Fit to window
    if (e.shiftKey && e.key === 'Z') {
      e.preventDefault();
      onFitToWindow?.();
      return;
    }

    // Don't process playback/tool shortcuts when editing
    if (isEditing) return;

    // Playback
    if (e.key === ' ') {
      e.preventDefault();
      onPlayPause?.();
      return;
    }

    if (e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      onPlayPause?.();
      return;
    }

    if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      onStepForward?.();
      return;
    }

    if (e.key === 'j' || e.key === 'J') {
      e.preventDefault();
      onStepBackward?.();
      return;
    }

    // Arrow keys for frame stepping (no modifiers) or nudging (with selection)
    if (e.key === 'ArrowRight' && !e.shiftKey && !metaOrCtrl) {
      e.preventDefault();
      // If something is selected, nudge right, otherwise step forward
      if (onNudgeRight) {
        onNudgeRight();
      } else {
        onStepForward?.();
      }
      return;
    }

    if (e.key === 'ArrowLeft' && !e.shiftKey && !metaOrCtrl) {
      e.preventDefault();
      // If something is selected, nudge left, otherwise step backward
      if (onNudgeLeft) {
        onNudgeLeft();
      } else {
        onStepBackward?.();
      }
      return;
    }

    // Shift + Arrow for bigger nudges
    if (e.key === 'ArrowRight' && e.shiftKey && !metaOrCtrl) {
      e.preventDefault();
      // Nudge right 10px (call nudge 10 times or have a separate handler)
      for (let i = 0; i < 10; i++) {
        onNudgeRight?.();
      }
      return;
    }

    if (e.key === 'ArrowLeft' && e.shiftKey && !metaOrCtrl) {
      e.preventDefault();
      for (let i = 0; i < 10; i++) {
        onNudgeLeft?.();
      }
      return;
    }

    if (e.key === 'ArrowUp' && !metaOrCtrl) {
      e.preventDefault();
      const multiplier = e.shiftKey ? 10 : 1;
      for (let i = 0; i < multiplier; i++) {
        onNudgeUp?.();
      }
      return;
    }

    if (e.key === 'ArrowDown' && !metaOrCtrl) {
      e.preventDefault();
      const multiplier = e.shiftKey ? 10 : 1;
      for (let i = 0; i < multiplier; i++) {
        onNudgeDown?.();
      }
      return;
    }

    // Jump to start/end
    if (e.key === 'Home') {
      e.preventDefault();
      onJumpToStart?.();
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      onJumpToEnd?.();
      return;
    }

    // Tools
    if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      onToggleRazor?.();
      return;
    }

    if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      onToggleSelection?.();
      return;
    }

    if (e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      onSplitAtPlayhead?.();
      return;
    }

    // Delete
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete?.();
      return;
    }

    // Markers
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      onSetInPoint?.();
      return;
    }

    if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      onSetOutPoint?.();
      return;
    }

    // Center playhead
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      onCenterPlayhead?.();
      return;
    }
  }, [
    disabled,
    onPlayPause,
    onStepForward,
    onStepBackward,
    onJumpToStart,
    onJumpToEnd,
    onUndo,
    onRedo,
    onCut,
    onCopy,
    onPaste,
    onDelete,
    onSelectAll,
    onToggleRazor,
    onToggleSelection,
    onSplitAtPlayhead,
    onZoomIn,
    onZoomOut,
    onFitToWindow,
    onCenterPlayhead,
    onSetInPoint,
    onSetOutPoint,
    onNudgeLeft,
    onNudgeRight,
    onNudgeUp,
    onNudgeDown,
    onSave,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return null;
};
