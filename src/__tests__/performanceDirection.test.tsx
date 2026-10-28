import React, { useState } from 'react';
import { expect, it, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { PerformanceDirection } from '../components/PerformanceDirection';
import type { DialogueConfig } from '../types/domain';
afterEach(cleanup);
function Harness({
  initial = { speaker: 'Mika', line: '“Sandali lang!”\nTara na. 😊', performanceDirection: { version: 1, styles: [] } },
}: {
  initial?: DialogueConfig;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PerformanceDirection dialogue={value} onChange={setValue} />
      <output data-testid="dialogue-state">{JSON.stringify(value)}</output>
    </>
  );
}
const state = () =>
  JSON.parse(screen.getByTestId('dialogue-state').textContent!);
it('defaults to no performance, keeps legacy custom text exact and never infers selected presets', () => {
  render(
    <Harness
      initial={{
        speaker: 'Mika',
        line: 'Exact',
        deliveryNotes: ' Angry?\nActually calm — preserve this. ',
        performanceDirection: { version: 1, styles: [] },
      }}
    />
  );
  expect(screen.getByLabelText('Custom Notes')).toHaveValue(
    ' Angry?\nActually calm — preserve this. '
  );
  expect(
    screen
      .getAllByRole('checkbox')
      .filter((input) => (input as HTMLInputElement).checked)
  ).toHaveLength(0);
  expect(screen.getByRole('combobox', { name: 'Speaking Pace' })).toHaveValue(
    ''
  );
  expect(state().performanceDirection).toEqual({ version: 1, styles: [] });
});
it('selects compatible presets, explains opposites, removes selections and clears only directions', () => {
  render(<Harness />);
  const line = state().line;
  fireEvent.click(screen.getByRole('checkbox', { name: 'Angry' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Energetic' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Lecturing' }));
  expect(screen.getByRole('checkbox', { name: /^Calm/ })).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox', { name: 'Speaking Pace' }), {
    target: { value: 'fast' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Body Language' }), {
    target: { value: 'strong_pointing' },
  });
  fireEvent.change(screen.getByLabelText('Custom Notes'), {
    target: { value: 'Keep this pause.\nExactly.' },
  });
  expect(state().performanceDirection).toEqual({
    version: 1,
    styles: ['angry', 'energetic', 'lecturing'],
    pace: 'fast',
    gestures: 'strong_pointing',
  });
  expect(screen.getByTestId('delivery-preview')).toHaveTextContent(
    'Angry, energetic and lecturing delivery. Fast-paced speech with strong, purposeful pointing gestures.'
  );
  fireEvent.click(screen.getByRole('checkbox', { name: 'Angry' }));
  expect(screen.getByRole('checkbox', { name: /^Calm/ })).not.toBeDisabled();
  fireEvent.change(screen.getByRole('combobox', { name: 'Speaking Pace' }), {
    target: { value: '' },
  });
  expect(state().performanceDirection).not.toHaveProperty('pace');
  fireEvent.click(
    screen.getByRole('button', { name: 'Clear performance direction' })
  );
  expect(state()).toEqual({ speaker: 'Mika', line });
});
