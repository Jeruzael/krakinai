import React, { useId, useState } from 'react';
import type {
  DialogueConfig,
  DialoguePerformanceDirectionV2,
} from '../types/domain';
import { getEffectiveDialogueDelivery } from '../domain/dialoguePerformance';
import {
  EMOTION_GROUPS,
  EMOTIONS,
  EMOTIONAL_INTENSITIES,
  TECHNIQUES,
  VOICE_FIELDS,
  SPEECH_FIELDS,
  GESTURES,
  conflictingTechnique,
  type TechniqueId,
  type BodyGesture,
} from '../domain/performanceCatalog';
import { LegacyPerformanceDirection } from './LegacyPerformanceDirection';
import './performanceDirection.css';

type Studio = DialoguePerformanceDirectionV2;
type Group =
  'emotion' | 'techniques' | 'voice' | 'speech' | 'gestures' | 'custom';
const GROUPS: Record<Group, string> = {
  emotion: 'Emotions',
  techniques: 'Delivery Technique',
  voice: 'Voice Characteristics',
  speech: 'Speech & Intonation',
  gestures: 'Body Language',
  custom: 'Custom Instructions',
};
const catalogs: Record<Group, string[]> = {
  emotion: [
    ...Object.values(EMOTIONS),
    ...Object.values(EMOTIONAL_INTENSITIES),
    ...Object.keys(EMOTION_GROUPS),
    'Primary emotion',
    'Secondary emotion',
    'Emotional intensity',
    'Custom emotional description',
  ],
  techniques: [
    ...Object.values(TECHNIQUES),
    'Custom delivery technique',
    'Sequential delivery',
  ],
  voice: Object.values(VOICE_FIELDS).flatMap((field) => [
    field.label,
    ...Object.values(field.options),
  ]),
  speech: [
    ...Object.values(SPEECH_FIELDS).flatMap((field) => [
      field.label,
      ...Object.values(field.options),
    ]),
    'Word emphasis',
  ],
  gestures: Object.values(GESTURES),
  custom: ['Custom Notes'],
};

/** Only explicit edits remove empty optional containers; loaded records are never normalized. */
function tidy(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      if (
        child === undefined ||
        child === '' ||
        (Array.isArray(child) && !child.length)
      )
        return [];
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        const nested = tidy(child as Record<string, unknown>);
        return Object.keys(nested).length ? [[key, nested]] : [];
      }
      return [[key, child]];
    })
  );
}

