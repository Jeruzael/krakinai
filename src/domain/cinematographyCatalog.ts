// Static technique catalog derived from the user-supplied coverage requirements.
// No actual browser records, asset IDs or private prompt text are included.
import type { CinematographyTechnique } from "./cinematographyRegistry";
export const CATALOG_FAMILIES = [
  {
    id: "A",
    name: "Shot Size and Subject Scale",
  },
  {
    id: "B",
    name: "Camera Angle, Height and Orientation",
  },
  {
    id: "C",
    name: "Shot Framing and Viewpoint",
  },
  {
    id: "D",
    name: "Composition Techniques",
  },
  {
    id: "E",
    name: "Camera Movement",
  },
  {
    id: "F",
    name: "Motion Design Parameters",
  },
  {
    id: "G",
    name: "Lens and Optical Methods",
  },
  {
    id: "H",
    name: "Focus and Depth of Field",
  },
  {
    id: "I",
    name: "Exposure, Capture and Motion Rendering",
  },
  {
    id: "J",
    name: "Camera Rigs and Shooting Platforms",
  },
  {
    id: "K",
    name: "Lighting and Image-Look Techniques",
  },
  {
    id: "L",
    name: "Coverage, Blocking and Continuity",
  },
  {
    id: "M",
    name: "Advanced and Specialized Techniques",
  },
  {
    id: "N",
    name: "Real Estate, Architecture and Property Video",
  },
  {
    id: "O",
    name: "Source-Based Graphics and Motion Design",
  },
] as const;
export const CATALOG_TECHNIQUES: CinematographyTechnique[] = [
  {
    id: "shot-size.extreme-wide-extreme-long-shot",
    name: "Extreme wide / extreme long shot (EWS / ELS)",
    aliases: ["EWS", "ELS", "extreme wide", "extreme long shot"],
    family: "A",
    description:
      "Frame the subject very small within a broad environment so location and scale dominate.",
    direction:
      "Frame the subject very small within a broad environment so location and scale dominate.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.wide-long-shot",
    name: "Wide / long shot (WS / LS)",
    aliases: ["WS", "LS", "wide shot", "long shot"],
    family: "A",
    description:
      "Show the subject and enough surrounding space to make the location and spatial relationships readable.",
    direction:
      "Show the subject and enough surrounding space to make the location and spatial relationships readable.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.full-shot",
    name: "Full shot (FS)",
    aliases: ["FS", "full-body", "head-to-toe"],
    family: "A",
    description:
      "Include the complete standing subject from head to feet, with deliberate room at the frame boundaries.",
    direction:
      "Include the complete standing subject from head to feet, with deliberate room at the frame boundaries.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.medium-full-medium-long-shot",
    name: "Medium full / medium long shot (MFS / MLS)",
    aliases: ["MFS", "MLS", "medium full", "medium long"],
    family: "A",
    description:
      "Frame a standing subject approximately from the knees or mid-thigh upward; specify the intended crop.",
    direction:
      "Frame a standing subject approximately from the knees or mid-thigh upward; specify the intended crop.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.cowboy-american-shot",
    name: "Cowboy / American shot",
    aliases: ["cowboy shot", "American shot"],
    family: "A",
    description:
      "Frame approximately from mid-thigh upward, retaining the hands and the area where a holster would sit.",
    direction:
      "Frame approximately from mid-thigh upward, retaining the hands and the area where a holster would sit.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.medium-shot",
    name: "Medium shot (MS)",
    aliases: ["MS", "medium shot", "waist-up"],
    family: "A",
    description:
      "Frame a person approximately from the waist upward, balancing body language with facial readability.",
    direction:
      "Frame a person approximately from the waist upward, balancing body language with facial readability.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.medium-close-up",
    name: "Medium close-up (MCU)",
    aliases: ["MCU", "medium close-up"],
    family: "A",
    description:
      "Frame approximately from the chest upward, giving the face more prominence than a medium shot.",
    direction:
      "Frame approximately from the chest upward, giving the face more prominence than a medium shot.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.close-up",
    name: "Close-up (CU)",
    aliases: ["CU", "close-up"],
    family: "A",
    description:
      "Frame the face or another subject tightly enough that its expression or shape becomes the main information.",
    direction:
      "Frame the face or another subject tightly enough that its expression or shape becomes the main information.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.big-close-up",
    name: "Big close-up (BCU)",
    aliases: ["BCU", "big close-up"],
    family: "A",
    description:
      "Use a very tight facial crop, usually emphasizing eyes and mouth; name the exact boundaries rather than relying on the abbreviation.",
    direction:
      "Use a very tight facial crop, usually emphasizing eyes and mouth; name the exact boundaries rather than relying on the abbreviation.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.extreme-close-up",
    name: "Extreme close-up (ECU)",
    aliases: ["ECU", "extreme close-up"],
    family: "A",
    description:
      "Isolate a small facial feature or detail that occupies most of the frame; specify what must remain visible.",
    direction:
      "Isolate a small facial feature or detail that occupies most of the frame; specify what must remain visible.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.macro-detail-close-up",
    name: "Macro / detail close-up",
    aliases: ["macro insert", "detail close-up"],
    family: "A",
    description:
      "Magnify a small existing surface or object detail and specify the focus plane and working distance.",
    direction:
      "Magnify a small existing surface or object detail and specify the focus plane and working distance.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.wide-close-up",
    name: "Wide close-up",
    aliases: ["wide-angle close-up"],
    family: "A",
    description:
      "Combine close subject distance with a wide field of view; preserve intentional near/far scale relationships and avoid accidental facial exaggeration.",
    direction:
      "Combine close subject distance with a wide field of view; preserve intentional near/far scale relationships and avoid accidental facial exaggeration.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "shot-size.variable-shot-size-within-a-continuous-move",
    name: "Variable shot size within a continuous move",
    aliases: ["changing shot size"],
    family: "A",
    description:
      "Specify the beginning and ending crop within one continuous move, keeping the same subject and spatial continuity.",
    direction:
      "Specify the beginning and ending crop within one continuous move, keeping the same subject and spatial continuity.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "shotSize",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.eye-level",
    name: "Eye-level",
    aliases: [],
    family: "B",
    description:
      "Set the physical camera height near the subject’s eyes; choose the viewing direction separately.",
    direction:
      "Set the physical camera height near the subject’s eyes; choose the viewing direction separately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "height",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.shoulder-level",
    name: "Shoulder-level",
    aliases: [],
    family: "B",
    description:
      "Set the physical camera height near the subject’s shoulders; this does not itself determine upward or downward aim.",
    direction:
      "Set the physical camera height near the subject’s shoulders; this does not itself determine upward or downward aim.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "height",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.chest-level",
    name: "Chest-level",
    aliases: [],
    family: "B",
    description:
      "Place the camera at chest height relative to the subject and separately specify where the lens points.",
    direction:
      "Place the camera at chest height relative to the subject and separately specify where the lens points.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "height",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.waist-hip-level",
    name: "Waist / hip-level",
    aliases: [],
    family: "B",
    description:
      "Place the camera at waist or hip height; maintain an intentional viewing direction and crop.",
    direction:
      "Place the camera at waist or hip height; maintain an intentional viewing direction and crop.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "height",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.knee-level",
    name: "Knee-level",
    aliases: [],
    family: "B",
    description:
      "Place the camera around knee height while keeping its aim and subject scale independently specified.",
    direction:
      "Place the camera around knee height while keeping its aim and subject scale independently specified.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "height",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.ground-level",
    name: "Ground-level",
    aliases: [],
    family: "B",
    description:
      "Place the camera very near the ground and preserve plausible clearance from the surface.",
    direction:
      "Place the camera very near the ground and preserve plausible clearance from the surface.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "height",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.worm-s-eye-view",
    name: "Worm's-eye view",
    aliases: ["worms-eye", "worm’s-eye"],
    family: "B",
    description:
      "Look sharply upward from a near-ground viewpoint, emphasizing height without inventing body or architectural geometry.",
    direction:
      "Look sharply upward from a near-ground viewpoint, emphasizing height without inventing body or architectural geometry.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.low-angle",
    name: "Low angle",
    aliases: [],
    family: "B",
    description:
      "Aim upward toward the subject from below its reference level; distinguish the upward aim from camera height.",
    direction:
      "Aim upward toward the subject from below its reference level; distinguish the upward aim from camera height.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.high-angle",
    name: "High angle",
    aliases: [],
    family: "B",
    description:
      "Aim downward toward the subject from a higher vantage point, retaining coherent scale and geometry.",
    direction:
      "Aim downward toward the subject from a higher vantage point, retaining coherent scale and geometry.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.overhead-top-down",
    name: "Overhead / top-down",
    aliases: ["overhead", "top-down"],
    family: "B",
    description:
      "Point the lens vertically downward for a top-down view; specify the actual height separately.",
    direction:
      "Point the lens vertically downward for a top-down view; specify the actual height separately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.bird-s-eye-view",
    name: "Bird's-eye view",
    aliases: ["birds-eye", "bird’s-eye"],
    family: "B",
    description:
      "Observe the scene from above so its layout is readable; specify whether the view is oblique or exactly top-down.",
    direction:
      "Observe the scene from above so its layout is readable; specify whether the view is oblique or exactly top-down.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.aerial-angle",
    name: "Aerial angle",
    aliases: [],
    family: "B",
    description:
      "Use an elevated aerial viewpoint, specifying the lens pitch and existing scene geography rather than assuming a particular aircraft.",
    direction:
      "Use an elevated aerial viewpoint, specifying the lens pitch and existing scene geography rather than assuming a particular aircraft.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.frontal-angle",
    name: "Frontal angle",
    aliases: [],
    family: "B",
    description:
      "Place the camera in front of the subject’s facing axis and specify whether eye contact is desired.",
    direction:
      "Place the camera in front of the subject’s facing axis and specify whether eye contact is desired.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.side-profile-angle",
    name: "Side / profile angle",
    aliases: ["profile", "side angle"],
    family: "B",
    description:
      "View the subject from its side, approximately perpendicular to its forward-facing axis; label whose left or right is intended.",
    direction:
      "View the subject from its side, approximately perpendicular to its forward-facing axis; label whose left or right is intended.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.three-quarter-front-angle",
    name: "Three-quarter front angle",
    aliases: ["front three-quarter", "front 3/4"],
    family: "B",
    description:
      "View the subject obliquely from the front, commonly near 45 degrees from its forward axis.",
    direction:
      "View the subject obliquely from the front, commonly near 45 degrees from its forward axis.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.three-quarter-rear-angle",
    name: "Three-quarter rear angle",
    aliases: ["rear three-quarter", "rear 3/4"],
    family: "B",
    description:
      "View the subject obliquely from behind, commonly near 135 degrees from its forward axis; direct frontal eye contact may conflict.",
    direction:
      "View the subject obliquely from behind, commonly near 135 degrees from its forward axis; direct frontal eye contact may conflict.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.rear-facing-angle",
    name: "Rear-facing angle",
    aliases: ["back view", "180-degree rear"],
    family: "B",
    description:
      "Place the camera behind the subject and preserve coherent back-facing anatomy, posture and screen direction.",
    direction:
      "Place the camera behind the subject and preserve coherent back-facing anatomy, posture and screen direction.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.dutch-canted-angle-left-or-right",
    name: "Dutch / canted angle, left or right",
    aliases: ["Dutch angle", "canted frame"],
    family: "B",
    description:
      "Roll the camera so the horizon is intentionally canted; specify left/right direction and angle without confusing roll with pan or tilt.",
    direction:
      "Roll the camera so the horizon is intentionally canted; specify left/right direction and angle without confusing roll with pan or tilt.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "orientation",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.level-neutral-horizon",
    name: "Level / neutral horizon",
    aliases: ["level horizon"],
    family: "B",
    description:
      "Keep the horizon level with deliberate vertical alignment; this describes orientation, not a requirement for a static camera.",
    direction:
      "Keep the horizon level with deliberate vertical alignment; this describes orientation, not a requirement for a static camera.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "orientation",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.rotated-or-rolling-frame",
    name: "Rotated or rolling frame",
    aliases: ["optical-axis roll"],
    family: "B",
    description:
      "Rotate the frame about the optical axis, distinguishing a held rotated orientation from a continuous roll.",
    direction:
      "Rotate the frame about the optical axis, distinguishing a held rotated orientation from a continuous roll.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "orientation",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "camera-placement.oblique-architectural-perspective",
    name: "Oblique architectural perspective",
    aliases: [],
    family: "B",
    description:
      "View architectural planes at an oblique angle to show depth while preserving true walls, openings and vertical relationships.",
    direction:
      "View architectural planes at an oblique angle to show depth while preserving true walls, openings and vertical relationships.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "angle",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.clean-single",
    name: "Clean single",
    aliases: [],
    family: "C",
    description:
      "Frame one principal subject without another participant intruding into the foreground.",
    direction:
      "Frame one principal subject without another participant intruding into the foreground.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.dirty-single",
    name: "Dirty single",
    aliases: ["dirty framing"],
    family: "C",
    description:
      "Frame one principal subject with a small, intentional foreground portion of another participant or object.",
    direction:
      "Frame one principal subject with a small, intentional foreground portion of another participant or object.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.two-shot",
    name: "Two-shot",
    aliases: [],
    family: "C",
    description:
      "Frame two established participants together with a clear relationship and intentional relative scale.",
    direction:
      "Frame two established participants together with a clear relationship and intentional relative scale.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.three-shot",
    name: "Three-shot",
    aliases: [],
    family: "C",
    description:
      "Frame three established participants together while keeping their relationships and screen positions readable.",
    direction:
      "Frame three established participants together while keeping their relationships and screen positions readable.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.group-ensemble-shot",
    name: "Group / ensemble shot",
    aliases: [],
    family: "C",
    description:
      "Compose several established participants as an ensemble; specify emphasis and avoid inventing additional people.",
    direction:
      "Compose several established participants as an ensemble; specify emphasis and avoid inventing additional people.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.over-the-shoulder",
    name: "Over-the-shoulder (OTS)",
    aliases: ["OTS", "over-shoulder"],
    family: "C",
    description:
      "Look past an established participant’s shoulder toward the other subject, retaining a controlled foreground shoulder shape.",
    direction:
      "Look past an established participant’s shoulder toward the other subject, retaining a controlled foreground shoulder shape.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.over-the-hip",
    name: "Over-the-hip",
    aliases: [],
    family: "C",
    description:
      "Frame past an established foreground hip toward the other subject; distinguish the framing arrangement from camera height.",
    direction:
      "Frame past an established foreground hip toward the other subject; distinguish the framing arrangement from camera height.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.reverse-angle",
    name: "Reverse angle",
    aliases: [],
    family: "C",
    description:
      "Show the opposing view of an established scene relationship while maintaining deliberate axis and eyeline continuity.",
    direction:
      "Show the opposing view of an established scene relationship while maintaining deliberate axis and eyeline continuity.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.point-of-view",
    name: "Point-of-view (POV)",
    aliases: ["POV", "first-person"],
    family: "C",
    description:
      "Show the view from an established character’s line of sight; the viewpoint is attributed to that character.",
    direction:
      "Show the view from an established character’s line of sight; the viewpoint is attributed to that character.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.subjective-camera",
    name: "Subjective camera",
    aliases: [],
    family: "C",
    description:
      "Present the scene through a character’s perceptual experience; subjective treatment can extend beyond a literal eye-position POV.",
    direction:
      "Present the scene through a character’s perceptual experience; subjective treatment can extend beyond a literal eye-position POV.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.objective-observational-camera",
    name: "Objective / observational camera",
    aliases: [],
    family: "C",
    description:
      "Observe the action from an external viewpoint without attributing the lens to a participant’s eyes.",
    direction:
      "Observe the action from an external viewpoint without attributing the lens to a participant’s eyes.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.reaction-shot",
    name: "Reaction shot",
    aliases: [],
    family: "C",
    description:
      "Emphasize an established participant’s response to an event; coordinate its editorial relationship with the surrounding shots.",
    direction:
      "Emphasize an established participant’s response to an event; coordinate its editorial relationship with the surrounding shots.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.insert-shot",
    name: "Insert shot",
    aliases: ["insert"],
    family: "C",
    description:
      "Isolate an existing relevant object, gesture or detail within the main action for clearer information.",
    direction:
      "Isolate an existing relevant object, gesture or detail within the main action for clearer information.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.cutaway-shot",
    name: "Cutaway shot",
    aliases: [],
    family: "C",
    description:
      "Show a related subject outside the immediate principal action as an editorial departure, then relate it to the surrounding sequence.",
    direction:
      "Show a related subject outside the immediate principal action as an editorial departure, then relate it to the surrounding sequence.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.master-shot",
    name: "Master shot",
    aliases: [],
    family: "C",
    description:
      "Cover the principal action and geography in one comprehensive view so the scene’s relationships remain understandable.",
    direction:
      "Cover the principal action and geography in one comprehensive view so the scene’s relationships remain understandable.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.establishing-shot",
    name: "Establishing shot",
    aliases: ["establishing"],
    family: "C",
    description:
      "Introduce the location and spatial context before closer coverage, without inventing unseen surroundings.",
    direction:
      "Introduce the location and spatial context before closer coverage, without inventing unseen surroundings.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.detail-shot",
    name: "Detail shot",
    aliases: [],
    family: "C",
    description:
      "Concentrate the viewer’s attention on a small existing feature; specify its informational purpose.",
    direction:
      "Concentrate the viewer’s attention on a small existing feature; specify its informational purpose.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.reveal-shot",
    name: "Reveal shot",
    aliases: [],
    family: "C",
    description:
      "Withhold and then disclose an existing subject or area through framing, timing or a motivated move.",
    direction:
      "Withhold and then disclose an existing subject or area through framing, timing or a motivated move.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.silhouette-framing",
    name: "Silhouette framing",
    aliases: [],
    family: "C",
    description:
      "Emphasize the subject’s outline against a contrasting background; coordinate the actual lighting in the Lighting layer.",
    direction:
      "Emphasize the subject’s outline against a contrasting background; coordinate the actual lighting in the Lighting layer.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.foreground-obstructed-framing",
    name: "Foreground-obstructed framing",
    aliases: ["occluded framing"],
    family: "C",
    description:
      "Use an existing foreground obstruction deliberately while preserving readable depth relationships.",
    direction:
      "Use an existing foreground obstruction deliberately while preserving readable depth relationships.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.through-object-or-through-window-framing",
    name: "Through-object or through-window framing",
    aliases: [],
    family: "C",
    description:
      "Frame through an existing opening, window or object; keep its edges and the view beyond physically consistent.",
    direction:
      "Frame through an existing opening, window or object; keep its edges and the view beyond physically consistent.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.reflection-mirror-framing",
    name: "Reflection / mirror framing",
    aliases: [],
    family: "C",
    description:
      "Use an actual reflective surface to frame the subject and preserve coherent reflected geometry and sightlines.",
    direction:
      "Use an actual reflective surface to frame the subject and preserve coherent reflected geometry and sightlines.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.product-hero-shot",
    name: "Product hero shot",
    aliases: [],
    family: "C",
    description:
      "Make an existing product the compositional focal point with deliberate scale, view and visual hierarchy.",
    direction:
      "Make an existing product the compositional focal point with deliberate scale, view and visual hierarchy.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "framing.architectural-hero-shot",
    name: "Architectural hero shot",
    aliases: [],
    family: "C",
    description:
      "Present an actual building or architectural feature as the principal subject while preserving its true proportions and context.",
    direction:
      "Present an actual building or architectural feature as the principal subject while preserving its true proportions and context.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "framing",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.rule-of-thirds",
    name: "Rule of thirds",
    aliases: [],
    family: "D",
    description:
      "Place important subjects near the intersections or lines of an imagined three-by-three grid when it serves the image.",
    direction:
      "Place important subjects near the intersections or lines of an imagined three-by-three grid when it serves the image.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.centered-composition",
    name: "Centered composition",
    aliases: ["center framing"],
    family: "D",
    description:
      "Place the principal subject or focal point near the frame’s center with intentional surrounding relationships.",
    direction:
      "Place the principal subject or focal point near the frame’s center with intentional surrounding relationships.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.symmetrical-composition",
    name: "Symmetrical composition",
    aliases: ["symmetry"],
    family: "D",
    description:
      "Balance corresponding forms around a deliberate axis; do not invent mirrored architecture or objects.",
    direction:
      "Balance corresponding forms around a deliberate axis; do not invent mirrored architecture or objects.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.asymmetrical-composition",
    name: "Asymmetrical composition",
    aliases: [],
    family: "D",
    description:
      "Balance unequal shapes, positions or visual weights without forcing mirror symmetry.",
    direction:
      "Balance unequal shapes, positions or visual weights without forcing mirror symmetry.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.golden-ratio-golden-spiral",
    name: "Golden ratio / golden spiral",
    aliases: [],
    family: "D",
    description:
      "Use a golden-ratio division or spiral as an optional guide for visual emphasis rather than a guaranteed aesthetic formula.",
    direction:
      "Use a golden-ratio division or spiral as an optional guide for visual emphasis rather than a guaranteed aesthetic formula.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.leading-lines",
    name: "Leading lines",
    aliases: [],
    family: "D",
    description:
      "Use actual visible lines to guide attention toward the intended subject or point of interest.",
    direction:
      "Use actual visible lines to guide attention toward the intended subject or point of interest.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.diagonal-composition",
    name: "Diagonal composition",
    aliases: [],
    family: "D",
    description:
      "Arrange existing forms or lines diagonally to create directional energy; a tilted camera is a separate choice.",
    direction:
      "Arrange existing forms or lines diagonally to create directional energy; a tilted camera is a separate choice.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.negative-space",
    name: "Negative space",
    aliases: [],
    family: "D",
    description:
      "Leave intentional relatively unoccupied areas around the subject to support emphasis or an editorial text-safe region.",
    direction:
      "Leave intentional relatively unoccupied areas around the subject to support emphasis or an editorial text-safe region.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.positive-space",
    name: "Positive space",
    aliases: [],
    family: "D",
    description:
      "Emphasize the frame area occupied by the subject and its shapes while controlling the surrounding empty areas.",
    direction:
      "Emphasize the frame area occupied by the subject and its shapes while controlling the surrounding empty areas.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.frame-within-a-frame",
    name: "Frame within a frame",
    aliases: ["frame-within-frame"],
    family: "D",
    description:
      "Use an existing doorway, arch, window or other boundary to form a secondary frame around the subject.",
    direction:
      "Use an existing doorway, arch, window or other boundary to form a secondary frame around the subject.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.foreground-midground-and-background-layering",
    name: "Foreground, midground and background layering",
    aliases: [],
    family: "D",
    description:
      "Organize established objects across foreground, midground and background to make depth relationships readable.",
    direction:
      "Organize established objects across foreground, midground and background to make depth relationships readable.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.deep-space-composition",
    name: "Deep-space composition",
    aliases: [],
    family: "D",
    description:
      "Use multiple spatial planes and perspective cues to emphasize depth; deep focus is a separate optical choice.",
    direction:
      "Use multiple spatial planes and perspective cues to emphasize depth; deep focus is a separate optical choice.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.flat-graphic-composition",
    name: "Flat / graphic composition",
    aliases: [],
    family: "D",
    description:
      "Emphasize two-dimensional shapes and surface relationships instead of suggesting unsupported spatial depth.",
    direction:
      "Emphasize two-dimensional shapes and surface relationships instead of suggesting unsupported spatial depth.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.vanishing-point-perspective",
    name: "Vanishing-point perspective",
    aliases: [],
    family: "D",
    description:
      "Align existing converging lines around a deliberate vanishing point while preserving real architectural geometry.",
    direction:
      "Align existing converging lines around a deliberate vanishing point while preserving real architectural geometry.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.visual-balance",
    name: "Visual balance",
    aliases: [],
    family: "D",
    description:
      "Distribute visual weight intentionally across the frame using established shapes, contrast and placement.",
    direction:
      "Distribute visual weight intentionally across the frame using established shapes, contrast and placement.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.visual-hierarchy-focal-point",
    name: "Visual hierarchy / focal point",
    aliases: [],
    family: "D",
    description:
      "Make the intended focal point legible through placement, scale, contrast or focus without changing unrelated scene layers.",
    direction:
      "Make the intended focal point legible through placement, scale, contrast or focus without changing unrelated scene layers.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.headroom",
    name: "Headroom",
    aliases: [],
    family: "D",
    description:
      "Set intentional space above a subject’s head, avoiding accidental crops or distracting excess.",
    direction:
      "Set intentional space above a subject’s head, avoiding accidental crops or distracting excess.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.look-room-nose-room",
    name: "Look room / nose room",
    aliases: ["lookroom", "nose room"],
    family: "D",
    description:
      "Leave deliberate space in the direction a subject faces or looks, unless a constrained frame is intentional.",
    direction:
      "Leave deliberate space in the direction a subject faces or looks, unless a constrained frame is intentional.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.lead-room",
    name: "Lead room",
    aliases: ["leadroom"],
    family: "D",
    description:
      "Leave deliberate space ahead of a moving subject in the intended screen direction.",
    direction:
      "Leave deliberate space ahead of a moving subject in the intended screen direction.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.horizon-placement",
    name: "Horizon placement",
    aliases: [],
    family: "D",
    description:
      "Place the visible horizon intentionally within the frame; horizon level and camera height are separate settings.",
    direction:
      "Place the visible horizon intentionally within the frame; horizon level and camera height are separate settings.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.natural-framing",
    name: "Natural framing",
    aliases: [],
    family: "D",
    description:
      "Use actual vegetation, landforms or existing environmental forms to border the subject.",
    direction:
      "Use actual vegetation, landforms or existing environmental forms to border the subject.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.architectural-framing",
    name: "Architectural framing",
    aliases: [],
    family: "D",
    description:
      "Use actual structural edges, openings or architectural boundaries to organize the frame without remodeling the scene.",
    direction:
      "Use actual structural edges, openings or architectural boundaries to organize the frame without remodeling the scene.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.repetition-and-patterns",
    name: "Repetition and patterns",
    aliases: [],
    family: "D",
    description:
      "Emphasize repetition in existing forms while preserving their real count, spacing and scale.",
    direction:
      "Emphasize repetition in existing forms while preserving their real count, spacing and scale.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.shape-based-composition",
    name: "Shape-based composition",
    aliases: [],
    family: "D",
    description:
      "Organize the frame around existing circles, triangles, rectangles or other recognizable shapes.",
    direction:
      "Organize the frame around existing circles, triangles, rectangles or other recognizable shapes.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.reflection-composition",
    name: "Reflection composition",
    aliases: [],
    family: "D",
    description:
      "Use a coherent real reflection as a compositional relationship rather than inventing reflected objects or views.",
    direction:
      "Use a coherent real reflection as a compositional relationship rather than inventing reflected objects or views.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.figure-ground-separation",
    name: "Figure-ground separation",
    aliases: [],
    family: "D",
    description:
      "Keep the subject distinguishable from its background through deliberate placement, focus or independently chosen lighting.",
    direction:
      "Keep the subject distinguishable from its background through deliberate placement, focus or independently chosen lighting.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.scale-contrast",
    name: "Scale contrast",
    aliases: [],
    family: "D",
    description:
      "Contrast the apparent scale of existing subjects or environment to communicate relative size without falsifying dimensions.",
    direction:
      "Contrast the apparent scale of existing subjects or environment to communicate relative size without falsifying dimensions.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.occlusion-and-reveal",
    name: "Occlusion and reveal",
    aliases: [],
    family: "D",
    description:
      "Use deliberate concealment by actual foreground forms followed by a readable reveal.",
    direction:
      "Use deliberate concealment by actual foreground forms followed by a readable reveal.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.layered-parallax",
    name: "Layered parallax",
    aliases: ["parallax layering"],
    family: "D",
    description:
      "Use relative motion of established depth layers to show depth; genuine parallax needs real spatial information or supplied layers.",
    direction:
      "Use relative motion of established depth layers to show depth; genuine parallax needs real spatial information or supplied layers.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: true,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "composition.intentional-visual-isolation",
    name: "Intentional visual isolation",
    aliases: [],
    family: "D",
    description:
      "Separate the intended subject from competing visual information using deliberate framing and emphasis.",
    direction:
      "Separate the intended subject from competing visual information using deliberate framing and emphasis.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "composition",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P0",
  },
  {
    id: "movement.locked-off-static-camera",
    name: "Locked-off / static camera",
    aliases: ["locked-off", "static"],
    family: "E",
    description:
      "Keep the camera body and viewing direction still; a separate focus pull can occur without camera travel.",
    direction:
      "Keep the camera body and viewing direction still; a separate focus pull can occur without camera travel.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "movement",
    propertyRecommended: true,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "static",
  },
  {
    id: "movement.pan-left-right",
    name: "Pan left / right",
    aliases: ["pan"],
    family: "E",
    description:
      "Rotate the viewing direction horizontally from a fixed camera position; do not substitute lateral translation.",
    direction:
      "Rotate the viewing direction horizontally from a fixed camera position; do not substitute lateral translation.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: true,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "rotation",
  },
  {
    id: "movement.tilt-up-down",
    name: "Tilt up / down",
    aliases: ["tilt"],
    family: "E",
    description:
      "Rotate the viewing direction vertically from a fixed camera position; do not substitute raising or lowering the camera.",
    direction:
      "Rotate the viewing direction vertically from a fixed camera position; do not substitute raising or lowering the camera.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: true,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "rotation",
  },
  {
    id: "movement.whip-swish-pan",
    name: "Whip / swish pan",
    aliases: ["whip pan", "swish pan"],
    family: "E",
    description:
      "Rotate horizontally in one fast deliberate reframe, with an intentional settle and brief directional blur.",
    direction:
      "Rotate horizontally in one fast deliberate reframe, with an intentional settle and brief directional blur.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "rotation",
  },
  {
    id: "movement.whip-tilt",
    name: "Whip tilt",
    aliases: [],
    family: "E",
    description:
      "Rotate vertically in a fast deliberate reframe while the camera base remains fixed.",
    direction:
      "Rotate vertically in a fast deliberate reframe while the camera base remains fixed.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "rotation",
  },
  {
    id: "movement.camera-roll-rotational-movement",
    name: "Camera roll / rotational movement",
    aliases: [],
    family: "E",
    description:
      "Rotate the camera about its optical axis so the horizon rolls; distinguish this from yaw or pitch.",
    direction:
      "Rotate the camera about its optical axis so the horizon rolls; distinguish this from yaw or pitch.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "rotation",
  },
  {
    id: "movement.slow-rotational-reveal",
    name: "Slow rotational reveal",
    aliases: [],
    family: "E",
    description:
      "Reveal an established area through a slow, deliberate rotational change of viewing direction.",
    direction:
      "Reveal an established area through a slow, deliberate rotational change of viewing direction.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "rotation",
  },
  {
    id: "movement.dolly-in-out",
    name: "Dolly in / out",
    aliases: ["dolly in", "dolly out"],
    family: "E",
    description:
      "Translate the camera toward or away from the subject, producing genuine viewpoint and parallax changes.",
    direction:
      "Translate the camera toward or away from the subject, producing genuine viewpoint and parallax changes.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.slow-push-in-pull-out",
    name: "Slow push-in / pull-out",
    aliases: ["push-in", "pull-out"],
    family: "E",
    description:
      "Move physically toward or away from the subject at a restrained pace; specify whether optical zoom is excluded.",
    direction:
      "Move physically toward or away from the subject at a restrained pace; specify whether optical zoom is excluded.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.truck-lateral-movement-left-or-right",
    name: "Truck / lateral movement left or right",
    aliases: ["truck left", "truck right", "lateral tracking"],
    family: "E",
    description:
      "Translate the complete camera sideways while distinguishing fixed heading from an intentional accompanying pan.",
    direction:
      "Translate the complete camera sideways while distinguishing fixed heading from an intentional accompanying pan.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: true,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.slider-move",
    name: "Slider move",
    aliases: [],
    family: "E",
    description:
      "Make a controlled short physical translation along a slider’s available path with real depth-dependent parallax.",
    direction:
      "Make a controlled short physical translation along a slider’s available path with real depth-dependent parallax.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.pedestal-up-down",
    name: "Pedestal up / down",
    aliases: ["pedestal"],
    family: "E",
    description:
      "Raise or lower the entire camera along a vertical path while choosing its aim independently.",
    direction:
      "Raise or lower the entire camera along a vertical path while choosing its aim independently.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.tracking-alongside-subject",
    name: "Tracking alongside subject",
    aliases: [],
    family: "E",
    description:
      "Travel alongside an established moving subject while maintaining deliberate relative framing.",
    direction:
      "Travel alongside an established moving subject while maintaining deliberate relative framing.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.leading-tracking-shot",
    name: "Leading tracking shot",
    aliases: ["frontal lead tracking"],
    family: "E",
    description:
      "Move ahead of a subject while looking back toward it, usually traveling backward relative to the camera’s viewing direction.",
    direction:
      "Move ahead of a subject while looking back toward it, usually traveling backward relative to the camera’s viewing direction.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.following-tracking-shot",
    name: "Following tracking shot",
    aliases: ["rear follow tracking"],
    family: "E",
    description:
      "Travel behind an established subject as it moves, retaining intentional rear or rear-quarter framing.",
    direction:
      "Travel behind an established subject as it moves, retaining intentional rear or rear-quarter framing.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.backward-tracking-shot",
    name: "Backward tracking shot",
    aliases: [],
    family: "E",
    description:
      "Translate the camera backward along a verified clear path while controlling subject scale and spacing.",
    direction:
      "Translate the camera backward along a verified clear path while controlling subject scale and spacing.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.lateral-parallax-tracking",
    name: "Lateral parallax tracking",
    aliases: [],
    family: "E",
    description:
      "Translate laterally so nearer established objects shift faster than farther ones, with coherent depth ordering.",
    direction:
      "Translate laterally so nearer established objects shift faster than farther ones, with coherent depth ordering.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.camera-rise-descent",
    name: "Camera rise / descent",
    aliases: [],
    family: "E",
    description:
      "Change the physical camera elevation; this is not equivalent to tilting a fixed camera.",
    direction:
      "Change the physical camera elevation; this is not equivalent to tilting a fixed camera.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.crane-rise-descent",
    name: "Crane rise / descent",
    aliases: [],
    family: "E",
    description:
      "Use an available crane trajectory to raise or lower the camera with actual changing viewpoint and clearance.",
    direction:
      "Use an available crane trajectory to raise or lower the camera with actual changing viewpoint and clearance.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: true,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.jib-boom-movement",
    name: "Jib / boom movement",
    aliases: [],
    family: "E",
    description:
      "Move the camera on a jib or boom arc while preserving plausible reach, clearance and target framing.",
    direction:
      "Move the camera on a jib or boom arc while preserving plausible reach, clearance and target framing.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.arc-shot",
    name: "Arc shot",
    aliases: [],
    family: "E",
    description:
      "Move the camera along a curved path around an established subject, specifying arc extent, direction and target behavior.",
    direction:
      "Move the camera along a curved path around an established subject, specifying arc extent, direction and target behavior.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: true,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.partial-orbit",
    name: "Partial orbit",
    aliases: [],
    family: "E",
    description:
      "Travel through part of a circle around the subject with coherent radius, height and background continuity.",
    direction:
      "Travel through part of a circle around the subject with coherent radius, height and background continuity.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.full-360-degree-orbit",
    name: "Full 360-degree orbit",
    aliases: ["full orbit", "360 orbit"],
    family: "E",
    description:
      "Travel a complete circle around the same subject; the subject does not rotate as a substitute for camera travel.",
    direction:
      "Travel a complete circle around the same subject; the subject does not rotate as a substitute for camera travel.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.spiral-movement",
    name: "Spiral movement",
    aliases: [],
    family: "E",
    description:
      "Follow a path that curves around the subject while changing radius or elevation; specify the intended spiral components.",
    direction:
      "Follow a path that curves around the subject while changing radius or elevation; specify the intended spiral components.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.curved-dolly",
    name: "Curved dolly",
    aliases: [],
    family: "E",
    description:
      "Translate on a curved dolly path with a separately specified viewing direction and physically available space.",
    direction:
      "Translate on a curved dolly path with a separately specified viewing direction and physically available space.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.combined-dolly-and-pan",
    name: "Combined dolly and pan",
    aliases: [],
    family: "E",
    description:
      "Combine physical camera translation with an intentional horizontal rotation; describe how both support the framing.",
    direction:
      "Combine physical camera translation with an intentional horizontal rotation; describe how both support the framing.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "compound",
  },
  {
    id: "movement.combined-crane-and-tilt",
    name: "Combined crane and tilt",
    aliases: [],
    family: "E",
    description:
      "Combine crane translation with an intentional vertical tilt, keeping physical elevation and lens aim distinct.",
    direction:
      "Combine crane translation with an intentional vertical tilt, keeping physical elevation and lens aim distinct.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "compound",
  },
  {
    id: "movement.reveal-from-behind-an-obstruction",
    name: "Reveal from behind an obstruction",
    aliases: [],
    family: "E",
    description:
      "Move from behind an actual obstruction until it clears the view; the obstruction does not disappear or morph.",
    direction:
      "Move from behind an actual obstruction until it clears the view; the obstruction does not disappear or morph.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: true,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.pass-through-movement-with-appropriate-feasibility-warnings",
    name: "Pass-through movement, with appropriate feasibility warnings",
    aliases: [],
    family: "E",
    description:
      "Pass through a verified traversable opening with sufficient clearance; a solid wall or flat source image is not an available path.",
    direction:
      "Pass through a verified traversable opening with sufficient clearance; a solid wall or flat source image is not an available path.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: true,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.optical-zoom-in-out",
    name: "Optical zoom in / out",
    aliases: [],
    family: "E",
    description:
      "Change the optical focal length while the camera position stays fixed; do not imply a dolly viewpoint change.",
    direction:
      "Change the optical focal length while the camera position stays fixed; do not imply a dolly viewpoint change.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "optical",
  },
  {
    id: "movement.slow-zoom",
    name: "Slow zoom",
    aliases: [],
    family: "E",
    description:
      "Change optical focal length gradually with a controlled rate while keeping physical camera travel separately specified.",
    direction:
      "Change optical focal length gradually with a controlled rate while keeping physical camera travel separately specified.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "optical",
  },
  {
    id: "movement.fast-crash-zoom",
    name: "Fast / crash zoom",
    aliases: [],
    family: "E",
    description:
      "Make a rapid optical focal-length change with deliberate start/end framing; this is distinct from physical approach.",
    direction:
      "Make a rapid optical focal-length change with deliberate start/end framing; this is distinct from physical approach.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "optical",
  },
  {
    id: "movement.snap-zoom",
    name: "Snap zoom",
    aliases: [],
    family: "E",
    description:
      "Make an abrupt, intentional optical zoom reframe without substituting a cut or a dolly move.",
    direction:
      "Make an abrupt, intentional optical zoom reframe without substituting a cut or a dolly move.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "optical",
  },
  {
    id: "movement.dolly-zoom",
    name: "Dolly zoom (Vertigo effect)",
    aliases: ["dolly zoom", "Vertigo effect", "contra zoom"],
    family: "E",
    description:
      "Combine opposing physical dolly and optical zoom changes to approximately hold subject size while the viewpoint relationship changes.",
    direction:
      "Combine opposing physical dolly and optical zoom changes to approximately hold subject size while the viewpoint relationship changes.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "compound",
  },
  {
    id: "movement.handheld-follow",
    name: "Handheld follow",
    aliases: [],
    family: "E",
    description:
      "Follow the established action with a handheld camera, controlling readability and the intended amount of operator motion.",
    direction:
      "Follow the established action with a handheld camera, controlling readability and the intended amount of operator motion.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "translation",
  },
  {
    id: "movement.stabilized-walking-shot",
    name: "Stabilized walking shot",
    aliases: [],
    family: "E",
    description:
      "Move at walking pace with controlled stabilization, preserving a physically traversable route and established scene geography.",
    direction:
      "Move at walking pace with controlled stabilization, preserving a physically traversable route and established scene geography.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.steadicam-shot",
    name: "Steadicam shot",
    aliases: [],
    family: "E",
    description:
      "Use a balanced Steadicam-supported move, separating the support method from the actual path and subject relationship.",
    direction:
      "Use a balanced Steadicam-supported move, separating the support method from the actual path and subject relationship.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "translation",
  },
  {
    id: "movement.gimbal-tracking",
    name: "Gimbal tracking",
    aliases: [],
    family: "E",
    description:
      "Track with a stabilized gimbal while specifying the actual translation path and target framing separately.",
    direction:
      "Track with a stabilized gimbal while specifying the actual translation path and target framing separately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P0",
    motionKind: "translation",
  },
  {
    id: "movement.snorricam-body-mounted-camera",
    name: "Snorricam / body-mounted camera",
    aliases: ["Snorricam"],
    family: "E",
    description:
      "Mount the camera to the performer’s body so the performer remains relatively fixed in frame while surroundings respond to body motion.",
    direction:
      "Mount the camera to the performer’s body so the performer remains relatively fixed in frame while surroundings respond to body motion.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "translation",
  },
  {
    id: "movement.drone-flyover",
    name: "Drone flyover",
    aliases: [],
    family: "E",
    description:
      "Fly over an established outdoor area along a plausible clear route with coherent geography and altitude.",
    direction:
      "Fly over an established outdoor area along a plausible clear route with coherent geography and altitude.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "translation",
  },
  {
    id: "movement.drone-rise-and-reveal",
    name: "Drone rise and reveal",
    aliases: [],
    family: "E",
    description:
      "Raise an aerial camera to reveal established surroundings while preserving real scale and safe clearance.",
    direction:
      "Raise an aerial camera to reveal established surroundings while preserving real scale and safe clearance.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "translation",
  },
  {
    id: "movement.drone-pullback",
    name: "Drone pullback",
    aliases: [],
    family: "E",
    description:
      "Move an aerial camera backward to reveal more established context without inventing geography beyond available source information.",
    direction:
      "Move an aerial camera backward to reveal more established context without inventing geography beyond available source information.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "translation",
  },
  {
    id: "movement.drone-orbit",
    name: "Drone orbit",
    aliases: [],
    family: "E",
    description:
      "Fly an aerial arc around an actual subject with a consistent radius, elevation and intentional target heading.",
    direction:
      "Fly an aerial arc around an actual subject with a consistent radius, elevation and intentional target heading.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "translation",
  },
  {
    id: "movement.fpv-drone-flight",
    name: "FPV drone flight",
    aliases: ["FPV"],
    family: "E",
    description:
      "Use a first-person-view drone flight path with plausible clearances and real spatial source; do not pass through solid obstacles.",
    direction:
      "Use a first-person-view drone flight path with plausible clearances and real spatial source; do not pass through solid obstacles.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "translation",
  },
  {
    id: "movement.cable-camera-tracking",
    name: "Cable-camera tracking",
    aliases: [],
    family: "E",
    description:
      "Track along the available cable path, respecting its physical span and the camera’s stabilized viewing direction.",
    direction:
      "Track along the available cable path, respecting its physical span and the camera’s stabilized viewing direction.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: true,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "translation",
  },
  {
    id: "movement.vehicle-mounted-tracking",
    name: "Vehicle-mounted tracking",
    aliases: [],
    family: "E",
    description:
      "Move with a camera attached to an established vehicle; specify relative subject motion and support separately.",
    direction:
      "Move with a camera attached to an established vehicle; specify relative subject motion and support separately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "translation",
  },
  {
    id: "movement.robotic-motion-control-movement",
    name: "Robotic / motion-control movement",
    aliases: [],
    family: "E",
    description:
      "Use programmed repeatable camera motion, specifying the trajectory without claiming an external model controls actual motion hardware.",
    direction:
      "Use programmed repeatable camera motion, specifying the trajectory without claiming an external model controls actual motion hardware.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "movement",
    propertyRecommended: false,
    guidance:
      "Keep optical zoom, physical travel and rotation distinct. Allow deliberate compound/staged moves; never treat a rig as a movement.",
    priority: "P2",
    motionKind: "compound",
  },
  {
    id: "motion-parameter.direction",
    name: "Direction",
    aliases: [],
    family: "F",
    description:
      "Specify movement direction relative to a named reference, distinguishing screen left/right from the subject’s own sides.",
    direction:
      "Specify movement direction relative to a named reference, distinguishing screen left/right from the subject’s own sides.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.movement-path",
    name: "Movement path",
    aliases: [],
    family: "F",
    description:
      "Describe the intended camera path or two-dimensional source treatment without inventing unavailable geometry.",
    direction:
      "Describe the intended camera path or two-dimensional source treatment without inventing unavailable geometry.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.start-framing",
    name: "Start framing",
    aliases: [],
    family: "F",
    description:
      "Describe the initial crop and viewpoint before the move begins.",
    direction:
      "Describe the initial crop and viewpoint before the move begins.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.end-framing",
    name: "End framing",
    aliases: [],
    family: "F",
    description: "Describe the final crop and viewpoint after the move ends.",
    direction: "Describe the final crop and viewpoint after the move ends.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.speed",
    name: "Speed",
    aliases: [],
    family: "F",
    description:
      "Specify a qualitative pace or a measured speed only when its distance and time context are known.",
    direction:
      "Specify a qualitative pace or a measured speed only when its distance and time context are known.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.acceleration-deceleration",
    name: "Acceleration / deceleration",
    aliases: [],
    family: "F",
    description:
      "Describe how motion speeds up or slows down instead of assuming constant velocity.",
    direction:
      "Describe how motion speeds up or slows down instead of assuming constant velocity.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.ease-in-ease-out",
    name: "Ease-in / ease-out",
    aliases: [],
    family: "F",
    description:
      "Specify gradual starts and finishes independently from the main movement speed.",
    direction:
      "Specify gradual starts and finishes independently from the main movement speed.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.travel-distance",
    name: "Travel distance",
    aliases: [],
    family: "F",
    description:
      "State physical travel distance only when real spatial information is available; a flat graphic has no new physical camera path.",
    direction:
      "State physical travel distance only when real spatial information is available; a flat graphic has no new physical camera path.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.rotation-angle",
    name: "Rotation angle",
    aliases: [],
    family: "F",
    description:
      "State the intended angular change and its axis; distinguish yaw, pitch, roll and orbit angle.",
    direction:
      "State the intended angular change and its axis; distinguish yaw, pitch, roll and orbit angle.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.arc-radius",
    name: "Arc radius",
    aliases: [],
    family: "F",
    description:
      "State the path radius around the established target when an actual curved spatial move is applicable.",
    direction:
      "State the path radius around the established target when an actual curved spatial move is applicable.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.movement-duration",
    name: "Movement duration",
    aliases: [],
    family: "F",
    description:
      "State the interval occupied by the movement, keeping total shot duration and static holds separate.",
    direction:
      "State the interval occupied by the movement, keeping total shot duration and static holds separate.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.initial-hold",
    name: "Initial hold",
    aliases: [],
    family: "F",
    description:
      "Reserve an initial interval with stable framing before the main movement begins.",
    direction:
      "Reserve an initial interval with stable framing before the main movement begins.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.final-hold",
    name: "Final hold",
    aliases: [],
    family: "F",
    description:
      "Reserve a final stable framing interval after the main movement settles.",
    direction:
      "Reserve a final stable framing interval after the main movement settles.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.subject-tracking-target-lock",
    name: "Subject tracking / target lock",
    aliases: [],
    family: "F",
    description:
      "Specify whether an established subject stays framed, which point is tracked and what remains free to move.",
    direction:
      "Specify whether an established subject stays framed, which point is tracked and what remains free to move.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.stabilization-level",
    name: "Stabilization level",
    aliases: [],
    family: "F",
    description:
      "Describe the intended stabilization, preserving deliberate handheld character when requested.",
    direction:
      "Describe the intended stabilization, preserving deliberate handheld character when requested.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.parallax-strength",
    name: "Parallax strength",
    aliases: [],
    family: "F",
    description:
      "Describe the intended relative depth motion; true parallax needs spatial source or actual supplied depth layers.",
    direction:
      "Describe the intended relative depth motion; true parallax needs spatial source or actual supplied depth layers.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.foreground-background-relationship",
    name: "Foreground/background relationship",
    aliases: [],
    family: "F",
    description:
      "Describe how established near and far elements relate during the move without fabricating new objects.",
    direction:
      "Describe how established near and far elements relate during the move without fabricating new objects.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.motivating-subject-or-reveal",
    name: "Motivating subject or reveal",
    aliases: [],
    family: "F",
    description:
      "Name the existing subject, event or reveal that motivates the camera direction.",
    direction:
      "Name the existing subject, event or reveal that motivates the camera direction.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.primary-movement",
    name: "Primary movement",
    aliases: [],
    family: "F",
    description:
      "Identify the principal move so secondary directions do not accidentally replace its purpose.",
    direction:
      "Identify the principal move so secondary directions do not accidentally replace its purpose.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "motion-parameter.optional-secondary-movement",
    name: "Optional secondary movement",
    aliases: [],
    family: "F",
    description:
      "Add a deliberate secondary move and specify whether it overlaps the principal move or follows it in a staged transition.",
    direction:
      "Add a deliberate secondary move and specify whether it overlaps the principal move or follows it in a staged transition.",
    owner: "camera",
    kind: "parameter",
    method: "planning",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P1",
  },
  {
    id: "optics.ultra-wide-angle",
    name: "Ultra-wide-angle",
    aliases: [],
    family: "G",
    description:
      "Use a very broad field of view relative to the named sensor or film format; preserve intentional near/far relationships and real geometry.",
    direction:
      "Use a very broad field of view relative to the named sensor or film format; preserve intentional near/far relationships and real geometry.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.wide-angle",
    name: "Wide-angle",
    aliases: [],
    family: "G",
    description:
      "Use a broad field of view relative to the stated format, choosing actual camera distance independently.",
    direction:
      "Use a broad field of view relative to the stated format, choosing actual camera distance independently.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.standard-normal-lens",
    name: "Standard / normal lens",
    aliases: [],
    family: "G",
    description:
      "Use a normal field of view for the stated format; do not assume one focal length is normal for every sensor.",
    direction:
      "Use a normal field of view for the stated format; do not assume one focal length is normal for every sensor.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.short-telephoto",
    name: "Short telephoto",
    aliases: [],
    family: "G",
    description:
      "Use a moderately narrow field of view suited to the stated format, with camera distance chosen for the desired perspective.",
    direction:
      "Use a moderately narrow field of view suited to the stated format, with camera distance chosen for the desired perspective.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.telephoto",
    name: "Telephoto",
    aliases: [],
    family: "G",
    description:
      "Use a narrow field of view for the stated format and specify the real camera-to-subject relationship separately.",
    direction:
      "Use a narrow field of view for the stated format and specify the real camera-to-subject relationship separately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.super-telephoto",
    name: "Super-telephoto",
    aliases: [],
    family: "G",
    description:
      "Use a very narrow field of view with appropriate real working distance, stabilization and focus expectations.",
    direction:
      "Use a very narrow field of view with appropriate real working distance, stabilization and focus expectations.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.macro-lens",
    name: "Macro lens",
    aliases: [],
    family: "G",
    description:
      "Use optics capable of close focusing and meaningful magnification; specify the existing detail and desired focus plane.",
    direction:
      "Use optics capable of close focusing and meaningful magnification; specify the existing detail and desired focus plane.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.fisheye-lens",
    name: "Fisheye lens",
    aliases: [],
    family: "G",
    description:
      "Use intentional fisheye projection with curved straight lines; this is distinct from a rectilinear wide-angle lens.",
    direction:
      "Use intentional fisheye projection with curved straight lines; this is distinct from a rectilinear wide-angle lens.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.rectilinear-lens",
    name: "Rectilinear lens",
    aliases: [],
    family: "G",
    description:
      "Use an optical projection that keeps straight scene lines straight, while recognizing that wide views can still stretch edge subjects.",
    direction:
      "Use an optical projection that keeps straight scene lines straight, while recognizing that wide views can still stretch edge subjects.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.spherical-lens",
    name: "Spherical lens",
    aliases: [],
    family: "G",
    description:
      "Use conventional non-anamorphic image projection; the final aspect ratio still depends on sensor area and crop.",
    direction:
      "Use conventional non-anamorphic image projection; the final aspect ratio still depends on sensor area and crop.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.anamorphic-lens",
    name: "Anamorphic lens",
    aliases: [],
    family: "G",
    description:
      "Use a specified anamorphic squeeze and appropriate desqueeze; flare, bokeh and distortion characteristics vary by lens design.",
    direction:
      "Use a specified anamorphic squeeze and appropriate desqueeze; flare, bokeh and distortion characteristics vary by lens design.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.prime-lens",
    name: "Prime lens",
    aliases: [],
    family: "G",
    description:
      "Use a fixed-focal-length lens; physical camera movement and focus changes remain separate choices.",
    direction:
      "Use a fixed-focal-length lens; physical camera movement and focus changes remain separate choices.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.zoom-lens",
    name: "Zoom lens",
    aliases: [],
    family: "G",
    description:
      "Use a variable-focal-length lens, specifying whether its focal length stays fixed or changes during the shot.",
    direction:
      "Use a variable-focal-length lens, specifying whether its focal length stays fixed or changes during the shot.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.tilt-shift-perspective-control-lens",
    name: "Tilt-shift / perspective-control lens",
    aliases: [],
    family: "G",
    description:
      "Use lens tilt to alter the focus-plane relationship or shift to adjust framing/perspective control; do not confuse the two movements.",
    direction:
      "Use lens tilt to alter the focus-plane relationship or shift to adjust framing/perspective control; do not confuse the two movements.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.probe-periscope-lens",
    name: "Probe / periscope lens",
    aliases: [],
    family: "G",
    description:
      "Use a purpose-built probe or periscope optical arrangement for access to tight viewpoints with verified physical clearance.",
    direction:
      "Use a purpose-built probe or periscope optical arrangement for access to tight viewpoints with verified physical clearance.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.vintage-optical-character",
    name: "Vintage optical character",
    aliases: [],
    family: "G",
    description:
      "Describe desired vintage optical qualities specifically, such as contrast falloff or flare, without assuming all older lenses share them.",
    direction:
      "Describe desired vintage optical qualities specifically, such as contrast falloff or flare, without assuming all older lenses share them.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.diffusion-filter-look",
    name: "Diffusion-filter look",
    aliases: [],
    family: "G",
    description:
      "Use a deliberate diffusion-filter character such as softened highlights or reduced microcontrast while retaining required subject readability.",
    direction:
      "Use a deliberate diffusion-filter character such as softened highlights or reduced microcontrast while retaining required subject readability.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.polarizing-filter",
    name: "Polarizing filter",
    aliases: [],
    family: "G",
    description:
      "Use polarization selectively to manage suitable reflections or sky appearance; the effect depends on surface, angle and filter orientation.",
    direction:
      "Use polarization selectively to manage suitable reflections or sky appearance; the effect depends on surface, angle and filter orientation.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.neutral-density-filter",
    name: "Neutral-density filter",
    aliases: ["ND filter"],
    family: "G",
    description:
      "Use neutral-density filtration to reduce incoming light while choosing aperture, shutter and color behavior deliberately.",
    direction:
      "Use neutral-density filtration to reduce incoming light while choosing aperture, shutter and color behavior deliberately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.characteristic-bokeh",
    name: "Characteristic bokeh",
    aliases: ["bokeh"],
    family: "G",
    description:
      "Describe the desired appearance of out-of-focus highlights separately from the amount of depth of field.",
    direction:
      "Describe the desired appearance of out-of-focus highlights separately from the amount of depth of field.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.anamorphic-flares",
    name: "Anamorphic flares",
    aliases: [],
    family: "G",
    description:
      "Request a particular anamorphic flare character only when desired; it is not guaranteed by every anamorphic design.",
    direction:
      "Request a particular anamorphic flare character only when desired; it is not guaranteed by every anamorphic design.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.natural-lens-flare",
    name: "Natural lens flare",
    aliases: [],
    family: "G",
    description:
      "Use a motivated lens flare from an actual bright source and preserve the intended subject and scene readability.",
    direction:
      "Use a motivated lens flare from an actual bright source and preserve the intended subject and scene readability.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.lens-distortion",
    name: "Lens distortion",
    aliases: [],
    family: "G",
    description:
      "Specify intentional optical geometry distortion rather than allowing accidental warped anatomy or altered architecture.",
    direction:
      "Specify intentional optical geometry distortion rather than allowing accidental warped anatomy or altered architecture.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.lens-breathing",
    name: "Lens breathing",
    aliases: [],
    family: "G",
    description:
      "Describe the change in apparent framing associated with focusing; this is not itself camera travel.",
    direction:
      "Describe the change in apparent framing associated with focusing; this is not itself camera travel.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "optics.chromatic-aberration-when-intentionally-requested",
    name: "Chromatic aberration, when intentionally requested",
    aliases: [],
    family: "G",
    description:
      "Request intentional color fringing at contrast edges as a controlled image treatment, not an assumed property of every lens.",
    direction:
      "Request intentional color fringing at contrast edges as a controlled image treatment, not an assumed property of every lens.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "lens",
    propertyRecommended: false,
    guidance:
      "Field of view depends on format; perspective depends on camera position. Focal length alone does not determine perspective.",
    priority: "P2",
  },
  {
    id: "focus.fixed-focus",
    name: "Fixed focus",
    aliases: [],
    family: "H",
    description:
      "Hold the intended focus distance or plane constant; camera movement can still occur if the chosen focal relationship permits it.",
    direction:
      "Hold the intended focus distance or plane constant; camera movement can still occur if the chosen focal relationship permits it.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
    focusKind: "fixed",
  },
  {
    id: "focus.shallow-depth-of-field",
    name: "Shallow depth of field",
    aliases: [],
    family: "H",
    description:
      "Keep a limited depth range acceptably sharp, with the intended subject plane clearly identified.",
    direction:
      "Keep a limited depth range acceptably sharp, with the intended subject plane clearly identified.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.deep-focus",
    name: "Deep focus",
    aliases: [],
    family: "H",
    description:
      "Keep the intended near and far scene elements acceptably sharp, using appropriate optical and exposure choices.",
    direction:
      "Keep the intended near and far scene elements acceptably sharp, using appropriate optical and exposure choices.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.selective-focus",
    name: "Selective focus",
    aliases: [],
    family: "H",
    description:
      "Emphasize an established subject or plane through focus while allowing other scene information to remain less sharp.",
    direction:
      "Emphasize an established subject or plane through focus while allowing other scene information to remain less sharp.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.soft-focus",
    name: "Soft focus",
    aliases: [],
    family: "H",
    description:
      "Request a deliberate overall softness or optical diffusion character; a blurred background alone is not a soft-focus treatment.",
    direction:
      "Request a deliberate overall softness or optical diffusion character; a blurred background alone is not a soft-focus treatment.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.rack-focus-focus-pull",
    name: "Rack focus / focus pull",
    aliases: ["rack focus", "focus pull"],
    family: "H",
    description:
      "Shift the focus plane deliberately between established subjects or distances without implying camera-body movement.",
    direction:
      "Shift the focus plane deliberately between established subjects or distances without implying camera-body movement.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
    focusKind: "transition",
  },
  {
    id: "focus.near-to-far-focus-transition",
    name: "Near-to-far focus transition",
    aliases: ["near-to-far"],
    family: "H",
    description:
      "Move focus from an existing nearer plane to an existing farther plane, keeping object identity and geography consistent.",
    direction:
      "Move focus from an existing nearer plane to an existing farther plane, keeping object identity and geography consistent.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
    focusKind: "transition",
  },
  {
    id: "focus.far-to-near-focus-transition",
    name: "Far-to-near focus transition",
    aliases: ["far-to-near"],
    family: "H",
    description:
      "Move focus from an existing farther plane to an existing nearer plane, keeping framing changes separately specified.",
    direction:
      "Move focus from an existing farther plane to an existing nearer plane, keeping framing changes separately specified.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
    focusKind: "transition",
  },
  {
    id: "focus.subject-following-focus",
    name: "Subject-following focus",
    aliases: [],
    family: "H",
    description:
      "Maintain the intended subject in focus as its distance changes; distinguish focus tracking from physically tracking the camera.",
    direction:
      "Maintain the intended subject in focus as its distance changes; distinguish focus tracking from physically tracking the camera.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.eye-face-focus",
    name: "Eye / face focus",
    aliases: [],
    family: "H",
    description:
      "Prioritize the intended visible eye or facial plane while preserving the original face and geometry.",
    direction:
      "Prioritize the intended visible eye or facial plane while preserving the original face and geometry.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.foreground-to-background-reveal",
    name: "Foreground-to-background reveal",
    aliases: [],
    family: "H",
    description:
      "Reveal an established background subject by shifting focus away from an actual foreground plane.",
    direction:
      "Reveal an established background subject by shifting focus away from an actual foreground plane.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
    focusKind: "transition",
  },
  {
    id: "focus.background-to-foreground-reveal",
    name: "Background-to-foreground reveal",
    aliases: [],
    family: "H",
    description:
      "Reveal an established foreground subject by shifting focus from the background to its nearer plane.",
    direction:
      "Reveal an established foreground subject by shifting focus from the background to its nearer plane.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
    focusKind: "transition",
  },
  {
    id: "focus.split-diopter-focus",
    name: "Split-diopter focus",
    aliases: [],
    family: "H",
    description:
      "Use a split-field close-up attachment to establish different focus ranges in different image areas, with careful boundary placement.",
    direction:
      "Use a split-field close-up attachment to establish different focus ranges in different image areas, with careful boundary placement.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.tilted-focus-plane",
    name: "Tilted focus plane",
    aliases: [],
    family: "H",
    description:
      "Use lens tilt to change the orientation of the focus plane relative to the image plane; do not imply that all distances become sharp.",
    direction:
      "Use lens tilt to change the orientation of the focus plane relative to the image plane; do not imply that all distances become sharp.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.hyperfocal-focus",
    name: "Hyperfocal focus",
    aliases: [],
    family: "H",
    description:
      "Set focus using a chosen acceptable-sharpness criterion so the intended distant and nearer range is covered; no universal distance is assumed.",
    direction:
      "Set focus using a chosen acceptable-sharpness criterion so the intended distant and nearer range is covered; no universal distance is assumed.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.macro-focus",
    name: "Macro focus",
    aliases: [],
    family: "H",
    description:
      "Place focus precisely on the intended small-scale detail, recognizing that close working distances can produce very limited depth of field.",
    direction:
      "Place focus precisely on the intended small-scale detail, recognizing that close working distances can produce very limited depth of field.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.defocus-refocus-reveal",
    name: "Defocus / refocus reveal",
    aliases: [],
    family: "H",
    description:
      "Intentionally move the image out of focus and then restore a specified established focal subject without changing its identity.",
    direction:
      "Intentionally move the image out of focus and then restore a specified established focal subject without changing its identity.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
    focusKind: "transition",
  },
  {
    id: "focus.intentional-focus-breathing",
    name: "Intentional focus breathing",
    aliases: [],
    family: "H",
    description:
      "Allow a deliberate visible framing change during a focus transition when the optical character is wanted.",
    direction:
      "Allow a deliberate visible framing change during a focus transition when the optical character is wanted.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "focus.minimal-focus-breathing",
    name: "Minimal focus breathing",
    aliases: [],
    family: "H",
    description:
      "Minimize unwanted framing changes during focus pulls without assuming a specific lens or provider can eliminate breathing entirely.",
    direction:
      "Minimize unwanted framing changes during focus pulls without assuming a specific lens or provider can eliminate breathing entirely.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "focus",
    propertyRecommended: false,
    guidance:
      "Focus transition is independent of body movement; fixed focus conflicts only with a simultaneous focus transition.",
    priority: "P0",
  },
  {
    id: "capture.aperture-f-stop",
    name: "Aperture / f-stop",
    aliases: [],
    family: "I",
    description:
      "Describe aperture or f-stop as an exposure and depth-of-field planning value, considering focal length and focus distance as well.",
    direction:
      "Describe aperture or f-stop as an exposure and depth-of-field planning value, considering focal length and focus distance as well.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.exposure-index-iso",
    name: "Exposure index / ISO",
    aliases: ["ISO", "EI"],
    family: "I",
    description:
      "Specify an intended exposure index or ISO context without claiming that raising it creates additional captured light.",
    direction:
      "Specify an intended exposure index or ISO context without claiming that raising it creates additional captured light.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.shutter-angle",
    name: "Shutter angle",
    aliases: [],
    family: "I",
    description:
      "Specify exposure time relative to frame duration as shutter angle; consider frame rate when describing motion rendering.",
    direction:
      "Specify exposure time relative to frame duration as shutter angle; consider frame rate when describing motion rendering.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.shutter-speed",
    name: "Shutter speed",
    aliases: ["shutter time"],
    family: "I",
    description:
      "Specify the intended exposure time per frame or photograph, considering motion blur and available light.",
    direction:
      "Specify the intended exposure time per frame or photograph, considering motion blur and available light.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.frame-rate",
    name: "Frame rate",
    aliases: ["fps"],
    family: "I",
    description:
      "Name intended capture and playback rates separately when motion speed is important.",
    direction:
      "Name intended capture and playback rates separately when motion speed is important.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.white-balance",
    name: "White balance",
    aliases: ["WB"],
    family: "I",
    description:
      "Specify the intended neutral color balance relative to the actual illumination rather than changing source identity or architecture.",
    direction:
      "Specify the intended neutral color balance relative to the actual illumination rather than changing source identity or architecture.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.color-temperature",
    name: "Color temperature",
    aliases: [],
    family: "I",
    description:
      "Describe intended source or balance color temperature with a clear reference; it is not a substitute for the complete color quality of a light.",
    direction:
      "Describe intended source or balance color temperature with a clear reference; it is not a substitute for the complete color quality of a light.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.exposure-compensation",
    name: "Exposure compensation",
    aliases: [],
    family: "I",
    description:
      "State a deliberate exposure adjustment relative to the chosen metered or reference exposure.",
    direction:
      "State a deliberate exposure adjustment relative to the chosen metered or reference exposure.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.motion-blur",
    name: "Motion blur",
    aliases: [],
    family: "I",
    description:
      "Describe the intended visible integration of moving subjects during exposure, distinguishing it from focus blur.",
    direction:
      "Describe the intended visible integration of moving subjects during exposure, distinguishing it from focus blur.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.high-speed-photography-slow-motion",
    name: "High-speed photography / slow motion",
    aliases: [],
    family: "I",
    description:
      "Capture at a higher rate than the intended playback rate to produce slow motion; merely slowing camera travel is a different instruction.",
    direction:
      "Capture at a higher rate than the intended playback rate to produce slow motion; merely slowing camera travel is a different instruction.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.undercranking-accelerated-motion",
    name: "Undercranking / accelerated motion",
    aliases: [],
    family: "I",
    description:
      "Capture at a lower rate than playback to accelerate apparent motion, while preserving the intended scene continuity.",
    direction:
      "Capture at a lower rate than playback to accelerate apparent motion, while preserving the intended scene continuity.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.timelapse",
    name: "Timelapse",
    aliases: [],
    family: "I",
    description:
      "Sample a slow event at intervals and play the frames more rapidly; specify the actual elapsed event and output duration separately.",
    direction:
      "Sample a slow event at intervals and play the frames more rapidly; specify the actual elapsed event and output duration separately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.hyperlapse",
    name: "Hyperlapse",
    aliases: [],
    family: "I",
    description:
      "Combine interval capture with a controlled changing camera position along an actual traversable route.",
    direction:
      "Combine interval capture with a controlled changing camera position along an actual traversable route.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.long-exposure",
    name: "Long exposure",
    aliases: [],
    family: "I",
    description:
      "Use a relatively long exposure to integrate motion or light over time, with the duration and moving elements explicitly identified.",
    direction:
      "Use a relatively long exposure to integrate motion or light over time, with the duration and moving elements explicitly identified.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.motion-streaking",
    name: "Motion streaking",
    aliases: [],
    family: "I",
    description:
      "Describe intentional trails from moving light or subjects during exposure, preserving the established direction and scene geometry.",
    direction:
      "Describe intentional trails from moving light or subjects during exposure, preserving the established direction and scene geometry.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.high-dynamic-range",
    name: "High dynamic range",
    aliases: [],
    family: "I",
    description:
      "Plan to retain a wider useful brightness range through an appropriate capture/display workflow; the label alone does not guarantee recoverable detail.",
    direction:
      "Plan to retain a wider useful brightness range through an appropriate capture/display workflow; the label alone does not guarantee recoverable detail.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.log-raw-capture-guidance",
    name: "Log / RAW capture guidance",
    aliases: [],
    family: "I",
    description:
      "Describe a log-encoded or RAW capture workflow only as planning guidance, including the need for a suitable interpretation and finishing process.",
    direction:
      "Describe a log-encoded or RAW capture workflow only as planning guidance, including the need for a suitable interpretation and finishing process.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.neutral-density-exposure-control",
    name: "Neutral-density exposure control",
    aliases: [],
    family: "I",
    description:
      "Use neutral-density filtration to support desired aperture and shutter choices under bright conditions.",
    direction:
      "Use neutral-density filtration to support desired aperture and shutter choices under bright conditions.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.intentional-underexposure",
    name: "Intentional underexposure",
    aliases: [],
    family: "I",
    description:
      "Plan a deliberate exposure below the chosen reference while retaining whichever details are essential.",
    direction:
      "Plan a deliberate exposure below the chosen reference while retaining whichever details are essential.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.intentional-overexposure",
    name: "Intentional overexposure",
    aliases: [],
    family: "I",
    description:
      "Plan a deliberate exposure above the chosen reference while considering which highlights must remain recoverable.",
    direction:
      "Plan a deliberate exposure above the chosen reference while considering which highlights must remain recoverable.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.highlight-preservation",
    name: "Highlight preservation",
    aliases: [],
    family: "I",
    description:
      "Prioritize the intended bright-area detail within the available capture range; do not promise recovery from clipped source data.",
    direction:
      "Prioritize the intended bright-area detail within the available capture range; do not promise recovery from clipped source data.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "capture.shadow-preservation",
    name: "Shadow preservation",
    aliases: [],
    family: "I",
    description:
      "Prioritize required dark-area detail within the available capture range without claiming unavailable source information can be recovered.",
    direction:
      "Prioritize required dark-area detail within the available capture range without claiming unavailable source information can be recovered.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "capture",
    propertyRecommended: false,
    guidance:
      "Capture descriptors are planning text; provider execution is not guaranteed.",
    priority: "P2",
  },
  {
    id: "rig.tripod",
    name: "Tripod",
    aliases: [],
    family: "J",
    description:
      "Support the camera on a tripod for the intended fixed position or controlled head rotation; the support does not require a static lens or focus.",
    direction:
      "Support the camera on a tripod for the intended fixed position or controlled head rotation; the support does not require a static lens or focus.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.monopod",
    name: "Monopod",
    aliases: [],
    family: "J",
    description:
      "Support the camera on a monopod with its intended freedom and stability, recognizing that it is not a fully locked tripod.",
    direction:
      "Support the camera on a monopod with its intended freedom and stability, recognizing that it is not a fully locked tripod.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.handheld",
    name: "Handheld",
    aliases: [],
    family: "J",
    description:
      "Support the camera directly with an operator’s hands and body, specifying the intended steadiness separately.",
    direction:
      "Support the camera directly with an operator’s hands and body, specifying the intended steadiness separately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.shoulder-mounted",
    name: "Shoulder-mounted",
    aliases: [],
    family: "J",
    description:
      "Support the camera at the operator’s shoulder; camera height and the resulting path remain independent planning choices.",
    direction:
      "Support the camera at the operator’s shoulder; camera height and the resulting path remain independent planning choices.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.steadicam",
    name: "Steadicam",
    aliases: [],
    family: "J",
    description:
      "Use a balanced Steadicam support system, with the actual movement trajectory separately defined.",
    direction:
      "Use a balanced Steadicam support system, with the actual movement trajectory separately defined.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.motorized-gimbal",
    name: "Motorized gimbal",
    aliases: ["gimbal"],
    family: "J",
    description:
      "Use a motorized gimbal to stabilize camera orientation while specifying actual translation and operator motion separately.",
    direction:
      "Use a motorized gimbal to stabilize camera orientation while specifying actual translation and operator motion separately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.slider",
    name: "Slider",
    aliases: [],
    family: "J",
    description:
      "Use a slider whose real length and orientation support the intended short camera translation.",
    direction:
      "Use a slider whose real length and orientation support the intended short camera translation.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.dolly-track",
    name: "Dolly / track",
    aliases: [],
    family: "J",
    description:
      "Use a dolly or track support for physical camera translation along an actual available path.",
    direction:
      "Use a dolly or track support for physical camera translation along an actual available path.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.jib",
    name: "Jib",
    aliases: [],
    family: "J",
    description:
      "Use a jib arm with a physically available arc, balancing camera aim and clearance.",
    direction:
      "Use a jib arm with a physically available arc, balancing camera aim and clearance.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.crane",
    name: "Crane",
    aliases: [],
    family: "J",
    description:
      "Use crane support for a reachable physical camera trajectory; specify path and tilt separately.",
    direction:
      "Use crane support for a reachable physical camera trajectory; specify path and tilt separately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.technocrane-telescoping-crane",
    name: "Technocrane / telescoping crane",
    aliases: ["telescoping crane"],
    family: "J",
    description:
      "Use a telescoping crane when its changing reach is necessary and its physical access and limits are known.",
    direction:
      "Use a telescoping crane when its changing reach is necessary and its physical access and limits are known.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.drone",
    name: "Drone",
    aliases: [],
    family: "J",
    description:
      "Use an aerial drone platform with a verified plausible route and established geography.",
    direction:
      "Use an aerial drone platform with a verified plausible route and established geography.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.fpv-drone",
    name: "FPV drone",
    aliases: [],
    family: "J",
    description:
      "Use an FPV drone platform for an appropriate real flight route rather than treating every opening or wall as traversable.",
    direction:
      "Use an FPV drone platform for an appropriate real flight route rather than treating every opening or wall as traversable.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.cable-camera",
    name: "Cable camera",
    aliases: [],
    family: "J",
    description:
      "Use a cable-supported camera on a physically established span and path.",
    direction:
      "Use a cable-supported camera on a physically established span and path.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.vehicle-car-mount",
    name: "Vehicle / car mount",
    aliases: [],
    family: "J",
    description:
      "Use an appropriate vehicle mount with its actual support relationship and subject motion specified.",
    direction:
      "Use an appropriate vehicle mount with its actual support relationship and subject motion specified.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.body-chest-helmet-mount",
    name: "Body / chest / helmet mount",
    aliases: [],
    family: "J",
    description:
      "Attach the camera to an established body, chest or helmet position and preserve that mounting relationship through motion.",
    direction:
      "Attach the camera to an established body, chest or helmet position and preserve that mounting relationship through motion.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.robotic-arm",
    name: "Robotic arm",
    aliases: [],
    family: "J",
    description:
      "Use a robotic camera arm for a specified reachable trajectory without claiming planning text operates the hardware.",
    direction:
      "Use a robotic camera arm for a specified reachable trajectory without claiming planning text operates the hardware.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.motion-control-system",
    name: "Motion-control system",
    aliases: [],
    family: "J",
    description:
      "Use a repeatable programmed motion-control system, distinguishing the platform from its chosen camera path.",
    direction:
      "Use a repeatable programmed motion-control system, distinguishing the platform from its chosen camera path.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.remote-stabilized-head",
    name: "Remote stabilized head",
    aliases: [],
    family: "J",
    description:
      "Use a remote stabilized head to control orientation, identifying the separate support and travel system.",
    direction:
      "Use a remote stabilized head to control orientation, identifying the separate support and travel system.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.underwater-housing",
    name: "Underwater housing",
    aliases: [],
    family: "J",
    description:
      "Use a suitable underwater camera housing when actual underwater capture is intended; a water-like visual treatment is a separate simulation.",
    direction:
      "Use a suitable underwater camera housing when actual underwater capture is intended; a water-like visual treatment is a separate simulation.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.probe-lens-rig",
    name: "Probe-lens rig",
    aliases: [],
    family: "J",
    description:
      "Use a probe-lens support arrangement compatible with its actual working distance and access path.",
    direction:
      "Use a probe-lens support arrangement compatible with its actual working distance and access path.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "rig.360-degree-camera-rig",
    name: "360-degree camera rig",
    aliases: [],
    family: "J",
    description:
      "Use a camera system that captures surrounding viewing directions; a camera orbit around one subject is not immersive 360 capture.",
    direction:
      "Use a camera system that captures surrounding viewing directions; a camera orbit around one subject is not immersive 360 capture.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "rig",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "lighting-look-link.three-point-lighting",
    name: "Three-point lighting",
    aliases: [],
    family: "K",
    description:
      "Coordinate key, fill and backlight as independently planned lighting roles rather than writing over the selected Lighting preset.",
    direction:
      "Coordinate key, fill and backlight as independently planned lighting roles rather than writing over the selected Lighting preset.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.high-key-lighting",
    name: "High-key lighting",
    aliases: [],
    family: "K",
    description:
      "Plan a relatively bright overall tonal treatment with restrained contrast through the Lighting layer.",
    direction:
      "Plan a relatively bright overall tonal treatment with restrained contrast through the Lighting layer.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.low-key-lighting",
    name: "Low-key lighting",
    aliases: [],
    family: "K",
    description:
      "Plan a predominantly dark tonal treatment with selective illumination and deliberate contrast.",
    direction:
      "Plan a predominantly dark tonal treatment with selective illumination and deliberate contrast.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.motivated-lighting",
    name: "Motivated lighting",
    aliases: [],
    family: "K",
    description:
      "Make lighting direction and quality appear justified by established practical or environmental sources.",
    direction:
      "Make lighting direction and quality appear justified by established practical or environmental sources.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.naturalistic-lighting",
    name: "Naturalistic lighting",
    aliases: [],
    family: "K",
    description:
      "Plan believable illumination consistent with the actual setting while allowing deliberate controlled lighting choices.",
    direction:
      "Plan believable illumination consistent with the actual setting while allowing deliberate controlled lighting choices.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.available-light",
    name: "Available light",
    aliases: [],
    family: "K",
    description:
      "Use the illumination already present at the location, describing its actual quality rather than inventing an additional source.",
    direction:
      "Use the illumination already present at the location, describing its actual quality rather than inventing an additional source.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.practical-lighting",
    name: "Practical lighting",
    aliases: [],
    family: "K",
    description:
      "Use established visible light sources as part of the scene and coordinate their actual illumination separately.",
    direction:
      "Use established visible light sources as part of the scene and coordinate their actual illumination separately.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.rembrandt-lighting",
    name: "Rembrandt lighting",
    aliases: [],
    family: "K",
    description:
      "Plan a portrait light arrangement that creates a controlled triangle of light on the shadow-side cheek.",
    direction:
      "Plan a portrait light arrangement that creates a controlled triangle of light on the shadow-side cheek.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.butterfly-lighting",
    name: "Butterfly lighting",
    aliases: [],
    family: "K",
    description:
      "Plan frontal elevated portrait lighting that creates a controlled small shadow beneath the nose.",
    direction:
      "Plan frontal elevated portrait lighting that creates a controlled small shadow beneath the nose.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.loop-lighting",
    name: "Loop lighting",
    aliases: [],
    family: "K",
    description:
      "Plan portrait lighting with a small lateral nose shadow that does not join the cheek shadow.",
    direction:
      "Plan portrait lighting with a small lateral nose shadow that does not join the cheek shadow.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.split-lighting",
    name: "Split lighting",
    aliases: [],
    family: "K",
    description:
      "Plan side-positioned portrait lighting that divides the face into deliberately lit and shadowed regions.",
    direction:
      "Plan side-positioned portrait lighting that divides the face into deliberately lit and shadowed regions.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.side-lighting",
    name: "Side lighting",
    aliases: [],
    family: "K",
    description:
      "Use light motivated from a subject’s side with its actual direction and softness specified in Lighting.",
    direction:
      "Use light motivated from a subject’s side with its actual direction and softness specified in Lighting.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.rim-back-lighting",
    name: "Rim / back lighting",
    aliases: [],
    family: "K",
    description:
      "Use illumination from behind the subject to create deliberate edge separation without confusing it with rear camera placement.",
    direction:
      "Use illumination from behind the subject to create deliberate edge separation without confusing it with rear camera placement.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.silhouette-lighting",
    name: "Silhouette lighting",
    aliases: [],
    family: "K",
    description:
      "Arrange subject/background illumination to emphasize an actual silhouette while preserving the intended contour.",
    direction:
      "Arrange subject/background illumination to emphasize an actual silhouette while preserving the intended contour.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.soft-hard-light",
    name: "Soft / hard light",
    aliases: [],
    family: "K",
    description:
      "Specify the intended transition quality of shadows through source size, distance and diffusion planning in the Lighting layer.",
    direction:
      "Specify the intended transition quality of shadows through source size, distance and diffusion planning in the Lighting layer.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.negative-fill",
    name: "Negative fill",
    aliases: [],
    family: "K",
    description:
      "Reduce unwanted fill with deliberate light absorption or shielding rather than adding a camera movement.",
    direction:
      "Reduce unwanted fill with deliberate light absorption or shielding rather than adding a camera movement.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.bounce-lighting",
    name: "Bounce lighting",
    aliases: [],
    family: "K",
    description:
      "Redirect an actual light source using an appropriate reflective surface while preserving its motivated direction.",
    direction:
      "Redirect an actual light source using an appropriate reflective surface while preserving its motivated direction.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.diffused-light",
    name: "Diffused light",
    aliases: [],
    family: "K",
    description:
      "Soften a light source using an appropriate diffusion arrangement rather than assuming optical lens diffusion does the same job.",
    direction:
      "Soften a light source using an appropriate diffusion arrangement rather than assuming optical lens diffusion does the same job.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.chiaroscuro",
    name: "Chiaroscuro",
    aliases: [],
    family: "K",
    description:
      "Plan a deliberate interplay of strong light and shadow as a lighting/composition treatment.",
    direction:
      "Plan a deliberate interplay of strong light and shadow as a lighting/composition treatment.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.volumetric-light",
    name: "Volumetric light",
    aliases: [],
    family: "K",
    description:
      "Make light paths visible through an established participating medium when appropriate; do not add unrequested haze to the environment.",
    direction:
      "Make light paths visible through an established participating medium when appropriate; do not add unrequested haze to the environment.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.golden-hour",
    name: "Golden hour",
    aliases: [],
    family: "K",
    description:
      "Use the established low sun and warm directional light near sunrise or sunset when that lighting matches the actual scene.",
    direction:
      "Use the established low sun and warm directional light near sunrise or sunset when that lighting matches the actual scene.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.blue-hour",
    name: "Blue hour",
    aliases: [],
    family: "K",
    description:
      "Use the established cooler ambient conditions around twilight without inventing a different time of day silently.",
    direction:
      "Use the established cooler ambient conditions around twilight without inventing a different time of day silently.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.day-for-night",
    name: "Day-for-night",
    aliases: [],
    family: "K",
    description:
      "Plan a deliberate daylight-for-night capture and finishing treatment, with actual illumination and grading responsibilities distinguished.",
    direction:
      "Plan a deliberate daylight-for-night capture and finishing treatment, with actual illumination and grading responsibilities distinguished.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.mixed-color-temperatures",
    name: "Mixed color temperatures",
    aliases: [],
    family: "K",
    description:
      "Describe the intended balance or contrast between established sources of different color temperatures.",
    direction:
      "Describe the intended balance or contrast between established sources of different color temperatures.",
    owner: "lighting",
    kind: "related",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "lighting-look-link.film-grain-halation-bloom-and-related-image-treatments",
    name: "Film grain, halation, bloom and related image treatments",
    aliases: [],
    family: "K",
    description:
      "Choose grain, halation, bloom or related image treatment through Art Styles or finishing notes, preserving independent Camera and Lighting selections.",
    direction:
      "Choose grain, halation, bloom or related image treatment through Art Styles or finishing notes, preserving independent Camera and Lighting selections.",
    owner: "styles",
    kind: "related",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    propertyRecommended: false,
    guidance: "Do not override independent Lighting or Style selections.",
    priority: "P1",
  },
  {
    id: "coverage.master-establishing-coverage",
    name: "Master / establishing coverage",
    aliases: [],
    family: "L",
    description:
      "Plan broad coverage of established geography and principal action before closer views; this belongs to the production/storyboard plan.",
    direction:
      "Plan broad coverage of established geography and principal action before closer views; this belongs to the production/storyboard plan.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.wide-to-medium-to-close-up-coverage",
    name: "Wide-to-medium-to-close-up coverage",
    aliases: [],
    family: "L",
    description:
      "Arrange an intentional progression between wide, medium and close views without creating a database asset for every combination.",
    direction:
      "Arrange an intentional progression between wide, medium and close views without creating a database asset for every combination.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.shot-reverse-shot",
    name: "Shot-reverse-shot",
    aliases: [],
    family: "L",
    description:
      "Plan complementary opposing views of established participants, preserving deliberate screen relationships.",
    direction:
      "Plan complementary opposing views of established participants, preserving deliberate screen relationships.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.matching-eyelines",
    name: "Matching eyelines",
    aliases: [],
    family: "L",
    description:
      "Coordinate where established participants look across adjacent views, without inferring a new character identity.",
    direction:
      "Coordinate where established participants look across adjacent views, without inferring a new character identity.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.180-degree-rule",
    name: "180-degree rule",
    aliases: ["180-degree axis"],
    family: "L",
    description:
      "Maintain a deliberate side of the established action axis so screen direction remains understandable; crossing can be an intentional choice.",
    direction:
      "Maintain a deliberate side of the established action axis so screen direction remains understandable; crossing can be an intentional choice.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.intentional-axis-crossing",
    name: "Intentional axis crossing",
    aliases: [],
    family: "L",
    description:
      "Plan an intentional crossing of the established action axis and make the spatial transition understandable through coverage.",
    direction:
      "Plan an intentional crossing of the established action axis and make the spatial transition understandable through coverage.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.30-degree-rule",
    name: "30-degree rule",
    aliases: ["30-degree edit rule"],
    family: "L",
    description:
      "Plan sufficient deliberate viewpoint change between similar adjacent views to avoid an unintended jump cut; it is an editing guideline, not a camera limit.",
    direction:
      "Plan sufficient deliberate viewpoint change between similar adjacent views to avoid an unintended jump cut; it is an editing guideline, not a camera limit.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.screen-direction",
    name: "Screen direction",
    aliases: [],
    family: "L",
    description:
      "Preserve or deliberately change the apparent left/right movement relationship across the sequence.",
    direction:
      "Preserve or deliberately change the apparent left/right movement relationship across the sequence.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.match-on-action",
    name: "Match on action",
    aliases: [],
    family: "L",
    description:
      "Join views across an established action so the gesture and timing remain coherent.",
    direction:
      "Join views across an established action so the gesture and timing remain coherent.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.continuity-of-movement",
    name: "Continuity of movement",
    aliases: [],
    family: "L",
    description:
      "Maintain coherent movement phase, direction and pace across related views or planned takes.",
    direction:
      "Maintain coherent movement phase, direction and pace across related views or planned takes.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.reaction-coverage",
    name: "Reaction coverage",
    aliases: [],
    family: "L",
    description:
      "Plan a view of an established participant’s response in relation to the event that motivates it.",
    direction:
      "Plan a view of an established participant’s response in relation to the event that motivates it.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.insert-and-cutaway-coverage",
    name: "Insert and cutaway coverage",
    aliases: [],
    family: "L",
    description:
      "Plan detail inserts and related editorial cutaways while preserving their relationship to the main action.",
    direction:
      "Plan detail inserts and related editorial cutaways while preserving their relationship to the main action.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.foreground-background-blocking",
    name: "Foreground/background blocking",
    aliases: [],
    family: "L",
    description:
      "Plan established participant and object positions across depth planes; Camera does not silently rewrite Action or Environment blocking.",
    direction:
      "Plan established participant and object positions across depth planes; Camera does not silently rewrite Action or Environment blocking.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.subject-entrance-and-exit",
    name: "Subject entrance and exit",
    aliases: [],
    family: "L",
    description:
      "Plan the established subject’s entry and exit points and coordinate framing and screen direction across the sequence.",
    direction:
      "Plan the established subject’s entry and exit points and coordinate framing and screen direction across the sequence.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.reveal-timing",
    name: "Reveal timing",
    aliases: [],
    family: "L",
    description:
      "Specify when an established subject or information becomes visible relative to the shot and edit.",
    direction:
      "Specify when an established subject or information becomes visible relative to the shot and edit.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.motivated-reframing",
    name: "Motivated reframing",
    aliases: [],
    family: "L",
    description:
      "Change framing for an established action or informational reason rather than adding arbitrary unmotivated motion.",
    direction:
      "Change framing for an established action or informational reason rather than adding arbitrary unmotivated motion.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.long-take-oner",
    name: "Long take / oner",
    aliases: ["oner"],
    family: "L",
    description:
      "Plan an extended continuous take with coherent blocking, route, timing and available physical space.",
    direction:
      "Plan an extended continuous take with coherent blocking, route, timing and available physical space.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "coverage.hidden-cut-continuous-shot-illusion",
    name: "Hidden-cut continuous-shot illusion",
    aliases: [],
    family: "L",
    description:
      "Plan separately captured material that is joined to suggest continuity, with hidden transitions handled explicitly in the edit.",
    direction:
      "Plan separately captured material that is joined to suggest continuity, with hidden transitions handled explicitly in the edit.",
    owner: "storyboard",
    kind: "related",
    method: "planning",
    shotTypes: ["character_scene", "property_environment"],
    propertyRecommended: false,
    guidance:
      "Keep production continuity separate from the Camera slot and immutable saved takes.",
    priority: "P3",
  },
  {
    id: "specialized.forced-perspective",
    name: "Forced perspective",
    aliases: [],
    family: "M",
    description:
      "Arrange actual camera position and subject distances to create an intentional apparent scale relationship; do not misrepresent property dimensions.",
    direction:
      "Arrange actual camera position and subject distances to create an intentional apparent scale relationship; do not misrepresent property dimensions.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.miniature-tilt-shift-illusion",
    name: "Miniature / tilt-shift illusion",
    aliases: [],
    family: "M",
    description:
      "Create a miniature-like focus/scale treatment with appropriate optics or an explicitly simulated finish; distinguish the treatment from actual miniatures.",
    direction:
      "Create a miniature-like focus/scale treatment with appropriate optics or an explicitly simulated finish; distinguish the treatment from actual miniatures.",
    owner: "camera",
    kind: "technique",
    method: "simulation",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.underwater-cinematography",
    name: "Underwater cinematography",
    aliases: [],
    family: "M",
    description:
      "Plan actual underwater capture with suitable source and equipment, or label an underwater visual simulation explicitly.",
    direction:
      "Plan actual underwater capture with suitable source and equipment, or label an underwater visual simulation explicitly.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.infrared-thermal-imagery",
    name: "Infrared / thermal imagery",
    aliases: [],
    family: "M",
    description:
      "Distinguish infrared or thermal capture from a colorized visual simulation; source sensors and signals are not interchangeable.",
    direction:
      "Distinguish infrared or thermal capture from a colorized visual simulation; source sensors and signals are not interchangeable.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.night-vision-imagery",
    name: "Night-vision imagery",
    aliases: [],
    family: "M",
    description:
      "Distinguish actual night-vision capture characteristics from a simulated green or intensified visual treatment.",
    direction:
      "Distinguish actual night-vision capture characteristics from a simulated green or intensified visual treatment.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.stop-motion-capture",
    name: "Stop-motion capture",
    aliases: [],
    family: "M",
    description:
      "Plan discrete posed-frame capture and playback rather than confusing stop-motion construction with ordinary slow motion.",
    direction:
      "Plan discrete posed-frame capture and playback rather than confusing stop-motion construction with ordinary slow motion.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.bullet-time-time-slice-photography",
    name: "Bullet-time / time-slice photography",
    aliases: [],
    family: "M",
    description:
      "Plan a multi-view/time-slice setup or explicitly labeled reconstruction; a single flat image does not provide surrounding viewpoints.",
    direction:
      "Plan a multi-view/time-slice setup or explicitly labeled reconstruction; a single flat image does not provide surrounding viewpoints.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.speed-ramping",
    name: "Speed ramping",
    aliases: [],
    family: "M",
    description:
      "Change the playback rate over time in editing, specifying the intended transition and available temporal source.",
    direction:
      "Change the playback rate over time in editing, specifying the intended transition and available temporal source.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.reverse-motion-treatment",
    name: "Reverse-motion treatment",
    aliases: [],
    family: "M",
    description:
      "Play existing action backward as a deliberate editorial treatment, keeping it distinct from a camera traveling backward.",
    direction:
      "Play existing action backward as a deliberate editorial treatment, keeping it distinct from a camera traveling backward.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.motion-control-repeat-passes",
    name: "Motion-control repeat passes",
    aliases: [],
    family: "M",
    description:
      "Repeat a verified programmed camera trajectory for multiple passes that will be combined deliberately.",
    direction:
      "Repeat a verified programmed camera trajectory for multiple passes that will be combined deliberately.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.in-camera-double-exposure",
    name: "In-camera double exposure",
    aliases: [],
    family: "M",
    description:
      "Plan multiple exposures within an appropriate capture process, distinguishing this from an explicitly simulated composite.",
    direction:
      "Plan multiple exposures within an appropriate capture process, distinguishing this from an explicitly simulated composite.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.split-screen-imagery",
    name: "Split-screen imagery",
    aliases: [],
    family: "M",
    description:
      "Arrange separate established views in a divided output frame as an editorial composition.",
    direction:
      "Arrange separate established views in a divided output frame as an editorial composition.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.projection-based-cinematography",
    name: "Projection-based cinematography",
    aliases: [],
    family: "M",
    description:
      "Use a specified projected image as an actual capture element, or explicitly identify projection simulation in post-production.",
    direction:
      "Use a specified projected image as an actual capture element, or explicitly identify projection simulation in post-production.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.match-moving-vfx-camera-tracking",
    name: "Match-moving / VFX camera tracking",
    aliases: [],
    family: "M",
    description:
      "Track or reconstruct the camera’s movement from suitable source for VFX integration; do not claim a single still supplies a solved 3D scene.",
    direction:
      "Track or reconstruct the camera’s movement from suitable source for VFX integration; do not claim a single still supplies a solved 3D scene.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.virtual-camera-movement",
    name: "Virtual camera movement",
    aliases: [],
    family: "M",
    description:
      "Move a virtual camera through an actual modeled or otherwise supported virtual scene; a flat photo alone is insufficient spatial source.",
    direction:
      "Move a virtual camera through an actual modeled or otherwise supported virtual scene; a flat photo alone is insufficient spatial source.",
    owner: "camera",
    kind: "technique",
    method: "simulation",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.360-degree-immersive-capture",
    name: "360-degree / immersive capture",
    aliases: [],
    family: "M",
    description:
      "Plan immersive capture covering surrounding viewing directions rather than a normal camera orbit around the subject.",
    direction:
      "Plan immersive capture covering surrounding viewing directions rather than a normal camera orbit around the subject.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.extreme-macro-probe-cinematography",
    name: "Extreme macro / probe cinematography",
    aliases: [],
    family: "M",
    description:
      "Use appropriate high-magnification or probe optics for actual close detail and access, preserving the real subject and clearance.",
    direction:
      "Use appropriate high-magnification or probe optics for actual close detail and access, preserving the real subject and clearance.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.subject-mounted-subjective-camera",
    name: "Subject-mounted subjective camera",
    aliases: [],
    family: "M",
    description:
      "Attach the camera to the subject to create an attributed body-relative viewpoint rather than an independent following camera.",
    direction:
      "Attach the camera to the subject to create an attributed body-relative viewpoint rather than an independent following camera.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "specialized.specialized-lens-transitions",
    name: "Specialized lens transitions",
    aliases: [],
    family: "M",
    description:
      "Name the intended specific optical transition, lens behavior and timing rather than treating a vague specialized label as an executable technique.",
    direction:
      "Name the intended specific optical transition, lens behavior and timing rather than treating a vague specialized label as an executable technique.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "specialized",
    propertyRecommended: false,
    guidance:
      "Optional, independent camera attribute; use only when applicable to the selected Shot Type.",
    priority: "P2",
  },
  {
    id: "property.exterior-establishing-shot",
    name: "Exterior establishing shot",
    aliases: [],
    family: "N",
    description:
      "Establish the actual property exterior and its real context without fabricating surroundings or changing its scale.",
    direction:
      "Establish the actual property exterior and its real context without fabricating surroundings or changing its scale.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.building-facade-reveal",
    name: "Building-facade reveal",
    aliases: [],
    family: "N",
    description:
      "Reveal the photographed or spatially documented building facade while preserving its actual openings, floors and proportions.",
    direction:
      "Reveal the photographed or spatially documented building facade while preserving its actual openings, floors and proportions.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.drone-elevation-pullback",
    name: "Drone elevation / pullback",
    aliases: [],
    family: "N",
    description:
      "Use a plausible aerial rise or pullback to show documented property context; do not invent unseen neighboring geography.",
    direction:
      "Use a plausible aerial rise or pullback to show documented property context; do not invent unseen neighboring geography.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.architectural-orbit",
    name: "Architectural orbit",
    aliases: [],
    family: "N",
    description:
      "Orbit an actual building only when adequate spatial or multiple-view source supports changing viewpoints.",
    direction:
      "Orbit an actual building only when adequate spatial or multiple-view source supports changing viewpoints.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.corridor-tracking",
    name: "Corridor tracking",
    aliases: [],
    family: "N",
    description:
      "Track through the real corridor along an available route without widening it, moving openings or passing through walls.",
    direction:
      "Track through the real corridor along an available route without widening it, moving openings or passing through walls.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.doorway-reveal",
    name: "Doorway reveal",
    aliases: [],
    family: "N",
    description:
      "Reveal an established room through its actual doorway, preserving the doorway location and available view.",
    direction:
      "Reveal an established room through its actual doorway, preserving the doorway location and available view.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.living-room-wide-master",
    name: "Living-room wide master",
    aliases: [],
    family: "N",
    description:
      "Show the real living-room arrangement in a readable wide view without expanding walls or rearranging furniture.",
    direction:
      "Show the real living-room arrangement in a readable wide view without expanding walls or rearranging furniture.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.dining-area-lateral-move",
    name: "Dining-area lateral move",
    aliases: [],
    family: "N",
    description:
      "Move laterally across a documented dining area while preserving furniture layout and real depth relationships.",
    direction:
      "Move laterally across a documented dining area while preserving furniture layout and real depth relationships.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.kitchen-detail-inserts",
    name: "Kitchen detail inserts",
    aliases: [],
    family: "N",
    description:
      "Frame actual kitchen materials or fixtures as details without adding appliances or implying unverified inclusions.",
    direction:
      "Frame actual kitchen materials or fixtures as details without adding appliances or implying unverified inclusions.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.bedroom-corner-to-corner-coverage",
    name: "Bedroom corner-to-corner coverage",
    aliases: [],
    family: "N",
    description:
      "Plan separate real bedroom views from actual available positions; do not invent the unseen corner or room dimensions.",
    direction:
      "Plan separate real bedroom views from actual available positions; do not invent the unseen corner or room dimensions.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.bathroom-architectural-detail",
    name: "Bathroom architectural detail",
    aliases: [],
    family: "N",
    description:
      "Show existing bathroom fixtures or finishes as architectural details without adding amenities or enlarging the space.",
    direction:
      "Show existing bathroom fixtures or finishes as architectural details without adding amenities or enlarging the space.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.window-view-reveal",
    name: "Window-view reveal",
    aliases: [],
    family: "N",
    description:
      "Reveal only a documented view through an actual window; do not invent a skyline or remove real obstructions.",
    direction:
      "Reveal only a documented view through an actual window; do not invent a skyline or remove real obstructions.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.balcony-reveal",
    name: "Balcony reveal",
    aliases: [],
    family: "N",
    description:
      "Reveal an existing balcony and its verified outlook without extending its footprint or inventing scenery.",
    direction:
      "Reveal an existing balcony and its verified outlook without extending its footprint or inventing scenery.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.ceiling-height-reveal",
    name: "Ceiling-height reveal",
    aliases: [],
    family: "N",
    description:
      "Frame the actual floor-to-ceiling relationship without claiming measurements or exaggerating vertical space.",
    direction:
      "Frame the actual floor-to-ceiling relationship without claiming measurements or exaggerating vertical space.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.furniture-layout-preserving-move",
    name: "Furniture-layout-preserving move",
    aliases: [],
    family: "N",
    description:
      "Use a restrained move that preserves the photographed furniture positions and the actual walls, doors and floor area.",
    direction:
      "Use a restrained move that preserves the photographed furniture positions and the actual walls, doors and floor area.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.straight-vertical-architectural-framing",
    name: "Straight-vertical architectural framing",
    aliases: [],
    family: "N",
    description:
      "Keep actual structural verticals intentionally straight while preserving true building and room proportions.",
    direction:
      "Keep actual structural verticals intentionally straight while preserving true building and room proportions.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.rectilinear-wide-angle-interior-coverage",
    name: "Rectilinear wide-angle interior coverage",
    aliases: [],
    family: "N",
    description:
      "Use a rectilinear wide view suited to an actual interior without stretching the room into fictional extra floor area.",
    direction:
      "Use a rectilinear wide view suited to an actual interior without stretching the room into fictional extra floor area.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.gentle-slider-parallax",
    name: "Gentle slider parallax",
    aliases: [],
    family: "N",
    description:
      "Use a short lateral parallax move only when the property’s real spatial source supports it; keep all furnishings fixed.",
    direction:
      "Use a short lateral parallax move only when the property’s real spatial source supports it; keep all furnishings fixed.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.stabilized-interior-walkthrough",
    name: "Stabilized interior walkthrough",
    aliases: [],
    family: "N",
    description:
      "Follow a real unobstructed interior route with controlled stabilization while preserving documented layout and clearances.",
    direction:
      "Follow a real unobstructed interior route with controlled stabilization while preserving documented layout and clearances.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.detail-to-wide-reveal",
    name: "Detail-to-wide reveal",
    aliases: [],
    family: "N",
    description:
      "Reveal documented context from an actual detail view without fabricating space outside the available source.",
    direction:
      "Reveal documented context from an actual detail view without fabricating space outside the available source.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "property.vertical-9-16-property-composition",
    name: "Vertical 9:16 property composition",
    aliases: [],
    family: "N",
    description:
      "Compose the actual property for a 9:16 frame with deliberate vertical emphasis and readable real spatial relationships.",
    direction:
      "Compose the actual property for a 9:16 frame with deliberate vertical emphasis and readable real spatial relationships.",
    owner: "camera",
    kind: "technique",
    method: "capture",
    shotTypes: ["character_scene", "property_environment"],
    dimension: "property",
    propertyRecommended: true,
    guidance:
      "No widened rooms, altered walls/doors, moved furniture, invented views or missing floor area. Physical travel requires sufficient actual spatial source.",
    priority: "P3",
  },
  {
    id: "graphics.2d-pan",
    name: "2D pan",
    aliases: [],
    family: "O",
    description:
      "Translate the view across the existing two-dimensional source within its actual bounds; do not invent a new three-dimensional viewpoint.",
    direction:
      "Translate the view across the existing two-dimensional source within its actual bounds; do not invent a new three-dimensional viewpoint.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: true,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.2d-zoom",
    name: "2D zoom",
    aliases: [],
    family: "O",
    description:
      "Change the crop scale of the existing source without claiming physical dolly parallax or recovering unavailable detail.",
    direction:
      "Change the crop scale of the existing source without claiming physical dolly parallax or recovering unavailable detail.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: true,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.pan-and-zoom-ken-burns-treatment",
    name: "Pan-and-zoom / Ken Burns treatment",
    aliases: ["Ken Burns"],
    family: "O",
    description:
      "Combine a controlled two-dimensional source translation and crop-scale change, keeping all original geometry and labels unchanged.",
    direction:
      "Combine a controlled two-dimensional source translation and crop-scale change, keeping all original geometry and labels unchanged.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: true,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.digital-crop-reframe",
    name: "Digital crop / reframe",
    aliases: ["digital reframe"],
    family: "O",
    description:
      "Select or move a crop within the existing source boundaries; no new architecture, labels or image areas are invented.",
    direction:
      "Select or move a crop within the existing source boundaries; no new architecture, labels or image areas are invented.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: false,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.subtle-graphic-reveal",
    name: "Subtle graphic reveal",
    aliases: [],
    family: "O",
    description:
      "Reveal existing graphic elements with restrained timing and motion while preserving their original identity and layout.",
    direction:
      "Reveal existing graphic elements with restrained timing and motion while preserving their original identity and layout.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: false,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.masked-area-highlighting",
    name: "Masked area highlighting",
    aliases: [],
    family: "O",
    description:
      "Highlight a verified existing source region with a separate mask or overlay rather than redrawing the underlying diagram.",
    direction:
      "Highlight a verified existing source region with a separate mask or overlay rather than redrawing the underlying diagram.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: false,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.sequential-area-emphasis",
    name: "Sequential area emphasis",
    aliases: [],
    family: "O",
    description:
      "Emphasize actual source regions in a specified sequence, preserving their geometry and information.",
    direction:
      "Emphasize actual source regions in a specified sequence, preserving their geometry and information.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: false,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.text-safe-movement",
    name: "Text-safe movement",
    aliases: [],
    family: "O",
    description:
      "Keep existing text legible and within a deliberate safe area while using restrained source movement.",
    direction:
      "Keep existing text legible and within a deliberate safe area while using restrained source movement.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: false,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.diagram-preserving-highlight",
    name: "Diagram-preserving highlight",
    aliases: [],
    family: "O",
    description:
      "Emphasize an actual diagram region without changing dimensions, labels, linework or proportions.",
    direction:
      "Emphasize an actual diagram region without changing dimensions, labels, linework or proportions.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: false,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.source-locked-composition",
    name: "Source-locked composition",
    aliases: ["source locked"],
    family: "O",
    description:
      "Keep the source geometry and composition fixed while any explicitly planned overlays remain separate.",
    direction:
      "Keep the source geometry and composition fixed while any explicitly planned overlays remain separate.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: true,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.static-source-with-animated-overlays",
    name: "Static source with animated overlays",
    aliases: [],
    family: "O",
    description:
      "Hold the original source image still and animate separate supplied or authored overlays without altering its underlying content.",
    direction:
      "Hold the original source image still and animate separate supplied or authored overlays without altering its underlying content.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: false,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
  {
    id: "graphics.simple-depth-layer-parallax-only-when-appropriate-source-layers-are-available",
    name: "Simple depth-layer parallax only when appropriate source layers are available",
    aliases: [],
    family: "O",
    description:
      "Use restrained relative motion only between actual supplied depth layers; a single flat floor plan is not a modeled 3D environment.",
    direction:
      "Use restrained relative motion only between actual supplied depth layers; a single flat floor plan is not a modeled 3D environment.",
    owner: "camera",
    kind: "technique",
    method: "editing",
    shotTypes: [
      "character_scene",
      "property_environment",
      "graphic_motion",
      "existing_footage",
    ],
    dimension: "graphics",
    propertyRecommended: false,
    guidance:
      "No invented 3D geometry; retain original diagram labels/layout; parallax requires actual layers.",
    priority: "P1",
  },
];
