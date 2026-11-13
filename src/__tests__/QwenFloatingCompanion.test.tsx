import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QwenProvider } from '../context/QwenContext';
import { QwenTopbarBed } from '../components/stories/QwenTopbarBed';
import { QwenFloatingCompanion } from '../components/stories/QwenFloatingCompanion';
import * as qwenClient from '../services/qwenClient';
import type { Story } from '../types/domain';

const mockStory: Story = {
  id: 'story-test-ui',
  title: 'Echoes of the Fable',
  author: 'KRAKINAI User',
  tags: ['action'],
  coverMediaId: null,
  heroBannerMediaId: null,
  logline: 'An adventurous test story.',
  premise: 'Testing floating companion.',
  synopsis: 'Synopsis test.',
  treatment: 'Treatment test.',
  fullBookText: 'Chapter 1: The First Step.',
  referencePack: { assetIds: [], variantIds: [], mediaIds: [] },
  linkedCollectionId: null,
  colorScript: [],
  favorite: false,
  revisionNumber: 1,
  acts: [],
  directorBriefing: undefined,
  createdAt: '2026-11-11T00:00:00.000Z',
  updatedAt: '2026-11-11T00:00:00.000Z',
};

describe('Qwen Topbar Bed & Floating Companion', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders topbar bed in sleeping state by default', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'sleeping',
      pid: null,
      port: 8080,
      modelReady: false,
      lastError: null,
    });

    render(
      <QwenProvider>
        <QwenTopbarBed />
        <QwenFloatingCompanion
          story={mockStory}
          mode="pitch"
          onApplyStoryPatch={vi.fn()}
        />
      </QwenProvider>
    );

    expect(screen.getByText(/Qwen \(0 MB\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wake/i })).toBeInTheDocument();
  });

  it('triggers wake from topbar bed and transitions to awake state', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'sleeping',
      pid: null,
      port: 8080,
      modelReady: false,
      lastError: null,
    });

    const startSpy = vi.spyOn(qwenClient, 'startQwen').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    render(
      <QwenProvider>
        <QwenTopbarBed />
        <QwenFloatingCompanion
          story={mockStory}
          mode="pitch"
          onApplyStoryPatch={vi.fn()}
        />
      </QwenProvider>
    );

    const wakeBtn = screen.getByRole('button', { name: /Wake/i });
    fireEvent.click(wakeBtn);

    await waitFor(() => {
      expect(startSpy).toHaveBeenCalled();
    });
  });

  it('renders sleep button in topbar bed to stop server and return to sleeping state', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    const stopSpy = vi.spyOn(qwenClient, 'stopQwen').mockResolvedValue({
      state: 'sleeping',
      pid: null,
      port: 8080,
      modelReady: false,
      lastError: null,
    });

    render(
      <QwenProvider>
        <QwenTopbarBed />
        <QwenFloatingCompanion
          story={mockStory}
          mode="pitch"
          onApplyStoryPatch={vi.fn()}
        />
      </QwenProvider>
    );

    const sleepBtn = await screen.findByRole('button', { name: /Sleep/i });
    fireEvent.click(sleepBtn);

    await waitFor(() => {
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  it('opens and closes settings modal from co-pilot panel', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    render(
      <QwenProvider>
        <QwenTopbarBed />
        <QwenFloatingCompanion
          story={mockStory}
          mode="pitch"
          onApplyStoryPatch={vi.fn()}
        />
      </QwenProvider>
    );

    // Click floating companion avatar to open panel
    const companionAvatar = await screen.findByRole('button', { name: /Qwen Companion/i });
    fireEvent.click(companionAvatar);

    // Click settings button
    const settingsBtn = await screen.findByTitle('Qwen Settings');
    fireEvent.click(settingsBtn);

    expect(screen.getByText(/Qwen 3.5 Settings & Parameters/i)).toBeInTheDocument();

    // Click Done to close
    const doneBtn = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Qwen 3.5 Settings & Parameters/i)).not.toBeInTheDocument();
    });
  });

  it('preserves conversation messages when minimizing and reopening the panel', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    vi.spyOn(qwenClient, 'streamChatCompletion').mockResolvedValue({
      fullText: 'Here is a custom hero story beat for your script.',
      thinking: 'Thinking about heroic stakes...',
      answer: 'Here is a custom hero story beat for your script.',
      finishReason: 'stop',
      ttftMs: 120,
    });

    render(
      <QwenProvider>
        <QwenFloatingCompanion
          story={mockStory}
          mode="pitch"
          onApplyStoryPatch={vi.fn()}
        />
      </QwenProvider>
    );

    // Open panel
    const companionAvatar = await screen.findByRole('button', { name: /Qwen Companion/i });
    fireEvent.click(companionAvatar);

    // Verify greeting
    expect(await screen.findByText(/Hello! I am your local Qwen 3.5 Story Co-Pilot/i)).toBeInTheDocument();

    // Type a user message and send
    const input = screen.getByPlaceholderText(/Ask Qwen for story beats/i);
    fireEvent.change(input, { target: { value: 'Can you see my screen?' } });
    const sendBtn = screen.getByRole('button', { name: /Send/i });
    fireEvent.click(sendBtn);

    // Wait for the response to appear
    expect(await screen.findByText('Can you see my screen?')).toBeInTheDocument();
    expect(await screen.findByText(/Here is a custom hero story beat/i)).toBeInTheDocument();

    // Minimize panel by clicking minimize button
    const minimizeBtn = screen.getByRole('button', { name: /Minimize/i });
    fireEvent.click(minimizeBtn);

    // Reopen panel by clicking avatar
    fireEvent.click(companionAvatar);

    // Messages MUST still be present (not wiped!)
    expect(screen.getByText('Can you see my screen?')).toBeInTheDocument();
    expect(screen.getByText(/Here is a custom hero story beat/i)).toBeInTheDocument();
  });

  it('renders skill persona selector and allows switching between personas', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    render(
      <QwenProvider>
        <QwenFloatingCompanion
          story={mockStory}
          mode="creator"
          onApplyStoryPatch={vi.fn()}
        />
      </QwenProvider>
    );

    // Open panel
    const companionAvatar = await screen.findByRole('button', { name: /Qwen Companion/i });
    fireEvent.click(companionAvatar);

    // Persona pill should be visible in header
    const personaPill = await screen.findByRole('button', { name: /Active Skill:/i });
    expect(personaPill).toBeInTheDocument();
    expect(personaPill).toHaveTextContent(/Screenwriter/i);

    // Click persona pill to open dropdown
    fireEvent.click(personaPill);

    // Dropdown listbox should be open with all 5 personas
    const dropdown = await screen.findByRole('listbox', { name: /AI Skill Personas/i });
    expect(dropdown).toBeInTheDocument();
    expect(screen.getByText(/Story Director/i)).toBeInTheDocument();
    expect(screen.getByText(/Book Novelist/i)).toBeInTheDocument();
    expect(screen.getByText(/Script Doctor & Editor/i)).toBeInTheDocument();
    expect(screen.getByText(/Storyboard Crafter/i)).toBeInTheDocument();

    // Select Story Director
    const directorOption = screen.getByText(/Story Director/i);
    fireEvent.click(directorOption);

    // Persona pill should now reflect Story Director
    expect(personaPill).toHaveTextContent(/Director/i);

    // Quick action chips should now feature Director actions
    expect(screen.getByText(/12-Layer Visual Prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/Camera Composition/i)).toBeInTheDocument();
  });

  it('renders active screen banner and toggles auto-write pill inside Co-Pilot panel', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    render(
      <QwenProvider>
        <QwenFloatingCompanion
          story={mockStory}
          mode="pitch"
          onApplyStoryPatch={vi.fn()}
        />
      </QwenProvider>
    );

    const companionAvatar = await screen.findByRole('button', { name: /Qwen Companion/i });
    fireEvent.click(companionAvatar);

    // Active screen banner should be visible
    expect(await screen.findByText(/📍/i)).toBeInTheDocument();

    // Auto-write pill toggle should be ON by default
    const autoWriteBtn = screen.getByRole('button', { name: /Auto-Write/i });
    expect(autoWriteBtn).toHaveTextContent(/⚡ Auto-Write: ON/i);

    // Toggle to OFF
    fireEvent.click(autoWriteBtn);
    expect(autoWriteBtn).toHaveTextContent(/⏸️ Auto-Write: OFF/i);
  });

  it('auto-applies patch when auto-write is ON and renders undo and re-apply buttons', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    const mockAnswer =
      'Revised your pitch as requested!\n\n<qwen-patch>\n{\n  "type": "update_story_fields",\n  "fields": {\n    "title": "Title From Qwen",\n    "logline": "Logline From Qwen"\n  }\n}\n</qwen-patch>';

    vi.spyOn(qwenClient, 'streamChatCompletion').mockImplementation(
      async (_messages, _settings, onDelta) => {
        onDelta?.({
          delta: mockAnswer,
          accumulatedText: mockAnswer,
          isThinking: false,
          thinking: '',
          answer: mockAnswer,
        });
        return {
          fullText: mockAnswer,
          thinking: '',
          answer: mockAnswer,
          finishReason: 'stop',
          ttftMs: 120,
        };
      }
    );

    const applySpy = vi.fn();

    render(
      <QwenProvider>
        <QwenFloatingCompanion
          story={mockStory}
          mode="pitch"
          onApplyStoryPatch={applySpy}
        />
      </QwenProvider>
    );

    const companionAvatar = await screen.findByRole('button', { name: /Qwen Companion/i });
    fireEvent.click(companionAvatar);

    // Type message requesting title change
    const input = screen.getByPlaceholderText(/Ask Qwen for story beats/i);
    fireEvent.change(input, { target: { value: 'Change title and logline' } });
    const sendBtn = screen.getByRole('button', { name: /Send/i });
    fireEvent.click(sendBtn);

    // Wait for the response and auto-apply
    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update_story_fields',
          fields: expect.objectContaining({
            title: 'Title From Qwen',
            logline: 'Logline From Qwen',
          }),
        })
      );
    });

    // Verify UI reflects auto-written status and has Undo button
    expect(await screen.findByText(/✅ Auto-written to/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Re-Apply/i })).toBeInTheDocument();

    // Clicking Undo should remove the applied state
    const undoBtn = screen.getByRole('button', { name: /Undo/i });
    fireEvent.click(undoBtn);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Undo/i })).not.toBeInTheDocument();
    });
  });

  it('distinguishes between dragging and clicking so dragging does NOT toggle the chat panel', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    const { container } = render(
      <QwenProvider>
        <QwenFloatingCompanion story={mockStory} mode="pitch" />
      </QwenProvider>
    );

    const avatar = await screen.findByRole('button', { name: /Qwen Companion/i });

    // Drag action (> 5px movement)
    fireEvent.mouseDown(avatar, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.mouseMove(window, { clientX: 160, clientY: 160 });
    fireEvent.mouseUp(window, { clientX: 160, clientY: 160 });
    fireEvent.click(avatar);

    // Panel should NOT be open after a drag (display: none)
    const panel = container.querySelector('.qwen-copilot-container') as HTMLElement;
    expect(panel).toHaveStyle({ display: 'none' });

    // Normal click (minimal movement <= 5px)
    fireEvent.mouseDown(avatar, { clientX: 160, clientY: 160, button: 0 });
    fireEvent.mouseUp(window, { clientX: 161, clientY: 161 });
    fireEvent.click(avatar);

    // Panel SHOULD be open after a click (display: flex)
    expect(panel).toHaveStyle({ display: 'flex' });
  });

  it('renders satellite performance sub-icon beneath avatar and toggles draggable performance modal', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    vi.spyOn(qwenClient, 'getQwenProcessMetrics').mockResolvedValue({
      pid: 9999,
      state: 'awake',
      ramWorkingSetMb: 5840.5,
      cpuPercent: 4.8,
      gpuPercent: 12,
      vramUsedMb: 1250,
      vramTotalMb: 8192,
      temperatureC: 48,
      gpuDeviceName: 'NVIDIA RTX 4070',
      uptimeSeconds: 150,
      port: 8080,
      contextSize: 8192,
      fitTargetMb: 1536,
    });

    render(
      <QwenProvider>
        <QwenFloatingCompanion story={mockStory} mode="pitch" />
      </QwenProvider>
    );

    const satelliteIcon = await screen.findByRole('button', { name: /Qwen Performance Monitor/i });
    expect(satelliteIcon).toBeInTheDocument();

    // Clicking satellite sub-icon opens floating performance monitor modal
    fireEvent.click(satelliteIcon);

    expect(await screen.findByText(/Qwen Performance Monitor/i)).toBeInTheDocument();
    expect(await screen.findByText(/5,841 MB/i)).toBeInTheDocument();
  });

  it('renders Prompts & Skills tab in QwenSettingsModal and supports editing prompt & custom skills', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    render(
      <QwenProvider>
        <QwenFloatingCompanion story={mockStory} mode="pitch" />
      </QwenProvider>
    );

    // Click avatar to open Co-Pilot panel
    const avatar = await screen.findByRole('button', { name: /Qwen Companion/i });
    fireEvent.click(avatar);

    // Open settings modal from co-pilot panel header
    const settingsBtn = await screen.findByTitle('Qwen Settings');
    fireEvent.click(settingsBtn);

    // Click Prompts & Skills tab
    const promptsTab = await screen.findByRole('button', { name: /Prompts & Skills/i });
    expect(promptsTab).toBeInTheDocument();
    fireEvent.click(promptsTab);

    // Verify Base System Instructions textarea is rendered
    expect(await screen.findByText(/Base System Instructions/i)).toBeInTheDocument();
    const promptTextarea = screen.getByPlaceholderText(/You are the KRAKINAI Story & Screenwriting Co-Pilot/i);
    expect(promptTextarea).toBeInTheDocument();

    // Type custom instructions
    fireEvent.change(promptTextarea, { target: { value: 'Custom Cyberpunk Noir Story Instructions.' } });
    expect(promptTextarea).toHaveValue('Custom Cyberpunk Noir Story Instructions.');

    // Reset to default button appears
    const resetBtn = screen.getByRole('button', { name: /Reset to Default/i });
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);
    expect(promptTextarea).toHaveValue('');

    // Click Persona preview for director
    const directorPreviewBtn = screen.getByRole('button', { name: /Director/i });
    fireEvent.click(directorPreviewBtn);
    expect(screen.getByText(/12-layer visual prompts/i)).toBeInTheDocument();

    // Add a custom skill
    const newSkillBtn = screen.getByRole('button', { name: /New Skill/i });
    fireEvent.click(newSkillBtn);

    const cmdInput = screen.getByPlaceholderText('command-name');
    const labelInput = screen.getByPlaceholderText(/e\.g\. Dark Gothic Atmosphere/i);
    const templateInput = screen.getByPlaceholderText(/Deepen the dark gothic mood/i);

    fireEvent.change(cmdInput, { target: { value: 'cyberpunk-glitch' } });
    fireEvent.change(labelInput, { target: { value: 'Cyberpunk Glitch' } });
    fireEvent.change(templateInput, { target: { value: 'Inject high-tech neon glitched dialogue and chrome aesthetics:' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Skill/i }));

    // Verify custom skill is displayed
    expect(await screen.findByText('/cyberpunk-glitch')).toBeInTheDocument();
    expect(screen.getByText('Cyberpunk Glitch')).toBeInTheDocument();
  });

  it('opens slash command autocomplete menu when user types / in chat input and executes skill', async () => {
    vi.spyOn(qwenClient, 'getQwenStatus').mockResolvedValue({
      state: 'awake',
      pid: 9999,
      port: 8080,
      modelReady: true,
      lastError: null,
    });

    render(
      <QwenProvider>
        <QwenFloatingCompanion story={mockStory} mode="creator" />
      </QwenProvider>
    );

    // Click avatar to open Co-Pilot panel
    const avatar = await screen.findByRole('button', { name: /Qwen Companion/i });
    fireEvent.click(avatar);

    const input = await screen.findByPlaceholderText(/Ask Qwen for story beats, dialogue, or chapter prose/i);
    expect(input).toBeInTheDocument();

    // Typing '/' opens autocomplete menu
    fireEvent.change(input, { target: { value: '/' } });

    expect(await screen.findByRole('listbox', { name: /Slash commands/i })).toBeInTheDocument();
    expect(screen.getByText('/screenwriter')).toBeInTheDocument();
    expect(screen.getByText('/director')).toBeInTheDocument();
    expect(screen.getByText('/taglish')).toBeInTheDocument();

    // Typing query to filter
    fireEvent.change(input, { target: { value: '/tag' } });
    expect(screen.getByText('/taglish')).toBeInTheDocument();

    // Clicking /taglish skill populates prompt template into chat input
    const taglishOption = screen.getByText('/taglish');
    fireEvent.click(taglishOption);

    expect(input).toHaveValue('Polish the scene dialogue with authentic, natural Filipino/Taglish conversational cadence: ');
  });
});
