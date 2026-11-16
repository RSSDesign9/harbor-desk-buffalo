import { useState, type ReactNode } from 'react';
import { IconButton } from '../../ui/Button.tsx';
import { SegmentedControl } from '../../ui/Tabs.tsx';
import { requestView } from '../../scene/viewRequests.ts';
import type { Preset } from '../../scene/camera.ts';
import { setPrefs, usePrefs, useReducedMotion } from '../../app/prefs.ts';
import { useAnnounce } from '../../ui/Announcer.tsx';

/**
 * View presets, reset and pause motion. Moving the camera never changes the selection.
 * Map (T29) replaced the old Top-down preset: a tilted, long-lens view of all 126 berths with status plates.
 * While the map is up its legend sits at the top of this panel.
 */
export function ViewControls({ legend = null }: { legend?: ReactNode }) {
  // The opening shot ends at Dock B (T24), so that is the resting preset and what Reset returns to.
  const [preset, setPreset] = useState<Preset>('dock');
  const prefs = usePrefs();
  const reduced = useReducedMotion();
  const announce = useAnnounce();
  const go = (p: Preset) => {
    setPreset(p);
    requestView(p);
  };
  const still = prefs.motionPaused || reduced;
  return (
    <div className="view-controls panel" role="group" aria-label="Camera view" data-legend={legend ? 'shown' : undefined}>
      {legend}
      <SegmentedControl
        label="Camera preset"
        value={preset}
        onChange={go}
        options={[
          { id: 'overview', label: 'Overview' },
          { id: 'dock', label: 'Dock B' },
          { id: 'map', label: 'Map' },
        ]}
      />
      <IconButton label="Reset view" icon="refresh" onClick={() => go('dock')} />
      <IconButton
        label={still ? 'Resume motion' : 'Pause motion'}
        icon={still ? 'play' : 'pause'}
        className="icon-btn motion-toggle"
        aria-pressed={prefs.motionPaused}
        disabled={reduced}
        title={reduced ? 'Reduced motion is on in your system settings' : undefined}
        onClick={() => {
          setPrefs({ motionPaused: !prefs.motionPaused });
          announce(prefs.motionPaused ? 'Motion resumed.' : 'Motion paused.');
        }}
      />
    </div>
  );
}
