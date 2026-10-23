# JVC Projector Card — options

Every option is in the visual editor; this page is for YAML users and for looking up what a setting
does. Only settings that differ from the default are saved, so a new card is just:

```yaml
type: custom:jvc-projector-card
```

Editor panels: **Card** (device, title, power & standby) · **Sections** (order, show / hide, and the
pencil on each row for its name, settings, merge and options) · **Buttons** · **Icons** · **Appearance**.

---

## Card

| Key | Default | Description |
|---|---|---|
| `device` | first projector | Device ID, if you have more than one JVC projector. |
| `title` | `Projector` | Header title. |
| `collapsible` | `false` | Tap the header to collapse the card to just the header while the projector is on. |
| `start_collapsed` | `false` | With `collapsible`, start collapsed. |
| `show_dot` | `true` | Show the link dot (green: reachable, red: not). |
| `dot_position` | `title` | `title` (right of the title), `right` (far right) or `icon` (replaces the header icon; it is then the power button). |

## Power & standby

| Key | Default | Description |
|---|---|---|
| `power_hold_on` | `false` | Require a press-and-hold to turn **on** too. Standby always needs a hold (or a double tap). |
| `when_off` | `collapse` | In standby / off: `hide` (hide the whole card), `collapse` (header only, so you can still power on) or `expanded` (keep every section). The editor always shows the card expanded. The old `show_when_off: false` still works and means `hide`. |
| `standby_text` | `below` | The standby message: `below` the title, `inline` with it, or `hidden`. |
| `standby_message` | stock text | Your own standby message. Empty = "Standby · tap the icon to power on". |
| `standby_button` | `false` | In standby, show a power button on the right instead of the "Standby" text. |

## Sections

| Key | Default | Description |
|---|---|---|
| `show_status` · `show_remote` · `show_picture` · `show_laser` · `show_inputs` · `show_info` | `true` | Turn a part off (`show_inputs` is the Source section). |
| `show_menus` | `true` | The menu shortcuts under the remote. |
| `show_laser_presets` | `true` | The Low / Mid / High laser buttons. |
| `section_order` | `[status, remote, picture, laser, source, info]` | Order of the sections. List only the ones you want to move; the rest follow in the default order. Editor: Sections → ↑ / ↓. |
| `open_sections` | | Sections already open when the dashboard loads: `remote`, `picture`, `laser`, `source`, `info`. Editor: Sections → **Open**. |
| `section_names` | | Your own name per section, e.g. `{ remote: Menu keys }`. Editor: pencil → Name. |
| `section_merge` | | Show a section's settings inside another one, e.g. `{ laser: picture }`. The section disappears and its visible settings appear at the end of the target, under its name. Not into a hidden section, and no chains. Editor: pencil → Merge. |
| `hidden_items` | | Single settings to hide, as `section.setting` (list below). Editor: pencil → Settings, one eye per setting. |

### `hidden_items` ids

| Section | Ids |
|---|---|
| `status` | `signal` (Signal box), `picture` (Picture box), `laser` (laser bar in the Picture box), `tags` |
| `remote` | `pad` (arrows and OK), `hint` ("hold an arrow" hint) |
| `picture` | `mode`, `dynamic`, `lens`, `anamorphic`, `hdr_proc`, `hdr_level`, `theater_opt`, `cmd`, `motion`, `eshift`, `low_latency` |
| `laser` | `slider` |
| `source` | `input` |
| `info` | `details`, `eco`, `link`, `missing` |

The menu shortcuts and the laser presets have their own keys (`show_menus`, `show_laser_presets`).

## Remote & laser

| Key | Default | Description |
|---|---|---|
| `menu_keys` | `[mpc, gamma, color_temp, lens_control, advanced_menu]` | Menu shortcuts under the remote, in order. Any of `mpc` `gamma` `color_temp` `color_profile` `gamma_settings` `pic_adj` `picture_mode` `cmd` `lens_control` `lens_ap` `anamo` `setting_memory` `mode_1` `mode_2` `mode_3` `input` `3d_format` `advanced_menu`; `[]` = none. |
| `laser_step` | `5` | How much − / + change the laser power (1–50). Editor: Sections → pencil on **Laser** → Options. |

## Buttons

| Key | Description |
|---|---|
| `hide_modes` · `hide_dynamic` · `hide_inputs` · `hide_lens` | Buttons to hide, by the integration's value, e.g. `[vivid, sdr2]`, `[off]`, `[hdmi2]`, `[memory_4, memory_5]`. The editor's **Buttons** panel lists them with an eye on each. |

## Icons & colors

| Key | Default | Description |
|---|---|---|
| `icons:` | | Per part: `header`, `remote`, `picture`, `laser`, `source`, `info`. Any MDI name; `mdi:` is optional. |
| `accent_color` | theme primary | The card's context color. |
| `hdr_color` | amber | Tint while HDR plays. |
| `warming_color` | orange | Power icon while warming up. |
| `cooling_color` | cyan | Power icon while cooling down. |

## Appearance (`styles:`)

Sizes are in px; colors take any CSS color or theme variable (e.g. `var(--accent-color)`).

- **Sizes:** `card_radius` `card_padding` `standby_indent` `header_icon_size` `title_size` `summary_size` `section_icon_size` `section_title_size` `subtitle_size` `text_size` `secondary_size` `chip_size` `icon_size`
- **Colors:** `card_background` `card_border_color` `box_background` `divider_color` `header_icon_color` `title_color` `summary_color` `section_icon_color` `section_title_color` `subtitle_color` `text_color` `secondary_color` `chip_color` `chip_background` `chip_border_color` `icon_color`
- `card_background`, `card_border_color`, `box_background`, `divider_color`, `chip_background` and `chip_border_color` also accept `transparent`.

---

## Entities

The card finds the integration's entities by their **translation keys**, so renamed entity IDs keep
working. The **Model** sensor is disabled by default; enable it in **Settings → Devices & services →
JVC Projector → device → Entities** to show the model in Info. Picture mode, input, dynamic control
and laser power are only available while the projector is on, so those sections are dimmed in standby.

## Example

Remote first and open on load, extra lens shortcuts, no Dynamic "Off", a transparent background:

```yaml
type: custom:jvc-projector-card
title: JVC NZ8
open_sections: [remote]
section_order: [remote, status, picture]
menu_keys: [mpc, gamma, color_temp, lens_control, anamo, setting_memory, advanced_menu]
hide_dynamic: ['off']
styles:
  card_background: transparent
```
