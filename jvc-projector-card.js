// JVC Projector Card — Home Assistant Dashboard card for JVC D-ILA projectors
// Version: v2026.10.14.3
//
// Read-only status on top (signal → picture → laser, status tags); every control
// lives in a collapsed section (Remote, Picture, Laser, Source, Info) so nothing
// changes by accident. For the `jvc_projector_ha` integration — the Ltek version
// (github.com/Ltek/jvc-projector) adds lens memory, anamorphic, HDR, motion and ECO
// settings, firmware and a connection sensor; mjmcg's original works without them. Same design as the Lumagen Card.
//
// Vanilla JS, single file, light DOM. The card stylesheet is a constant (no config
// values interpolated); per-card values are custom properties set inline on the
// card root. Entities are found by the integration's translation keys, so renamed
// entity IDs keep working; disabled entities simply don't appear.

const BUILD_NUMBER = 'v2026.10.14.3';
const CARD_TAG = 'jvc-projector-card';
const EDITOR_TAG = 'jvc-projector-card-editor';
const PLATFORM = 'jvc_projector_ha';

// ---------------------------------------------------------------------------
// Entity map: key → [domain, translation_key, entity_id suffix fallback]
// ---------------------------------------------------------------------------
const ENTITY_KEYS = {
  remote: ['remote', null, ''],
  power_state: ['sensor', 'jvc_power_state', 'power_state'],
  hours: ['sensor', 'jvc_light_source_time', 'light_source_time'],
  source: ['sensor', 'jvc_source_display', 'source_display'],
  input_disp: ['sensor', 'jvc_input_display', 'input_display'],
  content: ['sensor', 'jvc_auto_content_type', 'content_type'],
  colorimetry: ['sensor', 'jvc_colorimetry', 'colorimetry'],
  model: ['sensor', 'jvc_model', 'model'],
  mode: ['select', 'jvc_picture_mode', 'picture_mode'],
  input: ['select', 'jvc_input_select', 'input'],
  dynamic: ['select', 'jvc_dynamic_ctrl', 'dynamic_control'],
  laser: ['number', 'jvc_ld_power', 'ld_power'],
  signal: ['binary_sensor', 'jvc_signal_present', 'signal_present'],
  // Ltek integration only (absent with mjmcg's): the rows just don't appear.
  lens: ['select', 'jvc_installation_mode', 'installation_mode'],
  anamorphic: ['select', 'jvc_anamorphic', 'anamorphic'],
  hdr_proc: ['select', 'jvc_hdr_processing', 'hdr_processing'],
  hdr_level: ['select', 'jvc_hdr_level', 'hdr_level'],
  low_latency: ['switch', 'jvc_low_latency', 'low_latency'],
  // Ltek integration Phase 3 (Oct 14 2026): present only on models that support them.
  theater_opt: ['switch', 'jvc_theater_optimizer', 'theater_optimizer'],
  cmd: ['select', 'jvc_clear_motion_drive', 'clear_motion_drive'],
  motion: ['select', 'jvc_motion_enhance', 'motion_enhance'],
  eshift: ['switch', 'jvc_eshift', '8k_e_shift'],
  eco: ['switch', 'jvc_eco_mode', 'eco_mode'],
  connection: ['binary_sensor', 'jvc_connection', 'connection'],
  version: ['sensor', 'jvc_software_version', 'software_version'],
  color_depth: ['sensor', 'jvc_color_depth', 'color_depth'],
  color_space: ['sensor', 'jvc_color_space', 'color_space'],
  hdr_signal: ['sensor', 'jvc_hdr_signal', 'hdr_signal'],
};

// Optional entities (disabled by default in the integration) the card makes use of → friendly name
const OPTIONAL_ENTITIES = { model: 'Model' };

/** JVC projectors known to HA: [{id, name}] (from the entity registry). */
function listDevices(hass) {
  const seen = new Map();
  Object.values((hass && hass.entities) || {}).forEach((e) => {
    if (e.platform !== PLATFORM || !e.device_id || seen.has(e.device_id)) return;
    const d = (hass.devices || {})[e.device_id] || {};
    seen.set(e.device_id, d.name_by_user || d.name || e.device_id);
  });
  return [...seen].map(([id, name]) => ({ id, name }));
}

/** Map ENTITY_KEYS → entity_id for one device. Missing (or disabled) keys are absent. */
function resolveEntities(hass, deviceId) {
  const out = {};
  if (!hass) return out;
  const all = Object.values(hass.entities || {}).filter((e) => e.platform === PLATFORM);
  const dev = deviceId || (all.find((e) => e.device_id) || {}).device_id;
  const mine = all.filter((e) => !dev || e.device_id === dev);
  const remote = mine.find((e) => e.entity_id.startsWith('remote.'));
  const prefix = remote ? remote.entity_id.slice('remote.'.length) : null;
  Object.entries(ENTITY_KEYS).forEach(([key, [domain, tkey, suffix]]) => {
    let hit = null;
    if (domain === 'remote') hit = remote && remote.entity_id;
    else hit = (mine.find((e) => e.translation_key === tkey && e.entity_id.startsWith(domain + '.')) || {}).entity_id;
    if (!hit && prefix && suffix) {
      // Fallback for HA versions without translation_key in the display registry.
      const guess = `${domain}.${prefix}_${suffix}`;
      if (mine.some((e) => e.entity_id === guess) || (hass.states && hass.states[guess])) hit = guess;
    }
    if (hit) out[key] = hit;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Display names for the integration's raw states
// ---------------------------------------------------------------------------
const PICTURE_MODES = {
  natural: 'Natural', cinema: 'Cinema', vivid: 'Vivid', filmmaker: 'Filmmaker', sdr1: 'SDR 1', sdr2: 'SDR 2',
  frame_adapt_hdr: 'Frame Adapt HDR', frame_adapt_hdr2: 'Frame Adapt HDR 2', hdr1: 'HDR 1', hdr2: 'HDR 2',
  'hdr10+': 'HDR10+', hdr10_plus: 'HDR10+', hlg: 'HLG',
};
const CONTENT_TYPES = { sdr: 'SDR', hdr10: 'HDR10', 'hdr10+': 'HDR10+', hdr10_plus: 'HDR10+', hlg: 'HLG', auto: 'Auto' };
const DYNAMIC = { off: 'Off', low: 'Low', high: 'High', balanced: 'Balanced' };
const INPUTS = { hdmi1: 'HDMI 1', hdmi2: 'HDMI 2' };
const POWER = { on: 'On', standby: 'Standby', warming: 'Warming up', cooling: 'Cooling down', error: 'Error' };
const COLORIMETRY = {
  no_data: 'No data', bt601: 'BT.601', bt709: 'BT.709', xvycc601: 'xvYCC 601', xvycc709: 'xvYCC 709', sycc601: 'sYCC 601',
  adobe_ycc601: 'Adobe YCC 601', adobe_rgb: 'Adobe RGB', srgb: 'sRGB', dci_p3_d65: 'DCI-P3 D65', dci_p3_theater: 'DCI-P3 Theater',
  'bt2020(constant_luminance)': 'BT.2020 CL', 'bt2020(non-constant_luminance)': 'BT.2020', bt2020_cl: 'BT.2020 CL', bt2020_ncl: 'BT.2020',
};
const HDR_TYPES = ['hdr10', 'hdr10+', 'hdr10_plus', 'hlg'];
// Ltek integration settings
const LENS_MEMORIES = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`memory_${i + 1}`, String(i + 1)]));
const ANAMORPHIC = { off: 'Off', a: 'A', b: 'B', c: 'C', d: 'D' };
const HDR_PROCESSING = { hdr10_plus: 'HDR10+', static: 'Static', frame_by_frame: 'Frame', scene_by_scene: 'Scene' };
const HDR_LEVEL = { auto: 'Auto', minus_2: '−2', minus_1: '−1', zero: '0', plus_1: '+1', plus_2: '+2', auto_wide: 'Auto wide' };
const ON_OFF = { off: 'Off', on: 'On' };
const CMD = { off: 'Off', low: 'Low', high: 'High', inverse_telecine: 'Inverse telecine' };
const MOTION = { off: 'Off', low: 'Low', high: 'High' };
const COLOR_DEPTH = { '8bit': '8-bit', '10bit': '10-bit', '12bit': '12-bit' };
const COLOR_SPACE = { rgb: 'RGB', ycbcr_444: 'YCbCr 4:4:4', ycbcr_422: 'YCbCr 4:2:2', ycbcr_420: 'YCbCr 4:2:0' };
const HDR_SIGNAL = { sdr: 'SDR', hdr: 'HDR', smpte_st_2084: 'HDR10 (PQ)', hybrid_log: 'HLG', hdr10_plus: 'HDR10+', none: 'None' };

/** Source Display state class: the Ltek integration reports keys (no_signal), mjmcg's raw text (No Signal). */
const isNoSignal = (v) => v === 'No Signal' || v === 'no_signal';
const isOutOfRange = (v) => v === 'Out of Range' || v === 'out_of_range';

// Remote keys offered as one-tap menu shortcuts: [command, label]
const MENU_KEYS = [
  ['mpc', 'MPC'], ['gamma', 'Gamma'], ['color_temp', 'Color temp'], ['color_profile', 'Color profile'],
  ['gamma_settings', 'Gamma settings'], ['pic_adj', 'Picture adjust'], ['picture_mode', 'Picture mode'], ['cmd', 'CMD'],
  ['lens_control', 'Lens'], ['lens_ap', 'Lens aperture'], ['anamo', 'Anamorphic'], ['setting_memory', 'Setting memory'],
  ['mode_1', 'Mode 1'], ['mode_2', 'Mode 2'], ['mode_3', 'Mode 3'], ['input', 'Input'], ['3d_format', '3D format'],
  ['advanced_menu', 'Advanced'],
];
const MENU_LABELS = Object.fromEntries(MENU_KEYS);
const DEFAULT_MENU_KEYS = ['mpc', 'gamma', 'color_temp', 'lens_control', 'advanced_menu'];
// JVC's own Low / Mid / High laser settings on the integration's 1–100 scale (LD current 109 / 160 / 219).
const LASER_PRESETS = [['Low', 1], ['Mid', 47], ['High', 100]];

