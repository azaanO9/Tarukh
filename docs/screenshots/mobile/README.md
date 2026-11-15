# Mobile layout evidence

Captured from the built game in Chrome device emulation on November 16, 2026. Portrait gameplay is intentionally paused behind the rotation guide. Landscape captures show the reserved HUD and thumb-control zones. These images verify the tested states, not every possible mission dialog or physical phone safe area.

| Viewport | Screenshot |
| --- | --- |
| 360 × 640 | [Portrait](mobile-360x640.png) |
| 375 × 667 | [Portrait](mobile-375x667.png) |
| 390 × 844 | [Portrait](mobile-390x844.png) |
| 412 × 915 | [Portrait](mobile-412x915.png) |
| 430 × 932 | [Portrait](mobile-430x932.png) |
| 768 × 1024 | [Tablet portrait](mobile-768x1024.png) |
| 1024 × 768 | [Tablet landscape](mobile-1024x768.png) |
| 844 × 390 | [Phone landscape](mobile-844x390.png) |
| 926 × 428 | [Phone landscape](mobile-926x428.png) |
| 568 × 320 | [Short landscape](mobile-568x320.png) |

Additional states: [phone](mobile-phone-844x390.png), [atlas](mobile-atlas-844x390.png), [graphics settings](mobile-settings-844x390.png), [Story](mobile-story-844x390.png), [short Story](mobile-story-568x320.png), [briefing](mobile-story-briefing-844x390.png), [touch/hold map selection](atlas-touch-details.png), [offline launcher](pwa-offline-launch.png), [connection recovery](connection-recovery.png).

Automatic detection: [iPhone SE](launch-iPhone-SE.png), [iPhone 14](launch-iPhone-14.png), [iPhone 15](launch-iPhone-15.png), [Pixel 7](launch-Pixel-7.png), [Galaxy S9+](launch-Galaxy-S9-.png), [iPad](launch-iPad--gen-7-.png), [desktop](pc-launch-1280x720.png).

See the [layout report](../../qa/mobile/layout-report.json), [touch results](../../qa/mobile/atlas-touch-report.json) and [performance methodology](../../MOBILE_OPTIMIZATION.md). Re-run `scripts/mobile-layout-check.mjs` to create fresh screenshots and fail on tested overlaps, unsafe bounds or clipped controls.
