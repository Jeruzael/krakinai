import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { clearAllStoresForTesting } from '../storage/db';

describe('KRAKINAI End-to-End UI & Navigation Workflow', () => {
  beforeEach(async () => {
    window.location.hash = '#/';
    await clearAllStoresForTesting();
  });

  it('renders KRAKINAI shell, Stored on this browser notice, hero, and loads Starter Library on request', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByText(/Your reusable video creation toolkit/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/KRAKINAI/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Stored on this browser/i).length
    ).toBeGreaterThan(0);

    const loadStarterBtn = await screen.findByRole('button', {
      name: /Load Starter Library/i,
    });
    await user.click(loadStarterBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Maya Santos/i).length).toBeGreaterThan(0);
    });
  });

  it(
    'creates a character, adds an outfit variant, builds & assembles a scene, shows clipboard fallback on denial, and saves scene',
    async () => {
      const user = userEvent.setup({ delay: null });
      render(<App />);

    // Wait for home screen
    const createCharBtns = await screen.findAllByRole('button', {
      name: /Create Character/i,
    });
    await user.click(createCharBtns[0]);

    // S04 Create Character editor
    const titleInput = await screen.findByLabelText(/Title \*/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Elena Navarro');

    const promptInput = screen.getByLabelText(/Prompt Text \*/i);
    await user.clear(promptInput);
    await user.type(
      promptInput,
      'Elena is a fictional adult Filipina filmmaker, 30, warm brown eyes, wavy dark hair.'
    );

    const saveBtns = screen.getAllByRole('button', { name: /Save Prompt/i });
    await user.click(saveBtns[0]);

    // Redirects to S03 Prompt Detail
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Elena Navarro/i })
      ).toBeInTheDocument();
    });

    // Open Variants screen for Elena
    const manageVariantsBtn = screen.getByRole('button', {
      name: /Manage Variants/i,
    });
    await user.click(manageVariantsBtn);

    // S05 Variants screen
    const addVariantBtns = await screen.findAllByRole('button', {
      name: /\+ Add Variant/i,
    });
    await user.click(addVariantBtns[0]);

    // S04 Variant editor
    const varTitle = await screen.findByLabelText(/Title \*/i);
    await user.type(varTitle, 'Denim Jacket Look');
    const varPrompt = screen.getByLabelText(/Changed Layer Only \*/i);
    await user.type(
      varPrompt,
      'Wears a vintage indigo denim jacket over a striped cotton tee.'
    );
    await user.click(screen.getAllByRole('button', { name: /Save Variant/i })[0]);

    // Back on S05 Variants screen, click Use in Scene on the variant
    const useVariantBtns = await screen.findAllByRole('button', {
      name: /Use in Scene/i,
    });
    await user.click(useVariantBtns[0]);

    // Now on S06 Scene Builder with Elena + Denim Jacket Look populated!
    await waitFor(() => {
      expect(
        screen.getByText(
          /References only\. This app does not render a combined scene\./i
        )
      ).toBeInTheDocument();
    });

    // Create Environment prompt and add to scene
    await user.click(
      screen.getByRole('button', { name: /New Prompt/i })
    );
    const categorySelect = await screen.findByLabelText(/Category \*/i);
    await user.selectOptions(categorySelect, 'environments');
    const envTitle = await screen.findByLabelText(/Title \*/i);
    await user.type(envTitle, 'Corner Roastery');
    const envPrompt = screen.getByLabelText(/Prompt Text \*/i);
    await user.type(
      envPrompt,
      'Sunlit corner coffee roastery with oak counter.'
    );
    await user.click(screen.getAllByRole('button', { name: /Save Prompt/i })[0]);

    const addEnvToScene = await screen.findByRole('button', {
      name: /Add to Scene/i,
    });
    await user.click(addEnvToScene);

    // Wait for Scene Builder screen to render
    await screen.findByLabelText(/Scene Title \*/i);

    // Create Action prompt and add to scene
    await user.click(
      screen.getByRole('button', { name: /New Prompt/i })
    );
    const actCategorySelect = await screen.findByLabelText(/Category \*/i);
    await user.selectOptions(actCategorySelect, 'actions');
    const actTitle = await screen.findByLabelText(/Title \*/i);
    await user.type(actTitle, 'Reviewing Storyboard');
    const actPrompt = screen.getByLabelText(/Prompt Text \*/i);
    await user.type(
      actPrompt,
      'Sketches notes on a paper storyboard and smiles.'
    );
    await user.click(screen.getAllByRole('button', { name: /Save Prompt/i })[0]);

    const addActToScene = await screen.findByRole('button', {
      name: /Add to Scene/i,
    });
    await user.click(addActToScene);

    // Now on Scene Builder, set Scene Title and click Assemble Prompt
    const sTitle = await screen.findByLabelText(/Scene Title \*/i);
    await user.clear(sTitle);
    await user.type(sTitle, 'Elena Cafe Briefing');

    const assembleBtns = screen.getAllByRole('button', {
      name: /Assemble Prompt/i,
    });
    await user.click(assembleBtns[0]);

    // S07 Prompt Output
    const copyBtn = await screen.findByRole('button', { name: /Copy Prompt/i });
    expect(
      screen.getByText(/Sunlit corner coffee roastery with oak counter/i)
    ).toBeInTheDocument();

    // Switch to Structured and Compact tabs
    await user.click(screen.getByRole('tab', { name: /Structured/i }));
    expect(screen.getByText(/CHARACTER IDENTITY:/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Compact/i }));
    expect(
      screen.getByText(/Sunlit corner coffee roastery with oak counter/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Full Prompt/i }));

    // Test clipboard denial fallback
    const writeTextSpy = vi
      .fn()
      .mockRejectedValue(new Error('Clipboard blocked'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    });

    await user.click(copyBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Clipboard access was blocked/i)
      ).toBeInTheDocument();
    });

    // Close fallback dialog
    await user.click(screen.getByRole('button', { name: /^Close$/i }));

    // Save Scene
    const saveSceneBtn = screen.getByRole('button', { name: /Save Scene/i });
    await user.click(saveSceneBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Saved Scene \(Immutable Snapshot\)/i)
      ).toBeInTheDocument();
    });

    // Add Saved Scene to a newly created Collection
    await user.click(screen.getByRole('button', { name: /Add to Collection/i }));
    const colNameInput = await screen.findByLabelText(/Collection Name \*/i);
    await user.type(colNameInput, 'Cafe Pitch Pack');
    await user.click(screen.getByRole('button', { name: /Create & Add/i }));
    await user.click(screen.getByRole('button', { name: /^Done$/i }));

    // Navigate to Collections screen and verify collection membership
    await user.click(screen.getByRole('button', { name: /^Collections/i }));
    expect(await screen.findByText(/Cafe Pitch Pack/i)).toBeInTheDocument();

    // Navigate to Templates screen and verify 4 starter templates
    await user.click(screen.getByRole('button', { name: /^Templates/i }));
    expect(await screen.findByText(/Talking to Camera/i)).toBeInTheDocument();
    expect(screen.getByText(/Walking Scene/i)).toBeInTheDocument();
    expect(screen.getByText(/Product Showcase/i)).toBeInTheDocument();
    expect(screen.getByText(/Cinematic B-roll/i)).toBeInTheDocument();
  },
  15000
  );
});
