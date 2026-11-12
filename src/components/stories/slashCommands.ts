import type {
  SlashCommandCategory,
  SlashCommandItem,
  QwenCustomSkillPrompt,
} from '../../types/qwen';

export const BUILTIN_SLASH_COMMANDS: SlashCommandItem[] = [
  // 1. Persona Switchers
  {
    command: '/screenwriter',
    label: 'Story Screenwriter (Phase 1)',
    category: 'persona',
    categoryLabel: 'Persona',
    description: 'Switch persona: Screenplay, natural Taglish dialogue, and 5–10s beats.',
    icon: '🎭',
    actionType: 'switch_persona',
    targetPersona: 'screenwriter',
  },
  {
    command: '/editor',
    label: 'Script Doctor & Editor (Phase 2)',
    category: 'persona',
    categoryLabel: 'Persona',
    description: 'Switch persona: Beat duration audits, dialogue breathing, and director handoffs.',
    icon: '🔍',
    actionType: 'switch_persona',
    targetPersona: 'editor',
  },
  {
    command: '/novelist',
    label: 'Book Novelist (Phase 2B)',
    category: 'persona',
    categoryLabel: 'Persona',
    description: 'Switch persona: Continuous literary prose, sensory immersion, and monologues.',
    icon: '📚',
    actionType: 'switch_persona',
    targetPersona: 'novelist',
  },
  {
    command: '/director',
    label: 'Story Director (Phase 3)',
    category: 'persona',
    categoryLabel: 'Persona',
    description: 'Switch persona: 12-layer visual prompts, camera composition, and keyframes.',
    icon: '🎬',
    actionType: 'switch_persona',
    targetPersona: 'director',
  },
  {
    command: '/storyboarder',
    label: 'Storyboard Crafter',
    category: 'persona',
    categoryLabel: 'Persona',
    description: 'Switch persona: Emotional coverage, reaction pacing, and psychological blocking.',
    icon: '❤️',
    actionType: 'switch_persona',
    targetPersona: 'storyboarder',
  },

  // 2. Screenplay & Dialogue Skills
  {
    command: '/taglish',
    label: 'Polish Taglish Dialogue',
    category: 'screenplay',
    categoryLabel: 'Screenplay',
    description: 'Infuse natural Filipino/Taglish conversational cadence and vernacular.',
    icon: '🇵🇭',
    actionType: 'insert_prompt',
    promptTemplate: 'Polish the scene dialogue with authentic, natural Filipino/Taglish conversational cadence:',
  },
  {
    command: '/beats',
    label: 'Break into 5–10s Beats',
    category: 'screenplay',
    categoryLabel: 'Screenplay',
    description: 'Segment scenes into discrete 5-to-10-second cinematic story beats.',
    icon: '⏱️',
    actionType: 'insert_prompt',
    promptTemplate: 'Break down this scene into punchy 5-to-10-second cinematic story beats with clear action and dialogue:',
  },
  {
    command: '/subtext',
    label: 'Subtext & Unspoken Tension',
    category: 'screenplay',
    categoryLabel: 'Screenplay',
    description: 'Layer underlying psychological tension and unspoken character motivations.',
    icon: '🎭',
    actionType: 'insert_prompt',
    promptTemplate: 'Infuse subtle emotional subtext and unspoken tension between the characters:',
  },
  {
    command: '/conflict',
    label: 'Escalate Dramatic Conflict',
    category: 'screenplay',
    categoryLabel: 'Screenplay',
    description: 'Sharpen character opposition and elevate dramatic stakes in dialogue.',
    icon: '💥',
    actionType: 'insert_prompt',
    promptTemplate: 'Escalate the dramatic stakes and character conflict with sharp, revealing lines:',
  },

  // 3. Editorial & Pacing Skills
  {
    command: '/audit',
    label: 'Beat Duration Audit',
    category: 'editorial',
    categoryLabel: 'Editorial',
    description: 'Scan scene for bloated beats (>10s) or crammed dialogue blocks.',
    icon: '🔍',
    actionType: 'insert_prompt',
    promptTemplate: 'Audit this scene for beat duration. Flag any beats longer than 10 seconds or dialogue that is crammed:',
  },
  {
    command: '/breathe',
    label: 'Dialogue Breathing Room',
    category: 'editorial',
    categoryLabel: 'Editorial',
    description: 'Insert silent glances, micro-reactions, and pauses between dialogue exchanges.',
    icon: '💨',
    actionType: 'insert_prompt',
    promptTemplate: 'Suggest where to insert silent reaction beats, character glances, and dramatic breathing room:',
  },
  {
    command: '/handoff',
    label: 'Director Handoff Briefing',
    category: 'editorial',
    categoryLabel: 'Editorial',
    description: 'Generate briefing notes for Lighting, Mood, Tone, and Vocal Performance.',
    icon: '📋',
    actionType: 'insert_prompt',
    promptTemplate: 'Generate a Director Handoff Briefing with Lighting, Mood, and Vocal Performance notes:',
  },
  {
    command: '/tighten',
    label: 'Cut Fluff & Tighten',
    category: 'editorial',
    categoryLabel: 'Editorial',
    description: 'Trim redundant lines, exposition dumps, and wandering descriptions.',
    icon: '✂️',
    actionType: 'insert_prompt',
    promptTemplate: 'Tighten this scene by trimming redundant lines and sharpening the core dramatic focus:',
  },

  // 4. Novelist Prose Skills
  {
    command: '/chapter',
    label: 'Write Next Chapter',
    category: 'novelist',
    categoryLabel: 'Novelist',
    description: 'Draft the next chapter continuing manuscript prose with sensory immersion.',
    icon: '✍️',
    actionType: 'insert_prompt',
    promptTemplate: 'Draft the next narrative chapter continuing from our current excerpt, maintaining vivid sensory immersion:',
  },
  {
    command: '/sensory',
    label: 'Sensory Atmosphere',
    category: 'novelist',
    categoryLabel: 'Novelist',
    description: 'Enrich ambient sounds, scents, textures, temperature, and light in prose.',
    icon: '🌿',
    actionType: 'insert_prompt',
    promptTemplate: 'Deepen the environmental sensory details (sounds, smells, textures, ambient light):',
  },
  {
    command: '/monologue',
    label: 'Internal Monologue',
    category: 'novelist',
    categoryLabel: 'Novelist',
    description: 'Dive into protagonist introspection, memories, and unspoken emotional conflicts.',
    icon: '💭',
    actionType: 'insert_prompt',
    promptTemplate: 'Explore the protagonist\'s deep internal reflections and hidden emotional conflicts:',
  },
  {
    command: '/prose',
    label: 'Translate Scene to Prose',
    category: 'novelist',
    categoryLabel: 'Novelist',
    description: 'Convert structured screenplay/creator beats into flowing literary manuscript.',
    icon: '📖',
    actionType: 'insert_prompt',
    promptTemplate: 'Translate these outline beats into flowing, continuous literary manuscript prose:',
  },

  // 5. Director Visual Skills
  {
    command: '/visual',
    label: '12-Layer Visual Prompt',
    category: 'director',
    categoryLabel: 'Director',
    description: 'Craft 12-layer prompt (subject, wardrobe, lighting, lens, mood) for video generation.',
    icon: '🎥',
    actionType: 'insert_prompt',
    promptTemplate: 'Generate a 12-layer visual prompt (subject, environment, wardrobe, lighting, lens, mood) for this shot:',
  },
  {
    command: '/camera',
    label: 'Camera Composition',
    category: 'director',
    categoryLabel: 'Director',
    description: 'Specify lens, Dutch angle, push-in, parallax tracking, and depth of field.',
    icon: '📐',
    actionType: 'insert_prompt',
    promptTemplate: 'Suggest cinematic camera framing (e.g. low-angle dutch, slow push-in, shallow depth of field):',
  },
  {
    command: '/lighting',
    label: 'Lighting & Atmosphere',
    category: 'director',
    categoryLabel: 'Director',
    description: 'Design cinematic lighting keys (golden hour rim, volumetric fog, chiaroscuro).',
    icon: '💡',
    actionType: 'insert_prompt',
    promptTemplate: 'Define the lighting setup (e.g. golden hour rim light, neon chiaroscuro, volumetric mist):',
  },
  {
    command: '/keyframes',
    label: 'Keyframe Plan (Start/End)',
    category: 'director',
    categoryLabel: 'Director',
    description: 'Define precise start-still and end-still anchors for 5-to-10s video flow shots.',
    icon: '🎬',
    actionType: 'insert_prompt',
    promptTemplate: 'Plan start and end keyframe stills to control motion across this 5-to-10-second shot:',
  },

  // 6. Storyboard & Emotional Coverage
  {
    command: '/reactions',
    label: 'Reaction Shot Coverage',
    category: 'storyboarder',
    categoryLabel: 'Storyboard',
    description: 'Design silent close-up character reaction shots to let emotion register.',
    icon: '👁️',
    actionType: 'insert_prompt',
    promptTemplate: 'Plan emotional reaction shots to give character emotions time to register and breathe:',
  },
  {
    command: '/emotions',
    label: 'Emotional Climax Arc',
    category: 'storyboarder',
    categoryLabel: 'Storyboard',
    description: 'Chart vulnerability micro-arcs and power shifts across sequence.',
    icon: '💓',
    actionType: 'insert_prompt',
    promptTemplate: 'Map out the emotional micro-arcs and vulnerability shifts across this sequence:',
  },
  {
    command: '/blocking',
    label: 'Psychological Staging',
    category: 'storyboarder',
    categoryLabel: 'Storyboard',
    description: 'Position characters spatially in the environment to mirror emotional dynamics.',
    icon: '🪞',
    actionType: 'insert_prompt',
    promptTemplate: 'Use blocking and spatial staging to psychologically reflect the changing power dynamics:',
  },

  // 7. Creator Mode Structure Skills
  {
    command: '/act',
    label: 'Draft Act in Creator Mode',
    category: 'creator',
    categoryLabel: 'Creator Mode',
    description: 'Outline a full Act with thematic stakes, subtext, and inciting incident.',
    icon: '🏛️',
    actionType: 'insert_prompt',
    promptTemplate: 'Draft Act 1 with major narrative arc, dramatic stakes, subtext, and inciting incident in Creator Mode:',
  },
  {
    command: '/sequence',
    label: 'Create Narrative Sequence',
    category: 'creator',
    categoryLabel: 'Creator Mode',
    description: 'Populate the active Act with linked dramatic sequences.',
    icon: '🎞️',
    actionType: 'insert_prompt',
    promptTemplate: 'Create narrative sequences for the current act in Creator Mode:',
  },
  {
    command: '/scene',
    label: 'Create Detailed Scene',
    category: 'creator',
    categoryLabel: 'Creator Mode',
    description: 'Draft a scene with INT/EXT location, time of day, and dramatic objective.',
    icon: '🎬',
    actionType: 'insert_prompt',
    promptTemplate: 'Draft a detailed scene with location, time, and dramatic goal in Creator Mode:',
  },
  {
    command: '/seed3act',
    label: 'Seed 3-Act Structure',
    category: 'creator',
    categoryLabel: 'Creator Mode',
    description: 'Scaffold classic 3-Act structure (Setup, Confrontation, Climax & Resolution).',
    icon: '🌱',
    actionType: 'insert_prompt',
    promptTemplate: 'Seed a classic 3-Act narrative structure (Act 1 Setup, Act 2 Confrontation, Act 3 Resolution) in Creator Mode.',
  },

  // 8. Session Utilities
  {
    command: '/clear',
    label: 'Clear Chat History',
    category: 'utility',
    categoryLabel: 'Utility',
    description: 'Reset conversation history and start fresh with greeting.',
    icon: '🗑️',
    actionType: 'utility',
    utilityId: 'clear',
  },
  {
    command: '/help',
    label: 'Slash Command Cheatsheet',
    category: 'utility',
    categoryLabel: 'Utility',
    description: 'Display quick reference guide of all skills and shortcuts.',
    icon: '❓',
    actionType: 'utility',
    utilityId: 'help',
  },
];

