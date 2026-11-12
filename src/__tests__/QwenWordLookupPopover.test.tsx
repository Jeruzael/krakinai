import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QwenWordLookupPopover, calculatePopoverCoords } from '../components/stories/QwenWordLookupPopover';
import * as qwenClient from '../services/qwenClient';
import { DEFAULT_QWEN_SETTINGS } from '../storage/qwenSettings';

describe('QwenWordLookupPopover', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders word definition card when word is highlighted', async () => {
    const mockDef: qwenClient.WordDefinitionResult = {
      word: 'sickly',
      partOfSpeech: 'adjective',
      definition: 'Often unwell; weak or unhealthy in appearance.',
      contextualMeaning: 'Describing the eerie green glow of the receiver.',
      examples: [
        'The lantern cast a sickly amber glow against the depot wall.',
        'A sickly fog rose from the frozen rail tracks.',
      ],
      synonyms: ['pallid', 'faint', 'feeble'],
    };

    vi.spyOn(qwenClient, 'lookupWordDefinition').mockResolvedValue(mockDef);

    const { container } = render(
      <div>
        <p data-testid="story-paragraph">
          The kerosene lantern and the sickly phosphor-green flicker of a cracked radio.
        </p>
        <QwenWordLookupPopover
          settings={DEFAULT_QWEN_SETTINGS}
          isServerAwake={true}
        />
      </div>
    );

    // Mock window.getSelection
    const paragraph = screen.getByTestId('story-paragraph');
    const mockRange = {
      getBoundingClientRect: () => ({
        top: 200,
        bottom: 220,
        left: 300,
        right: 350,
        width: 50,
        height: 20,
      }),
      commonAncestorContainer: paragraph,
    };

    const mockSelection = {
      toString: () => 'sickly',
      rangeCount: 1,
      getRangeAt: () => mockRange,
      isCollapsed: false,
    };

    vi.stubGlobal('getSelection', () => mockSelection);

    // Trigger selection change or mouseup
    fireEvent.mouseUp(paragraph);

    await waitFor(() => {
      expect(screen.getByText('sickly')).toBeInTheDocument();
      expect(screen.getByText('adjective')).toBeInTheDocument();
      expect(screen.getByText(/Often unwell/i)).toBeInTheDocument();
      expect(screen.getByText(/The lantern cast a sickly amber glow/i)).toBeInTheDocument();
    });
  });

  it('does not trigger on input elements or empty selection', async () => {
    const lookupSpy = vi.spyOn(qwenClient, 'lookupWordDefinition');

    render(
      <div>
        <input data-testid="chat-input" defaultValue="sickly" />
        <QwenWordLookupPopover
          settings={DEFAULT_QWEN_SETTINGS}
          isServerAwake={true}
        />
      </div>
    );

    const input = screen.getByTestId('chat-input');
    const mockSelection = {
      toString: () => 'sickly',
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ top: 10, bottom: 20, left: 10, right: 20 }),
        commonAncestorContainer: input,
      }),
      isCollapsed: false,
    };

    vi.stubGlobal('getSelection', () => mockSelection);

    fireEvent.mouseUp(input);

    expect(lookupSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: /Word Definition/i })).not.toBeInTheDocument();
  });

  it('renders token consumption badge and cache status', async () => {
    const mockDef: qwenClient.WordDefinitionResult = {
      word: 'corrugated',
      partOfSpeech: 'adjective',
      definition: 'Formed into parallel ridges and grooves.',
      examples: ['The corrugated metal groaned under heavy snow.'],
      synonyms: ['ridged', 'ribbed'],
      tokenCost: {
        promptTokens: 42,
        completionTokens: 84,
        totalTokens: 126,
      },
      cached: false,
    };

    vi.spyOn(qwenClient, 'lookupWordDefinition').mockResolvedValue(mockDef);

    render(
      <div>
        <p data-testid="target-p">...against the rusted corrugated siding...</p>
        <QwenWordLookupPopover
          settings={DEFAULT_QWEN_SETTINGS}
          isServerAwake={true}
        />
      </div>
    );

    const paragraph = screen.getByTestId('target-p');
    const mockSelection = {
      toString: () => 'corrugated',
      rangeCount: 1,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ top: 400, bottom: 420, left: 200, right: 280, width: 80, height: 20 }),
        commonAncestorContainer: paragraph,
      }),
      isCollapsed: false,
    };
    vi.stubGlobal('getSelection', () => mockSelection);

    fireEvent.mouseUp(paragraph);

    await waitFor(() => {
      expect(screen.getByText('corrugated')).toBeInTheDocument();
      expect(screen.getByText(/126 tokens/i)).toBeInTheDocument();
      expect(screen.getByText(/Re-query AI/i)).toBeInTheDocument();
    });
  });

  it('calculatePopoverCoords correctly anchors popover near word without sticking to top', () => {
    // Word at bottom of screen (top: 700px, bottom: 720px)
    const mockRangeBottom = {
      getBoundingClientRect: () => ({
        top: 700,
        bottom: 720,
        left: 300,
        right: 380,
        width: 80,
        height: 20,
      }),
    } as unknown as Range;

    const coordsAbove = calculatePopoverCoords(mockRangeBottom, { offsetHeight: 250 } as HTMLElement);
    // With card height 250 and word at top 700, targetY should be 700 - 250 - 8 = 442
    expect(coordsAbove.placeAbove).toBe(true);
    expect(coordsAbove.y).toBe(442);

    // Word at top of screen (top: 50px, bottom: 70px)
    const mockRangeTop = {
      getBoundingClientRect: () => ({
        top: 50,
        bottom: 70,
        left: 300,
        right: 380,
        width: 80,
        height: 20,
      }),
    } as unknown as Range;

    const coordsBelow = calculatePopoverCoords(mockRangeTop, { offsetHeight: 250 } as HTMLElement);
    // Not enough space above (50 < 250 + 16), so placed below at bottom (70) + 8 = 78
    expect(coordsBelow.placeAbove).toBe(false);
    expect(coordsBelow.y).toBe(78);
  });
});
