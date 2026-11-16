/**
 * Display options (T17): chart/light theme, solid panels, pause motion, and plan vs 3D map on small screens.
 * A disclosure button with a non-modal popover: Escape or a click outside closes it and returns focus to the
 * button. These are UI preferences only; they never change records or workflow state.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { LayoutMode } from '../../app/layout.ts';
import { setPrefs, usePrefs, useReducedMotion } from '../../app/prefs.ts';
import { Checkbox } from '../../ui/Fields.tsx';
import { useAnnounce } from '../../ui/Announcer.tsx';

export function DisplayMenu({ canUse3d, use3dOnMobile, mode }: { canUse3d: boolean; use3dOnMobile: boolean; mode: LayoutMode }) {
  const prefs = usePrefs();
  const reduced = useReducedMotion();
  const announce = useAnnounce();
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <span className="display-menu">
      <button ref={button} type="button" className="btn btn-ghost display-button" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen(!open)}>
        Display
      </button>
      <div ref={panel} id={`${id}-panel`} className="display-panel panel" role="group" aria-label="Display options" hidden={!open}>
        <fieldset className="display-group">
          <legend className="label">Theme</legend>
          <label className="radio">
            <input type="radio" name={`${id}-theme`} checked={prefs.theme === 'dark'} onChange={() => setPrefs({ theme: 'dark' })} />
            Marine (dark)
          </label>
          <label className="radio">
            <input type="radio" name={`${id}-theme`} checked={prefs.theme === 'light'} onChange={() => setPrefs({ theme: 'light' })} />
            Chart (light, high contrast)
          </label>
        </fieldset>
        <Checkbox label="Solid panels" description="No see-through glass behind text." checked={prefs.solidPanels} onChange={(e) => setPrefs({ solidPanels: e.currentTarget.checked })} />
        <Checkbox
          label="Pause motion"
          description={reduced ? 'Your system asks for reduced motion, so water is already still and the camera cuts.' : 'Stops the moving water. Everything else keeps working.'}
          checked={prefs.motionPaused}
          onChange={(e) => {
            setPrefs({ motionPaused: e.currentTarget.checked });
            announce(e.currentTarget.checked ? 'Motion paused.' : 'Motion resumed.');
          }}
        />
        {mode === 'mobile' && canUse3d ? (
          <Checkbox
            label="Use 3D map"
            description="Heavier on small devices. The flat plan shows the same records."
            checked={use3dOnMobile}
            onChange={(e) => setPrefs({ mobileView: e.currentTarget.checked ? '3d' : 'plan' })}
          />
        ) : null}
      </div>
    </span>
  );
}
