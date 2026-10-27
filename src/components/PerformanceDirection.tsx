import React, { useId } from 'react';
import type {
  DialogueConfig,
  DialogueDeliveryStyle,
  DialoguePerformanceDirection,
  DialogueSpeakingPace,
  DialogueBodyLanguage,
} from '../types/domain';
import {
  DELIVERY_STYLES,
  SPEAKING_PACES,
  BODY_LANGUAGE,
  conflictingDeliveryStyle,
  getEffectiveDialogueDelivery,
} from '../domain/dialoguePerformance';
import './performanceDirection.css';

export const PerformanceDirection: React.FC<{
  dialogue: DialogueConfig;
  onChange: (dialogue: DialogueConfig) => void;
}> = ({ dialogue, onChange }) => {
  const prefix = useId();
  const direction: DialoguePerformanceDirection =
    dialogue.performanceDirection ?? { version: 1, styles: [] };
  const update = (next: DialoguePerformanceDirection) => {
    const normalized: DialoguePerformanceDirection = {
      ...next,
      styles: DELIVERY_STYLES.filter((style) =>
        next.styles.includes(style.id)
      ).map((style) => style.id),
    };
    onChange({
      ...dialogue,
      performanceDirection:
        normalized.styles.length || normalized.pace || normalized.gestures
          ? normalized
          : undefined,
    });
  };
  const toggle = (id: DialogueDeliveryStyle) =>
    update({
      ...direction,
      styles: direction.styles.includes(id)
        ? direction.styles.filter((value) => value !== id)
        : [...direction.styles, id],
    });
  const effective = getEffectiveDialogueDelivery(dialogue);
  return (
    <fieldset className="performance-direction">
      <legend>Performance Direction (Optional)</legend>
      <p className="muted-text">
        Choose compatible directions, add custom notes, or leave everything
        unspecified. Your exact spoken line stays separate.
      </p>
      <fieldset className="performance-style-fieldset">
        <legend>Emotion / Delivery</legend>
        <div className="performance-style-grid">
          {DELIVERY_STYLES.map((style) => {
            const conflict = conflictingDeliveryStyle(
              style.id,
              direction.styles
            );
            const explanation = conflict
              ? `Remove ${DELIVERY_STYLES.find((s) => s.id === conflict)!.label} first`
              : undefined;
            return (
              <label
                key={style.id}
                className={`performance-style ${direction.styles.includes(style.id) ? 'selected' : ''}`}
                title={explanation}
              >
                <input
                  type="checkbox"
                  checked={direction.styles.includes(style.id)}
                  disabled={!!conflict}
                  aria-describedby={
                    explanation ? `${prefix}-${style.id}` : undefined
                  }
                  onChange={() => toggle(style.id)}
                />
                <span>
                  {style.label}
                  {explanation && (
                    <small id={`${prefix}-${style.id}`}>{explanation}</small>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="performance-options">
        <label>
          Speaking Pace
          <select
            className="select"
            value={direction.pace ?? ''}
            onChange={(e) => {
              const { pace: _, ...rest } = direction;
              update(
                e.target.value
                  ? { ...rest, pace: e.target.value as DialogueSpeakingPace }
                  : rest
              );
            }}
          >
            <option value="">Not specified</option>
            {Object.entries(SPEAKING_PACES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Body Language
          <select
            className="select"
            value={direction.gestures ?? ''}
            onChange={(e) => {
              const { gestures: _, ...rest } = direction;
              update(
                e.target.value
                  ? {
                      ...rest,
                      gestures: e.target.value as DialogueBodyLanguage,
                    }
                  : rest
              );
            }}
          >
            <option value="">Not specified</option>
            {Object.entries(BODY_LANGUAGE).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="performance-custom" htmlFor={`${prefix}-custom`}>
        Custom Notes
        <textarea
          id={`${prefix}-custom`}
          className="textarea"
          rows={3}
          maxLength={1000}
          value={dialogue.deliveryNotes ?? ''}
          onChange={(e) =>
            onChange({ ...dialogue, deliveryNotes: e.target.value })
          }
        />
      </label>
      <p className="muted-text performance-note">
        Existing delivery notes stay here unchanged; presets are never inferred
        from your writing.
      </p>
      {effective ? (
        <details className="performance-preview">
          <summary>Effective delivery preview</summary>
          <p data-testid="delivery-preview">{effective}</p>
        </details>
      ) : (
        <p className="muted-text">No delivery instructions specified.</p>
      )}
      {(dialogue.performanceDirection || dialogue.deliveryNotes) && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const {
              performanceDirection: _,
              deliveryNotes: __,
              ...rest
            } = dialogue;
            onChange(rest);
          }}
        >
          Clear performance direction
        </button>
      )}
    </fieldset>
  );
};
