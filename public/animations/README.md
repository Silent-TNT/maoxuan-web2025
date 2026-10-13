# Fire animation

## Previous trial: LPC Flames

- Graphic artist: Sharm
- Extracted/packed by: William.Thompsonj
- Source: https://opengameart.org/content/lpc-flames
- Download: https://opengameart.org/sites/default/files/flames_0.png
- Selected license: CC BY 3.0, https://creativecommons.org/licenses/by/3.0/
- Retrieved: 2026-10-13
- `lpc-flames.png` is the unmodified transparent sprite sheet, 64×72 pixels (12 frames of 16×24).
- When enabled, the site displays the original frames at staggered phases with a soft glow and credits Sharm in the page footer. This trial is currently inactive.

## Current: Lottie Fire Animation

- Title: Fire Animation
- Published by: grappphy (original animation by Yogi, as credited on the source page)
- Source: https://lottiefiles.com/free-animation/fire-animation-HVXQU0gagS
- Original file: https://assets-v2.lottiefiles.com/a/a4e58fca-ae93-4448-af6a-20ea4e915468/HVXQU0gagS.lottie
- License listed by the source: Lottie Simple License
- Retrieved: 2026-10-13

`.vitepress/theme/assets/fire.json` is the unmodified animation JSON extracted from `a/Main Scene.json` in `fire.lottie`.
The page plays the full original timeline (32 frames at an original 24 fps), at 0.4× playback speed with staggered starting phases. No frames are omitted. No additional opacity animation is applied to the flame.

`fire-still.svg` is a static render of frame 8 from the same original animation. It fades in underneath the live animation during its extinguishing/empty frames, keeping the flame continuously visible without cutting the original timeline. The outer flame opacity stays at 100%.
