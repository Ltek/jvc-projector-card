# JVC Projector Card

A Home Assistant Dashboard card for **JVC D-ILA projectors** (NZ / RS / N series). See the signal,
picture mode and laser at a glance, and reach the remote, picture settings, laser power and inputs
from one card, without a stray tap ever stopping your movie. Set up in a visual editor.

Current build: **v2026.10.26.14** · full history in [CHANGELOG.md](CHANGELOG.md) · every YAML option in [OPTIONS.md](OPTIONS.md)

```
 ▣  Projector ●                     2160p24 · HDR10 · Frame Adapt HDR
 ┌ SIGNAL · HDMI 1 ──────┐     ┌ PICTURE ───────────────┐
 │ 2160p24               │  →  │ Frame Adapt HDR        │
 │ HDR10 · BT.2020       │     │ Dynamic Balanced       │
 │                       │     │ ▬▬▬▬▬▬▬▬░░░  Laser 72% │
 └───────────────────────┘     └────────────────────────┘
 [HDR10]
 ▦ Remote                                         ›
 ◐ Picture  Frame Adapt HDR · Dynamic Balanced    ›
 ☀ Laser    72%                                   ›
 ⇥ Source   HDMI 1                                ›
 ⓘ Info     DLA-NZ700                             ›
```

---

## Installation

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Ltek&repository=jvc-projector-card&category=plugin)

1. Click the button above. It opens HACS in your Home Assistant with this repository filled in.
2. Add it, then click **Download**. HACS registers the Dashboard resource for you.
3. Hard-refresh the browser (Ctrl/Cmd + Shift + R).
4. On a dashboard: **+ Add card → JVC Projector Card**. With one projector there is nothing to set up.

The card is a **custom repository**, so searching HACS won't find it. If the button doesn't work:
HACS → **⋮ → Custom repositories** → `https://github.com/Ltek/jvc-projector-card`, category **Dashboard**.

**Requires** a JVC Projector integration (2024 LAN spec):

- [Ltek/jvc-projector](https://github.com/Ltek/jvc-projector) — **recommended**. Adds lens memory,
  anamorphic, HDR settings, Theater Optimizer, motion settings, e-shift, ECO mode, firmware version and
  a connection sensor, creates only what your model supports, and fixes remote lag.
- or the original [mjmcg/jvc_projector_ha](https://github.com/mjmcg/jvc_projector_ha). The extra
  settings then simply don't appear.

---

## Features

### See what's on screen
- **Signal → Picture**: the input, resolution and rate, then content type, colorimetry and bit depth
  (`HDR10 · BT.2020 · 10-bit`) next to the picture mode, dynamic control and a laser power bar.
- **Tags** for what matters right now: HDR10 / HDR10+ / HLG, no signal, out of range, DCI, low
  latency, ECO mode, link down.
- The card **tints in your HDR color** while HDR plays.

### Safe power control
- The header icon is the power button: **tap to turn on, hold for standby**, so a stray tap can't end
  your movie. Keyboard and screen-reader users tap twice to confirm.
- It shows **warming up**, **cooling down** (it can't be turned on until standby) and **error**.
- A link dot shows whether Home Assistant can reach the projector.
- In standby, hide the card, collapse it to the header, or keep it expanded.

### Everything one tap away, nothing by accident
- **Every control sits in a collapsed section**; each collapsed header shows the current value.
- **Remote**: menu, arrows and OK; **hold an arrow to repeat it 5×**. One-tap menu shortcuts (MPC,
  Gamma, Color temp, Lens, Advanced — pick your own from 18 keys).
- **Picture**: picture mode (only the modes for the current content), dynamic control, and with the
  Ltek integration lens memory, anamorphic, HDR processing and level, Theater Optimizer, Clear Motion
  Drive, Motion enhance, 8K e-shift and low latency.
- **Laser**: slider, − / + and JVC's own **Low / Mid / High**.
- **Source**: HDMI 1 / HDMI 2. **Info**: model, firmware, signal details, light-source hours, ECO mode
  (with a warning, since ECO mode stops Home Assistant turning the projector on).
- The projector is polled every 10 seconds, so a tapped option shows as *sending* until it confirms.

### Make it yours
- **Reorder, rename, hide and merge sections**, and hide single settings or buttons you never use.
- Your own icons, accent / HDR / warming / cooling colors, and sizes and colors for every part of the
  card, from your theme or your own.
- Everything is in the visual editor; YAML is optional. Only settings you change are saved.

### Works with your projector
- Finds the integration's entities by their translation keys, so **renamed entities keep working**.
- Rows appear only for the settings your model has, and hide while the projector disables them (HDR
  settings without HDR, CMD and Dynamic while low latency is on).
- **Phone-friendly:** the boxes stay side by side on a phone in portrait, and stack only on a very narrow card. Or choose always / never.

---

## Credits

- **[mjmcg](https://github.com/mjmcg)** — the [jvc_projector_ha](https://github.com/mjmcg/jvc_projector_ha)
  integration this card is designed around, built on [Steve Easley](https://github.com/SteveEasley)'s
  pyjvcprojector.
- [JVC](https://www.jvc.com) for the published external command communication specification.
- Same design as the [Lumagen Card](https://github.com/Ltek/lumagen-card) and the
  [StormAudio Card](https://github.com/Ltek/stormaudio-card).

MIT licensed — see [LICENSE](LICENSE).
