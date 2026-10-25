import { useLayoutEffect, useRef, type RefObject } from 'react';

const focusableSelector = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href], [tabindex]:not([tabindex="-1"])';

function focusableItems(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
    .filter(item => !item.closest('[hidden], [inert]') && item.getClientRects().length > 0);
}

function focusInitial(dialog: HTMLElement) {
  const preferred = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus], input:not(:disabled)');
  (preferred || focusableItems(dialog)[0] || dialog).focus({ preventScroll: true });
}

/** A portal dialog owns focus until it closes, including after its form changes. */
export function useDialogFocus(dialogRef: RefObject<HTMLElement | null>, isOpen: boolean, onClose: () => void, focusKey?: unknown) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const previous = document.activeElement instanceof window.HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.body.children)
      .filter(element => !element.contains(dialog) && !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName))
      .map(element => ({ element, inert: element.getAttribute('inert') }));
    document.body.style.overflow = 'hidden';
    for (const item of background) item.element.setAttribute('inert', '');
    focusInitial(dialog);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const items = focusableItems(dialog);
      const first = items[0], last = items.at(-1);
      const active = document.activeElement;
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      if (!dialog.contains(active) || active === dialog) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault(); first?.focus();
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) (focusableItems(dialog)[0] || dialog).focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', keepFocus);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', keepFocus);
      document.body.style.overflow = previousOverflow;
      for (const item of background) {
        if (item.inert === null) item.element.removeAttribute('inert');
        else item.element.setAttribute('inert', item.inert);
      }
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [dialogRef, isOpen]);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog) focusInitial(dialog);
  }, [dialogRef, isOpen, focusKey]);
}
