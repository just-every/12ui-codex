export const baseCreateGuidance = [
  'Use the attached sketch and reference assets as visual context for placement, hierarchy, density, brand cues, and reusable visual assets.',
  'Do not include the sketch itself in the final image. Follow the sketch layout closely unless the user explicitly asks for a different structure.',
  'Treat uploaded page screenshots as style/layout context, not as literal reusable source images. Reuse an uploaded asset literally only when it is clearly an identity/product asset such as a logo, icon, mascot, product photo, or explicitly requested visual.',
  'Design a polished full-screen web page or product interface, edge-to-edge, with no browser chrome, tabs, address bars, device frames, presentation backgrounds, surrounding scenes, collages, or explanatory annotations.',
  'For product tools, dashboards, editors, and operational surfaces, keep the UI calm, dense enough for repeated work, and easy to scan. Avoid marketing-page composition unless the prompt asks for a landing page.',
  'Use full-bleed layout deliberately: the interface should occupy the whole frame, but text and controls need comfortable margins, visible grouping, and stable alignment.',
  'When using background images or rich visual scenes, make them fill the whole frame and let the page text, controls, and composition tell the story together.',
  'Avoid boxed sections and layered card-like layouts. Integrate text and imagery naturally into the overall composition instead of stacking cards over a background.',
  'Match text scale to the container. Use hero-scale type only for true heroes; keep toolbar, sidebar, card, dashboard, and editor headings compact. Text must fit inside buttons, pills, cards, nav items, and panels without clipping or overlap.',
  'Keep spacing rhythm, typography, alignment, and component sizes consistent. Fixed-format UI elements such as boards, grids, toolbars, icon buttons, counters, and tiles need stable dimensions so hover states, labels, and dynamic content do not shift layout.',
  'Avoid visual clutter: no random floating decoration, no generic SaaS card piles, no illegible microtext, and no one-note color palette. Use restrained accents that serve selection, status, and primary actions.',
  'Make the result feel like a real interface ready for implementation and 12ui conversion.',
].join('\n');

export const plannerGuidance = [
  'Before writing branch prompts, inspect every attached image and infer the intended layout, major zones, visual density, and any reusable assets.',
  'Order the branches by creative distance: branch 1 should be the straight, faithful interpretation of the prompt; each later branch should become progressively more creative, inventive, and unexpected while still solving the same user goal.',
  'Make the increasing creativity come from interaction model, composition, spatial metaphor, workflow, or visual system, not just color or copy changes.',
  'Each branch prompt must be directly usable by an image generation model with the same sketch/reference images attached.',
  'Each branch prompt must restate the key visual constraints from the sketch/assets so image generation remains grounded even if the generated image model weighs text more strongly than image context.',
  'Call out full-bleed framing, text-size discipline, spacing rhythm, and overlap avoidance when relevant to the prompt.',
].join('\n');
