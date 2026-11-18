/** @jest-environment jsdom */
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { jest } from '@jest/globals';
import ConfirmationDialog from '../../../src/shared/feedback/ConfirmationDialog.jsx';

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

test('moves focus into the dialog, traps tab navigation and restores focus', async () => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <ConfirmationDialog
          open={open}
          consequenceKey="confirmDeactivateWarning"
          onCancel={() => {
            onCancel();
            setOpen(false);
          }}
          onConfirm={onConfirm}
        />
      </>
    );
  }

  await act(async () => {
    root.render(<Harness />);
  });
  const opener = container.querySelector('button');
  opener.focus();
  await act(async () => opener.click());
  const buttons = container.querySelectorAll('[role="alertdialog"] button');
  expect(document.activeElement).toBe(buttons[1]);
  buttons[1].focus();
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
  });
  expect(document.activeElement).toBe(buttons[0]);
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
  });
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(opener);
});
