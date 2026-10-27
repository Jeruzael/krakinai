import React from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ScenePreflightDialog } from '../components/ScenePreflightDialog';
import userEvent from '@testing-library/user-event';
import {
  runScenePreflight,
  type PreflightFinding,
} from '../domain/scenePreflight';
import { legacyDraft } from './fixtures/legacyScene';
afterEach(cleanup);
const finding: PreflightFinding = {
  id: 'P001-evidence',
  ruleId: 'P001',
  severity: 'review',
  title: 'Gaze conflict',
  components: ['camera', 'action'],
  evidence: [
    {
      component: 'camera',
      text: "Position the camera about 135 degrees from the subject's forward axis, toward the left-rear side.\nExact source punctuation!”",
    },
  ],
  explanation: 'Review these directions.',
  suggestedActions: ['Adjust composition.'],
};
it('starts exact evidence collapsed and uses two actions for the selected source, with local acknowledgement', () => {
  const view = vi.fn(),
    edit = vi.fn(),
    change = vi.fn();
  const before = structuredClone(finding);
  render(
    <ScenePreflightDialog
      findings={[finding]}
      onClose={() => {}}
      onViewSource={view}
      onEditComponent={edit}
      onIntentionalIdsChange={change}
    />
  );
  const evidence = screen.getByText(finding.evidence[0].text, {
    exact: true,
    collapseWhitespace: false,
  });
  expect(evidence).not.toBeVisible();
  fireEvent.click(screen.getByText('Show Evidence', { exact: true }));
  expect(evidence).toBeVisible();
  expect(evidence.textContent).toBe(finding.evidence[0].text);
  expect(
    screen.getAllByRole('button', { name: /^(View source|Edit component):/ })
  ).toHaveLength(2);
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: 'action' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'View source: action' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Edit component: action' })
  );
  expect(view).toHaveBeenCalledWith('action');
  expect(edit).toHaveBeenCalledWith('action');
  fireEvent.click(screen.getByRole('checkbox'));
  expect(change).toHaveBeenCalledWith(['P001-evidence']);
  expect(finding).toEqual(before);
});
it('prevents acknowledging blockers and offers Edit a Copy for saved scenes', () => {
  render(
    <ScenePreflightDialog
      findings={[{ ...finding, severity: 'blocking' }]}
      onClose={() => {}}
      onViewSource={() => {}}
      onEditComponent={() => {}}
      readOnly
    />
  );
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Edit a Copy: camera' })
  ).toBeTruthy();
});

it('keeps a genuine Aya Santos / Joy P005 finding with exact evidence and preserves the source', async () => {
  const source = structuredClone(legacyDraft);
  source.slots.character!.sourceTitle = 'Aya Santos / Base Identity';
  source.dialogue = {
    speaker: 'Joy',
    line: 'The train is arriving.',
    mode: 'on_camera',
  };
  const before = structuredClone(source);
  const f = runScenePreflight(source).find((f) => f.ruleId === 'P005')!;
  expect(f.severity).toBe('review');
  render(
    <ScenePreflightDialog
      findings={[f]}
      onClose={() => {}}
      onViewSource={() => {}}
      onEditComponent={() => {}}
      readOnly
    />
  );
  await userEvent
    .setup()
    .click(screen.getByText('Show Evidence', { exact: true }));
  for (const e of f.evidence)
    expect(screen.getByRole('dialog').textContent).toContain(e.text);
  expect(source).toEqual(before);
});

it('groups each severity once and excludes collapsed evidence controls from keyboard focus', async () => {
  render(
    <ScenePreflightDialog
      findings={[
        finding,
        { ...finding, id: 'second', ruleId: 'P002', title: 'Other conflict' },
        { ...finding, id: 'info', severity: 'information' },
      ]}
      onClose={() => {}}
      onViewSource={() => {}}
      onEditComponent={() => {}}
    />
  );
  expect(
    screen.getAllByRole('heading', { name: /^Review/, level: 2 })
  ).toHaveLength(1);
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getAllByText('Show Evidence')).toHaveLength(3);
  const close = screen.getByRole('button', { name: 'Close' });
  close.focus();
  await userEvent.setup().tab();
  expect(
    screen.getByRole('button', { name: 'Close Scene Preflight' })
  ).toHaveFocus();
});
