import React, { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export const ShotActions: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  return (
    <details
      ref={ref}
      name="storyboard-shot-actions"
      className="cw-shot-actions"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && ref.current?.open) {
          event.preventDefault();
          event.stopPropagation();
          ref.current.open = false;
          ref.current.querySelector('summary')?.focus();
        }
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button') && ref.current) {
          ref.current.open = false;
          ref.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary aria-label={`More actions for ${title}`}>
        More Actions <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="cw-secondary-actions">{children}</div>
    </details>
  );
};