/** Known label, else a tidy version of the raw value ('frame_adapt_x' → 'Frame adapt x'). */
function pretty(map, v) {
  if (!okState(v)) return '';
  if (map[v] !== undefined) return map[v];
  const s = String(v).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Source Display (IFIS) → compact label: '4k(3840)24' → '2160p24', '4k(4096)24' → '4K DCI 24'. */
function fmtSource(v) {
  if (!okState(v)) return '—';
  if (isNoSignal(v)) return 'No signal';
  if (isOutOfRange(v)) return 'Out of range';
  // '4k(3840)24' (mjmcg) or '4k_3840_24' (Ltek)
  let m = /^4k(?:\((\d+)\)|_(\d+)_)(\d+)$/i.exec(v);
  if (m) return (m[1] || m[2]) === '4096' ? `4K DCI ${m[3]}` : `2160p${m[3]}`;
  m = /^2048x1080[ _]p(\d+)$/i.exec(v);
  if (m) return `2K DCI ${m[1]}`;
  m = /^([A-Z]+)\(.*\)$/.exec(v);
  if (m) return m[1];
  m = /^([a-z]+)_\d+x\d+$/.exec(v); // 'wuxga_1920x1200'
  if (m) return m[1].toUpperCase();
  if (/^(qxga|wqhd\d+)$/.test(v)) return v.toUpperCase();
  return String(v);
}

/** 1234 → '1,234 h'. */
function fmtHours(v) {
  if (!okState(v) || !Number.isFinite(Number(v))) return '';
  return `${String(Math.round(Number(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} h`;
}

// ---------------------------------------------------------------------------
// Config — byte-stable: only non-default keys are emitted
// ---------------------------------------------------------------------------
const DEFAULTS = {
  device: '',
  title: 'Projector',
  show_when_off: true,
  power_hold_on: false,
  standby_text: 'below',
  standby_message: '',
  standby_button: false,
  show_dot: true,
  dot_position: 'title',
  collapsible: false,
  start_collapsed: false,
  show_status: true,
  show_remote: true,
  show_menus: true,
  show_picture: true,
  show_laser: true,
  show_laser_presets: true,
  show_inputs: true,
  show_info: true,
  laser_step: 5,
  accent_color: '',
  hdr_color: '',
  warming_color: '',
  cooling_color: '',
};
const SECTIONS = [
  ['show_status', 'Status (signal → picture → laser) and tags'],
  ['show_remote', 'Remote section'],
  ['show_menus', 'Remote section: menu shortcuts (MPC, Gamma…)'],
  ['show_picture', 'Picture section: picture mode, dynamic control, lens memory, anamorphic, HDR, Theater Optimizer, motion, e-shift, low latency'],
  ['show_laser', 'Laser section'],
  ['show_laser_presets', 'Laser section: Low / Mid / High buttons'],
  ['show_inputs', 'Source section: inputs'],
  ['show_info', 'Info section'],
];
// Collapsible sections, in card order: [id, label]
const FOLDS = [['remote', 'Remote'], ['picture', 'Picture'], ['laser', 'Laser'], ['source', 'Source'], ['info', 'Info']];

// Icons: header (also the power button) and each collapsible section.
const ICON_DEFAULTS = {
  header: 'mdi:projector',
  remote: 'mdi:remote',
  picture: 'mdi:palette',
  laser: 'mdi:brightness-6',
  source: 'mdi:video-input-hdmi',
  info: 'mdi:information-outline',
};
const ICON_LABELS = {
  header: 'Header (power button)', remote: 'Remote', picture: 'Picture', laser: 'Laser', source: 'Source', info: 'Info',
};

/** 'movie' → 'mdi:movie'; 'hass:x' / 'mdi:x' kept; '' → ''. */
function normalizeIcon(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  return s.includes(':') ? s : `mdi:${s}`;
}

// Appearance: [key, group, kind, label, default(px for sizes | label for colors), min, max]
const STYLE_DEFS = [
  ['card_background', 'card', 'color', 'Background', 'Theme card background'],
  ['card_border_color', 'card', 'color', 'Border color', 'Theme border'],
  ['card_radius', 'card', 'size', 'Corner radius', 12, 0, 32],
  ['card_padding', 'card', 'size', 'Padding', 12, 4, 28],
  ['box_background', 'card', 'color', 'Box & key background', 'Subtle grey'],
  ['divider_color', 'card', 'color', 'Section divider color', 'Subtle grey'],
  ['header_icon_size', 'header', 'size', 'Icon size', 22, 14, 44],
  ['header_icon_color', 'header', 'color', 'Icon color (when on)', 'Context color'],
  ['title_size', 'header', 'size', 'Title size', 16, 11, 30],
  ['title_color', 'header', 'color', 'Title color', 'Primary text'],
  ['summary_size', 'header', 'size', 'Summary size', 13, 9, 22],
  ['summary_color', 'header', 'color', 'Summary color', 'Secondary text'],
  ['section_icon_size', 'sections', 'size', 'Icon size', 18, 12, 34],
  ['section_icon_color', 'sections', 'color', 'Icon color', 'Context color'],
  ['section_title_size', 'sections', 'size', 'Title size', 14, 10, 24],
  ['section_title_color', 'sections', 'color', 'Title color', 'Primary text'],
  ['subtitle_size', 'subtitles', 'size', 'Size', 10, 8, 18],
  ['subtitle_color', 'subtitles', 'color', 'Color', 'Secondary text'],
  ['text_size', 'text', 'size', 'Size', 14, 10, 26],
  ['text_color', 'text', 'color', 'Color', 'Primary text'],
  ['secondary_size', 'secondary', 'size', 'Size', 12, 9, 20],
  ['secondary_color', 'secondary', 'color', 'Color', 'Secondary text'],
  ['chip_size', 'chips', 'size', 'Text size', 13, 10, 22],
  ['chip_color', 'chips', 'color', 'Text color', 'Primary text'],
  ['chip_background', 'chips', 'color', 'Background', 'Transparent'],
  ['chip_border_color', 'chips', 'color', 'Border color', 'Subtle grey'],
  ['icon_size', 'icons', 'size', 'Size', 22, 14, 40],
  ['icon_color', 'icons', 'color', 'Color', 'Primary text'],
  ['standby_indent', 'standby', 'size', 'Standby message indent', 46, 0, 160],
];
const STYLE_GROUPS = [
  ['card', 'Card', 'Background, border and the boxes / remote keys.'],
  ['header', 'Header', 'Icon, title and the live summary on the right.'],
  ['sections', 'Section headers', 'The collapsible Remote / Picture / Laser / Source / Info rows.'],
  ['subtitles', 'Subtitles', 'Box headings (SIGNAL / PICTURE / LASER) and row labels (Mode, Dynamic…).'],
  ['text', 'Values', 'Main values in the status boxes.'],
  ['secondary', 'Details text', 'Second lines, info rows and notes.'],
  ['chips', 'Chips & buttons', 'Picture mode / dynamic / input / menu buttons. Active chips use the context color.'],
  ['icons', 'Icons', 'Remote key icons and the status arrows.'],
];
const STYLE_INDEX = Object.fromEntries(STYLE_DEFS.map((d) => [d[0], d]));
// Backgrounds and borders also offer "Transparent".
const TRANSPARENT_KEYS = new Set(['card_background', 'card_border_color', 'box_background', 'divider_color', 'chip_background', 'chip_border_color']);
const DOT_POSITIONS = [['title', 'Right of the title'], ['right', 'Far right'], ['icon', 'Replace the header icon']];
// Per-row hidden buttons: config key → the select entity whose options it filters (ids are the raw options).
const HIDE_LISTS = {
  hide_modes: { entity: 'mode', labels: PICTURE_MODES },
  hide_dynamic: { entity: 'dynamic', labels: DYNAMIC },
  hide_inputs: { entity: 'input', labels: INPUTS },
  hide_lens: { entity: 'lens', labels: LENS_MEMORIES },
};
const STANDBY_TEXT = [['below', 'Below the title'], ['inline', 'Inline with the title'], ['hidden', 'Hidden']];

/** String list: trimmed, de-duplicated, empties dropped. */
function strList(a) {
  const out = [];
  (Array.isArray(a) ? a : []).forEach((v) => {
    const s = String(v == null ? '' : v).trim();
    if (s && !out.includes(s)) out.push(s);
  });
  return out;
}

function normalizeConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  if (c.type !== undefined) out.type = c.type;
  Object.keys(DEFAULTS).forEach((k) => {
    if (c[k] === undefined || c[k] === null) return;
    let v = c[k];
    const d = DEFAULTS[k];
    if (typeof d === 'boolean') v = v === true || v === 'true';
    else if (typeof d === 'number') { v = Number(v); if (!Number.isFinite(v)) return; v = Math.min(50, Math.max(1, Math.round(v))); }
    else v = String(v).trim();
    if (v === d) return;
    out[k] = v;
  });
  if (c.icons && typeof c.icons === 'object') {
    const icons = {};
    Object.keys(c.icons).forEach((k) => {
      const v = normalizeIcon(c.icons[k]);
      if (v && v !== ICON_DEFAULTS[k]) icons[k] = v;
    });
    if (Object.keys(icons).length) out.icons = icons;
  }
  if (c.styles && typeof c.styles === 'object') {
    const styles = {};
    Object.keys(c.styles).forEach((k) => {
      const def = STYLE_INDEX[k];
      let v = c.styles[k];
      if (v === undefined || v === null || v === '') return;
      if (!def) { styles[k] = v; return; } // unknown (newer build): keep verbatim
      if (def[2] === 'size') {
        v = Number(v);
        if (!Number.isFinite(v) || v === def[4]) return;
        v = Math.round(Math.min(def[6], Math.max(def[5], v)));
        if (v === def[4]) return;
      } else v = String(v).trim();
      if (v !== '') styles[k] = v;
    });
    if (Object.keys(styles).length) out.styles = styles;
  }
  Object.keys(HIDE_LISTS).forEach((k) => {
    const list = strList(c[k]);
    if (list.length) out[k] = list;
  });
  // Menu shortcuts: an explicit list (possibly empty) only when it differs from the default.
  if (Array.isArray(c.menu_keys)) {
    const list = strList(c.menu_keys);
    if (JSON.stringify(list) !== JSON.stringify(DEFAULT_MENU_KEYS)) out.menu_keys = list;
  }
  // Sections that start open (card order).
  const open = strList(c.open_sections).filter((s) => FOLDS.some(([id]) => id === s));
  if (open.length) out.open_sections = FOLDS.map(([id]) => id).filter((id) => open.includes(id));
  const known = ['type', 'icons', 'styles', 'menu_keys', 'open_sections'];
  Object.keys(c).forEach((k) => {
    if (!(k in out) && !(k in DEFAULTS) && !(k in HIDE_LISTS) && !known.includes(k)) out[k] = c[k];
  });
  return out;
}

function cfg(config, key) {
  return config[key] !== undefined ? config[key] : DEFAULTS[key];
}

function menuKeys(config) {
  return Array.isArray(config.menu_keys) ? config.menu_keys : DEFAULT_MENU_KEYS;
}

function iconFor(config, key) {
  return (config.icons && config.icons[key]) || ICON_DEFAULTS[key];
}

/** Per-card custom properties (inline on the card root; never in the stylesheet). */
function rootStyleVars(config) {
  const vars = [];
  if (config.accent_color) vars.push(`--jvc-accent:${config.accent_color}`);
  if (config.hdr_color) vars.push(`--jvc-hdr:${config.hdr_color}`);
  if (config.warming_color) vars.push(`--jvc-warm:${config.warming_color}`);
  if (config.cooling_color) vars.push(`--jvc-cool:${config.cooling_color}`);
  const st = config.styles || {};
  STYLE_DEFS.forEach(([key, , kind]) => {
    if (st[key] === undefined) return;
    vars.push(`--jvc-${key.replace(/_/g, '-')}:${st[key]}${kind === 'size' ? 'px' : ''}`);
  });
  return vars.join(';');
}

