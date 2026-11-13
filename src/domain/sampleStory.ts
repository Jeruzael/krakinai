import type { Story } from '../types/domain';

export const SAMPLE_STORY_CREATOR_MODE: Story = {
  id: 'story_wool_and_fang',
  title: 'Wool and Fang: The Timberline Snare',
  author: 'KRAKINAI Studio & Antigravity',
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-11T08:00:00.000Z',
  archivedAt: null,
  favorite: true,
  revisionNumber: 3,
  tags: ['high-fantasy', 'drama', 'cinematic', 'beastfolk', 'rivalry', 'healing'],
  logline: 'A wounded silver wolf raider and a compassionate sheep healer forge a desperate alliance when ruthless warhounds corner them along the frostbitten timberline.',
  premise: 'Can empathy bridge the ancient divide when two rival beastfolk are forced to choose between loyalty to their bloodline and preserving innocent life?',
  synopsis: 'Amidst a brutal winter famine, Kael\'s starving wolf pack descends upon Meadowbrook Village. When brutal Mastiff Enforcers ambush the raiders with spiked iron collars, Kael is mortally wounded and hidden by Elowen, a gentle sheep healer. Hidden in a darkened apothecary cellar, the unlikely pair must race against both the pack\'s vengeance and the dogs\' wrath before dawn brings an inevitable massacre.',
  treatment: `ACT I: THE FAMINE RAID
In the bitter cold dawn, mist blankets the pine ridge above Meadowbrook Village. Kael (20s, silver wolf) watches the peaceful sheepfolk harvesting winter apples. Beside him, Alpha Vane demands blood. When Vane unleashes the raid, chaos erupts. In the scramble, Elowen (20s, cream-wooled sheep healer) risks her life to pull a fallen lamb to safety. Kael hesitates to strike her, paralyzed by her bravery.

ACT II: THE IRON COLLARS & THE HEALER'S CELLAR
Before the pack can breach the granary, the garrison gates explode outward. Garrick and his Mastiff Enforcers charge in spiked iron collars and plate armor, cutting the starving wolves down. Kael is impaled against a timber millstone by an iron lance. As Garrick\'s dogs sweep the alleyways, Elowen discovers the bleeding wolf. Refusing to let him die, she drags Kael into her underground apothecary cellar and binds his wounds with willow bark.

ACT III: DAWN AT FIRST LIGHT
Vane gathers the survivors for a fiery reprisal, while Garrick issues an ultimatum to burn every suspect house. Trapped between two ruthless leaders, Kael stands before Vane's wolves and Elowen confronts the village council. In a climactic standoff at the village gate, Kael breaks his pack alpha's lance, sparing the village and establishing a fragile new covenant between sheep and fang.`,
  fullBookText: `Chapter 1: Shadows on the Ridge

A heavy blanket of morning mist clung to the pine needle timberline overlooking Meadowbrook Village. Below in the tranquil valley, humanoid sheep in woven linen aprons tended to apple orchards and stone cottages, their curved horn crowns and snowy wool catching the pale amber rays of dawn.

Crouched inside the thorny perimeter brush was Kael—a lean, silver-furred humanoid wolf clad in scarred leather brigandine. His amber eyes tracked the peaceful village below, his hollow stomach aching from two months of unrelenting winter famine. Beside him towered Vane, the jagged-eared alpha of the raiding party, flanked by four shivering, gaunt wolves.

"Walang bantay sa silangang bakod," Vane growled in a predatory whisper, yellow fangs bared. "Pagbilang ko ng tatlo, sunggaban n'yo agad ang nasa bungad. Walang matitira."

Kael tightened his grip on his iron-banded quarterstaff. His claws dug into the frozen black loam. Hunt or starve—that was the unforgiving law of the pack. Yet as his eyes locked onto a young lamb stumbling in the orchard, an unfamiliar ache tightened in his chest.

Chapter 2: The Iron Snare

The howling began before Kael could breathe. The wolves surged across the low stone wall like grey phantoms. The village watchtower bell clanged frantic, broken chimes into the winter air.

Baskets tumbled, spilling red apples across the frosted pavers. Amidst the screams, Elowen slid across the wet cobblestones, wrapping her slender arms around the weeping lamb and shoving the child into an open cellar hatch. She turned just as Kael rounded the alleyway, staff raised.

For a heartbeat, wolf and sheep stared into each other's eyes. In hers was defiance; in his, shame.

Then the garrison gates blew outward with an ear-shattering crash.

Heavy iron gauntlets slammed into stone. Towering over the alley was Garrick, Captain of the Mastiff Vanguard, his cropped ears pinned flat and heavy jowls dripping with fury. "Trespassers," the captain snarled. "Iron collars for every stray hound!"

Chapter 3: The Sanctuary Below

A heavy iron bolt caught Kael beneath the shoulder blade. The world spun into darkness and blood.

When his eyes flickered open, he was not chained to the garrison stocks. Soft candlelight flickered over dried chamomile bundles, row upon row of amber tinctures, and stone mortar bowls. Gentle hands pressed crushed willow bark and clean linen against his torn flesh.

"Don't move," Elowen whispered, her voice trembling but steady. "If Garrick hears you breathe, he will burn this cellar with both of us inside."

Kael looked down at his bloodstained claws, then up at her horn crown. "Bakit mo 'ko niligtas?" he rasped. "Lobo ako. Kaaway mo ako."

Elowen did not flinch. "Dahil nakita ko kung paano mo tiningnan 'yung bata kanina. Hindi ka halimaw, Kael. Gutom ka lang."`,
  referencePack: {
    assetIds: ['asset_char_maya', 'asset_char_nico', 'asset_env_cafe_day'],
    variantIds: ['variant_maya_office_outfit'],
    mediaIds: [],
  },
  linkedCollectionId: 'collection_drama_series',
  colorScript: [
    {
      id: 'cs_timberline_dawn',
      orderIndex: 0,
      label: 'Timberline Dawn Mist',
      targetNodeId: 'act_1_famine_raid',
      hexPalette: ['#1E293B', '#334155', '#475569', '#94A3B8'],
      notes: 'Desaturated cold slate blues and dense pine mist before the assault',
    },
    {
      id: 'cs_iron_blood',
      orderIndex: 1,
      label: 'Iron Collars & Blood',
      targetNodeId: 'act_2_iron_collars',
      hexPalette: ['#450A0A', '#7F1D1D', '#991B1B', '#DC2626'],
      notes: 'Visceral crimson flares and cold burnished steel as the garrison retaliates',
    },
    {
      id: 'cs_first_light',
      orderIndex: 2,
      label: 'The First Light Covenant',
      targetNodeId: 'act_3_first_light',
      hexPalette: ['#FEF3C7', '#FDE68A', '#F59E0B', '#D97706'],
      notes: 'Warm amber dawn breaking through the valley as the standoff resolves peacefully',
    },
  ],
  acts: [
    {
      id: 'act_1_famine_raid',
      orderIndex: 0,
      title: 'Act I: The Famine Raid',
      summary: 'Desperate wolves plan and launch a dawn raid on Meadowbrook Village.',
      dramaticMeta: {
        incitingIncident: 'Alpha Vane orders the dawn strike against the undefended eastern orchards.',
        subtext: 'Kael hides his moral aversion to slaughter behind the imperative of pack survival.',
        setupForeshadowing: ['Kael flinches when sighting a defenseless lamb', 'Alpha Vane\'s yellowed fang dagger'],
        characterArcs: [
          {
            characterAssetId: 'asset_char_maya',
            arcState: 'conflicted',
            internalShift: 'from unquestioned pack obedience to conscience-driven hesitation',
          },
        ],
      },
      sequences: [
        {
          id: 'seq_1_timberline',
          orderIndex: 0,
          title: 'Sequence 1: The Timberline Descent',
          summary: 'Scouting the orchards and launching the assault.',
          dramaticMeta: {
            subtext: 'The wolves are starving; this raid is driven by sheer winter desperation.',
          },
          scenes: [
            {
              id: 'scene_1_shadows_ridge',
              orderIndex: 0,
              title: 'Scene 1: Shadows on the Ridge',
              summary: 'Kael and Vane survey the morning mist from the briar patch.',
              dramaticMeta: {
                setupForeshadowing: ['A frayed leather brigandine strap on Kael\'s shoulder'],
              },
              beats: [
                {
                  id: 'beat_1_hunger_watch',
                  orderIndex: 0,
                  title: 'The Hunger Watch',
                  content: 'Silver wolf Kael crouches in damp briars, watching sheepfolk pick winter apples below.',
                  dramaticMeta: {
                    subtext: 'Kael feels the gnawing winter hunger but dreads the coming blood.',
                  },
                },
                {
                  id: 'beat_2_howl_signal',
                  orderIndex: 1,
                  title: 'The Howl Signal',
                  content: 'Vane gives the guttural command to breach the stone boundary.',
                  dramaticMeta: {
                    incitingIncident: 'Vane gives the kill order; the raid is underway.',
                  },
                },
              ],
            },
            {
              id: 'scene_2_village_panic',
              orderIndex: 1,
              title: 'Scene 2: Chaos in the Orchard',
              summary: 'Wolves burst over the fieldstone wall as the alarm bell clangs.',
              beats: [
                {
                  id: 'beat_3_healer_rescue',
                  orderIndex: 0,
                  title: 'The Healer\'s Rescue',
                  content: 'Elowen slides through spilled fruit to thrust a fallen lamb into a cellar shelter.',
                  dramaticMeta: {
                    payoff: ['The lamb is saved, establishing Elowen\'s selfless courage.'],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'act_2_iron_collars',
      orderIndex: 1,
      title: 'Act II: The Iron Collars & Sanctuary',
      summary: 'The Mastiff Vanguard ambushes the raiders; a wounded Kael finds refuge in Elowen\'s cellar.',
      dramaticMeta: {
        incitingIncident: 'Garrick\'s armored Mastiff Dogs counterattack with lethal iron collars.',
        climax: 'An iron crossbow bolt impales Kael against the timber millstone.',
        subtext: 'Elowen chooses medical compassion over lifelong prejudice.',
        setupForeshadowing: ['Garrick\'s vow to burn every house hiding a raider', 'Willow bark poultice jar'],
      },
      sequences: [
        {
          id: 'seq_2_ambush_sanctuary',
          orderIndex: 0,
          title: 'Sequence 2: The Counterattack & The Healer\'s Cellar',
          summary: 'Kael falls in combat and is sheltered in secret.',
          scenes: [
            {
              id: 'scene_3_garrison_charge',
              orderIndex: 0,
              title: 'Scene 3: The Garrison Blowout',
              summary: 'Iron-collared Mastiffs drive the wolves into retreat.',
              beats: [
                {
                  id: 'beat_4_kael_down',
                  orderIndex: 0,
                  title: 'Kael Down',
                  content: 'Kael is wounded protecting an elderly villager from crossfire.',
                  dramaticMeta: {
                    climax: 'Kael collapses in the rain-slicked alleyway.',
                  },
                },
              ],
            },
            {
              id: 'scene_4_apothecary_cellar',
              orderIndex: 1,
              title: 'Scene 4: The Apothecary Sanctuary',
              summary: 'Elowen drags the wounded wolf into her subterranean dispensary.',
              beats: [
                {
                  id: 'beat_5_pact_of_willow',
                  orderIndex: 0,
                  title: 'The Pact of Willow Bark',
                  content: 'Elowen tends Kael\'s wounds in candlelight while patrol boots thud on the street above.',
                  dramaticMeta: {
                    subtext: 'Enemy becomes patient; mutual humanity discovered under fire.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'act_3_first_light',
      orderIndex: 2,
      title: 'Act III: Dawn at First Light',
      summary: 'Kael intervenes between Vane\'s vengeance and Garrick\'s brutality, ending the blood cycle.',
      dramaticMeta: {
        climax: 'Kael shatters Vane\'s lance at the village gate and forces a ceasefire.',
        payoff: ['The silver wolf spares Meadowbrook', 'The iron collars are turned back'],
        characterArcs: [
          {
            characterAssetId: 'asset_char_maya',
            arcState: 'transformed',
            internalShift: 'became the bridge of peace between wolf and sheep',
          },
        ],
      },
      sequences: [
        {
          id: 'seq_3_standoff',
          orderIndex: 0,
          title: 'Sequence 3: The Gate Standoff',
          summary: 'The final confrontation at the stone village gates.',
          scenes: [
            {
              id: 'scene_5_first_light_covenant',
              orderIndex: 0,
              title: 'Scene 5: The First Light Covenant',
              summary: 'Kael and Elowen stand shoulder to shoulder to stop the slaughter.',
              beats: [
                {
                  id: 'beat_6_broken_lance',
                  orderIndex: 0,
                  title: 'The Broken Lance',
                  content: 'Kael intercepts Vane\'s spear mid-strike, saving the elder and declaring peace.',
                  dramaticMeta: {
                    climax: 'Vane retreats into the timberline; Meadowbrook stands intact.',
                    payoff: ['A new covenant of survival replaces centuries of predator-prey bloodshed.'],
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  directorBriefing: {
    pacingAuditSummary: '✅ All 6 beats audited for Google Flow Omni 5–10s window (≤ 18 words dialogue / ≤ 14 words dialogue + physical action). Zero compound action bottlenecks.',
    continuityLocks: [
      {
        id: 'cl_kael',
        assetType: 'character',
        candidateRefOrId: 'char-kael',
        description: 'Kael (20s, humanoid silver wolf in scarred leather brigandine, amber eyes, work-hardened claws).',
      },
      {
        id: 'cl_elowen',
        assetType: 'character',
        candidateRefOrId: 'char-elowen',
        description: 'Elowen (20s, cream-wooled humanoid sheep healer in woven linen apron, curved horn crown).',
      },
      {
        id: 'cl_cellar',
        assetType: 'environment',
        candidateRefOrId: 'env-healer-cellar',
        description: 'Darkened stone apothecary cellar, dried chamomile bundles, amber tinctures, stone mortar bowls.',
      },
      {
        id: 'cl_ward_brigandine',
        assetType: 'wardrobe',
        candidateRefOrId: 'ward-kael-brigandine',
        description: 'Scarred dark brown leather brigandine, wolf pelt collar, torn left shoulder from millstone lance.',
      },
    ],
    lightingProgression: [
      {
        id: 'lp_timberline',
        beatRange: 'BEAT-01–02',
        candidateRefOrId: 'light-timberline-dawn',
        setupAndMood: 'Cold 6500K pine ridge mist key with pale amber 3200K dawn rim; tense, desperate mood.',
      },
      {
        id: 'lp_cellar',
        beatRange: 'BEAT-03–05',
        candidateRefOrId: 'light-cellar-candle',
        setupAndMood: 'Warm 2400K flickering candlelight key, deep shadowed falloff; intimate, vulnerable sanctuary.',
      },
      {
        id: 'lp_first_light',
        beatRange: 'BEAT-06',
        candidateRefOrId: 'light-first-light-covenant',
        setupAndMood: 'Radiant 4500K morning sun breaking over stone gate, volumetric gold dust; hopeful reconciliation.',
      },
    ],
    actionArchetypes: [
      {
        id: 'aa_crouch',
        beatRange: 'BEAT-01',
        candidateRefOrId: 'act-predatory-crouch',
        kinematicsAndIntensity: 'Low perimeter crouch, claws digging into frozen black loam, controlled ragged breathing.',
      },
      {
        id: 'aa_cellar_bind',
        beatRange: 'BEAT-04',
        candidateRefOrId: 'act-tender-binding',
        kinematicsAndIntensity: 'Pressing crushed willow bark against bleeding shoulder with steady gentle hands, kneeling beside timber cot.',
      },
      {
        id: 'aa_lance_break',
        beatRange: 'BEAT-06',
        candidateRefOrId: 'act-lance-intercept',
        kinematicsAndIntensity: 'Explosive forward pivot, bare claws catching iron lance shaft, snapping ash wood across knee.',
      },
    ],
    vocalRegister: [
      {
        id: 'vr_vane_order',
        character: 'Vane',
        beatId: 'BEAT-01',
        emotion: 'Predatory / Callous',
        deliveryTechnique: 'Grounded staccato, guttural projection',
        voiceCharacteristics: 'Rasping low bass, wet snarling texture',
        speechIntonation: 'Harsh descending threat on "Walang matitira"',
        bodyLanguage: 'Baring yellowed fangs, pointing iron dagger downward',
      },
      {
        id: 'vr_kael_shame',
        character: 'Kael',
        beatId: 'BEAT-04',
        emotion: 'Vulnerable / Ashamed',
        deliveryTechnique: 'Raspy whisper, breathy strained voice',
        voiceCharacteristics: 'Low gravelly baritone, fragile delivery',
        speechIntonation: 'Falling cadence on "Kaaway mo ako"',
        bodyLanguage: 'Eyes cast down at claws, flinching from willow bark',
      },
      {
        id: 'vr_elowen_mercy',
        character: 'Elowen',
        beatId: 'BEAT-04',
        emotion: 'Compassionate / Resolute',
        deliveryTechnique: 'Soft projected, steady supportive voice',
        voiceCharacteristics: 'Warm melodic soprano, calm texture',
        speechIntonation: 'Even emphatic stress on "Gutom ka lang"',
        bodyLanguage: 'Holding eye contact, unwavering posture beside lantern',
      },
    ],
  },
};
