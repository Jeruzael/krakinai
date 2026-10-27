import React, { useState } from 'react';
import { expect, it, afterEach } from 'vitest';
import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
} from '@testing-library/react';
import { PerformanceDirection } from '../components/PerformanceDirection';
import type { DialogueConfig } from '../types/domain';
afterEach(cleanup);
function Harness({
  initial = { speaker: 'Mika', line: '  “Tara—wait!”\n😊  ' },
}: {
  initial?: DialogueConfig;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PerformanceDirection dialogue={value} onChange={setValue} />
      <output data-testid="state">{JSON.stringify(value)}</output>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId('state').textContent!);
const open = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
it('starts collapsed and unspecified, searches grouped emotions and supports angry mixed with sad without inferring notes', () => {
  render(<Harness />);
  expect(screen.getByRole('button', { name: /^Emotions/ })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
  expect(
    screen.queryByRole('combobox', { name: 'Primary emotion' })
  ).not.toBeInTheDocument();
  open('Emotions');
  fireEvent.change(screen.getByRole('combobox', { name: 'Primary emotion' }), {
    target: { value: 'angry' },
  });
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Secondary emotion' }),
    { target: { value: 'sad' } }
  );
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Emotional intensity' }),
    { target: { value: 'strong' } }
  );
  expect(state().performanceDirection).toEqual({
    version: 2,
    emotion: { primary: 'angry', secondary: 'sad', intensity: 'strong' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Primary emotion: Angry' })
  );
  expect(state().performanceDirection.emotion).toEqual({
    secondary: 'sad',
    intensity: 'strong',
  });
  expect(screen.getByTestId('delivery-preview')).toHaveTextContent(
    'Emotion: sad; strong intensity.'
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Primary emotion' }), {
    target: { value: 'angry' },
  });
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search All Directions' }),
    { target: { value: 'nostalgic' } }
  );
  expect(
    within(screen.getByRole('combobox', { name: 'Primary emotion' })).getByRole(
      'option',
      { name: 'Nostalgic' }
    )
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
  open('Custom Instructions');
  fireEvent.change(screen.getByLabelText('Custom Notes'), {
    target: { value: '  whispered? Not necessarily.\nExact custom words.  ' },
  });
  expect(state().performanceDirection.emotion.primary).toBe('angry');
  expect(state().deliveryNotes).toBe(
    '  whispered? Not necessarily.\nExact custom words.  '
  );
});
it('searches techniques, explains simultaneous vocal conflicts and removes each selected field without defaults', () => {
  render(<Harness />);
  open('Delivery Technique');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Whispered' }));
  expect(screen.getByRole('checkbox', { name: /^Screamed/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Whispered' }));
  expect(screen.getByRole('checkbox', { name: 'Screamed' })).toBeEnabled();
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search delivery techniques' }),
    { target: { value: 'lectur' } }
  );
  fireEvent.click(screen.getByRole('checkbox', { name: 'Lecturing' }));
  open('Voice Characteristics');
  fireEvent.change(screen.getByRole('combobox', { name: 'Vocal tone' }), {
    target: { value: 'stern' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Vocal tone: Stern' })
  );
  expect(screen.getByRole('combobox', { name: 'Vocal tone' })).toHaveValue('');
  open('Speech & Intonation');
  fireEvent.change(screen.getByRole('textbox', { name: 'Word emphasis' }), {
    target: { value: '  Emphasize “tayo”.  ' },
  });
  expect(state().performanceDirection.speech.emphasis).toBe(
    '  Emphasize “tayo”.  '
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove Word emphasis' }));
  expect(state().performanceDirection).toEqual({
    version: 2,
    techniques: ['lecturing'],
  });
});
it('keeps v1 authoring choices and exact output until explicit replacement, retaining custom notes', () => {
  render(
    <Harness
      initial={{
        speaker: 'Mika',
        line: ' Exact 😊 ',
        deliveryNotes: '  Keep notes.  ',
        performanceDirection: {
          version: 1,
          styles: ['urgent', 'apologetic'],
          pace: 'slow',
        },
      }}
    />
  );
  expect(state().performanceDirection).toEqual({
    version: 1,
    styles: ['urgent', 'apologetic'],
    pace: 'slow',
  });
  expect(screen.getByText(/Legacy directions/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Urgent' }));
  expect(state().performanceDirection).toEqual({
    version: 1,
    styles: ['apologetic'],
    pace: 'slow',
  });
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Replace legacy directions with Performance Studio',
    })
  );
  expect(state()).toEqual({
    speaker: 'Mika',
    line: ' Exact 😊 ',
    deliveryNotes: '  Keep notes.  ',
  });
  open('Body Language');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Nervous fidgeting' }));
  expect(state().performanceDirection).toEqual({
    version: 2,
    gestures: ['nervous_fidgeting'],
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Clear All performance direction' })
  );
  expect(state()).toEqual({ speaker: 'Mika', line: ' Exact 😊 ' });
});