/** Classes on the card root that depend on config (constant stylesheet, no interpolation). */
function rootClasses(config) {
  const st = config.styles || {};
  const cls = ['jvc'];
  if (st.card_border_color) cls.push('has-border');
  if (st.card_background === 'transparent') cls.push('is-flat');
  return cls.join(' ');
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
function okState(v) { return v !== undefined && v !== null && v !== '' && v !== 'unknown' && v !== 'unavailable'; }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Projector power from the Power State sensor, else from the remote (on = on or warming). */
function powerOf(psState, remoteState) {
  if (psState !== undefined) return psState;
  if (remoteState === 'on') return 'on';
  if (remoteState === 'off') return 'standby';
  return remoteState;
}

const PENDING_MS = 15000; // how long a tapped option shows as "sending" before the poll catches up

// ---------------------------------------------------------------------------
// Card stylesheet — CONSTANT (identical for every instance; see design system §0.9)
// ---------------------------------------------------------------------------
const CARD_CSS = `
.jvc { --jvc-ctx: var(--jvc-accent, var(--primary-color, #2196F3));
  --jvc-box: var(--jvc-box-background, rgba(127,127,127,0.10));
  padding: var(--jvc-card-padding, 12px) calc(var(--jvc-card-padding, 12px) + 2px) calc(var(--jvc-card-padding, 12px) - 2px);
  overflow: hidden; background: var(--jvc-card-background, var(--ha-card-background, var(--card-background-color)));
  border-radius: var(--jvc-card-radius, var(--ha-card-border-radius, 12px)); }
.jvc.has-border { border: var(--ha-card-border-width, 1px) solid var(--jvc-card-border-color); }
.jvc.is-flat { box-shadow: none; }
.jvc.is-hdr { --jvc-ctx: var(--jvc-hdr, #ffb300); }
.jvc [hidden] { display: none !important; }
.jvc button { font: inherit; }
.jvc-head { display: flex; align-items: center; gap: 10px; min-height: 36px; }
.jvc-power { flex: 0 0 auto; width: calc(var(--jvc-header-icon-size, 22px) + 14px); height: calc(var(--jvc-header-icon-size, 22px) + 14px);
  border-radius: 50%; border: none; cursor: pointer; background: transparent; color: var(--disabled-text-color, #777);
  display: flex; align-items: center; justify-content: center; transition: background .2s, color .2s;
  --mdc-icon-size: var(--jvc-header-icon-size, 22px); --jvc-pwr: var(--jvc-header-icon-color, var(--jvc-ctx)); }
.jvc.is-warming .jvc-power { --jvc-pwr: var(--jvc-warm, #ff9800); }
.jvc.is-cooling .jvc-power { --jvc-pwr: var(--jvc-cool, #00bcd4); }
.jvc.is-error .jvc-power { --jvc-pwr: var(--error-color, #f44336); }
.jvc.is-on .jvc-power, .jvc.is-warming .jvc-power, .jvc.is-cooling .jvc-power, .jvc.is-error .jvc-power {
  color: var(--jvc-pwr); background: color-mix(in srgb, var(--jvc-pwr) 16%, transparent); }
.jvc.is-warming .jvc-power ha-icon, .jvc.is-cooling .jvc-power ha-icon { animation: jvc-pulse 1.6s ease-in-out infinite; }
@keyframes jvc-pulse { 50% { opacity: .4; } }
.jvc-title { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: var(--jvc-title-size, 16px); font-weight: 500; white-space: nowrap;
  color: var(--jvc-title-color, var(--primary-text-color)); }
.jvc-dot { flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; background: var(--disabled-text-color, #777); }
.jvc-dot.at-right { margin-left: 2px; }
.jvc-dot.at-icon { width: calc(var(--jvc-header-icon-size, 22px) * .6); height: calc(var(--jvc-header-icon-size, 22px) * .6); }
.jvc-dot.ok { background: var(--success-color, #4caf50); }
.jvc-dot.bad { background: var(--error-color, #f44336); }
.jvc-summary { margin-left: auto; min-width: 0; font-size: var(--jvc-summary-size, 13px); color: var(--jvc-summary-color, var(--secondary-text-color));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jvc.is-down .jvc-summary, .jvc.is-error .jvc-summary { color: var(--error-color, #f44336); }
.jvc.is-warming .jvc-summary { color: var(--jvc-warm, #ff9800); }
.jvc.is-cooling .jvc-summary { color: var(--jvc-cool, #00bcd4); }
.jvc-head.is-tap { cursor: pointer; }
.jvc-hchev { color: var(--secondary-text-color); --mdc-icon-size: 20px; transition: transform .2s; flex: 0 0 auto; }
.jvc.is-collapsed .jvc-hchev { transform: rotate(-90deg); }
.jvc.is-collapsed .jvc-body { display: none; }
.jvc-sb-inline { margin-left: max(0px, calc(var(--jvc-standby-indent, 46px) - 46px)); font-size: var(--jvc-secondary-size, 12px); font-weight: 400; color: var(--jvc-secondary-color, var(--secondary-text-color));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jvc-pwr2 { margin-left: auto; flex: 0 0 auto; width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--jvc-box); color: var(--jvc-header-icon-color, var(--jvc-ctx)); display: flex; align-items: center; justify-content: center;
  --mdc-icon-size: 20px; }
.jvc-pwr2:hover { background: color-mix(in srgb, var(--jvc-ctx) 20%, transparent); }
.jvc-standby { padding: 2px 0 2px var(--jvc-standby-indent, 46px); font-size: var(--jvc-secondary-size, 13px); color: var(--jvc-secondary-color, var(--secondary-text-color)); }
.jvc-chain { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr); gap: 6px; margin-top: 10px; }
.jvc-box { min-width: 0; padding: 8px 6px; border-radius: 10px; text-align: center; background: var(--jvc-box); }
.jvc-box-h { font-size: var(--jvc-subtitle-size, 10px); letter-spacing: .08em; text-transform: uppercase; color: var(--jvc-subtitle-color, var(--secondary-text-color)); }
.jvc-box-t { font-size: var(--jvc-text-size, 14px); font-weight: 600; color: var(--jvc-text-color, var(--primary-text-color));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jvc-box-s { font-size: var(--jvc-secondary-size, 12px); color: var(--jvc-secondary-color, var(--secondary-text-color));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jvc-mini { height: 4px; margin: 5px 10% 4px; border-radius: 2px; background: rgba(127,127,127,0.2); overflow: hidden; }
.jvc-mini > span { display: block; height: 100%; border-radius: 2px; background: var(--jvc-ctx); transition: width .4s ease; }
.jvc-arrow { align-self: center; color: var(--jvc-icon-color, var(--jvc-ctx)); --mdc-icon-size: 18px; }
.jvc-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.jvc-tags:empty { display: none; }
.jvc-tag { padding: 1px 8px; border: 1px solid currentColor; border-radius: 999px; font-size: 11px; font-weight: 600;
  letter-spacing: .04em; color: var(--secondary-text-color); }
.jvc-tag.hdr { color: var(--jvc-hdr, #ffb300); }
.jvc-tag.ctx { color: var(--jvc-ctx); }
.jvc-tag.bad { color: var(--error-color, #f44336); }
.jvc-fold { margin-top: 10px; border-top: 1px solid var(--jvc-divider-color, rgba(127,127,127,0.2)); }
.jvc-fold > summary { display: flex; align-items: center; gap: 8px; padding: 8px 0 2px; cursor: pointer; list-style: none;
  font-size: var(--jvc-section-title-size, 14px); color: var(--jvc-section-title-color, var(--primary-text-color)); user-select: none; }
.jvc-fold > summary::-webkit-details-marker { display: none; }
.jvc-fold > summary .jvc-sec-i { color: var(--jvc-section-icon-color, var(--jvc-ctx)); --mdc-icon-size: var(--jvc-section-icon-size, 18px); }
.jvc-fold > summary .jvc-chev { margin-left: auto; color: var(--secondary-text-color); --mdc-icon-size: 18px; transition: transform .2s; }
.jvc-fold[open] > summary .jvc-chev { transform: rotate(90deg); }
.jvc-fold > summary .jvc-peek { font-size: var(--jvc-secondary-size, 12px); color: var(--jvc-secondary-color, var(--secondary-text-color));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.jvc-row { display: flex; align-items: flex-start; gap: 8px; margin-top: 8px; }
.jvc-row-l { flex: 0 0 88px; padding-top: 6px; font-size: var(--jvc-subtitle-size, 12px); color: var(--jvc-subtitle-color, var(--secondary-text-color)); }
.jvc-opts { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.jvc-chip { padding: 5px 10px; border: 1px solid var(--jvc-chip-border-color, rgba(127,127,127,0.35)); border-radius: 8px; cursor: pointer;
  background: var(--jvc-chip-background, transparent); color: var(--jvc-chip-color, var(--primary-text-color));
  font-size: var(--jvc-chip-size, 13px); white-space: nowrap; transition: background .2s, border-color .2s; }
.jvc-chip:hover { border-color: var(--jvc-ctx); }
.jvc-chip.on { background: var(--jvc-ctx); border-color: var(--jvc-ctx); color: #fff; }
.jvc-chip.ro { cursor: default; }
.jvc-chip.pend { border-style: dashed; border-color: var(--jvc-ctx); color: var(--jvc-ctx); animation: jvc-pulse 1.2s ease-in-out infinite; }
.jvc-held { outline: 2px solid var(--jvc-ctx); outline-offset: 1px; }
.jvc.is-off .jvc-ctl, .jvc.is-down .jvc-ctl { opacity: .45; pointer-events: none; }
.jvc.is-down [data-sec="status"] .jvc-chain { opacity: .45; }
.jvc-pad { display: grid; grid-template-columns: repeat(3, 64px); grid-auto-rows: 44px; gap: 6px; justify-content: center; margin-top: 6px; }
.jvc-key { display: flex; align-items: center; justify-content: center; border: none; border-radius: 10px; cursor: pointer;
  background: var(--jvc-box); color: var(--jvc-icon-color, var(--primary-text-color)); font-size: var(--jvc-chip-size, 12px);
  --mdc-icon-size: var(--jvc-icon-size, 22px); }
.jvc-key:hover { background: color-mix(in srgb, var(--jvc-ctx) 20%, transparent); }
.jvc-key.ok { background: color-mix(in srgb, var(--jvc-ctx) 30%, transparent); color: var(--jvc-ctx); }
.jvc-key.sm { color: var(--jvc-chip-color, var(--secondary-text-color)); }
.jvc-menus { justify-content: center; margin-top: 10px; }
.jvc-laser { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.jvc-laser .jvc-key { flex: 0 0 40px; height: 36px; }
.jvc-range { flex: 1 1 auto; min-width: 80px; accent-color: var(--jvc-ctx); cursor: pointer; }
.jvc-laser-v { flex: 0 0 44px; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums;
  font-size: var(--jvc-text-size, 14px); color: var(--jvc-text-color, var(--primary-text-color)); }
.jvc-info { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 4px 12px; margin-top: 8px;
  font-size: var(--jvc-secondary-size, 12px); color: var(--jvc-secondary-color, var(--secondary-text-color)); }
.jvc-info > b { font-weight: 500; color: var(--jvc-text-color, var(--primary-text-color)); text-align: right;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jvc-note { margin-top: 8px; font-size: var(--jvc-secondary-size, 12px); line-height: 1.5; color: var(--jvc-secondary-color, var(--secondary-text-color)); }
.jvc-note.bad { color: var(--error-color, #f44336); }
.jvc-hint { margin-top: 4px; font-size: 11px; color: var(--secondary-text-color); text-align: center; }
`;

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
class JvcProjectorCard extends HTMLElement {
  static getConfigElement() { return document.createElement(EDITOR_TAG); }
  static getStubConfig() { return {}; }

  constructor() {
    super();
    this._config = {};
    this._built = false;
    this._sig = '';
    this._optSig = {};
    this._timer = null;
    this._press = null;
    this._editMode = false;
    this._preview = false;
    this._open = null; // sections open right now (survives config changes); seeded from open_sections
    this._pending = {}; // entity_id → { value, until }: a tap the next poll hasn't confirmed yet
    this._dragging = false;
  }

  setConfig(config) {
    if (!config || typeof config !== 'object') throw new Error('Invalid configuration');
    const next = normalizeConfig(config);
    if (cfg(next, 'start_collapsed') !== cfg(this._config, 'start_collapsed') || cfg(next, 'collapsible') !== cfg(this._config, 'collapsible')) {
      this._collapsed = undefined; // re-apply the configured starting state
    }
    if (!this._open || JSON.stringify(next.open_sections || []) !== JSON.stringify(this._config.open_sections || [])) {
      this._open = new Set(next.open_sections || []);
    }
    this._config = next;
    this._built = false;
    if (this._hass) this._build();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    else this._schedule();
  }

  set editMode(v) { this._editMode = !!v; this._applyVisibility(); }
  set preview(v) { this._preview = !!v; this._applyVisibility(); }

  getCardSize() { return 5; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: 'auto' }; }

  _schedule() {
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = null; this._update(false); }, 250);
  }

  // -- build once -----------------------------------------------------------
  _build() {
    const c = this._config;
    if (!this._open) this._open = new Set(c.open_sections || []);
    const fold = (sec, label, body) => `
      <details class="jvc-fold" data-sec="${sec}"${this._open.has(sec) ? ' open' : ''}>
        <summary><ha-icon class="jvc-sec-i" icon="${esc(iconFor(c, sec))}"></ha-icon><span>${label}</span>
          <span class="jvc-peek" data-peek="${sec}"></span><ha-icon class="jvc-chev" icon="mdi:chevron-right"></ha-icon></summary>
        ${body}
      </details>`;
    const key = (cmd, inner, cls = '', hold = '') =>
      `<button class="jvc-key ${cls}" data-tap="remote" data-cmd="${cmd}"${hold ? ' data-hold="remote-repeat"' : ''} aria-label="${cmd}">${inner}</button>`;
    const icon = (i) => `<ha-icon icon="mdi:${i}"></ha-icon>`;
    const standbyText = esc(cfg(c, 'standby_message') || `Standby · ${cfg(c, 'power_hold_on') ? 'hold' : 'tap'} the icon to power on`);
    const dotAt = cfg(c, 'show_dot') ? cfg(c, 'dot_position') : 'none';
    const dot = (where) => (dotAt === where ? `<span class="jvc-dot at-${where}" data-k="dot" data-pos="${where}"></span>` : '');
    const menus = menuKeys(c).map((k) => `<button class="jvc-chip" data-tap="remote" data-cmd="${esc(k)}">${esc(MENU_LABELS[k] || k)}</button>`).join('');
    if (this._collapsed === undefined) this._collapsed = cfg(c, 'collapsible') && cfg(c, 'start_collapsed');
    const box = (id, title) => `<div class="jvc-box"><div class="jvc-box-h">${title}</div><div class="jvc-box-t" data-k="${id}_t"></div>`
      + `${id === 'x' ? '<div class="jvc-mini"><span data-k="x_bar"></span></div>' : `<div class="jvc-box-s" data-k="${id}_1"></div>`}<div class="jvc-box-s" data-k="${id}_2"></div></div>`;
    const arrow = '<ha-icon class="jvc-arrow" icon="mdi:chevron-right"></ha-icon>';
    this.innerHTML = `
      <style>${CARD_CSS}</style>
      <ha-card class="${rootClasses(c)}" style="${esc(rootStyleVars(c))}">
        <div class="jvc-head${cfg(c, 'collapsible') ? ' is-tap' : ''}"${cfg(c, 'collapsible') ? ' data-tap="collapse"' : ''}>
          <button class="jvc-power" data-tap="power" data-hold="power-hold" aria-label="Power">${dotAt === 'icon' ? dot('icon') : `<ha-icon icon="${esc(iconFor(c, 'header'))}"></ha-icon>`}</button>
          <div class="jvc-title"><span>${esc(cfg(c, 'title'))}</span>${dot('title')}
            <span class="jvc-sb-inline" data-k="standby_inline" hidden>${standbyText}</span></div>
          <div class="jvc-summary" data-k="summary"></div>${dot('right')}
          <button class="jvc-pwr2" data-tap="power" data-hold="power-hold" data-k="pwr2" aria-label="Power on" hidden><ha-icon icon="mdi:power"></ha-icon></button>
          <ha-icon class="jvc-hchev" data-k="hchev" icon="mdi:chevron-down" hidden></ha-icon>
        </div>
        <div class="jvc-standby" data-k="standby" hidden>${standbyText}</div>
        <div class="jvc-body" data-k="body">
          <div data-sec="status">
            <div class="jvc-chain">${box('s', 'Signal')}${arrow}${box('p', 'Picture')}${arrow}${box('x', 'Laser')}</div>
            <div class="jvc-tags" data-k="tags"></div>
          </div>
          ${fold('remote', 'Remote', `
            <div class="jvc-ctl"><div class="jvc-pad">
              ${key('hide', 'Hide', 'sm')}${key('up', icon('chevron-up'), '', 1)}${key('info', 'Info', 'sm')}
              ${key('left', icon('chevron-left'), '', 1)}${key('ok', 'OK', 'ok')}${key('right', icon('chevron-right'), '', 1)}
              ${key('menu', 'Menu', 'sm')}${key('down', icon('chevron-down'), '', 1)}${key('back', 'Back', 'sm')}
            </div>
            <div class="jvc-hint">Hold an arrow to repeat it 5×</div>
            <div class="jvc-opts jvc-menus" data-k="menus"${cfg(c, 'show_menus') && menus ? '' : ' hidden'}>${menus}</div></div>`)}
          ${fold('picture', 'Picture', `
            <div class="jvc-ctl">
              <div class="jvc-row" data-row="mode"><div class="jvc-row-l">Mode</div><div class="jvc-opts" data-opts="mode"></div></div>
              <div class="jvc-row" data-row="dynamic"><div class="jvc-row-l">Dynamic</div><div class="jvc-opts" data-opts="dynamic"></div></div>
              <div class="jvc-row" data-row="lens"><div class="jvc-row-l">Lens memory</div><div class="jvc-opts" data-opts="lens"></div></div>
              <div class="jvc-row" data-row="anamorphic"><div class="jvc-row-l">Anamorphic</div><div class="jvc-opts" data-opts="anamorphic"></div></div>
              <div class="jvc-row" data-row="hdr_proc"><div class="jvc-row-l">HDR processing</div><div class="jvc-opts" data-opts="hdr_proc"></div></div>
              <div class="jvc-row" data-row="hdr_level"><div class="jvc-row-l">HDR level</div><div class="jvc-opts" data-opts="hdr_level"></div></div>
              <div class="jvc-row" data-row="theater_opt"><div class="jvc-row-l">Theater optimizer</div><div class="jvc-opts" data-opts="theater_opt"></div></div>
              <div class="jvc-row" data-row="cmd"><div class="jvc-row-l">Motion (CMD)</div><div class="jvc-opts" data-opts="cmd"></div></div>
              <div class="jvc-row" data-row="motion"><div class="jvc-row-l">Motion enhance</div><div class="jvc-opts" data-opts="motion"></div></div>
              <div class="jvc-row" data-row="eshift"><div class="jvc-row-l">8K e-shift</div><div class="jvc-opts" data-opts="eshift"></div></div>
              <div class="jvc-row" data-row="low_latency"><div class="jvc-row-l">Low latency</div><div class="jvc-opts" data-opts="low_latency"></div></div>
            </div>`)}
          ${fold('laser', 'Laser', `
            <div class="jvc-ctl">
              <div class="jvc-laser">
                <button class="jvc-key sm" data-tap="laser-step" data-dir="-1" aria-label="Laser down">${icon('minus')}</button>
                <input type="range" class="jvc-range" data-k="laser_range" min="1" max="100" step="1" aria-label="Laser power">
                <button class="jvc-key sm" data-tap="laser-step" data-dir="1" aria-label="Laser up">${icon('plus')}</button>
                <span class="jvc-laser-v" data-k="laser_val"></span>
              </div>
              <div class="jvc-row" data-k="laser_presets_row"${cfg(c, 'show_laser_presets') ? '' : ' hidden'}><div class="jvc-row-l">Preset</div><div class="jvc-opts">
                ${LASER_PRESETS.map(([n, val]) => `<button class="jvc-chip" data-tap="laser-set" data-val="${val}">${n}</button>`).join('')}
              </div></div>
            </div>`)}
          ${fold('source', 'Source', `
            <div class="jvc-ctl">
              <div class="jvc-row" data-row="input"><div class="jvc-row-l">Input</div><div class="jvc-opts" data-opts="input"></div></div>
            </div>`)}
          ${fold('info', 'Info', `
            <div class="jvc-info" data-k="info"></div>
            <div class="jvc-row" data-row="eco"><div class="jvc-row-l">ECO mode</div><div class="jvc-opts" data-opts="eco"></div></div>
            <div class="jvc-note bad" data-k="eco_note" hidden>ECO mode is on: the projector switches its network off in standby, so Home Assistant can't reach it or turn it on until it is turned on with the remote.</div>
            <div class="jvc-note" data-k="link"></div>
            <div class="jvc-note" data-k="missing"></div>`)}
        </div>
      </ha-card>`;
    this._root = this.querySelector('.jvc');
    this._k = {};
    this.querySelectorAll('[data-k]').forEach((el) => { this._k[el.dataset.k] = el; });
    this.querySelectorAll('details.jvc-fold').forEach((d) => d.addEventListener('toggle', () => {
      if (d.open) this._open.add(d.dataset.sec); else this._open.delete(d.dataset.sec);
    }));
    const range = this._k.laser_range;
    range.addEventListener('input', () => { this._dragging = true; this._k.laser_val.textContent = `${range.value}%`; });
    range.addEventListener('change', () => { this._dragging = false; this._setLaser(Number(range.value)); });
    this._bind();
    this._built = true;
    this._sig = '';
    this._optSig = {};
    this._update(true);
  }

  // -- input handling ---------------------------------------------------------
  _bind() {
    const root = this._root;
    const target = (e) => e.target.closest && e.target.closest('[data-tap],[data-hold],[data-opt]');
    root.addEventListener('pointerdown', (e) => {
      const el = target(e);
      if (!el || el.dataset.opt !== undefined || !el.dataset.hold) return;
      const press = { el, held: false };
      press.timer = setTimeout(() => {
        press.held = true;
        el.classList.add('jvc-held');
        setTimeout(() => el.classList.remove('jvc-held'), 300);
        this._run(el.dataset.hold, el);
      }, 500);
      this._press = press;
    });
    const cancel = () => { if (this._press) { clearTimeout(this._press.timer); this._press = null; } };
    root.addEventListener('pointerleave', cancel);
    root.addEventListener('pointercancel', cancel);
    root.addEventListener('contextmenu', (e) => { if (target(e)) e.preventDefault(); });
    root.addEventListener('click', (e) => {
      const el = target(e);
      if (!el) return;
      const press = this._press;
      this._press = null;
      if (press) clearTimeout(press.timer);
      if (press && press.el === el && press.held) return; // hold already ran
      if (el.dataset.opt !== undefined) { this._select(el.dataset.ent, el.dataset.opt); return; }
      if (el.dataset.tap) this._run(el.dataset.tap, el);
      else if (el.dataset.hold) this._toast('Hold to run');
    });
  }

  _toast(message) {
    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
  }

  _call(domain, service, data) {
    if (!this._hass) return;
    Promise.resolve(this._hass.callService(domain, service, data)).catch((err) => this._toast(`JVC: ${err && err.message ? err.message : err}`));
  }

  /** Remember a value the projector hasn't reported yet (it is polled every 10 s), and refresh when that times out. */
  _markPending(entityId, value) {
    this._pending[entityId] = { value, until: Date.now() + PENDING_MS };
    setTimeout(() => { if (this._built) this._update(true); }, PENDING_MS + 50);
  }

  _pendingFor(entityId, current) {
    const p = this._pending[entityId];
    if (!p) return null;
    if (Date.now() > p.until || String(p.value) === String(current)) { delete this._pending[entityId]; return null; }
    return p.value;
  }

  _select(entityId, option) {
    if (!entityId) return;
    this._markPending(entityId, option);
    if (entityId.startsWith('switch.')) this._call('switch', option === 'on' ? 'turn_on' : 'turn_off', { entity_id: entityId });
    else this._call('select', 'select_option', { entity_id: entityId, option });
    this._update(true);
  }

  _laserState() {
    const E = this._ents || {};
    const s = E.laser && this._hass && this._hass.states[E.laser];
    const a = (s && s.attributes) || {};
    const n = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
    return { s, min: n(a.min, 1), max: n(a.max, 100), value: s && okState(s.state) ? Math.round(Number(s.state)) : null };
  }

  _setLaser(value) {
    const E = this._ents || {};
    if (!E.laser) return;
    const L = this._laserState();
    const v = Math.min(L.max, Math.max(L.min, Math.round(value)));
    this._markPending(E.laser, v);
    this._call('number', 'set_value', { entity_id: E.laser, value: v });
    this._update(true);
  }

  _run(action, el) {
    const E = this._ents || {};
    const remote = E.remote;
    const ps = this._powerState;
    switch (action) {
      case 'power': {
        // Standby always needs a hold; turning on needs one only when power_hold_on is set.
        if (ps === 'on' || ps === 'warming') this._toast('Hold to put the projector in standby');
        else if (ps === 'cooling') this._toast('Cooling down — the projector can be turned on once it reaches standby');
        else if (cfg(this._config, 'power_hold_on')) this._toast('Hold to turn the projector on');
        else if (remote) this._call('remote', 'turn_on', { entity_id: remote });
        break;
      }
      case 'power-hold':
        if (!remote) break;
        if (ps === 'cooling') this._toast('Cooling down — the projector can be turned on once it reaches standby');
        else this._call('remote', ps === 'on' || ps === 'warming' ? 'turn_off' : 'turn_on', { entity_id: remote });
        break;
      case 'collapse':
        if (ps !== 'on') break;
        this._collapsed = !this._collapsed;
        this._applyCollapse();
        break;
      case 'remote': if (remote) this._call('remote', 'send_command', { entity_id: remote, command: el.dataset.cmd }); break;
      case 'remote-repeat':
        // A list of five, sent one by one 0.15 s apart. (mjmcg's integration ignores num_repeats; a list works with both.)
        if (remote) this._call('remote', 'send_command', { entity_id: remote, command: Array(5).fill(el.dataset.cmd) });
        break;
      case 'laser-step': {
        const L = this._laserState();
        const cur = this._pendingFor(E.laser, L.value) ?? L.value;
        if (cur !== null) this._setLaser(Number(cur) + Number(el.dataset.dir) * cfg(this._config, 'laser_step'));
        break;
      }
      case 'laser-set': this._setLaser(Number(el.dataset.val)); break;
      default: break;
    }
  }

  _applyCollapse() {
    if (!this._built) return;
    const can = cfg(this._config, 'collapsible') && this._powerState === 'on';
    // Like HA's Conditional card: never hide content while the Dashboard is being edited.
    const collapsed = can && !!this._collapsed && !this._editMode && !this._preview;
    this._root.classList.toggle('is-collapsed', collapsed);
    this._k.hchev.hidden = !can;
  }

  // -- visibility -------------------------------------------------------------
  _applyVisibility() {
    if (!this._built) return;
    const hide = !cfg(this._config, 'show_when_off') && this._powerState === 'standby' && !this._editMode && !this._preview;
    this.style.display = hide ? 'none' : '';
    this._applyCollapse();
  }

  // -- live patching ----------------------------------------------------------
  _update(force) {
    const h = this._hass;
    if (!h || !this._built) return;
    const c = this._config;
    const E = (this._ents = resolveEntities(h, cfg(c, 'device')));
    const st = (k) => (E[k] ? h.states[E[k]] : undefined);
    const v = (k) => { const s = st(k); return s ? s.state : undefined; };
    const sig = JSON.stringify(Object.keys(ENTITY_KEYS).map((k) => {
      const s = st(k);
      return s ? [s.state, s.attributes.options, s.attributes.min, s.attributes.max] : null;
    })) + JSON.stringify(this._pending);
    if (!force && sig === this._sig) return;
    this._sig = sig;

    const K = this._k;
    const set = (k, text) => { if (K[k] && K[k].textContent !== text) K[k].textContent = text; };
    const html = (el, markup) => { if (el && el.innerHTML !== markup) el.innerHTML = markup; };
    const found = !!(E.power_state || E.remote);
    const ps = powerOf(v('power_state'), v('remote'));
    // Every entity goes unavailable when the integration can't poll the projector;
    // the Ltek integration also has a Connection sensor that stays available.
    const isDown = found && (v('connection') === 'off' || ps === 'unavailable' || v('remote') === 'unavailable');
    this._powerState = isDown ? 'unavailable' : ps;
    const isOn = !isDown && ps === 'on';
    const live = isOn;
    const content = v('content');
    const isHdr = live && HDR_TYPES.includes(content);
    const R = this._root.classList;
    R.toggle('is-on', isOn);
    R.toggle('is-off', !isOn);
    R.toggle('is-down', isDown);
    R.toggle('is-hdr', isHdr);
    R.toggle('is-warming', !isDown && ps === 'warming');
    R.toggle('is-cooling', !isDown && ps === 'cooling');
    R.toggle('is-error', !isDown && ps === 'error');

    // header
    if (K.dot) {
      const dotCls = `jvc-dot at-${K.dot.dataset.pos}` + (!found ? '' : isDown ? ' bad' : ' ok');
      if (K.dot.className !== dotCls) K.dot.className = dotCls;
      const tip = !found ? '' : isDown ? 'Projector not reachable' : 'Projector reachable';
      if (K.dot.title !== tip) K.dot.title = tip;
    }
    const src = v('source');
    const summary = !found ? 'No JVC projector found — pick a device in the card editor'
      : isDown ? 'Offline'
        : !isOn ? (POWER[ps] || pretty({}, ps) || 'Standby')
          : [src && !isNoSignal(src) ? fmtSource(src) : 'No signal', pretty(CONTENT_TYPES, content), pretty(PICTURE_MODES, v('mode'))].filter(Boolean).join(' · ');
    const standby = found && !isDown && (ps === 'standby' || ps === 'off');
    const sbMode = cfg(c, 'standby_text');
    const sbButton = standby && cfg(c, 'standby_button');
    set('summary', sbButton ? '' : summary);
    K.summary.hidden = sbButton;
    K.pwr2.hidden = !sbButton;
    K.standby_inline.hidden = !(standby && sbMode === 'inline');
    K.standby.hidden = !(standby && sbMode === 'below');
    K.body.hidden = !found || (!isOn && !isDown);

    // sections on/off (config) + entity availability
    this.querySelectorAll('[data-sec]').forEach((el) => {
      const sec = el.dataset.sec;
      let show = cfg(c, { status: 'show_status', source: 'show_inputs' }[sec] || `show_${sec}`);
      if (sec === 'remote') show = show && !!E.remote;
      if (sec === 'picture') show = show && !!(E.mode || E.dynamic || E.lens || E.anamorphic || E.low_latency || E.cmd || E.motion || E.eshift || E.theater_opt);
      if (sec === 'laser') show = show && !!E.laser;
      if (sec === 'source') show = show && !!E.input;
      el.hidden = !show;
    });

    // status boxes: signal › picture › laser
    const input = pretty(INPUTS, v('input')) || pretty(INPUTS, v('input_disp'));
    set('s_t', fmtSource(src));
    set('s_1', input || '—');
    set('s_2', [pretty(COLORIMETRY, v('colorimetry')), pretty(COLOR_DEPTH, v('color_depth'))].filter(Boolean).join(' · ') || '—');
    set('p_t', pretty(PICTURE_MODES, v('mode')) || '—');
    set('p_1', pretty(CONTENT_TYPES, content) || '—');
    set('p_2', okState(v('dynamic')) ? `Dynamic ${pretty(DYNAMIC, v('dynamic'))}` : '—');
    const L = this._laserState();
    const laserShown = this._pendingFor(E.laser, L.value) ?? L.value;
    const pct = laserShown === null ? 0 : ((Number(laserShown) - L.min) / Math.max(1, L.max - L.min)) * 100;
    set('x_t', laserShown === null ? '—' : `${laserShown}%`);
    const w = `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`;
    if (K.x_bar.style.width !== w) K.x_bar.style.width = w;
    set('x_2', fmtHours(v('hours')) || '—');

    // tags
    const tags = [];
    if (isDown) tags.push(['LINK DOWN', 'bad']);
    if (isHdr) tags.push([pretty(CONTENT_TYPES, content), 'hdr']);
    if (live && isNoSignal(src)) tags.push(['NO SIGNAL', 'bad']);
    if (live && isOutOfRange(src)) tags.push(['OUT OF RANGE', 'bad']);
    if (live && okState(src) && /4096|2048/.test(src)) tags.push(['DCI', '']);
    if (live && v('low_latency') === 'on') tags.push(['LOW LATENCY', '']);
    if (live && v('eco') === 'on') tags.push(['ECO', 'bad']);
    html(K.tags, tags.map(([t, cls]) => `<span class="jvc-tag ${cls}">${esc(t)}</span>`).join(''));

    // chip rows
    this._chips('mode', E.mode, st('mode'), PICTURE_MODES, 'hide_modes');
    this._chips('dynamic', E.dynamic, st('dynamic'), DYNAMIC, 'hide_dynamic');
    this._chips('input', E.input, st('input'), INPUTS, 'hide_inputs');
    this._chips('lens', E.lens, st('lens'), LENS_MEMORIES, 'hide_lens');
    this._chips('anamorphic', E.anamorphic, st('anamorphic'), ANAMORPHIC);
    // HDR10+ processing is chosen by the projector for HDR10+ content; it can't be tapped.
    this._chips('hdr_proc', E.hdr_proc, st('hdr_proc'), HDR_PROCESSING, null, ['hdr10_plus']);
    this._chips('hdr_level', E.hdr_level, st('hdr_level'), HDR_LEVEL);
    this._chips('low_latency', E.low_latency, st('low_latency'), ON_OFF, null, [], ['off', 'on']);
    this._chips('theater_opt', E.theater_opt, st('theater_opt'), ON_OFF, null, [], ['off', 'on']);
    this._chips('cmd', E.cmd, st('cmd'), CMD);
    this._chips('motion', E.motion, st('motion'), MOTION);
    this._chips('eshift', E.eshift, st('eshift'), ON_OFF, null, [], ['off', 'on']);
    this._chips('eco', E.eco, st('eco'), ON_OFF, null, [], ['off', 'on']);
    // Rows the integration makes unavailable at times are hidden then: HDR settings
    // and Theater Optimizer without an HDR source; CMD and Dynamic while Low Latency is on.
    const condRows = { hdr_proc: true, hdr_level: true, theater_opt: true, cmd: true, dynamic: true, eco: true };
    this.querySelectorAll('[data-row]').forEach((row) => {
      const key = row.dataset.row;
      row.hidden = !E[key] || (condRows[key] && !okState(v(key)));
    });

    // laser
    const range = K.laser_range;
    ['min', 'max'].forEach((a) => { if (range.getAttribute(a) !== String(L[a])) range.setAttribute(a, String(L[a])); });
    if (!this._dragging) {
      if (laserShown !== null && range.value !== String(laserShown)) range.value = String(laserShown);
      set('laser_val', laserShown === null ? '—' : `${laserShown}%`);
    }
    range.disabled = laserShown === null;
    this.querySelectorAll('[data-tap="laser-set"]').forEach((b) => b.classList.toggle('on', laserShown !== null && Number(b.dataset.val) === Number(laserShown)));

    // section peeks: current value shown on the collapsed header
    const peek = (sec, text) => {
      const el = this.querySelector(`[data-peek="${sec}"]`);
      if (el && el.textContent !== text) el.textContent = text;
    };
    peek('picture', [pretty(PICTURE_MODES, v('mode')), okState(v('dynamic')) ? `Dynamic ${pretty(DYNAMIC, v('dynamic'))}` : '',
      okState(v('lens')) ? `Lens ${pretty(LENS_MEMORIES, v('lens'))}` : ''].filter(Boolean).join(' · '));
    peek('laser', laserShown === null ? '' : `${laserShown}%`);
    peek('source', input);
    peek('info', isDown ? 'not reachable' : (okState(v('model')) ? v('model') : fmtHours(v('hours'))));

    // info
    const rows = [
      ['Model', okState(v('model')) ? v('model') : ''],
      ['Power', isDown ? 'Not reachable' : pretty(POWER, ps)],
      ['Signal', okState(src) ? fmtSource(src) : ''],
      ['Input', input],
      ['Colorimetry', pretty(COLORIMETRY, v('colorimetry'))],
      ['Content', pretty(CONTENT_TYPES, content)],
      ['Lens memory', okState(v('lens')) ? `Memory ${pretty(LENS_MEMORIES, v('lens'))}` : ''],
      ['Anamorphic', pretty(ANAMORPHIC, v('anamorphic'))],
      ['HDR processing', pretty(HDR_PROCESSING, v('hdr_proc'))],
      ['Low latency', pretty(ON_OFF, v('low_latency'))],
      ['Theater optimizer', pretty(ON_OFF, v('theater_opt'))],
      ['Motion (CMD)', pretty(CMD, v('cmd'))],
      ['8K e-shift', pretty(ON_OFF, v('eshift'))],
      ['Color depth', pretty(COLOR_DEPTH, v('color_depth'))],
      ['Color space', pretty(COLOR_SPACE, v('color_space'))],
      ['HDR signal', pretty(HDR_SIGNAL, v('hdr_signal'))],
      ['Light source', fmtHours(v('hours'))],
      ['Firmware', okState(v('version')) ? v('version') : ''],
    ].filter(([, val]) => val);
    if (K.eco_note) K.eco_note.hidden = !(okState(v('eco')) && v('eco') === 'on');
    html(K.info, rows.map(([l, val]) => `<span>${esc(l)}</span><b>${esc(val)}</b>`).join(''));
    set('link', !found ? '' : isDown
      ? 'The integration cannot reach the projector (it is polled every 10 s). Check its network connection and the network password.'
      : 'Connected · polled every 10 s, so a change can take a few seconds to show.');
    const lcls = 'jvc-note' + (isDown ? ' bad' : '');
    if (K.link.className !== lcls) K.link.className = lcls;
    const missing = Object.entries(OPTIONAL_ENTITIES).filter(([k]) => !E[k]).map(([, n]) => n);
    set('missing', found && missing.length ? `Disabled: ${missing.join(' · ')} — enable in Settings → Devices & services → JVC Projector → device → Entities.` : '');
    K.missing.hidden = !found || !missing.length;

    this._applyVisibility();
  }

  /** Option chips for a select (or a switch, with fixed ['off', 'on']). readOnly values show but can't be tapped. */
  _chips(name, entityId, state, labels, hideKey, readOnly = [], fixed = null) {
    const box = this.querySelector(`[data-opts="${name}"]`);
    if (!box) return;
    const hidden = new Set((hideKey && this._config[hideKey]) || []);
    const all = fixed || (state && state.attributes && state.attributes.options) || [];
    const current0 = state ? state.state : null;
    // a read-only value only appears while it is the current one
    const options = all.filter((o) => !hidden.has(String(o)) && (!readOnly.includes(o) || o === current0));
    const sig = JSON.stringify([entityId, options]);
    if (this._optSig[name] !== sig) {
      this._optSig[name] = sig;
      box.innerHTML = options.map((o) => (readOnly.includes(o)
        ? `<span class="jvc-chip ro" title="${esc(o)}">${esc(pretty(labels, o))}</span>`
        : `<button class="jvc-chip" data-opt="${esc(o)}" data-ent="${esc(entityId)}" title="${esc(o)}">${esc(pretty(labels, o))}</button>`)).join('');
    }
    const current = state ? state.state : null;
    const pend = this._pendingFor(entityId, current);
    box.querySelectorAll('.jvc-chip.ro').forEach((b) => b.classList.toggle('on', pend === null));
    box.querySelectorAll('[data-opt]').forEach((b) => {
      b.classList.toggle('on', b.dataset.opt === current && pend === null);
      b.classList.toggle('pend', pend !== null && b.dataset.opt === String(pend));
    });
  }
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
const THEME_COLORS = [
  ['var(--primary-color)', 'Primary'],
  ['var(--accent-color)', 'Accent'],
  ['var(--primary-text-color)', 'Primary text'],
  ['var(--secondary-text-color)', 'Secondary text'],
  ['var(--disabled-text-color)', 'Disabled text'],
  ['var(--state-active-color)', 'State active'],
  ['var(--error-color)', 'Error'],
  ['var(--warning-color)', 'Warning'],
  ['var(--success-color)', 'Success'],
  ['var(--info-color)', 'Info'],
];
const CONTEXT_COLORS = [
  ['accent_color', 'Accent', 'Theme primary', '#2196f3'],
  ['hdr_color', 'HDR', 'Amber', '#ffb300'],
  ['warming_color', 'Warming up', 'Orange', '#ff9800'],
  ['cooling_color', 'Cooling down', 'Cyan', '#00bcd4'],
];

