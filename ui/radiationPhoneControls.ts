export type RadiationPhoneCommand = 'open' | 'close' | 'next-tab' | 'previous-tab' | 'toggle-feed';

export interface RadiationPhoneKeys {
  open: boolean;
  enabled: boolean;
  editable: boolean;
  interactive: boolean;
  otherDialog: boolean;
  repeat: boolean;
  modified: boolean;
}

/** Phone shortcuts never take arrows or letters from another dialog or an input. */
export function radiationPhoneCommand(key: string, context: RadiationPhoneKeys): RadiationPhoneCommand | null {
  if (!context.enabled || context.otherDialog || context.repeat || context.modified) return null;
  if (context.open && key === 'Escape') return 'close';
  if (context.editable) return null;
  if (!context.open) {
    return !context.interactive && (key.toLowerCase() === 'p' || key === 'ArrowUp') ? 'open' : null;
  }
  if (key.toLowerCase() === 'p' || key === 'ArrowDown') return 'close';
  if (key === 'ArrowRight') return 'next-tab';
  if (key === 'ArrowLeft') return 'previous-tab';
  if (key.toLowerCase() === 'y') return 'toggle-feed';
  return null;
}

/** Native modal dialogs may tab into browser chrome; keep this game's loop explicit. */
export function trapRadiationPhoneTab(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault' | 'stopImmediatePropagation'>, dialog: HTMLDialogElement): boolean {
  if (event.key !== 'Tab') return false;
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )).filter(element => !element.matches(':disabled, [tabindex="-1"]')
    && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0);
  const first = controls[0];
  const last = controls[controls.length - 1];
  const active = dialog.ownerDocument.activeElement;
  const outsideControls = !controls.includes(active as HTMLElement);
  if (outsideControls || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    (event.shiftKey ? last : first)?.focus();
    return true;
  }
  return false;
}
