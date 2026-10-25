import type {
  Collection,
  MediaAsset,
  PromptAsset,
  PromptCategory,
  Template,
  Variant,
} from '../types/domain';
import { VARIANT_TYPE_TO_SLOT } from './validation';

const STARTER_TS = '2026-10-25T08:00:00.000Z';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createBundledIllustrationSvg(params: {
  title: string;
  subtitle: string;
  badge: string;
  accent: string;
  bgStart: string;
  bgEnd: string;
  kind?: 'portrait' | 'scene' | 'camera' | 'style';
}): string {
  const { title, subtitle, badge, accent, bgStart, bgEnd, kind = 'scene' } = params;
  const safeTitle = escapeXml(title);
  const safeSub = escapeXml(subtitle);
  const safeBadge = escapeXml(badge);

  let graphic = '';
  if (kind === 'portrait') {
    graphic = `
      <circle cx="320" cy="185" r="56" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="2.5"/>
      <circle cx="320" cy="172" r="24" fill="${accent}" fill-opacity="0.45"/>
      <path d="M276 232 C276 206, 364 206, 364 232" fill="${accent}" fill-opacity="0.35"/>
    `;
  } else if (kind === 'camera') {
    graphic = `
      <rect x="255" y="140" width="96" height="68" rx="12" fill="${accent}" fill-opacity="0.2" stroke="${accent}" stroke-width="2.5"/>
      <polygon points="355,158 388,142 388,206 355,190" fill="${accent}" fill-opacity="0.35" stroke="${accent}" stroke-width="2"/>
      <circle cx="303" cy="174" r="16" fill="${accent}" fill-opacity="0.4"/>
    `;
  } else if (kind === 'style') {
    graphic = `
      <circle cx="295" cy="172" r="42" fill="${accent}" fill-opacity="0.22" stroke="${accent}" stroke-width="2"/>
      <rect x="315" y="142" width="66" height="66" rx="14" fill="#0EA5E9" fill-opacity="0.22" stroke="${accent}" stroke-width="2"/>
    `;
  } else {
    graphic = `
      <rect x="240" y="132" width="160" height="92" rx="14" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-width="2"/>
      <path d="M252 210 L292 168 L328 198 L354 176 L388 210 Z" fill="${accent}" fill-opacity="0.32"/>
      <circle cx="362" cy="156" r="10" fill="${accent}" fill-opacity="0.5"/>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" width="640" height="420">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgStart}" />
        <stop offset="100%" stop-color="${bgEnd}" />
      </linearGradient>
    </defs>
    <rect width="640" height="420" fill="url(#bg)" />
    <rect x="24" y="24" width="592" height="372" rx="20" fill="#FFFFFF" fill-opacity="0.72" stroke="#CBD5E1" stroke-width="1.5" />
    <rect x="44" y="44" width="210" height="28" rx="14" fill="${accent}" fill-opacity="0.12" />
    <text x="58" y="63" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="${accent}">DEMO ILLUSTRATION • ${safeBadge}</text>
    ${graphic}
    <text x="320" y="292" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" fill="#0F172A">${safeTitle}</text>
    <text x="320" y="322" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#475569">${safeSub}</text>
    <text x="320" y="366" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#64748B">Bundled visual card — attach real reference files separately in your external tool</text>
  </svg>`;
}

function makeMediaFromSvg(id: string, filename: string, svg: string): MediaAsset {
  const bytes = new TextEncoder().encode(svg);
  const blob = new Blob([bytes], { type: 'image/svg+xml' });
  return {
    id,
    filename,
    safeFilename: filename,
    mimeType: 'image/svg+xml',
    byteSize: bytes.byteLength,
    blob,
    width: 640,
    height: 420,
    isBundledIllustration: true,
    createdAt: STARTER_TS,
  };
}

export function getStarterTemplates(): Template[] {
  return [
    {
      id: 'template_talking_to_camera',
      name: 'Talking to Camera',
      description: 'Direct-address monologue or presenter shot with clear eye-level framing and natural daylight.',
      category: 'Character',
      requiredSlots: ['character', 'environment', 'action'],
      defaults: {
        environment: {
          slot: 'environment',
          title: 'Quiet Studio Office / Day',
          promptText: 'A calm studio workroom with warm wood shelving, soft plants in the background, and a window to the left; daytime.',
          compactText: 'Calm daytime studio workroom with wood shelving and left window.',
        },
        action: {
          slot: 'action',
          title: 'Direct Address Speaking',
          promptText: 'Looks directly into the camera lens, speaks with measured natural hand gestures, and nods thoughtfully at the end of the phrase.',
          compactText: 'Speaks directly to camera with natural hand gestures and a thoughtful nod.',
        },
        camera: {
          slot: 'camera',
          title: 'Medium Chest-up Locked-off',
          promptText: 'Medium chest-up framing at eye level on a 50mm lens. The camera remains locked off on a tripod.',
          compactText: 'Medium chest-up eye-level 50mm locked-off shot.',
        },
        lighting: {
          slot: 'lighting',
          title: 'Soft Key Daylight',
          promptText: 'Soft diffused daylight from 45 degrees left with subtle warm bounce fill and clean catchlights.',
          compactText: 'Soft 45-degree key daylight with warm fill.',
        },
      },
      sceneInstructionsDefault: 'Single continuous take. Keep presenter posture steady and background clutter-free.',
      settingsDefault: {
        aspectRatio: '16:9',
        durationSeconds: 8,
        toolNotes: 'Suitable for presenter or vlog-style external video tools.',
      },
      illustrationSvg: createBundledIllustrationSvg({
        title: 'Talking to Camera',
        subtitle: 'Requires Character + Environment + Action',
        badge: 'TEMPLATE',
        accent: '#2563EB',
        bgStart: '#EFF6FF',
        bgEnd: '#E0F2FE',
        kind: 'portrait',
      }),
      isStarter: true,
      revision: 1,
      createdAt: STARTER_TS,
      updatedAt: STARTER_TS,
    },
    {
      id: 'template_walking_scene',
      name: 'Walking Scene',
      description: 'Character walking through an exterior or corridor setting with smooth side-tracking camera motion.',
      category: 'Character',
      requiredSlots: ['character', 'environment', 'action'],
      defaults: {
        environment: {
          slot: 'environment',
          title: 'Tree-lined City Sidewalk',
          promptText: 'A quiet tree-lined urban sidewalk with brick storefronts and dappled morning sunlight on the pavement.',
          compactText: 'Tree-lined city sidewalk with morning sunlight.',
        },
        action: {
          slot: 'action',
          title: 'Steady Forward Walk',
          promptText: 'Walks forward at an unhurried pace, glances briefly toward the street, and continues with a calm expression.',
          compactText: 'Walks forward steadily, glances toward street with calm expression.',
        },
        camera: {
          slot: 'camera',
          title: 'Smooth Gimbal Side-Tracking',
          promptText: 'Medium-wide three-quarter profile tracking shot moving smoothly backward at walking speed.',
          compactText: 'Smooth medium-wide tracking shot at walking pace.',
        },
        lighting: {
          slot: 'lighting',
          title: 'Morning Side Sunlight',
          promptText: 'Warm low-angle morning sunlight casting soft rim highlights and gentle pavement shadows.',
          compactText: 'Warm low-angle morning sunlight with soft rim light.',
        },
      },
      sceneInstructionsDefault: 'Maintain consistent walking cadence across the full shot.',
      settingsDefault: {
        aspectRatio: '16:9',
        durationSeconds: 6,
      },
      illustrationSvg: createBundledIllustrationSvg({
        title: 'Walking Scene',
        subtitle: 'Requires Character + Environment + Action',
        badge: 'TEMPLATE',
        accent: '#0284C7',
        bgStart: '#F0F9FF',
        bgEnd: '#E0F2FE',
        kind: 'camera',
      }),
      isStarter: true,
      revision: 1,
      createdAt: STARTER_TS,
      updatedAt: STARTER_TS,
    },
    {
      id: 'template_product_showcase',
      name: 'Product Showcase',
      description: 'Tabletop or hero object showcase. Character is optional; focuses on setting, object motion, and lighting.',
      category: 'Product',
      requiredSlots: ['environment', 'action'],
      defaults: {
        environment: {
          slot: 'environment',
          title: 'Minimal Stone Tabletop',
          promptText: 'A matte travertine stone tabletop with soft architectural shadows and a clean warm-gray backdrop.',
          compactText: 'Matte travertine tabletop with warm-gray backdrop.',
        },
        action: {
          slot: 'action',
          title: 'Hero Object Turntable Reveal',
          promptText: 'A matte ceramic pour-over coffee carafe rests on the stone surface as a thin ribbon of warm steam rises gently from the spout.',
          compactText: 'Ceramic coffee carafe on stone surface with gentle rising steam.',
        },
        camera: {
          slot: 'camera',
          title: 'Macro Slow Push-In',
          promptText: 'Close-up 85mm macro shot with shallow depth of field, executing a slow, steady 10% push-in.',
          compactText: '85mm macro close-up with slow steady push-in.',
        },
        lighting: {
          slot: 'lighting',
          title: 'Controlled Rim & Softbox',
          promptText: 'Overhead diffused softbox key with crisp warm side rim lighting accentuating surface texture.',
          compactText: 'Diffused overhead softbox with crisp warm rim light.',
        },
      },
      sceneInstructionsDefault: 'Scenery/product shot — no character required unless manually added.',
      settingsDefault: {
        aspectRatio: '1:1',
        durationSeconds: 5,
      },
      illustrationSvg: createBundledIllustrationSvg({
        title: 'Product Showcase',
        subtitle: 'Requires Environment + Action (Character optional)',
        badge: 'TEMPLATE',
        accent: '#4F46E5',
        bgStart: '#EEF2FF',
        bgEnd: '#E0E7FF',
        kind: 'scene',
      }),
      isStarter: true,
      revision: 1,
      createdAt: STARTER_TS,
      updatedAt: STARTER_TS,
    },
    {
      id: 'template_cinematic_broll',
      name: 'Cinematic B-roll',
      description: 'Atmospheric establishing or environmental transition shot. Works without a character.',
      category: 'B-roll',
      requiredSlots: ['environment', 'action'],
      defaults: {
        environment: {
          slot: 'environment',
          title: 'Rain-Washed Cafe Window',
          promptText: 'An exterior glass window of a corner cafe at dusk with warm interior pendant lamps reflected on wet pavement.',
          compactText: 'Corner cafe window at dusk with warm reflections on wet pavement.',
        },
        action: {
          slot: 'action',
          title: 'Ambient Rain & Passing Headlights',
          promptText: 'Light raindrops trickle down the windowpane while out-of-focus amber bokeh headlights glide slowly across the glass reflection.',
          compactText: 'Raindrops on glass with slow amber bokeh reflections.',
        },
        camera: {
          slot: 'camera',
          title: 'Locked-off Shallow Focus',
          promptText: 'Static 50mm composition focused on the raindrops on the glass with soft background bokeh.',
          compactText: 'Static 50mm shot focused on glass raindrops.',
        },
        lighting: {
          slot: 'lighting',
          title: 'Blue Hour & Warm Practicals',
          promptText: 'Cool blue-hour ambient twilight balanced against warm 2700K tungsten cafe interior practicals.',
          compactText: 'Cool twilight balanced with warm tungsten interior glow.',
        },
        style: {
          slot: 'style',
          title: 'Naturalistic Cinema Grade',
          promptText: 'Naturalistic live-action cinema aesthetic with subtle film grain and restrained highlight roll-off.',
          compactText: 'Naturalistic cinema aesthetic with subtle grain.',
        },
      },
      sceneInstructionsDefault: 'Atmospheric B-roll shot. Keep camera motion minimal.',
      settingsDefault: {
        aspectRatio: '16:9',
        durationSeconds: 6,
      },
      illustrationSvg: createBundledIllustrationSvg({
        title: 'Cinematic B-roll',
        subtitle: 'Requires Environment + Action (Character optional)',
        badge: 'TEMPLATE',
        accent: '#0D9488',
        bgStart: '#F0FDFA',
        bgEnd: '#CCFBF1',
        kind: 'style',
      }),
      isStarter: true,
      revision: 1,
      createdAt: STARTER_TS,
      updatedAt: STARTER_TS,
    },
  ];
}

interface RawStarterAsset {
  id: string;
  title: string;
  category: PromptCategory;
  description: string;
  promptText: string;
  compactText?: string;
  avoidText?: string;
  tags: string[];
  favorite?: boolean;
  accent: string;
  kind: 'portrait' | 'scene' | 'camera' | 'style';
}

const RAW_STARTER_ASSETS: RawStarterAsset[] = [
  // Characters (3)
  {
    id: 'asset_char_maya',
    title: 'Maya Santos / Base Identity',
    category: 'characters',
    description: 'Fictional adult Filipina lead character identity for drama and lifestyle scenes.',
    promptText:
      'Maya is a fictional adult Filipina woman, 28, with an oval face, warm medium-brown skin, expressive dark brown eyes, shoulder-length wavy black hair with a natural side part, and an average build. Keep these core identity traits consistent.',
    avoidText: 'altered facial structure, different hair length, heavy glam makeup',
    tags: ['Adult', 'Realistic', 'Lead'],
    favorite: true,
    accent: '#2563EB',
    kind: 'portrait',
  },
  {
    id: 'asset_char_nico',
    title: 'Nico Reyes / Base Identity',
    category: 'characters',
    description: 'Fictional adult male architect character with rectangular glasses and short fade haircut.',
    promptText:
      'Nico is a fictional adult Filipino man, 32, with a square jawline, warm tan skin, dark eyes behind thin matte-black rectangular eyeglasses, neatly cropped black hair with a low taper, and a lean athletic build. Keep these core identity traits consistent.',
    avoidText: 'missing eyeglasses, long hair, beard changes',
    tags: ['Adult', 'Realistic', 'Glasses'],
    favorite: false,
    accent: '#1D4ED8',
    kind: 'portrait',
  },
  {
    id: 'asset_char_lina',
    title: 'Lina Cruz / Base Identity',
    category: 'characters',
    description: 'Fictional seasoned creative director in her late 40s with silver-streaked bob haircut.',
    promptText:
      'Lina is a fictional adult woman, 47, with high cheekbones, olive-toned skin, calm hazel-brown eyes, a chin-length bob of dark hair with natural silver streaks at the temples, and an upright poised posture. Keep these core identity traits consistent.',
    avoidText: 'youthful age regression, long hair',
    tags: ['Adult', 'Realistic', 'Mentor'],
    favorite: false,
    accent: '#3B82F6',
    kind: 'portrait',
  },

  // Clothing & Accessories (3)
  {
    id: 'asset_ward_casual_white',
    title: 'Casual White Shirt',
    category: 'wardrobe',
    description: 'Clean everyday smart-casual cotton shirt and denim combination.',
    promptText:
      'Wears a crisp relaxed-fit white linen button-down shirt with sleeves rolled to the forearms, classic mid-wash straight-leg denim jeans, and a minimalist brown leather wristwatch.',
    compactText: 'Relaxed white linen shirt with rolled sleeves, mid-wash jeans, brown leather watch.',
    avoidText: 'logos, graphic prints, formal necktie',
    tags: ['Casual', 'Daywear', 'Minimal'],
    favorite: true,
    accent: '#0284C7',
    kind: 'portrait',
  },
  {
    id: 'asset_ward_navy_office',
    title: 'Navy Office Outfit',
    category: 'wardrobe',
    description: 'Tailored business blazer and trousers for studio or office scenes.',
    promptText:
      'Wears a structured navy-blue wool blazer over a tucked ivory silk blouse, tailored charcoal trousers, and small brushed-silver stud earrings.',
    compactText: 'Structured navy blazer over ivory blouse, charcoal trousers, silver stud earrings.',
    avoidText: 'wrinkled fabric, neon colors',
    tags: ['Formal', 'Office', 'Tailored'],
    favorite: false,
    accent: '#0369A1',
    kind: 'portrait',
  },
  {
    id: 'asset_ward_weekend',
    title: 'Relaxed Weekend Outfit',
    category: 'wardrobe',
    description: 'Layered knit cardigan and canvas tote for outdoor or cafe moments.',
    promptText:
      'Wears an oatmeal-beige ribbed cotton crewneck tee beneath an olive-green overshirt jacket, dark chinos, white low-top sneakers, and a cream canvas shoulder tote.',
    compactText: 'Oatmeal tee under olive overshirt, dark chinos, white sneakers, canvas tote.',
    tags: ['Weekend', 'Layered', 'Outdoor'],
    favorite: false,
    accent: '#0EA5E9',
    kind: 'portrait',
  },

  // Actions & Emotions (3)
  {
    id: 'asset_act_sitting_listening',
    title: 'Sitting and Listening',
    category: 'actions',
    description: 'Attentive seated performance at a table with subtle notebook interaction.',
    promptText:
      'Sits comfortably at the table, gently closes a hardcover notebook with both hands, and looks toward someone just off-camera with an attentive, restrained smile.',
    compactText: 'Sits at table, closes notebook, looks off-camera with a restrained smile.',
    avoidText: 'exaggerated laughing, erratic hand waving',
    tags: ['Seated', 'Subtle', 'Dialogue-Ready'],
    favorite: true,
    accent: '#4F46E5',
    kind: 'scene',
  },
  {
    id: 'asset_act_walking_smile',
    title: 'Walking with a Restrained Smile',
    category: 'actions',
    description: 'Unhurried forward walk suitable for tracking shots.',
    promptText:
      'Walks forward at a relaxed, steady pace along the path, glances warmly toward the side, and offers a calm, natural half-smile.',
    compactText: 'Walks forward steadily, glances aside with a calm half-smile.',
    tags: ['Walking', 'Exterior', 'Calm'],
    favorite: false,
    accent: '#4338CA',
    kind: 'scene',
  },
  {
    id: 'asset_act_speaking_camera',
    title: 'Speaking to Camera',
    category: 'actions',
    description: 'Direct-to-lens explanation with natural conversational gestures.',
    promptText:
      'Maintains steady eye contact with the camera lens while speaking clearly, using measured open-palm hand gestures to emphasize key points.',
    compactText: 'Speaks directly to camera lens with measured open-palm gestures.',
    tags: ['Presenter', 'Direct', 'Speaking'],
    favorite: false,
    accent: '#6366F1',
    kind: 'scene',
  },

  // Environments (3)
  {
    id: 'asset_env_cafe_day',
    title: 'Neighborhood Cafe / Day',
    category: 'environments',
    description: 'Sunlit corner cafe with wooden tables and greenery.',
    promptText:
      'A quiet neighborhood cafe interior with pale oak tables, ceramic cups, potted indoor monstera plants, and a tall street-facing window on the left letting in clear daytime light.',
    compactText: 'Quiet daytime neighborhood cafe with pale oak tables and left window.',
    avoidText: 'crowded bar, flashing neon signs',
    tags: ['Indoor', 'Cafe', 'Daytime'],
    favorite: true,
    accent: '#0D9488',
    kind: 'scene',
  },
  {
    id: 'asset_env_apartment_evening',
    title: 'Apartment Living Room / Evening',
    category: 'environments',
    description: 'Warm lived-in modern apartment at dusk.',
    promptText:
      'A cozy modern apartment living room in the evening with a low fabric sofa, walnut bookshelf, framed prints, and a warm floor lamp glowing near rain-speckled balcony glass.',
    compactText: 'Cozy evening apartment living room with walnut bookshelf and warm floor lamp.',
    tags: ['Indoor', 'Evening', 'Home'],
    favorite: false,
    accent: '#0F766E',
    kind: 'scene',
  },
  {
    id: 'asset_env_city_sidewalk',
    title: 'Quiet City Sidewalk',
    category: 'environments',
    description: 'Clean urban walkway with brick facades and trees.',
    promptText:
      'A clean tree-lined city sidewalk bordered by warm brick Ground-floor cafés, cast-iron streetlamps, and soft morning traffic blurred in the far distance.',
    compactText: 'Tree-lined brick city sidewalk with blurred morning background.',
    tags: ['Outdoor', 'Urban', 'Morning'],
    favorite: false,
    accent: '#14B8A6',
    kind: 'scene',
  },

  // Camera & Movement (3)
  {
    id: 'asset_cam_medium_locked',
    title: 'Medium Eye-level Locked-off',
    category: 'camera',
    description: 'Stable tripod framing from waist up at eye level.',
    promptText:
      'Medium shot at eye level from a front three-quarter angle on a 50mm prime lens with natural depth of field. The camera remains completely locked off.',
    compactText: 'Medium eye-level front 3/4 shot, 50mm lens, locked-off.',
    avoidText: 'handheld shake, whip pan, dutch angle',
    tags: ['Medium', 'Static', '50mm'],
    favorite: true,
    accent: '#7C3AED',
    kind: 'camera',
  },
  {
    id: 'asset_cam_closeup_push',
    title: 'Close-up Slow Push-in',
    category: 'camera',
    description: 'Intimate shoulder-up framing with a gentle dolly in.',
    promptText:
      'Shoulder-up close-up at eye level on an 85mm lens with soft background bokeh, executing a slow, controlled dolly push-in over the duration of the shot.',
    compactText: '85mm eye-level close-up with slow controlled dolly push-in.',
    tags: ['Close-up', 'Push-in', '85mm'],
    favorite: false,
    accent: '#6D28D9',
    kind: 'camera',
  },
  {
    id: 'asset_cam_wide_tracking',
    title: 'Wide Side Tracking Shot',
    category: 'camera',
    description: 'Smooth lateral or backward gimbal tracking shot.',
    promptText:
      'Medium-wide 35mm gimbal shot tracking smoothly alongside the subject at walking pace while preserving consistent headroom and lead room.',
    compactText: '35mm medium-wide gimbal tracking shot at walking pace.',
    tags: ['Wide', 'Tracking', '35mm'],
    favorite: false,
    accent: '#8B5CF6',
    kind: 'camera',
  },

  // Lighting & Mood (3)
  {
    id: 'asset_light_window_day',
    title: 'Soft Window Daylight',
    category: 'lighting',
    description: 'Natural directional daylight with gentle shadow roll-off.',
    promptText:
      'Soft diffused daylight streaming from the left window, wrapping naturally across the subject with gentle shadow falloff and clean neutral-warm highlights.',
    compactText: 'Soft diffused left-window daylight with gentle shadows.',
    tags: ['Daylight', 'Soft', 'Natural'],
    favorite: true,
    accent: '#D97706',
    kind: 'style',
  },
  {
    id: 'asset_light_practical_evening',
    title: 'Warm Practical Evening',
    category: 'lighting',
    description: 'Intimate tungsten lamp glow balanced against cool twilight.',
    promptText:
      'Warm 2700K tungsten practical lamp key light paired with subtle cool blue-hour ambient fill in the background shadows.',
    compactText: 'Warm 2700K practical lamp key with cool twilight shadow fill.',
    tags: ['Evening', 'Warm', 'Practical'],
    favorite: false,
    accent: '#B45309',
    kind: 'style',
  },
  {
    id: 'asset_light_overcast',
    title: 'Gentle Overcast Exterior',
    category: 'lighting',
    description: 'Even, shadow-free outdoor sky diffusion.',
    promptText:
      'Even, shadowless overcast sky lighting that preserves soft skin tones and balanced exposure across foreground and background.',
    compactText: 'Even soft overcast exterior lighting.',
    tags: ['Exterior', 'Overcast', 'Even'],
    favorite: false,
    accent: '#F59E0B',
    kind: 'style',
  },

  // Art Styles (3)
  {
    id: 'asset_style_natural_drama',
    title: 'Naturalistic Live-action Drama',
    category: 'styles',
    description: 'Grounded cinema look with true-to-life skin texture and subtle film grain.',
    promptText:
      'Naturalistic live-action cinema drama with restrained color grading, authentic skin texture, subtle 35mm film grain, and smooth highlight roll-off.',
    compactText: 'Naturalistic live-action drama, restrained color grade, subtle 35mm grain.',
    avoidText: 'plastic skin smoothing, oversaturated neon, cartoon cel shading',
    tags: ['Realistic', 'Cinema', 'Live-action'],
    favorite: true,
    accent: '#E11D48',
    kind: 'style',
  },
  {
    id: 'asset_style_stylized_3d',
    title: 'Soft Stylized 3D',
    category: 'styles',
    description: 'Tactile animated feature look with warm subsurface scattering.',
    promptText:
      'High-craft stylized 3D feature animation with soft subsurface lighting on skin, tactile fabric weaves, and gentle painterly depth of field.',
    compactText: 'Stylized 3D feature animation with tactile materials and soft lighting.',
    tags: ['3D', 'Stylized', 'Animated'],
    favorite: false,
    accent: '#BE123C',
    kind: 'style',
  },
  {
    id: 'asset_style_minimal_2d',
    title: 'Minimal 2D Animation',
    category: 'styles',
    description: 'Clean hand-drawn editorial linework and muted watercolor fills.',
    promptText:
      'Clean 2D hand-drawn animation with expressive ink linework, warm paper texture, and muted editorial gouache color washes.',
    compactText: 'Clean 2D hand-drawn ink linework with muted gouache washes.',
    tags: ['2D', 'Illustration', 'Editorial'],
    favorite: false,
    accent: '#F43F5E',
    kind: 'style',
  },
];

export interface StarterLibraryBundle {
  assets: PromptAsset[];
  variants: Variant[];
  collections: Collection[];
  templates: Template[];
  media: MediaAsset[];
}

export function buildStarterLibraryBundle(): StarterLibraryBundle {
  const media: MediaAsset[] = [];
  const assets: PromptAsset[] = RAW_STARTER_ASSETS.map((raw, idx) => {
    const mediaId = `media_${raw.id}`;
    const filename = `${raw.id}.svg`;
    const svg = createBundledIllustrationSvg({
      title: raw.title,
      subtitle: raw.description,
      badge: raw.category.toUpperCase(),
      accent: raw.accent,
      bgStart: '#F8FAFC',
      bgEnd: '#EFF6FF',
      kind: raw.kind,
    });
    media.push(makeMediaFromSvg(mediaId, filename, svg));

    return {
      id: raw.id,
      title: raw.title,
      category: raw.category,
      description: raw.description,
      promptText: raw.promptText,
      compactText: raw.compactText,
      avoidText: raw.avoidText,
      tags: raw.tags,
      mediaLinks: [
        {
          mediaId,
          role: 'reference',
          altText: `Demo illustration for ${raw.title}`,
          viewLabel: 'Demo card',
          order: 0,
          filename,
          mimeType: 'image/svg+xml',
        },
      ],
      coverMediaId: mediaId,
      favorite: Boolean(raw.favorite),
      reviewStatus: idx % 2 === 0 ? 'user-approved' : 'unreviewed',
      provenance: {
        toolName: 'Starter Library (Illustrative)',
        settingsNotes: 'Demo prompt component — replace or pair with your own generated samples.',
      },
      notes: 'Bundled starter library entry.',
      isStarter: true,
      revision: 1,
      createdAt: STARTER_TS,
      updatedAt: new Date(Date.parse(STARTER_TS) + (RAW_STARTER_ASSETS.length - idx) * 1000).toISOString(),
    };
  });

  const rawVariants: Array<{
    id: string;
    type: Variant['type'];
    title: string;
    description: string;
    promptText: string;
    compactText: string;
    tags: string[];
  }> = [
    {
      id: 'variant_maya_office_outfit',
      type: 'Outfit',
      title: 'Office Outfit',
      description: 'Structured navy blazer and ivory shirt for Maya.',
      promptText:
        'She wears a navy blazer over a plain white shirt, charcoal trousers, and small silver stud earrings.',
      compactText: 'Navy blazer over white shirt, charcoal trousers, silver stud earrings.',
      tags: ['Formal', 'Office'],
    },
    {
      id: 'variant_maya_restrained_smile',
      type: 'Expression',
      title: 'Restrained Smile',
      description: 'Warm, subtle expression without exaggerated grin.',
      promptText:
        'She holds a calm, attentive expression that softens into a warm, restrained smile with relaxed eyes.',
      compactText: 'Calm attentive expression softening into a restrained smile.',
      tags: ['Subtle', 'Warm'],
    },
    {
      id: 'variant_maya_seated_pose',
      type: 'Pose',
      title: 'Seated Listening Pose',
      description: 'Seated upright at a table with hands resting on a closed notebook.',
      promptText:
        'She sits upright at the table, forearms resting lightly on a closed hardcover notebook, leaning slightly forward as she listens.',
      compactText: 'Seated upright at table, hands on closed notebook, leaning slightly forward.',
      tags: ['Seated', 'Table'],
    },
    {
      id: 'variant_maya_closeup_angle',
      type: 'Camera Angle',
      title: 'Front Three-quarter Close-up',
      description: 'Eye-level 3/4 portrait framing for conversational shots.',
      promptText:
        'Medium-close framing at eye level from a front three-quarter angle on a 50mm lens, camera locked off.',
      compactText: 'Eye-level front 3/4 medium-close shot, 50mm locked-off.',
      tags: ['Close-up', '3/4 Angle'],
    },
    {
      id: 'variant_maya_cafe_location',
      type: 'Location',
      title: 'Cafe Location',
      description: 'Daytime neighborhood cafe corner table.',
      promptText:
        'A quiet neighborhood cafe with pale wooden tables and a sunlit window on the left; daytime.',
      compactText: 'Quiet daytime cafe with pale wooden tables and left window.',
      tags: ['Cafe', 'Daytime'],
    },
    {
      id: 'variant_maya_drama_style',
      type: 'Visual Style',
      title: 'Naturalistic Drama Style',
      description: 'Grounded live-action drama aesthetic.',
      promptText:
        'Naturalistic live-action drama with restrained color grading and soft highlight roll-off.',
      compactText: 'Naturalistic live-action drama with restrained color grading.',
      tags: ['Realistic', 'Drama'],
    },
  ];

  const variants: Variant[] = rawVariants.map((rv, idx) => {
    const mediaId = `media_${rv.id}`;
    const filename = `${rv.id}.svg`;
    const svg = createBundledIllustrationSvg({
      title: `Maya • ${rv.title}`,
      subtitle: `${rv.type} Variant`,
      badge: rv.type.toUpperCase(),
      accent: '#2563EB',
      bgStart: '#EFF6FF',
      bgEnd: '#F8FAFC',
      kind: 'portrait',
    });
    media.push(makeMediaFromSvg(mediaId, filename, svg));

    return {
      id: rv.id,
      parentCharacterId: 'asset_char_maya',
      type: rv.type,
      targetSlot: VARIANT_TYPE_TO_SLOT[rv.type],
      title: rv.title,
      description: rv.description,
      promptText: rv.promptText,
      compactText: rv.compactText,
      tags: rv.tags,
      mediaLinks: [
        {
          mediaId,
          role: 'reference',
          altText: `Demo illustration for Maya variant: ${rv.title}`,
          viewLabel: rv.type,
          order: 0,
          filename,
          mimeType: 'image/svg+xml',
        },
      ],
      coverMediaId: mediaId,
      favorite: rv.type === 'Outfit',
      reviewStatus: 'user-approved',
      notes: 'Linked to Maya Santos / Base Identity.',
      isStarter: true,
      revision: 1,
      createdAt: STARTER_TS,
      updatedAt: new Date(Date.parse(STARTER_TS) + (RAW_STARTER_ASSETS.length - idx) * 1000).toISOString(),
    };
  });

  const collections: Collection[] = [
    {
      id: 'collection_drama_series',
      name: 'Drama Series',
      description: 'Cafe and apartment conversational scenes featuring Maya and Nico.',
      members: [
        { type: 'asset', id: 'asset_char_maya', addedAt: STARTER_TS },
        { type: 'asset', id: 'asset_char_nico', addedAt: STARTER_TS },
        { type: 'asset', id: 'asset_env_cafe_day', addedAt: STARTER_TS },
        { type: 'asset', id: 'asset_act_sitting_listening', addedAt: STARTER_TS },
        { type: 'variant', id: 'variant_maya_office_outfit', addedAt: STARTER_TS },
        { type: 'variant', id: 'variant_maya_restrained_smile', addedAt: STARTER_TS },
      ],
      isStarter: true,
      createdAt: STARTER_TS,
      updatedAt: STARTER_TS,
    },
    {
      id: 'collection_product_ads',
      name: 'Product Ads',
      description: 'Clean studio and tabletop lighting, macro camera moves, and presenter prompts.',
      members: [
        { type: 'asset', id: 'asset_cam_closeup_push', addedAt: STARTER_TS },
        { type: 'asset', id: 'asset_light_window_day', addedAt: STARTER_TS },
        { type: 'asset', id: 'asset_act_speaking_camera', addedAt: STARTER_TS },
      ],
      isStarter: true,
      createdAt: STARTER_TS,
      updatedAt: STARTER_TS,
    },
    {
      id: 'collection_character_pack',
      name: 'Character Pack',
      description: 'Reusable base character identities and core wardrobe layers.',
      members: [
        { type: 'asset', id: 'asset_char_maya', addedAt: STARTER_TS },
        { type: 'asset', id: 'asset_char_nico', addedAt: STARTER_TS },
        { type: 'asset', id: 'asset_char_lina', addedAt: STARTER_TS },
        { type: 'variant', id: 'variant_maya_office_outfit', addedAt: STARTER_TS },
      ],
      isStarter: true,
      createdAt: STARTER_TS,
      updatedAt: STARTER_TS,
    },
  ];

  return {
    assets,
    variants,
    collections,
    templates: getStarterTemplates(),
    media,
  };
}