function colorMode(cur, allowTransparent = false) {
  cur = cur == null ? '' : String(cur);
  if (cur === '') return 'default';
  if (allowTransparent && cur === 'transparent') return 'transparent';
  if (/^#[0-9a-fA-F]{3,8}$/.test(cur)) return 'custom';
  if (/^var\(/.test(cur) && THEME_COLORS.some(([v]) => v === cur)) return 'theme';
  return 'css';
}

const EDITOR_CSS = `
        .jvce {
          /* Font sizes (by role, not by pixel) */
          --ltek-fs-panel-title: 16px;  /* top-level panel / section title */
          --ltek-fs-header: 15px;       /* editor header, panel summary */
          --ltek-fs-group: 14px;        /* group heading inside a panel */
          --ltek-fs-label: 13px;        /* standard field label / row */
          --ltek-fs-body: 12px;         /* body text, most controls */
          --ltek-fs-small: 11px;        /* hints, secondary text */
          --ltek-fs-tiny: 10px;         /* badges, micro-labels */
          /* Font weights */
          --ltek-fw-normal: 400;        /* control labels (recede) */
          --ltek-fw-medium: 500;
          --ltek-fw-semibold: 600;
          --ltek-fw-bold: 700;          /* titles, values (lead) */
          /* Text colors */
          --ltek-c-text: var(--primary-text-color, #e1e1e1);  /* primary */
          --ltek-c-label: #ccc;         /* control labels */
          --ltek-c-muted: #888;         /* hints / disabled */
          --ltek-c-accent: var(--primary-color, #2196F3);
          /* Accent tints — hover / active fills (kept as rgba literals; one place
             to change). Default to the Material blue the cards shipped with. */
          --ltek-c-accent-fade: rgba(var(--rgb-primary-color,33,150,243),0.12);       /* active / pressed fill */
          --ltek-c-accent-fade-soft: rgba(var(--rgb-primary-color,33,150,243),0.08);  /* hover fill */
          --ltek-c-error-fade: rgba(244,67,54,0.15);         /* delete hover fill */
          /* Status colors — defer to the user's theme, fall back to Material. */
          --ltek-c-error: var(--error-color, #f44336);
          --ltek-c-success: var(--success-color, #4caf50);
          --ltek-c-warning: var(--warning-color, #ffb300);
          --ltek-c-info: var(--info-color, #2196F3);
          /* Second accent: the green "library / shared" grouping (distinct from
             the blue layout accent on purpose — NOT tied to --primary-color). */
          --ltek-c-accent-lib: #7fd18a;
          --ltek-c-on-accent: #fff;   /* text/icon on a solid accent fill */
          /* Action icons (edit/copy/hide/etc): neutral idle → brighten on hover.
             Delete stays a status color (error) on its own hover. */
          --ltek-c-icon: #aaa;        /* idle action icon */
          --ltek-c-icon-hover: #fff;  /* hovered action icon */
          /* Surfaces */
          --ltek-c-surface: rgba(255,255,255,0.015);        /* panels */
          --ltek-c-surface-raised: rgba(255,255,255,0.02);  /* cards / rows */
          /* Borders */
          --ltek-c-panel-border: #3a3a3a;   /* panels */
          --ltek-c-border: #444;            /* controls */
          --ltek-c-border-soft: #333;       /* subtle inner dividers */
          /* Radii */
          --ltek-r-panel: 12px;   /* panels */
          --ltek-r-card: 10px;    /* section cards */
          --ltek-r-md: 8px;       /* blocks */
          --ltek-r-ctrl: 6px;     /* inputs, selects, buttons */
          /* Spacing scale (4px base) */
          --ltek-sp-1: 4px;
          --ltek-sp-2: 6px;
          --ltek-sp-3: 8px;
          --ltek-sp-4: 10px;
          --ltek-sp-5: 12px;
          --ltek-sp-6: 16px;
          /* Control padding — uniform input/select/button height. */
          --ltek-ctrl-pad: 6px 10px;
          /* Icon sizes (two clear roles; one-off glyphs stay literal). */
          --ltek-icon-sm: 16px;   /* inline / action icons */
          --ltek-icon-lg: 20px;   /* panel-title icons */
          /* Slider row geometry (shared by every slider) */
          --ltek-slider-val-w: 44px;   /* value readout column width */
          display: flex; flex-direction: column; gap: 8px; font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }
        .jvce ha-icon { --mdc-icon-size: 18px; vertical-align: middle; }
        .jvce-sec { border: 1px solid var(--ltek-c-panel-border); border-radius: var(--ltek-r-panel); background: var(--ltek-c-surface); overflow: hidden; }
        .jvce-sec[open] { border-color: var(--ltek-c-accent); }
        .jvce-sec > summary { display: flex; align-items: center; gap: var(--ltek-sp-3); padding: 14px 16px; cursor: pointer; user-select: none;
          list-style: none; font-size: var(--ltek-fs-panel-title); font-weight: var(--ltek-fw-bold); color: var(--ltek-c-text); }
        .jvce-sec > summary::-webkit-details-marker, .jvce-sub > summary::-webkit-details-marker { display: none; }
        .jvce-sec > summary > ha-icon:not(.chev) { color: var(--ltek-c-accent); --mdc-icon-size: var(--ltek-icon-lg); }
        .jvce-sec > summary .chev, .jvce-sub > summary .chev { margin-left: auto; color: #999; --mdc-icon-size: 20px; transition: transform .2s ease; transform: rotate(-90deg); }
        .jvce-sec[open] > summary .chev, .jvce-sub[open] > summary .chev { transform: none; }
        .jvce-body { padding: 0 16px 16px; }
        .jvce-hint { color: var(--ltek-c-muted); font-size: var(--ltek-fs-small); margin: 0 0 var(--ltek-sp-3); }
        .jvce-group { color: var(--accent-color, var(--ltek-c-accent)); font-size: var(--ltek-fs-group); font-weight: var(--ltek-fw-semibold);
          margin-top: var(--ltek-sp-4); padding-top: var(--ltek-sp-3); border-top: 1px solid var(--ltek-c-border-soft); }
        .jvce-group.first { margin-top: 0; padding-top: 0; border-top: none; }
        .jvce-sub { border-top: 1px solid var(--ltek-c-border-soft); border-radius: var(--ltek-r-ctrl); }
        .jvce-sub + .jvce-sub { margin-top: 0; }
        .jvce-sub[open] { border: 1px solid var(--accent-color, var(--ltek-c-accent)); margin: var(--ltek-sp-1) 0; }
        .jvce-sub > summary { display: flex; align-items: center; gap: var(--ltek-sp-2); padding: var(--ltek-sp-3) var(--ltek-sp-2); cursor: pointer;
          list-style: none; color: var(--ltek-c-accent); font-size: var(--ltek-fs-label); font-weight: var(--ltek-fw-semibold);
          text-transform: uppercase; letter-spacing: 0.04em; }
        .jvce-sub-body { padding: 0 var(--ltek-sp-4) var(--ltek-sp-4); }
        .jvce-row { display: flex; align-items: center; gap: var(--ltek-sp-4); padding: var(--ltek-sp-1) 0; flex-wrap: wrap; justify-content: flex-start; }
        .jvce-row label.lbl { color: var(--ltek-c-label); font-size: var(--ltek-fs-body); font-weight: var(--ltek-fw-normal); flex: none; }
        .jvce-row input[type="text"], .jvce-row select { flex: 1 1 auto; min-width: 0; padding: var(--ltek-ctrl-pad);
          background: var(--secondary-background-color, #2a2a2a); border: 1px solid var(--ltek-c-border); border-radius: var(--ltek-r-ctrl);
          color: var(--ltek-c-text); font-size: var(--ltek-fs-body); }
        .jvce-row input[type="range"] { flex: 1 1 auto; min-width: 100px; accent-color: var(--ltek-c-accent); cursor: pointer; }
        .jvce-val { flex: 0 0 var(--ltek-slider-val-w); text-align: right; font-weight: var(--ltek-fw-bold); font-variant-numeric: tabular-nums;
          white-space: nowrap; color: var(--ltek-c-text); font-size: var(--ltek-fs-body); }
        .jvce-nowrap { flex-wrap: nowrap; }
        .jvce-check { display: flex; align-items: center; gap: var(--ltek-sp-2); padding: var(--ltek-sp-1) 0; color: var(--ltek-c-label);
          font-size: var(--ltek-fs-body); cursor: pointer; }
        .jvce-check input { accent-color: var(--ltek-c-accent); }
        .jvce-checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0 var(--ltek-sp-4); }
        .jvce-color { display: flex; flex: 1 1 auto; gap: var(--ltek-sp-2); flex-wrap: wrap; min-width: 0; }
        .jvce-color select.jvce-cmode { flex: 0 0 auto; min-width: 120px; }
        .jvce-color input[type="color"] { flex: 0 0 auto; width: 44px; height: 30px; padding: 0; border: none; background: none; cursor: pointer; }
        .jvce-reset { border: none; background: none; padding: 0; color: var(--ltek-c-icon); cursor: pointer; }
        .jvce-reset:hover { color: var(--ltek-c-icon-hover); }
        .jvce-reset ha-icon { --mdc-icon-size: var(--ltek-icon-sm); }
        .jvce-foot { color: var(--ltek-c-muted); font-size: var(--ltek-fs-tiny); text-align: right; }
`;

class JvcProjectorCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._open = new Set(['device']);
    this._rendered = false;
    this._cmode = {}; // color key -> mode picked in this session (so an empty Custom CSS field stays visible)
  }

  setConfig(config) {
    const next = normalizeConfig(config);
    const changed = JSON.stringify(next) !== JSON.stringify(this._config);
    this._config = next;
    if (this._hass && (!this._rendered || changed)) this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first || !this._rendered) this._render();
  }

  _emit() {
    this._config = normalizeConfig(this._config);
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  /** Write a config value. scope: '' (top level) | 'styles' | 'icons'. Defaults / empty remove the key. */
  _set(key, value, scope = '') {
    if (!scope) {
      if (value === '' || value === undefined || value === null || value === DEFAULTS[key]) delete this._config[key];
      else this._config[key] = value;
    } else {
      const obj = { ...(this._config[scope] || {}) };
      if (value === '' || value === undefined || value === null) delete obj[key];
      else obj[key] = value;
      if (Object.keys(obj).length) this._config[scope] = obj; else delete this._config[scope];
    }
    this._emit();
  }

  _get(key, scope = '') {
    return scope ? (this._config[scope] || {})[key] : this._config[key];
  }

  _panel(id, icon, title, body) {
    return `<details class="jvce-sec" data-panel="${id}"${this._open.has(id) ? ' open' : ''}>
      <summary><ha-icon icon="${icon}"></ha-icon>${title}<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon></summary>
      <div class="jvce-body">${body}</div></details>`;
  }

  _sub(id, title, body) {
    return `<details class="jvce-sub" data-panel="${id}"${this._open.has(id) ? ' open' : ''}>
      <summary>${title}<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon></summary>
      <div class="jvce-sub-body">${body}</div></details>`;
  }

  _colorControl(key, label, defaultLabel, seedHex, scope = '') {
    const cur = this._get(key, scope) || '';
    const id = `${scope}:${key}`;
    // The mode picked in this editor session wins (e.g. Custom CSS holding a listed theme var);
    // otherwise classify the stored value.
    const canClear = scope === 'styles' && TRANSPARENT_KEYS.has(key);
    const mode = this._cmode[id] || (cur ? colorMode(cur, canClear) : 'default');
    const data = `data-ckey="${key}" data-scope="${scope}"`;
    let field = '';
    if (mode === 'theme') {
      field = `<select class="jvce-ctheme" ${data}>${THEME_COLORS.map(([v, n]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
    } else if (mode === 'custom') {
      const hex = /^#[0-9a-fA-F]{6}$/.test(cur) ? cur : seedHex;
      field = `<input type="color" class="jvce-chex" ${data} value="${hex}">`;
    } else if (mode === 'css') {
      field = `<input type="text" class="jvce-ccss" ${data} value="${esc(cur)}" placeholder="e.g. tomato, rgba(…), var(--my-color)">`;
    }
    const modes = [['default', defaultLabel], ...(canClear ? [['transparent', 'Transparent']] : []),
      ['theme', 'Theme color'], ['custom', 'Custom color'], ['css', 'Custom CSS']];
    return `<div class="jvce-row"><label class="lbl">${label}</label><div class="jvce-color">
      <select class="jvce-cmode" ${data} data-seed="${seedHex}">${modes.map(([m, n]) => `<option value="${m}"${m === mode ? ' selected' : ''}>${n}</option>`).join('')}</select>
      ${field}</div></div>`;
  }

  _slider(key, label, value, min, max, step, scope = '', fmt = (n) => `${n}px`) {
    const isSet = this._get(key, scope) !== undefined;
    return `<div class="jvce-row jvce-nowrap"><label class="lbl">${label}</label>
      <input type="range" data-skey="${key}" data-scope="${scope}" min="${min}" max="${max}" step="${step}" value="${value}">
      <span class="jvce-val" data-val="${scope}:${key}">${fmt(value)}</span>
      ${isSet && scope ? `<button class="jvce-reset" data-reset="${key}" data-scope="${scope}" title="Back to default"><ha-icon icon="mdi:restore"></ha-icon></button>` : ''}</div>`;
  }

  _buttonsBody() {
    const c = this._config;
    const E = resolveEntities(this._hass, cfg(c, 'device'));
    const group = (title, key) => {
      const def = HIDE_LISTS[key];
      const s = E[def.entity] && this._hass.states[E[def.entity]];
      const opts = (s && s.attributes && s.attributes.options) || [];
      // Picture modes are filtered by content type; keep every mode ever hidden listed so it can be shown again.
      const items = strList([...opts, ...(c[key] || [])]);
      const hidden = new Set(c[key] || []);
      const body = items.length
        ? `<div class="jvce-checks">${items.map((o) => `<label class="jvce-check"><input type="checkbox" data-hide="${key}" data-hval="${esc(o)}"${hidden.has(o) ? '' : ' checked'}>${esc(pretty(def.labels, o))}</label>`).join('')}</div>`
        : '<p class="jvce-hint">Not available — the entity is missing or the projector is off.</p>';
      return this._sub(`btn-${key}`, title, body);
    };
    const keys = menuKeys(c);
    const extra = keys.filter((k) => !MENU_LABELS[k]);
    const menus = this._sub('btn-menus', 'Menu shortcuts (Remote section)', `
      <p class="jvce-hint">Remote keys shown as one-tap buttons under the arrows.</p>
      <div class="jvce-checks">${[...MENU_KEYS, ...extra.map((k) => [k, k])].map(([k, n]) => `<label class="jvce-check"><input type="checkbox" data-menu="${esc(k)}"${keys.includes(k) ? ' checked' : ''}>${esc(n)}</label>`).join('')}</div>`);
    const laser = this._sub('btn-laser', 'Laser', `
      <p class="jvce-hint">How much − and + change the laser power (Low / Mid / High match the projector's own settings).</p>
      ${this._slider('laser_step', 'Step', cfg(c, 'laser_step'), 1, 20, 1, '', (n) => `${n}%`)}`);
    return `<p class="jvce-hint">Untick a button to hide it from the card. Picture modes come from the projector and change with the content (SDR / HDR10 / HLG…).</p>
      ${group('Picture mode', 'hide_modes')}
      ${group('Dynamic control', 'hide_dynamic')}
      ${group('Input', 'hide_inputs')}
      ${group('Lens memory', 'hide_lens')}
      ${menus}${laser}`;
  }

  _render() {
    if (!this._hass) return;
    const c = this._config;
    const devices = listDevices(this._hass);
    const dev = cfg(c, 'device');
    const st = c.styles || {};
    const openSecs = c.open_sections || [];
    const deviceBody = `
      <p class="jvce-hint">Which projector to show. Entities are found automatically, so renamed entity IDs keep working.</p>
      <div class="jvce-row"><label class="lbl">Device</label>
        <select data-key="device">
          <option value="">${devices.length ? 'Auto (first JVC projector found)' : 'No JVC projector found'}</option>
          ${devices.map((d) => `<option value="${esc(d.id)}"${d.id === dev ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}
          ${dev && !devices.some((d) => d.id === dev) ? `<option value="${esc(dev)}" selected>${esc(dev)} (not found)</option>` : ''}
        </select></div>`;
    const sbMode = cfg(c, 'standby_text');
    const cardBody = `
      <p class="jvce-hint">Header title, the power button, what the card does while the projector is off, and collapsing.</p>
      <div class="jvce-row"><label class="lbl">Title</label><input type="text" data-key="title" value="${esc(cfg(c, 'title'))}"></div>
      <div class="jvce-group">Power & standby</div>
      <p class="jvce-hint">The header icon is the power button and shows the power state (warming up, cooling down, error). Standby always needs a press-and-hold.</p>
      <label class="jvce-check"><input type="checkbox" data-key="power_hold_on"${cfg(c, 'power_hold_on') ? ' checked' : ''}>
        Require a hold to turn on too</label>
      <label class="jvce-check"><input type="checkbox" data-key="show_when_off"${cfg(c, 'show_when_off') ? ' checked' : ''}>
        Show the card while the projector is in standby (otherwise hide it)</label>
      ${cfg(c, 'show_when_off') ? `
      <div class="jvce-row"><label class="lbl">Standby message</label>
        <select data-key="standby_text">${STANDBY_TEXT.map(([v, n]) => `<option value="${v}"${v === sbMode ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      ${sbMode !== 'hidden' ? `
      <div class="jvce-row"><label class="lbl">Message text</label><input type="text" data-key="standby_message" value="${esc(cfg(c, 'standby_message'))}"
        placeholder="Standby · ${cfg(c, 'power_hold_on') ? 'hold' : 'tap'} the icon to power on"></div>
      ${this._slider('standby_indent', 'Message indent', st.standby_indent !== undefined ? st.standby_indent : 46, 0, 160, 1, 'styles')}` : ''}
      <label class="jvce-check"><input type="checkbox" data-key="standby_button"${cfg(c, 'standby_button') ? ' checked' : ''}>
        In standby, show a power button on the right instead of the word "Standby"</label>` : ''}
      <div class="jvce-group">Link dot</div>
      <p class="jvce-hint">Green when the integration reaches the projector, red when it can't.</p>
      <div class="jvce-row"><label class="jvce-check"><input type="checkbox" data-key="show_dot"${cfg(c, 'show_dot') ? ' checked' : ''}>Show</label>
        ${cfg(c, 'show_dot') ? `<select data-key="dot_position">${DOT_POSITIONS.map(([v, n]) => `<option value="${v}"${v === cfg(c, 'dot_position') ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}</div>
      <div class="jvce-group">Collapse</div>
      <label class="jvce-check"><input type="checkbox" data-key="collapsible"${cfg(c, 'collapsible') ? ' checked' : ''}>
        Tap the header to collapse the card to just the header (while the projector is on)</label>
      ${cfg(c, 'collapsible') ? `<label class="jvce-check"><input type="checkbox" data-key="start_collapsed"${cfg(c, 'start_collapsed') ? ' checked' : ''}>
        Start collapsed</label>` : ''}
      <div class="jvce-group">Sections</div>
      <p class="jvce-hint">Status sits on top; every control is in a collapsed section so nothing changes by accident.</p>
      ${SECTIONS.map(([k, n]) => `<label class="jvce-check"><input type="checkbox" data-key="${k}"${cfg(c, k) ? ' checked' : ''}>${n}</label>`).join('')}
      <div class="jvce-group">Start open</div>
      <p class="jvce-hint">Sections that are already open when the Dashboard loads (e.g. the Remote).</p>
      <div class="jvce-checks">${FOLDS.map(([id, n]) => `<label class="jvce-check"><input type="checkbox" data-open="${id}"${openSecs.includes(id) ? ' checked' : ''}>${n}</label>`).join('')}</div>`;
    const iconBody = `
      <p class="jvce-hint">Any Material Design icon — type just the name (e.g. <b>projector-screen</b>); "mdi:" is added for you. Leave empty for the default.</p>
      ${Object.keys(ICON_DEFAULTS).map((k) => `
        <div class="jvce-row"><label class="lbl">${ICON_LABELS[k]}</label>
          <ha-icon icon="${esc(iconFor(c, k))}"></ha-icon>
          <input type="text" data-icon="${k}" value="${esc(((c.icons || {})[k] || '').replace(/^mdi:/, ''))}" placeholder="${ICON_DEFAULTS[k].replace(/^mdi:/, '')}"></div>`).join('')}`;
    const looks = STYLE_GROUPS.map(([g, title, hint]) => this._sub(`look-${g}`, title, `
      <p class="jvce-hint">${hint}</p>
      ${STYLE_DEFS.filter((d) => d[1] === g).map(([key, , kind, label, def, min, max]) => (kind === 'size'
        ? this._slider(key, label, st[key] !== undefined ? st[key] : def, min, max, 1, 'styles')
        : this._colorControl(key, label, def, '#2196f3', 'styles'))).join('')}`)).join('')
      + this._sub('look-context', 'Context colors', `
      <p class="jvce-hint">The card tints itself by context: the accent normally and the HDR color while HDR plays. The header icon turns the warming / cooling color while the projector changes power state.</p>
      ${CONTEXT_COLORS.map(([k, l, d, seed]) => this._colorControl(k, l, d, seed)).join('')}`);
    this.innerHTML = `<style>${EDITOR_CSS}</style>
      <div class="jvce">
        ${this._panel('device', 'mdi:projector', 'Device', deviceBody)}
        ${this._panel('card', 'mdi:card-text-outline', 'Card & sections', cardBody)}
        ${this._panel('buttons', 'mdi:gesture-tap-button', 'Buttons', this._buttonsBody())}
        ${this._panel('icons', 'mdi:emoticon-outline', 'Icons', iconBody)}
        ${this._panel('look', 'mdi:palette', 'Appearance', `<p class="jvce-hint">Sizes and colors. Every color can follow your theme or be custom; "Back to default" (↺) resets a size.</p>${looks}`)}
        <div class="jvce-foot">JVC Projector Card ${BUILD_NUMBER}</div>
      </div>`;
    this._rendered = true;
    this._wire();
  }

  _wire() {
    this.querySelectorAll('details.jvce-sec, details.jvce-sub').forEach((d) => d.addEventListener('toggle', () => {
      if (d.open) this._open.add(d.dataset.panel); else this._open.delete(d.dataset.panel);
    }));
    this.querySelectorAll('[data-key]').forEach((el) => {
      const key = el.dataset.key;
      const reveals = ['show_when_off', 'collapsible', 'show_dot', 'standby_text', 'power_hold_on'].includes(key);
      if (el.type === 'checkbox') el.addEventListener('change', () => { this._set(key, el.checked); if (reveals) this._render(); });
      else el.addEventListener('change', () => { this._set(key, el.value.trim()); if (reveals) this._render(); });
    });
    this.querySelectorAll('[data-skey]').forEach((el) => {
      const key = el.dataset.skey;
      const scope = el.dataset.scope;
      const fmt = scope ? (n) => `${n}px` : (n) => `${n}%`;
      el.addEventListener('input', () => {
        const out = this.querySelector(`[data-val="${scope}:${key}"]`);
        if (out) out.textContent = fmt(el.value);
      });
      el.addEventListener('change', () => {
        const n = Number(el.value);
        if (scope) {
          const def = STYLE_INDEX[key];
          this._set(key, def && n === def[4] ? '' : n, scope);
        } else this._set(key, n);
        this._render();
      });
    });
    this.querySelectorAll('[data-hide]').forEach((el) => el.addEventListener('change', () => {
      const key = el.dataset.hide;
      const val = el.dataset.hval;
      const list = (this._config[key] || []).filter((x) => x !== val);
      if (!el.checked) list.push(val);
      if (list.length) this._config[key] = list; else delete this._config[key];
      this._emit();
    }));
    this.querySelectorAll('[data-menu]').forEach((el) => el.addEventListener('change', () => {
      const cur = menuKeys(this._config);
      const known = MENU_KEYS.map(([k]) => k);
      const picked = new Set(cur.filter((k) => k !== el.dataset.menu));
      if (el.checked) picked.add(el.dataset.menu);
      // Card order = the editor's order; keys typed in YAML that aren't listed stay at the end.
      this._config.menu_keys = [...known.filter((k) => picked.has(k)), ...cur.filter((k) => !known.includes(k) && picked.has(k))];
      this._emit();
    }));
    this.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('change', () => {
      const list = (this._config.open_sections || []).filter((s) => s !== el.dataset.open);
      if (el.checked) list.push(el.dataset.open);
      if (list.length) this._config.open_sections = list; else delete this._config.open_sections;
      this._emit();
    }));
    this.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => {
      this._set(b.dataset.reset, '', b.dataset.scope);
      this._render();
    }));
    this.querySelectorAll('[data-icon]').forEach((el) => el.addEventListener('change', () => {
      this._set(el.dataset.icon, normalizeIcon(el.value) === ICON_DEFAULTS[el.dataset.icon] ? '' : normalizeIcon(el.value), 'icons');
      this._render();
    }));
    this.querySelectorAll('.jvce-cmode').forEach((sel) => sel.addEventListener('change', () => {
      const key = sel.dataset.ckey;
      const scope = sel.dataset.scope;
      const cur = this._get(key, scope) || '';
      const was = cur ? colorMode(cur) : 'default';
      let next = '';
      // Seed the new mode from the old value; never drop the user's color on a mode change.
      if (sel.value === 'transparent') next = 'transparent';
      else if (sel.value === 'theme') next = was === 'theme' ? cur : 'var(--primary-color)';
      else if (sel.value === 'custom') next = /^#[0-9a-fA-F]{6}$/.test(cur) ? cur : sel.dataset.seed;
      else if (sel.value === 'css') next = cur === 'transparent' ? '' : cur;
      this._cmode[`${scope}:${key}`] = sel.value;
      this._set(key, next, scope);
      this._render();
    }));
    const val = (sel, fn) => this.querySelectorAll(sel).forEach((el) => el.addEventListener(fn === 'input' ? 'input' : 'change',
      () => this._set(el.dataset.ckey, el.value.trim(), el.dataset.scope)));
    val('.jvce-ctheme', 'change');
    val('.jvce-chex', 'input');
    val('.jvce-ccss', 'change');
  }
}

// Test hooks (pure helpers; no effect in the browser)
JvcProjectorCard._test = {
  BUILD_NUMBER, CARD_CSS, EDITOR_CSS, DEFAULTS, ENTITY_KEYS, OPTIONAL_ENTITIES, STYLE_DEFS, ICON_DEFAULTS, MENU_KEYS, DEFAULT_MENU_KEYS,
  normalizeConfig, normalizeIcon, rootStyleVars, rootClasses, resolveEntities, listDevices, fmtSource, fmtHours, pretty, powerOf, colorMode,
  PICTURE_MODES, COLORIMETRY, CONTENT_TYPES, LENS_MEMORIES, HDR_PROCESSING, HDR_LEVEL, isNoSignal,
};

if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, JvcProjectorCard);
if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, JvcProjectorCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: 'JVC Projector Card',
    description: 'JVC D-ILA projector: signal, picture and laser status, and collapsible remote, picture mode, laser, input and info sections.',
    preview: false,
    documentationURL: 'https://github.com/Ltek/jvc-projector-card',
  });
}

console.info(`%c JVC-PROJECTOR-CARD %c ${BUILD_NUMBER} `, 'color:#fff;background:#2196F3;font-weight:700', 'color:#2196F3;background:transparent');