export const PerformanceDirection: React.FC<{
  dialogue: DialogueConfig;
  onChange: (dialogue: DialogueConfig) => void;
}> = ({ dialogue, onChange }) => {
  const prefix = useId();
  const [active, setActive] = useState<Group>();
  const [query, setQuery] = useState('');
  const [techniqueQuery, setTechniqueQuery] = useState('');
  if (dialogue.performanceDirection?.version === 1)
    return (
      <LegacyPerformanceDirection
        dialogue={dialogue}
        onChange={onChange}
        onReplace={() => {
          const { performanceDirection: _, ...rest } = dialogue;
          onChange(rest);
          setActive(undefined);
        }}
      />
    );
  const direction: Studio = dialogue.performanceDirection ?? { version: 2 };
  const update = (next: Studio) => {
    const normalized = tidy(
      next as unknown as Record<string, unknown>
    ) as unknown as Studio;
    const { performanceDirection: _, ...rest } = dialogue;
    onChange(
      Object.keys(normalized).length > 1
        ? { ...rest, performanceDirection: normalized }
        : rest
    );
  };
  const nested = (
    group: 'emotion' | 'voice' | 'speech',
    key: string,
    value?: string
  ) =>
    update({
      ...direction,
      [group]: { ...direction[group], [key]: value || undefined },
    });
  const toggleTechnique = (id: TechniqueId) =>
    update({
      ...direction,
      techniques: direction.techniques?.includes(id)
        ? direction.techniques.filter((value) => value !== id)
        : [...(direction.techniques ?? []), id],
    });
  const toggleGesture = (id: BodyGesture) =>
    update({
      ...direction,
      gestures: direction.gestures?.includes(id)
        ? direction.gestures.filter((value) => value !== id)
        : [...(direction.gestures ?? []), id],
    });
  const match = (text: string, group: Group) =>
    !query.trim() ||
    `${text} ${GROUPS[group]}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
  const choices: { group: Group; label: string; remove: () => void }[] = [];
  for (const [key, label] of [
    ['primary', 'Primary emotion'],
    ['secondary', 'Secondary emotion'],
    ['intensity', 'Emotional intensity'],
  ] as const) {
    const value = direction.emotion?.[key];
    if (value)
      choices.push({
        group: 'emotion',
        label: `${label}: ${key === 'intensity' ? EMOTIONAL_INTENSITIES[value as keyof typeof EMOTIONAL_INTENSITIES] : EMOTIONS[value as keyof typeof EMOTIONS]}`,
        remove: () => nested('emotion', key),
      });
  }
  if (direction.emotion?.custom)
    choices.push({
      group: 'emotion',
      label: 'Custom emotional description',
      remove: () => nested('emotion', 'custom'),
    });
  for (const id of Object.keys(TECHNIQUES) as TechniqueId[])
    if (direction.techniques?.includes(id))
      choices.push({
        group: 'techniques',
        label: TECHNIQUES[id],
        remove: () => toggleTechnique(id),
      });
  if (direction.customTechnique)
    choices.push({
      group: 'techniques',
      label: 'Custom delivery technique',
      remove: () => update({ ...direction, customTechnique: undefined }),
    });
  for (const [group, fields] of [
    ['voice', VOICE_FIELDS],
    ['speech', SPEECH_FIELDS],
  ] as const)
    for (const [key, field] of Object.entries(fields)) {
      const value = (direction[group] as Record<string, string> | undefined)?.[
        key
      ];
      if (value)
        choices.push({
          group,
          label: `${field.label}: ${(field.options as Record<string, string>)[value]}`,
          remove: () => nested(group, key),
        });
    }
  if (direction.speech?.emphasis)
    choices.push({
      group: 'speech',
      label: 'Word emphasis',
      remove: () => nested('speech', 'emphasis'),
    });
  for (const id of Object.keys(GESTURES) as BodyGesture[])
    if (direction.gestures?.includes(id))
      choices.push({
        group: 'gestures',
        label: GESTURES[id],
        remove: () => toggleGesture(id),
      });
  if (dialogue.deliveryNotes)
    choices.push({
      group: 'custom',
      label: 'Custom Notes',
      remove: () => {
        const { deliveryNotes: _, ...rest } = dialogue;
        onChange(rest);
      },
    });
  const effective = getEffectiveDialogueDelivery(dialogue);
  const selectFields = (
    group: 'voice' | 'speech',
    fields: typeof VOICE_FIELDS | typeof SPEECH_FIELDS
  ) => (
    <div className="performance-options">
      {Object.entries(fields)
        .filter(([, field]) =>
          match([field.label, ...Object.values(field.options)].join(' '), group)
        )
        .map(([key, field]) => (
          <label key={key}>
            {field.label}
            <select
              className="select"
              value={
                (direction[group] as Record<string, string> | undefined)?.[
                  key
                ] ?? ''
              }
              onChange={(e) => nested(group, key, e.target.value)}
            >
              <option value="">Not specified</option>
              {Object.entries(field.options).map(([value, label]) => (
                <option key={value} value={value}>
                  {String(label)}
                </option>
              ))}
            </select>
          </label>
        ))}
    </div>
  );
  const textField = (
    label: string,
    value: string | undefined,
    change: (value: string) => void
  ) => (
    <label className="performance-custom">
      {label}
      <textarea
        className="textarea"
        rows={3}
        maxLength={1000}
        value={value ?? ''}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
  const emotionSelect = (key: 'primary' | 'secondary', label: string) => (
    <label>
      {label}
      <select
        className="select"
        value={direction.emotion?.[key] ?? ''}
        onChange={(e) => nested('emotion', key, e.target.value)}
      >
        <option value="">Not specified</option>
        {Object.entries(EMOTION_GROUPS).map(([name, options]) => (
          <optgroup key={name} label={name}>
            {Object.entries(options)
              .filter(
                ([id, text]) =>
                  match(`${name} ${text}`, 'emotion') ||
                  id === direction.emotion?.[key]
              )
              .map(([id, text]) => (
                <option
                  key={id}
                  value={id}
                  disabled={
                    id ===
                    direction.emotion?.[
                      key === 'primary' ? 'secondary' : 'primary'
                    ]
                  }
                >
                  {text}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
  const visible = (Object.keys(GROUPS) as Group[]).filter((group) =>
    match(catalogs[group].join(' '), group)
  );
  return (
    <fieldset className="performance-direction performance-studio">
      <legend>Performance Direction (Optional)</legend>
      <p className="muted-text">
        Scene-specific acting direction. Leave any control unspecified. Your
        exact spoken line stays separate.
      </p>
      <label className="performance-search">
        Search All Directions
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find emotions, techniques, tone, gestures…"
        />
      </label>
      {choices.length > 0 && (
        <div
          className="performance-selections"
          aria-label="Selected directions"
        >
          {choices.map((choice) => (
            <button
              key={`${choice.group}-${choice.label}`}
              type="button"
              className="performance-chip"
              aria-label={`Remove ${choice.label}`}
              onClick={choice.remove}
            >
              {choice.label}
              <span aria-hidden="true"> ×</span>
            </button>
          ))}
        </div>
      )}
      {query && (
        <p role="status" className="muted-text">
          {visible.length
            ? `${visible.length} matching groups. Open a group to choose directions.`
            : 'No matching directions. Try another search or add custom instructions.'}
        </p>
      )}
      <div className="performance-groups">
        {visible.map((group) => (
          <section key={group} className="performance-group">
            <h3>
              <button
                type="button"
                className="performance-group-toggle"
                aria-expanded={active === group}
                aria-controls={`${prefix}-${group}`}
                onClick={() => setActive(active === group ? undefined : group)}
              >
                <span>
                  <strong>{GROUPS[group]}</strong>
                  <small>
                    {choices
                      .filter((choice) => choice.group === group)
                      .map((choice) => choice.label)
                      .join(' · ') || 'Not specified'}
                  </small>
                </span>
                <span aria-hidden="true">{active === group ? '−' : '+'}</span>
              </button>
            </h3>
            {active === group && (
              <div
                id={`${prefix}-${group}`}
                className="performance-group-body"
                role="region"
                aria-label={GROUPS[group]}
              >
                {group === 'emotion' && (
                  <>
                    <p className="muted-text">
                      Choose a primary emotion, an optional mixed emotion, or
                      your own description.
                    </p>
                    <div className="performance-options">
                      {emotionSelect('primary', 'Primary emotion')}
                      {emotionSelect('secondary', 'Secondary emotion')}
                      <label>
                        Emotional intensity
                        <select
                          className="select"
                          value={direction.emotion?.intensity ?? ''}
                          onChange={(e) =>
                            nested('emotion', 'intensity', e.target.value)
                          }
                        >
                          <option value="">Not specified</option>
                          {Object.entries(EMOTIONAL_INTENSITIES).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>
                    {textField(
                      'Custom emotional description',
                      direction.emotion?.custom,
                      (value) => nested('emotion', 'custom', value)
                    )}
                  </>
                )}
                {group === 'techniques' && (
                  <>
                    <label className="performance-search">
                      Search delivery techniques
                      <input
                        className="input"
                        type="search"
                        value={techniqueQuery}
                        onChange={(e) => setTechniqueQuery(e.target.value)}
                      />
                    </label>
                    <div className="performance-style-grid">
                      {(Object.entries(TECHNIQUES) as [TechniqueId, string][])
                        .filter(
                          ([, label]) =>
                            match(label, group) &&
                            label
                              .toLowerCase()
                              .includes(techniqueQuery.trim().toLowerCase())
                        )
                        .map(([id, label]) => {
                          const conflict = conflictingTechnique(
                            id,
                            direction.techniques ?? []
                          );
                          return (
                            <label
                              key={id}
                              className={`performance-style ${direction.techniques?.includes(id) ? 'selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  direction.techniques?.includes(id) ?? false
                                }
                                disabled={!!conflict}
                                aria-describedby={
                                  conflict
                                    ? `${prefix}-${id}-conflict`
                                    : undefined
                                }
                                onChange={() => toggleTechnique(id)}
                              />
                              <span>
                                {label}
                                {conflict && (
                                  <small id={`${prefix}-${id}-conflict`}>
                                    Remove {TECHNIQUES[conflict]} first; these
                                    vocal extremes cannot be simultaneous.
                                  </small>
                                )}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                    {!Object.values(TECHNIQUES).some(
                      (label) =>
                        match(label, group) &&
                        label
                          .toLowerCase()
                          .includes(techniqueQuery.trim().toLowerCase())
                    ) && (
                      <p className="muted-text">
                        No matching techniques. Add your own delivery guidance
                        below.
                      </p>
                    )}
                    {textField(
                      'Custom delivery technique / sequential delivery',
                      direction.customTechnique,
                      (value) =>
                        update({
                          ...direction,
                          customTechnique: value || undefined,
                        })
                    )}
                  </>
                )}
                {group === 'voice' && (
                  <>
                    <p className="muted-text">
                      Descriptive voice guidance; these choices do not guarantee
                      exact audio processing or voice reproduction.
                    </p>
                    {selectFields('voice', VOICE_FIELDS)}
                  </>
                )}
                {group === 'speech' && (
                  <>
                    {selectFields('speech', SPEECH_FIELDS)}
                    {textField(
                      'Word emphasis',
                      direction.speech?.emphasis,
                      (value) => nested('speech', 'emphasis', value)
                    )}
                  </>
                )}
                {group === 'gestures' && (
                  <div className="performance-style-grid">
                    {(Object.entries(GESTURES) as [BodyGesture, string][])
                      .filter(([, label]) => match(label, group))
                      .map(([id, label]) => (
                        <label
                          key={id}
                          className={`performance-style ${direction.gestures?.includes(id) ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={direction.gestures?.includes(id) ?? false}
                            onChange={() => toggleGesture(id)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                  </div>
                )}
                {group === 'custom' && (
                  <>
                    {textField(
                      'Custom Notes',
                      dialogue.deliveryNotes,
                      (value) => onChange({ ...dialogue, deliveryNotes: value })
                    )}
                    <p className="muted-text">
                      Preserved exactly as authored. Preset choices are never
                      inferred from your writing.
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
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
          Clear All performance direction
        </button>
      )}
    </fieldset>
  );
};