export function resolveSlashCommands(
  customSkills: QwenCustomSkillPrompt[] = []
): SlashCommandItem[] {
  const customItems: SlashCommandItem[] = (customSkills || []).map((skill) => {
    let cleanCmd = (skill.command || '').trim().toLowerCase();
    if (!cleanCmd.startsWith('/')) {
      cleanCmd = `/${cleanCmd}`;
    }
    return {
      command: cleanCmd,
      label: skill.label || cleanCmd,
      category: 'custom' as SlashCommandCategory,
      categoryLabel: 'Custom Skill',
      description: skill.description || 'Custom user-defined skill prompt',
      icon: skill.icon || '✨',
      actionType: 'insert_prompt',
      promptTemplate: skill.prompt,
    };
  });

  return [...BUILTIN_SLASH_COMMANDS, ...customItems];
}

export function filterSlashCommands(
  query: string,
  allCommands: SlashCommandItem[]
): SlashCommandItem[] {
  const raw = query.trim().toLowerCase();
  const clean = raw.startsWith('/') ? raw.slice(1) : raw;

  if (!clean) {
    return allCommands;
  }

  const matches = allCommands.filter((cmd) => {
    const cmdWithoutSlash = cmd.command.slice(1).toLowerCase();
    const labelLower = cmd.label.toLowerCase();
    const descLower = cmd.description.toLowerCase();
    const catLower = cmd.categoryLabel.toLowerCase();

    return (
      cmdWithoutSlash.includes(clean) ||
      labelLower.includes(clean) ||
      descLower.includes(clean) ||
      catLower.includes(clean)
    );
  });

  // Relevance ranking: exact command > command prefix > label prefix > other matches
  return matches.sort((a, b) => {
    const aCmd = a.command.slice(1).toLowerCase();
    const bCmd = b.command.slice(1).toLowerCase();

    const aExact = aCmd === clean ? 0 : 1;
    const bExact = bCmd === clean ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;

    const aPrefix = aCmd.startsWith(clean) ? 0 : 1;
    const bPrefix = bCmd.startsWith(clean) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;

    const aLabelPrefix = a.label.toLowerCase().startsWith(clean) ? 0 : 1;
    const bLabelPrefix = b.label.toLowerCase().startsWith(clean) ? 0 : 1;
    if (aLabelPrefix !== bLabelPrefix) return aLabelPrefix - bLabelPrefix;

    return 0;
  });
}

export function generateSlashHelpMarkdown(commands: SlashCommandItem[]): string {
  const lines = [
    `### ⚡ Qwen Story Co-Pilot Slash Commands & Skills`,
    `Type \`/\` in the chat input to search and trigger any of the following skills:\n`,
  ];

  const grouped = new Map<string, SlashCommandItem[]>();
  for (const c of commands) {
    const cat = c.categoryLabel;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(c);
  }

  grouped.forEach((items, groupName) => {
    lines.push(`**${groupName}:**`);
    for (const item of items) {
      lines.push(`- \`${item.command}\` — **${item.label}**: ${item.description}`);
    }
    lines.push('');
  });

  lines.push(`💡 *You can create your own custom slash skills in Qwen Settings (⚙️).*`);
  return lines.join('\n');
}
