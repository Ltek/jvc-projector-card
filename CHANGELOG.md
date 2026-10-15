# Changelog

## v2026.10.15.4

- **Reorder the sections.** The editor's **Sections** list (Card & sections) now shows every section in card order, with ↑ / ↓ arrows to move it, its Show checkbox, its **Start open** checkbox and its sub-options (menu shortcuts under Remote, Low / Mid / High under Laser). Status can move too. A **Default order** button puts them back. YAML: `section_order: [remote, status, …]` — only written when it differs from the default; sections you leave out follow in the default order.

## v2026.10.14.3

For the Ltek integration v2026.10.14.3; everything still works with mjmcg's original and older Ltek builds.

- Picture section: **Theater Optimizer** (Off / On, only while HDR plays), **Motion (CMD)** (Clear Motion Drive: Off / Low / High / Inverse telecine — the options your model has), **Motion enhance** and **8K e-shift**. Rows appear only on models that have the setting.
- CMD and Dynamic rows hide while the projector disables them (Low latency on).
- Info: **firmware version**, color depth, color space, HDR signal, Theater Optimizer, CMD and e-shift; an **ECO mode** Off / On row, with a warning and an ECO tag while it's on (the projector can't be reached in standby then).
- Signal box shows the bit depth next to the colorimetry (BT.2020 · 10-bit).
- Uses the integration's **Connection** sensor for the link dot and "Offline".
- The 8K e-shift row appears on the NZ800 / NZ900, NZ7 / NZ8 / NZ9 and NX9 (the integration decides which models have it).

## v2026.10.13.2

For the Ltek integration ([Ltek/jvc-projector](https://github.com/Ltek/jvc-projector)); everything still works with mjmcg's original.

- Picture section: new **Lens memory** row (installation modes 1–5 or 1–10, depending on the model), **Anamorphic** (Off / A–D), **HDR processing** (Static / Frame / Scene; HDR10+ shows when the projector picks it but can't be tapped) and **HDR level**, both only while HDR plays, and **Low latency** (Off / On). Each row appears only if the integration provides that entity.
- Lens memory on the collapsed Picture header; lens memory, anamorphic, HDR processing and low latency in Info; a LOW LATENCY tag while it's on.
- `hide_lens` (Buttons panel: Lens memory) hides memories you don't use.
- Understands the integration's new state keys (`no_signal`, `4k_3840_24`, `hdr10_plus`, `bt2020_cl`…) as well as the old raw values.
- Info shows the signal as a compact label (2160p24) instead of the raw value.
- Row labels are wider so the longer names fit on one line.

## v2026.10.13.1

First release. Same design as the Lumagen Card.

- Header: power button (tap to turn on, hold for standby) that shows the power state — warming up (orange, pulsing), cooling down (cyan; turning on is blocked until standby), error (red); link dot; live summary (signal · content type · picture mode); red "Offline" when the integration can't reach the projector.
- Standby: collapses to a one-line bar instead of disappearing (option to hide the card instead; always shown while editing). Standby message below / inline / hidden or your own text, optional power button on the right, optional hold-to-turn-on.
- Status: Signal (resolution & rate, input, colorimetry) › Picture (picture mode, content type, dynamic control) › Laser (power bar, light-source hours).
- Status tags that appear only when active: HDR10 / HDR10+ / HLG, NO SIGNAL, OUT OF RANGE, DCI, LINK DOWN.
- Collapsible sections (collapsed by default, or chosen to start open): Remote (Hide / Info / Menu / Back, OK and arrows — hold an arrow to repeat 5× — plus menu shortcut buttons), Picture (picture mode and dynamic control chips), Laser (slider, − / +, Low / Mid / High), Source (HDMI 1 / 2), Info.
- A tapped option shows as "sending" until the projector's next poll confirms it.
- Entities found by the integration's translation keys (renamed entity IDs keep working); readable names for the integration's raw values.
- Visual editor: Device, Card & sections, Buttons (hide picture modes / dynamic / inputs, menu shortcuts, laser step), Icons, Appearance (sizes, four-mode colors, transparent backgrounds) and context colors.
