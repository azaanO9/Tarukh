import assert from 'node:assert/strict';
import test from 'node:test';
import { radiationPhoneCommand, trapRadiationPhoneTab } from '../ui/radiationPhoneControls.ts';

const world = { open: false, enabled: true, editable: false, interactive: false, otherDialog: false, repeat: false, modified: false };

test('both world entry keys open the phone without becoming movement input', () => {
  for (const key of ['p', 'P', 'ArrowUp']) assert.equal(radiationPhoneCommand(key, world), 'open');
  assert.equal(radiationPhoneCommand('w', world), null);
});

test('phone supports close and navigation while buttons retain native activation', () => {
  const open = { ...world, open: true, interactive: true };
  for (const key of ['P', 'ArrowDown', 'Escape']) assert.equal(radiationPhoneCommand(key, open), 'close');
  assert.equal(radiationPhoneCommand('ArrowRight', open), 'next-tab');
  assert.equal(radiationPhoneCommand('ArrowLeft', open), 'previous-tab');
  assert.equal(radiationPhoneCommand('y', open), 'toggle-feed');
  assert.equal(radiationPhoneCommand('Enter', open), null);
  assert.equal(radiationPhoneCommand(' ', open), null);
});

test('sliders, text fields and Story activities own their keyboard events', () => {
  for (const key of ['p', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'y']) {
    assert.equal(radiationPhoneCommand(key, { ...world, editable: true }), null);
    assert.equal(radiationPhoneCommand(key, { ...world, open: true, editable: true }), null);
    assert.equal(radiationPhoneCommand(key, { ...world, otherDialog: true }), null);
  }
  assert.equal(radiationPhoneCommand('Escape', { ...world, open: true, otherDialog: true }), null);
});

test('pause, held shortcuts, modifiers and focused launch-unrelated controls do not open the phone', () => {
  for (const blocked of [{ enabled: false }, { repeat: true }, { modified: true }, { interactive: true }]) {
    assert.equal(radiationPhoneCommand('ArrowUp', { ...world, ...blocked }), null);
  }
});

function focusFixture() {
  const document = { activeElement: null };
  const control = (hidden = false, disabled = false) => ({
    matches: () => disabled, closest: () => null,
    getClientRects: () => hidden ? [] : [{}],
    focus() { document.activeElement = this; },
  });
  const first = control(), middle = control(), last = control();
  const dialog = { ownerDocument: document, querySelectorAll: () => [first, control(true), middle, last, control(false, true)] };
  const event = (shiftKey = false) => ({ key: 'Tab', shiftKey, prevented: false,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} });
  return { document, first, middle, last, dialog, event };
}

test('Tab wraps after the last visible control and Shift+Tab wraps before the first', () => {
  const f = focusFixture();
  f.last.focus();
  assert.equal(trapRadiationPhoneTab(f.event(), f.dialog), true);
  assert.equal(f.document.activeElement, f.first);
  assert.equal(trapRadiationPhoneTab(f.event(true), f.dialog), true);
  assert.equal(f.document.activeElement, f.last);
});

test('ordinary in-dialog tabbing stays native and lost focus recovers to a visible control', () => {
  const f = focusFixture();
  f.middle.focus();
  assert.equal(trapRadiationPhoneTab(f.event(), f.dialog), false);
  f.document.activeElement = null;
  assert.equal(trapRadiationPhoneTab(f.event(), f.dialog), true);
  assert.equal(f.document.activeElement, f.first);
  assert.equal(trapRadiationPhoneTab({ ...f.event(), key: 'ArrowUp' }, f.dialog), false);
});
