import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const StudioDialog: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'default' | 'wide';
}> = ({
  title,
  onClose,
  children,
  footer,
  className = '',
  size = 'default',
}) => {
  const titleId = useId();
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const background = [...document.body.children]
      .filter((el) => el !== backdrop.current)
      .map((el) => ({
        el: el as HTMLElement,
        inert: (el as HTMLElement).inert,
        hidden: el.getAttribute('aria-hidden'),
      }));
    background.forEach(({ el }) => {
      el.inert = true;
      el.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      [
        ...(panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), video[controls], audio[controls], summary, [tabindex="0"]'
        ) ?? []),
      ].filter(
        (el) =>
          !el.closest('[hidden]') &&
          (!el.closest('details:not([open])') || el.tagName === 'SUMMARY')
      );
    const focusFirst = () => (focusables()[0] ?? panel.current)?.focus();
    focusFirst();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key === 'Tab') {
        const elements = focusables();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          panel.current?.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (!panel.current?.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', handleKey, true);
    document.addEventListener('focusin', keepFocus);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      document.removeEventListener('focusin', keepFocus);
      background.forEach(({ el, inert, hidden }) => {
        el.inert = inert;
        if (hidden === null) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', hidden);
      });
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  return createPortal(
    <div
      ref={backdrop}
      className="modal-backdrop studio-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className={`modal-panel studio-dialog ${size === 'wide' ? 'studio-dialog-wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={titleId} className="section-title">
            {title}
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};
