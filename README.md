# JVC Projector Card

A Home Assistant Dashboard **custom card** for **JVC D-ILA projectors** (NZ / RS / N series): signal, picture mode and laser status at a glance, a menu remote, picture mode and dynamic control, laser power, inputs and projector info — all in one card with a visual editor. Same design as the [Lumagen Card](https://github.com/Ltek/lumagen-card).

Current build: **v2026.10.14.3** · full history in [CHANGELOG.md](CHANGELOG.md)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Ltek&repository=jvc-projector-card&category=plugin)

> Requires the **JVC Projector integration** (2024 LAN spec): the Ltek version [Ltek/jvc-projector](https://github.com/Ltek/jvc-projector) (recommended: adds lens memory, anamorphic, HDR settings, Theater Optimizer, motion settings, e-shift, ECO mode, firmware version and a connection sensor, creates only what your model supports, and fixes remote lag), or the original [mjmcg/jvc_projector_ha](https://github.com/mjmcg/jvc_projector_ha).

---

## What it shows

Status sits on top. **Every control is in a collapsed section**, so nothing changes by accident; each collapsed header shows the current value.

```
 ▣  Projector ●                     2160p24 · HDR10 · Frame Adapt HDR
 ┌ SIGNAL ─────┐   ┌ PICTURE ───────┐   ┌ LASER ─────┐
 │ 2160p24     │ › │ Frame Adapt HDR│ › │ 72%        │
 │ HDMI 1      │   │ HDR10          │   │ ▬▬▬▬▬▬▬░░  │
 │ BT.2020     │   │ Dynamic Bal.   │   │ 1,234 h    │
 └─────────────┘   └────────────────┘   └────────────┘
 [HDR10]
 ▦ Remote                                         ›
 ◐ Picture  Frame Adapt HDR · Dynamic Balanced    ›
 ☀ Laser    72%                                   ›
 ⇥ Source   HDMI 1                                ›
 ⓘ Info     DLA-NZ700                             ›
```

- **Header** — the icon is the power button: tap to turn the projector on, **hold** for standby (a stray tap can't stop your movie). It shows the power state: context color when on, orange and pulsing while **warming up**, cyan while **cooling down** (it can't be turned on until it reaches standby), red on **error**. The dot is the link: green = the integration reaches the projector, red = it can't; the summary then reads *Offline* in red.
- **Standby** — the card shrinks to its header instead of disappearing, so you can power on from it. Choose where the "Standby · tap the icon to power on" message goes (below, inline, hidden), or show a power button on the right. Optionally require a hold to turn on too, or hide the card in standby (it always shows while you edit the Dashboard).
- **Collapse** — optionally tap the header to collapse the card to just the header while the projector is on, and start collapsed.
- **Status** — Signal (resolution & rate, input, colorimetry and bit depth) › Picture (picture mode, content type, dynamic control) › Laser (power with a bar, light-source hours).
- **Tags** appear only when active: HDR10 / HDR10+ / HLG, NO SIGNAL, OUT OF RANGE, DCI, LOW LATENCY, LINK DOWN.
- **Remote** — Hide / Info / Menu / Back, OK and arrows; **hold an arrow to repeat it 5×**. Below: one-tap menu shortcuts (MPC, Gamma, Color temp, Lens, Advanced by default — pick your own from 18 keys).
- **Picture** — picture mode chips (the projector's modes for the current content: SDR, HDR10, HLG…) and dynamic control (Off / Low / High / Balanced). With the Ltek integration also **Lens memory** (installation mode 1–5 / 1–10, for constant-height screens), **Anamorphic** (Off / A–D), **HDR processing** and **HDR level** (only while HDR plays), **Theater Optimizer** (only while HDR plays), **Motion (CMD)** (Clear Motion Drive), **Motion enhance**, **8K e-shift** and **Low latency** (Off / On). Rows appear only for the settings your projector has, and hide while the projector disables them (CMD and Dynamic while Low latency is on).
- **Laser** — slider, − / + buttons and **Low / Mid / High** (the projector's own laser settings).
- **Source** — HDMI 1 / HDMI 2.
- **Info** — model, firmware, power, signal, input, colorimetry, color depth / space, HDR signal, content type, picture settings, light-source hours and the connection state. With the Ltek integration also an **ECO mode** Off / On row, and a warning while it's on: with ECO mode on the projector switches its network off in standby, so Home Assistant can't turn it on.
- **Context tint** — accent normally, HDR color while HDR plays.

The projector is polled every 10 seconds, so a tapped option shows as **sending** (dashed, pulsing) until the projector confirms it.

## Installation

### HACS

1. Click the badge above, or in HACS → **⋮ → Custom repositories** add `https://github.com/Ltek/jvc-projector-card`, category **Dashboard**.
2. Install **JVC Projector Card** and reload the browser.

### Manual

Copy `jvc-projector-card.js` to `/config/www/`, then add it under **Settings → Dashboards → ⋮ → Resources** as `/local/jvc-projector-card.js` (JavaScript module).

## Setup

Add a card → search **JVC Projector Card**. With one projector there is nothing to configure. The card finds the integration's entities by their translation keys, so renamed entity IDs keep working.

Minimal YAML:

```yaml
type: custom:jvc-projector-card
```

The integration's **Model** sensor is disabled by default; enable it in **Settings → Devices & services → JVC Projector → device → Entities** to show the model in Info. Picture mode, input, dynamic control and laser power are only available while the projector is on, so those sections are dimmed in standby.

## Options

Everything is in the visual editor (Device · Card & sections · Buttons · Icons · Appearance). YAML keys are only written when they differ from the default.

| Key | Default | Description |
|---|---|---|
| `device` | first projector | Device ID, if you have more than one JVC projector. |
| `title` | `Projector` | Header title. |
| `show_when_off` | `true` | `true`: show the card (header only) in standby. `false`: hide the card in standby. |
| `standby_text` | `below` | Standby message: `below` the title, `inline` with it, or `hidden`. |
| `standby_message` | stock text | Your own standby message; empty = "Standby · tap the icon to power on". |
| `standby_button` | `false` | In standby, replace the right-hand "Standby" with a power button that turns the projector on. |
| `power_hold_on` | `false` | Require a press-and-hold to turn **on** too (standby always needs a hold). |
| `show_dot` | `true` | Show the link dot. |
| `dot_position` | `title` | `title` (right of the title), `right` (far right), or `icon` (replaces the header icon; it is then the power button). |
| `collapsible` | `false` | Tap the header to collapse the card to just the header while the projector is on. |
| `start_collapsed` | `false` | With `collapsible`, start collapsed. |
| `open_sections` | | Sections already open when the Dashboard loads: `remote`, `picture`, `laser`, `source`, `info`. |
| `menu_keys` | `[mpc, gamma, color_temp, lens_control, advanced_menu]` | Menu shortcuts under the remote. Any of `mpc` `gamma` `color_temp` `color_profile` `gamma_settings` `pic_adj` `picture_mode` `cmd` `lens_control` `lens_ap` `anamo` `setting_memory` `mode_1` `mode_2` `mode_3` `input` `3d_format` `advanced_menu`; `[]` = none. |
| `hide_modes` · `hide_dynamic` · `hide_inputs` · `hide_lens` | | Buttons to hide, by the integration's value (e.g. `[vivid, sdr2]`, `[off]`, `[hdmi2]`, `[memory_4, memory_5]`). The editor's **Buttons** panel lists them. |
| `laser_step` | `5` | How much − / + change the laser power (1–50). |
| `show_status` · `show_remote` · `show_menus` · `show_picture` · `show_laser` · `show_laser_presets` · `show_inputs` · `show_info` | `true` | Turn parts off. |
| `accent_color` · `hdr_color` · `warming_color` · `cooling_color` | theme primary · amber · orange · cyan | Context colors. |
| `icons:` | | `header`, `remote`, `picture`, `laser`, `source`, `info` — any MDI name; `mdi:` is optional. |
| `styles:` | | Sizes (px) and colors (any CSS color or theme variable) — see below. |

**`styles:` keys** — sizes: `card_radius` `card_padding` `standby_indent` `header_icon_size` `title_size` `summary_size` `section_icon_size` `section_title_size` `subtitle_size` `text_size` `secondary_size` `chip_size` `icon_size`; colors: `card_background` `card_border_color` `box_background` `divider_color` `header_icon_color` `title_color` `summary_color` `section_icon_color` `section_title_color` `subtitle_color` `text_color` `secondary_color` `chip_color` `chip_background` `chip_border_color` `icon_color`.

Backgrounds and borders (`card_background`, `card_border_color`, `box_background`, `divider_color`, `chip_background`, `chip_border_color`) also accept `transparent` — the editor offers it as a choice.

Example — remote open on load, extra lens shortcuts, no Dynamic "Off":

```yaml
type: custom:jvc-projector-card
title: JVC NZ8
open_sections: [remote]
menu_keys: [mpc, gamma, color_temp, lens_control, anamo, setting_memory, advanced_menu]
hide_dynamic: [off]
styles:
  card_background: transparent
```

## Credits

- **[mjmcg](https://github.com/mjmcg)** — the [jvc_projector_ha](https://github.com/mjmcg/jvc_projector_ha) integration this card is designed around, built on [Steve Easley](https://github.com/SteveEasley)'s pyjvcprojector.
- [JVC](https://www.jvc.com) for the published external command communication specification.

MIT licensed — see [LICENSE](LICENSE).
