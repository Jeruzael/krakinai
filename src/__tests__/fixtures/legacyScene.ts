// Golden saved output captured from master 9f64d95 before formatter changes. Synthetic QA data only.
import type { SavedScene, SceneDraft } from '../../types/domain';
export const legacyDraft: SceneDraft = {
  id: 'draft_advanced_qa',
  title: 'Mika introduction — café',
  slots: {
    character: {
      slot: 'character',
      sourceType: 'asset',
      sourceId: 'asset_char_maya',
      sourceRevision: 1,
      sourceTitle: 'Mika / Base Identity',
      promptText:
        '**IDENTITY**\nMika is a fictional adult woman. Preserve her face, eye spacing and natural proportions.\n\n**HAIR**\nLong chestnut hair with wispy bangs.\n\nMika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.',
      avoidText:
        'altered facial structure, different hair length, heavy glam makeup',
      mediaLinks: [
        {
          mediaId: 'media_asset_char_maya',
          role: 'reference',
          altText: 'Demo illustration for Maya Santos / Base Identity',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_char_maya.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
    wardrobe: {
      slot: 'wardrobe',
      sourceType: 'variant',
      sourceId: 'variant_maya_office_outfit',
      sourceRevision: 1,
      sourceTitle: 'Office Outfit',
      parentCharacterId: 'asset_char_maya',
      promptText:
        'She wears a navy blazer over a plain white shirt, charcoal trousers, and small silver stud earrings.',
      compactText:
        'Navy blazer over white shirt, charcoal trousers, silver stud earrings.',
      mediaLinks: [
        {
          mediaId: 'media_variant_maya_office_outfit',
          role: 'reference',
          altText: 'Demo illustration for Maya variant: Office Outfit',
          viewLabel: 'Outfit',
          order: 0,
          filename: 'variant_maya_office_outfit.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
    environment: {
      slot: 'environment',
      sourceType: 'asset',
      sourceId: 'asset_env_cafe_day',
      sourceRevision: 1,
      sourceTitle: 'Neighborhood Cafe / Day',
      promptText:
        'A quiet neighborhood cafe interior with pale oak tables, ceramic cups, potted indoor monstera plants, and a tall street-facing window on the left letting in clear daytime light.',
      compactText:
        'Quiet daytime neighborhood cafe with pale oak tables and left window.',
      avoidText: 'crowded bar, flashing neon signs',
      mediaLinks: [
        {
          mediaId: 'media_asset_env_cafe_day',
          role: 'reference',
          altText: 'Demo illustration for Neighborhood Cafe / Day',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_env_cafe_day.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
    action: {
      slot: 'action',
      sourceType: 'asset',
      sourceId: 'asset_act_sitting_listening',
      sourceRevision: 1,
      sourceTitle: 'Sitting and Listening',
      promptText:
        'Sits comfortably at the table, gently closes a hardcover notebook with both hands, and looks toward someone just off-camera with an attentive, restrained smile.',
      compactText:
        'Sits at table, closes notebook, looks off-camera with a restrained smile.',
      avoidText: 'exaggerated laughing, erratic hand waving',
      mediaLinks: [
        {
          mediaId: 'media_asset_act_sitting_listening',
          role: 'reference',
          altText: 'Demo illustration for Sitting and Listening',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_act_sitting_listening.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
    camera: {
      slot: 'camera',
      sourceType: 'asset',
      sourceId: 'asset_cam_closeup_push',
      sourceRevision: 1,
      sourceTitle: 'Close-up Slow Push-in',
      promptText:
        'Shoulder-up close-up at eye level on an 85mm lens with soft background bokeh, executing a slow, controlled dolly push-in over the duration of the shot.',
      compactText:
        '85mm eye-level close-up with slow controlled dolly push-in.',
      mediaLinks: [
        {
          mediaId: 'media_asset_cam_closeup_push',
          role: 'reference',
          altText: 'Demo illustration for Close-up Slow Push-in',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_cam_closeup_push.svg',
          mimeType: 'image/svg+xml',
        },
      ],
      overrideText:
        'A stable eye-level frame.\nDo not add an unselected focal length.',
    },
    lighting: {
      slot: 'lighting',
      sourceType: 'asset',
      sourceId: 'asset_light_overcast',
      sourceRevision: 1,
      sourceTitle: 'Gentle Overcast Exterior',
      promptText:
        'Even, shadowless overcast sky lighting that preserves soft skin tones and balanced exposure across foreground and background.',
      compactText: 'Even soft overcast exterior lighting.',
      mediaLinks: [
        {
          mediaId: 'media_asset_light_overcast',
          role: 'reference',
          altText: 'Demo illustration for Gentle Overcast Exterior',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_light_overcast.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
    style: {
      slot: 'style',
      sourceType: 'asset',
      sourceId: 'asset_style_minimal_2d',
      sourceRevision: 1,
      sourceTitle: 'Minimal 2D Animation',
      promptText:
        'Clean 2D hand-drawn animation with expressive ink linework, warm paper texture, and muted editorial gouache color washes.',
      compactText:
        'Clean 2D hand-drawn ink linework with muted gouache washes.',
      mediaLinks: [
        {
          mediaId: 'media_asset_style_minimal_2d',
          role: 'reference',
          altText: 'Demo illustration for Minimal 2D Animation',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_style_minimal_2d.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
  },
  extraRequiredSlots: [],
  sceneInstructions: 'One continuous take. Preserve the selected layers.',
  avoidText: 'No identity drift.',
  dialogue: {
    speaker: 'Mika',
    line: 'Hello! I\'m Mika, an AI avatar.\n"Kumusta?" — Tara, let\'s go! 😊',
  },
  settings: {
    aspectRatio: '9:16',
    durationSeconds: 8,
    toolNotes: 'User selected settings only.',
  },
  inputRevision: 1,
  manualOutputs: {},
  resultMediaLinks: [],
  reviewNotes: '',
  reviewStatus: 'unreviewed',
  updatedAt: '2026-10-26T03:17:52.598Z',
};
export const legacyScene: SavedScene = {
  id: 'scene_421df829f153',
  title: 'Mika introduction — café',
  slots: {
    character: {
      slot: 'character',
      sourceType: 'asset',
      sourceId: 'asset_char_maya',
      sourceRevision: 1,
      sourceTitle: 'Mika / Base Identity',
      promptText:
        '**IDENTITY**\nMika is a fictional adult woman. Preserve her face, eye spacing and natural proportions.\n\n**HAIR**\nLong chestnut hair with wispy bangs.\n\nMika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.',
      avoidText:
        'altered facial structure, different hair length, heavy glam makeup',
      mediaLinks: [
        {
          mediaId: 'media_asset_char_maya',
          role: 'reference',
          altText: 'Demo illustration for Maya Santos / Base Identity',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_char_maya.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
    wardrobe: {
      slot: 'wardrobe',
      sourceType: 'variant',
      sourceId: 'variant_maya_office_outfit',
      sourceRevision: 1,
      sourceTitle: 'Office Outfit',
      parentCharacterId: 'asset_char_maya',
      promptText:
        'She wears a navy blazer over a plain white shirt, charcoal trousers, and small silver stud earrings.',
      compactText:
        'Navy blazer over white shirt, charcoal trousers, silver stud earrings.',
      mediaLinks: [
        {
          mediaId: 'media_variant_maya_office_outfit',
          role: 'reference',
          altText: 'Demo illustration for Maya variant: Office Outfit',
          viewLabel: 'Outfit',
          order: 0,
          filename: 'variant_maya_office_outfit.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
    environment: {
      slot: 'environment',
      sourceType: 'asset',
      sourceId: 'asset_env_cafe_day',
      sourceRevision: 1,
      sourceTitle: 'Neighborhood Cafe / Day',
      promptText:
        'A quiet neighborhood cafe interior with pale oak tables, ceramic cups, potted indoor monstera plants, and a tall street-facing window on the left letting in clear daytime light.',
      compactText:
        'Quiet daytime neighborhood cafe with pale oak tables and left window.',
      avoidText: 'crowded bar, flashing neon signs',
      mediaLinks: [
        {
          mediaId: 'media_asset_env_cafe_day',
          role: 'reference',
          altText: 'Demo illustration for Neighborhood Cafe / Day',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_env_cafe_day.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
    action: {
      slot: 'action',
      sourceType: 'asset',
      sourceId: 'asset_act_sitting_listening',
      sourceRevision: 1,
      sourceTitle: 'Sitting and Listening',
      promptText:
        'Sits comfortably at the table, gently closes a hardcover notebook with both hands, and looks toward someone just off-camera with an attentive, restrained smile.',
      compactText:
        'Sits at table, closes notebook, looks off-camera with a restrained smile.',
      avoidText: 'exaggerated laughing, erratic hand waving',
      mediaLinks: [
        {
          mediaId: 'media_asset_act_sitting_listening',
          role: 'reference',
          altText: 'Demo illustration for Sitting and Listening',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_act_sitting_listening.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
    camera: {
      slot: 'camera',
      sourceType: 'asset',
      sourceId: 'asset_cam_closeup_push',
      sourceRevision: 1,
      sourceTitle: 'Close-up Slow Push-in',
      promptText:
        'Shoulder-up close-up at eye level on an 85mm lens with soft background bokeh, executing a slow, controlled dolly push-in over the duration of the shot.',
      compactText:
        '85mm eye-level close-up with slow controlled dolly push-in.',
      mediaLinks: [
        {
          mediaId: 'media_asset_cam_closeup_push',
          role: 'reference',
          altText: 'Demo illustration for Close-up Slow Push-in',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_cam_closeup_push.svg',
          mimeType: 'image/svg+xml',
        },
      ],
      overrideText:
        'A stable eye-level frame.\nDo not add an unselected focal length.',
    },
    lighting: {
      slot: 'lighting',
      sourceType: 'asset',
      sourceId: 'asset_light_overcast',
      sourceRevision: 1,
      sourceTitle: 'Gentle Overcast Exterior',
      promptText:
        'Even, shadowless overcast sky lighting that preserves soft skin tones and balanced exposure across foreground and background.',
      compactText: 'Even soft overcast exterior lighting.',
      mediaLinks: [
        {
          mediaId: 'media_asset_light_overcast',
          role: 'reference',
          altText: 'Demo illustration for Gentle Overcast Exterior',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_light_overcast.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
    style: {
      slot: 'style',
      sourceType: 'asset',
      sourceId: 'asset_style_minimal_2d',
      sourceRevision: 1,
      sourceTitle: 'Minimal 2D Animation',
      promptText:
        'Clean 2D hand-drawn animation with expressive ink linework, warm paper texture, and muted editorial gouache color washes.',
      compactText:
        'Clean 2D hand-drawn ink linework with muted gouache washes.',
      mediaLinks: [
        {
          mediaId: 'media_asset_style_minimal_2d',
          role: 'reference',
          altText: 'Demo illustration for Minimal 2D Animation',
          viewLabel: 'Demo card',
          order: 0,
          filename: 'asset_style_minimal_2d.svg',
          mimeType: 'image/svg+xml',
        },
      ],
    },
  },
  extraRequiredSlots: [],
  sceneInstructions: 'One continuous take. Preserve the selected layers.',
  avoidText:
    'altered facial structure, different hair length, heavy glam makeup, crowded bar, flashing neon signs, exaggerated laughing, erratic hand waving, No identity drift.',
  dialogue: {
    speaker: 'Mika',
    line: 'Hello! I\'m Mika, an AI avatar.\n"Kumusta?" — Tara, let\'s go! 😊',
  },
  settings: {
    aspectRatio: '9:16',
    durationSeconds: 8,
    toolNotes: 'User selected settings only.',
  },
  outputs: {
    full: '**IDENTITY**\nMika is a fictional adult woman. Preserve her face, eye spacing and natural proportions.\n\n**HAIR**\nLong chestnut hair with wispy bangs.\n\nMika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.\n\nShe wears a navy blazer over a plain white shirt, charcoal trousers, and small silver stud earrings.\n\nA quiet neighborhood cafe interior with pale oak tables, ceramic cups, potted indoor monstera plants, and a tall street-facing window on the left letting in clear daytime light.\n\nSits comfortably at the table, gently closes a hardcover notebook with both hands, and looks toward someone just off-camera with an attentive, restrained smile.\n\nA stable eye-level frame.\nDo not add an unselected focal length.\n\nEven, shadowless overcast sky lighting that preserves soft skin tones and balanced exposure across foreground and background.\n\nClean 2D hand-drawn animation with expressive ink linework, warm paper texture, and muted editorial gouache color washes.\n\nOne continuous take. Preserve the selected layers.\n\nDialogue (Mika): Hello! I\'m Mika, an AI avatar.\n"Kumusta?" — Tara, let\'s go! 😊',
    structured:
      'Character Identity:\n**IDENTITY**\nMika is a fictional adult woman. Preserve her face, eye spacing and natural proportions.\n\n**HAIR**\nLong chestnut hair with wispy bangs.\n\nMika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.\n\nClothing & Accessories:\nShe wears a navy blazer over a plain white shirt, charcoal trousers, and small silver stud earrings.\n\nEnvironment:\nA quiet neighborhood cafe interior with pale oak tables, ceramic cups, potted indoor monstera plants, and a tall street-facing window on the left letting in clear daytime light.\n\nAction & Emotion:\nSits comfortably at the table, gently closes a hardcover notebook with both hands, and looks toward someone just off-camera with an attentive, restrained smile.\n\nCamera & Movement:\nA stable eye-level frame.\nDo not add an unselected focal length.\n\nLighting & Mood:\nEven, shadowless overcast sky lighting that preserves soft skin tones and balanced exposure across foreground and background.\n\nArt Style:\nClean 2D hand-drawn animation with expressive ink linework, warm paper texture, and muted editorial gouache color washes.\n\nScene Instructions:\nOne continuous take. Preserve the selected layers.\n\nDialogue:\nDialogue (Mika): Hello! I\'m Mika, an AI avatar.\n"Kumusta?" — Tara, let\'s go! 😊',
    compact:
      '**IDENTITY**\nMika is a fictional adult woman. Preserve her face, eye spacing and natural proportions.\n\n**HAIR**\nLong chestnut hair with wispy bangs.\n\nMika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.Mika is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.\n\nNavy blazer over white shirt, charcoal trousers, silver stud earrings.\n\nQuiet daytime neighborhood cafe with pale oak tables and left window.\n\nSits at table, closes notebook, looks off-camera with a restrained smile.\n\nA stable eye-level frame.\nDo not add an unselected focal length.\n\nEven soft overcast exterior lighting.\n\nClean 2D hand-drawn ink linework with muted gouache washes.\n\nOne continuous take. Preserve the selected layers.\n\nDialogue (Mika): Hello! I\'m Mika, an AI avatar.\n"Kumusta?" — Tara, let\'s go! 😊',
  },
  manualOutputs: {},
  references: [
    {
      mediaId: 'media_asset_char_maya',
      role: 'reference',
      altText: 'Demo illustration for Maya Santos / Base Identity',
      viewLabel: 'Demo card',
      order: 0,
      filename: 'asset_char_maya.svg',
      mimeType: 'image/svg+xml',
    },
    {
      mediaId: 'media_variant_maya_office_outfit',
      role: 'reference',
      altText: 'Demo illustration for Maya variant: Office Outfit',
      viewLabel: 'Outfit',
      order: 0,
      filename: 'variant_maya_office_outfit.svg',
      mimeType: 'image/svg+xml',
    },
    {
      mediaId: 'media_asset_env_cafe_day',
      role: 'reference',
      altText: 'Demo illustration for Neighborhood Cafe / Day',
      viewLabel: 'Demo card',
      order: 0,
      filename: 'asset_env_cafe_day.svg',
      mimeType: 'image/svg+xml',
    },
    {
      mediaId: 'media_asset_act_sitting_listening',
      role: 'reference',
      altText: 'Demo illustration for Sitting and Listening',
      viewLabel: 'Demo card',
      order: 0,
      filename: 'asset_act_sitting_listening.svg',
      mimeType: 'image/svg+xml',
    },
    {
      mediaId: 'media_asset_cam_closeup_push',
      role: 'reference',
      altText: 'Demo illustration for Close-up Slow Push-in',
      viewLabel: 'Demo card',
      order: 0,
      filename: 'asset_cam_closeup_push.svg',
      mimeType: 'image/svg+xml',
    },
    {
      mediaId: 'media_asset_light_overcast',
      role: 'reference',
      altText: 'Demo illustration for Gentle Overcast Exterior',
      viewLabel: 'Demo card',
      order: 0,
      filename: 'asset_light_overcast.svg',
      mimeType: 'image/svg+xml',
    },
    {
      mediaId: 'media_asset_style_minimal_2d',
      role: 'reference',
      altText: 'Demo illustration for Minimal 2D Animation',
      viewLabel: 'Demo card',
      order: 0,
      filename: 'asset_style_minimal_2d.svg',
      mimeType: 'image/svg+xml',
    },
  ],
  resultMediaLinks: [],
  reviewNotes: '',
  reviewStatus: 'unreviewed',
  revision: 1,
  createdAt: '2026-10-26T03:17:52.599Z',
  updatedAt: '2026-10-26T03:17:52.599Z',
};
