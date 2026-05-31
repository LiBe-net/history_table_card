/**
 * History Table Card
 * HACS Custom Lovelace Card for Home Assistant
 *
 * Zwei Konfigurationsmodi:
 *
 *  COLUMNS-MODUS (neu):
 *    columns:
 *      - type: date      (Datumsspalte)
 *      - type: entity    (entity, stat_type)
 *      - type: calc      (template: "{{ (pv/(pv+grid)*100)|round(1) }} %",
 *                         vars: { pv: {entity, stat_type}, grid: {entity, stat_type} })
 *
 *  ENTITIES-MODUS (v1-kompatibel):
 *    entity: sensor.xxx   ODER   entities: [...]
 *
 * @version 0.9.0
 * @license MIT
 */

// ─── Konstanten ───────────────────────────────────────────────────────────────

const CARD_VERSION = '0.9.0';
const CARD_NAME    = 'History Table Card';
const CARD_TAG     = 'history-table-card';

const COL_DATE   = 'date';
const COL_ENTITY = 'entity';
const COL_CALC   = 'calc';
const COL_ENERGY = 'energy';   // Summe aus Energy-Dashboard-Quellen (Wh → kWh, automatisch)

// Gültige Werte für den recorder/statistics_during_period WebSocket-Aufruf
const VALID_STAT_TYPES = new Set(['change', 'last_reset', 'max', 'mean', 'min', 'state', 'sum']);
const VALID_PERIODS    = new Set(['5minute', 'hour', 'day', 'week', 'month', 'year']);

function statOptionsForStateClass(stateClass) {
  const isTotalType = stateClass === 'total_increasing' || stateClass === 'total' || stateClass === 'increasing';
  if (stateClass === 'measurement') {
    return [['mean', 'stat_mean'], ['max', 'stat_max'], ['min', 'stat_min']];
  }
  if (isTotalType) {
    return [['change', 'stat_change'], ['sum', 'stat_sum'], ['state', 'stat_state']];
  }
  return [['mean', 'stat_mean'], ['sum', 'stat_sum'], ['max', 'stat_max'], ['min', 'stat_min'], ['state', 'stat_state'], ['change', 'stat_change']];
}

function smartStatTypeForStateClass(stateClass) {
  return (stateClass === 'total_increasing' || stateClass === 'total' || stateClass === 'increasing') ? 'change' : 'mean';
}

function statModelForStateClasses(stateClasses) {
  const classes = (stateClasses || []).filter(Boolean);
  if (!classes.length) {
    return {
      opts: [['mean', 'stat_mean'], ['sum', 'stat_sum'], ['max', 'stat_max'], ['min', 'stat_min'], ['state', 'stat_state'], ['change', 'stat_change']],
      smart: 'mean',
    };
  }
  const allTotal = classes.every(sc => sc === 'total_increasing' || sc === 'total' || sc === 'increasing');
  if (allTotal) {
    return { opts: [['change', 'stat_change'], ['sum', 'stat_sum'], ['state', 'stat_state']], smart: 'change' };
  }
  const allMeasurement = classes.every(sc => sc === 'measurement');
  if (allMeasurement) {
    return { opts: [['mean', 'stat_mean'], ['max', 'stat_max'], ['min', 'stat_min']], smart: 'mean' };
  }
  return {
    opts: [['mean', 'stat_mean'], ['sum', 'stat_sum'], ['max', 'stat_max'], ['min', 'stat_min'], ['state', 'stat_state'], ['change', 'stat_change']],
    smart: 'mean',
  };
}

function chooseAllowedStatType(preferred, stateClasses) {
  const model = statModelForStateClasses(stateClasses);
  const allowed = new Set(model.opts.map(([v]) => v));
  const next = allowed.has(preferred) ? preferred : model.smart;
  return { statType: next, opts: model.opts, smart: model.smart };
}

const DEFAULT_COLUMN_BG_COLORS = [
  'rgba(255, 152,   0, 0.2)',  // amber         – HA solar / energy
  'rgba( 33, 150, 243, 0.2)',  // blue           – HA primary
  'rgba( 76, 175,  80, 0.2)',  // green          – HA success / grid
  'rgba(244,  67,  54, 0.2)',  // red            – HA error / alert
  'rgba(156,  39, 176, 0.2)',  // purple         – HA battery / domain
  'rgba(  0, 188, 212, 0.2)',  // cyan / teal    – HA energy return
  'rgba(255, 193,   7, 0.2)',  // yellow-amber   – HA warning
  'rgba(233,  30,  99, 0.2)',  // pink           – HA domain accent
  'rgba( 63,  81, 181, 0.2)',  // indigo         – HA nav / blueprint
  'rgba(139, 195,  74, 0.2)',  // light green    – HA climate
  'rgba(255,  87,  34, 0.2)',  // deep orange    – HA heating
  'rgba( 96, 125, 139, 0.2)',  // blue-grey      – HA unavailable / neutral
];

// Solid colors for text / font color pickers (same semantic palette, no transparency)
const DEFAULT_TEXT_COLORS = [
  '#000000',  // schwarz
  '#ffffff',  // weiß
  '#cccccc',  // hellgrau
  '#888888',  // grau
  '#ff0000',  // rot
  '#ff8f00',  // amber
  '#2e7d32',  // grün
  '#1565c0',  // blau
  '#6a1b9a',  // lila
  '#c62828',  // dunkelrot
  '#00838f',  // cyan
  '#37474f',  // blaugrau
];

const EDITOR_TRANSLATIONS = {
  de: {
    tab_general: 'Allgemein', tab_cols: 'Spalten', tab_display: 'Schnellmenüeinträge',
    sec_card: 'Karte', sec_advanced: 'Erweitert', sec_aggregation: 'Aggregation',
    sec_display: 'Anzeigeoptionen',
    lbl_title: 'Titel', lbl_days: 'Tage anzeigen', lbl_decimals: 'Dezimalstellen',
    lbl_collection_key: 'Collection Key (Energy)', lbl_custom_start: 'Eigenes Startdatum',
    lbl_range_mode: 'Zeitbereich', range_mode_days: 'Tage anzeigen', range_mode_energy: 'Folge Energy-Datepicker', range_mode_period: 'Vordefinierte Periode', range_mode_custom: 'Eigenes Startdatum',
    hint_range_energy: 'Voraussetzung: energy-date-selection-Card im Dashboard (vor dem Anlegen dieser Karte)',
    lbl_sort_col: 'Sortierspalte (0-basiert)',
    lbl_layout: 'Standard-Layout', layout_normal: 'Vertikale Zeitachse', layout_transposed: 'Horizontale Zeitachse',
    lbl_default_period: 'Periode fixieren (beim Laden)',
    lbl_stat_type: 'Standard-Statistiktyp', lbl_date_format: 'Datumsformat',
    lbl_initial_period: 'Startperiode', lbl_sort_dir: 'Sortierrichtung',
    lbl_period_fallback: 'Periode (Fallback)',
    agg_hint: '»Automatisch« verwendet die Schwellwerte und Perioden aus der folgenden Tabelle:',
    agg_auto: '— Auto —', period_none: '— Automatisch —', period_timespan: 'Ein Wert für den Zeitraum',
    sec_features: 'Aktivierte Funktionen',
    sort_asc: 'Aufsteigend', sort_desc: 'Absteigend',
    stat_mean: 'Mittelwert', stat_sum: 'Summe', stat_max: 'Maximum',
    stat_min: 'Minimum', stat_state: 'Zustand', stat_change: 'Änderung',
    lbl_card_padding: 'Erweiterte Layout-Settings',
    chk_show_header: 'Kopfzeile',
    chk_hide_table_header: 'Tabellenkopf ausblenden',
    chk_sticky_header: 'Sticky Kopfzeile',
    chk_sticky_header_hint: 'Funktioniert nur, wenn die Karte eine begrenzte Höhe hat (z. B. über grid_options → rows).',
    chk_sticky_first_col: 'Sticky 1. Spalte',
    chk_color_bullet: 'Farb-Bullet',
    lbl_bullet_color_hint: '(nur bei Horizontaler Zeitachse)',
    lbl_header_color: 'Kopfzeilen-Hintergrundfarbe',
    lbl_header_text_color: 'Kopfzeilen-Schriftfarbe',
    lbl_first_col_color: 'Erste-Spalte-Hintergrundfarbe',
    lbl_first_col_text_color: 'Erste-Spalte-Schriftfarbe',
    chk_enable_sort: 'Sortierung aktivieren',
    chk_zoom: 'Zeitraum verdoppeln', chk_nav: 'Nav-Menü', chk_reset: 'Reset-Button',
    chk_date_links: 'Datum-Links', chk_back: 'Zurück-Button',
    chk_show_nav_date: 'Datum einblenden', chk_nav_btns: 'Vor/Zurück Tasten', chk_show_quick_menu: 'Quick Menü einblenden',
    btn_add_col: '＋ Spalte hinzufügen',
    col_fallback: 'Spalte',
    lbl_type: 'Typ', lbl_header: 'Name',
    lbl_date_format_col: 'Datumsformat (Spalte)', lbl_stat_type_col: 'Statistiktyp',
    lbl_entity: 'Entity', lbl_decimals_col: 'Dezimalstellen',
    lbl_factor: 'Faktor', lbl_unit: 'Einheit',
    lbl_format: 'Format-Template', lbl_alias: 'Variable', lbl_alias_hint: 'für Verwendung in calc',
    lbl_template: 'Template / Formel',
    lbl_hidden: 'in Tabelle Ausblenden (Daten für calc noch verfügbar)',
    lbl_vars: 'Variablen (Variable=Entity-ID, stat_type optional, je Zeile)',
    chk_hide_unit: 'Keine Einheit',
    lbl_unit_hint: 'Einheit überschreiben',
    lbl_calc_aliases: 'Variablen (aus Variable)',
    lbl_calc_ops: 'Operatoren',
    lbl_calc_filters: 'Filter',
    lbl_calc_mode_hint: 'Clientseitig \u2022 Fallback Jinja2',
    lbl_color: 'Textfarbe', lbl_bg_color: 'Hintergrundfarbe', lbl_bullet_color: 'Bullet-Farbe',
    ph_bg_color: 'z.B. rgba(100,150,200,0.2)', ph_bullet_color: 'z.B. #ff9800',
    lbl_text_align: 'Textausrichtung', align_left: 'Links', align_center: 'Mitte', align_right: 'Rechts',
    lbl_padding: 'Innenabstand (px)',
    lbl_cell_padding: 'Zellenabstand (px)', lbl_row_height: 'Zeilenhöhe (px)', lbl_max_col_width: 'Max. Spaltenbreite (px)',
    lbl_transposed_header: 'Kopfzeile 1. Spalte', lbl_transposed_val_header: 'Kopfzeile Wert-Spalte',
    lbl_transposed_row_default: 'Entität', lbl_transposed_val_default: 'Wert',
    lbl_col_width_key: 'Breite 1. Spalte (%)', lbl_col_width_value: 'Breite Wert-Spalte (%)',
    lbl_text_align_key: 'Ausrichtung 1. Spalte', lbl_text_align_value: 'Ausrichtung Wert-Spalte',
    lbl_card_pad_top: 'oben', lbl_card_pad_right: 'rechts', lbl_card_pad_bottom: 'unten', lbl_card_pad_left: 'links',
    sec_quick_menu: 'Schnellmenü-Einträge',
    btn_add_qmi: '＋ Eintrag hinzufügen',
    lbl_qmi_title: 'Titel (leer = auto)', lbl_qmi_range_mode: 'Zeitraum',
    lbl_qmi_energy_period: 'Energy-Periode',
    lbl_qmi_period: 'Period überschreiben', lbl_qmi_sort_col: 'Sortierspalte',
    lbl_qmi_days_to_show: 'Anzahl Tage', lbl_qmi_custom_start: 'Startdatum (eigenes)',
    lbl_qmi_date_links: 'Datum-Links', lbl_qmi_enable_sort: 'Sortierung',
    lbl_qmi_sticky_header: 'Sticky Kopfzeile', lbl_qmi_sticky_first_col: 'Sticky 1. Spalte',
    lbl_qmi_layout: 'Ansichtsmodus',
    qmi_range_energy: 'Energy-Periode', qmi_range_days: 'Anzahl Tage', qmi_range_custom: 'Eigenes Startdatum',
    qmi_no_change: '— (nicht ändern)', qmi_on: 'An', qmi_off: 'Aus',
    qmi_layout_normal: 'Vertikale Zeitachse', qmi_layout_transposed: 'Horizontale Zeitachse',
    qmi_period_default: 'Standard (zurücksetzen)',
    qmi_energy_labels: { today: 'Heute', yesterday: 'Gestern', this_week: 'Diese Woche', this_month: 'Dieser Monat', this_quarter: 'Dieses Quartal', this_year: 'Dieses Jahr', 'now-7d': 'Letzte 7 Tage', 'now-30d': 'Letzte 30 Tage', 'now-365d': 'Letzte 365 Tage', 'now-12m': 'Letzte 12 Monate' },
    menu_period: 'Periode', menu_view: 'Ansicht', menu_range: 'Zeitraum',
    menu_revert_auto: 'Automatisch', menu_default: 'Standard',
    menu_view_horizontal: 'Horizontale Zeitachse', menu_view_normal: 'Vertikale Zeitachse',
    menu_timespan: 'Eine Zeile für den Zeitraum',
    df_default: 'Standard', stat_default: 'Standard',
    stat_period_labels: { '5minute': '5 Minuten', hour: 'Stunde', day: 'Tag', week: 'Woche', month: 'Monat', year: 'Jahr' },
    df_labels: { short: 'Kurz', medium: 'Mittel', long: 'Lang', full: 'Vollständig', unixtimestamp: 'Unix-Zeitstempel', numeric_dt: 'JJJJ.MM.TT HH:mm' },
    type_date: 'Datum', type_entity: 'Entity', type_calc: 'Berechnung', type_energy: 'Energie ⚡',
    lbl_energy_key: 'Energie-Typ', lbl_energy_load: '⚡ Energie-Dashboard laden',
    energy_key_pv_sum: 'PV Gesamt', energy_key_grid_import: 'Netz Bezug',
    energy_key_grid_export: 'Netz Einspeisung', energy_key_battery_charge: 'Batterie Laden',
    energy_key_battery_discharge: 'Batterie Entladen', energy_key_device_sum: 'Geräte Gesamt',
    energy_key_pv_n: 'PV', energy_key_device_n: 'Gerät',
    msg_energy_prefs_loading: 'Lade…',
    msg_energy_prefs_err: 'Energy-Dashboard nicht verfügbar',
    energy_default_alias: { pv_sum:'pv', grid_import:'grid_import', grid_export:'grid_export', battery_charge:'charge', battery_discharge:'discharge', device_sum:'device_sum' },
    period_labels: {
      today: 'today (heute)', yesterday: 'yesterday (gestern)',
      this_week: 'this_week (diese Woche)', this_month: 'this_month (dieser Monat)',
      this_quarter: 'this_quarter (dieses Quartal)', this_year: 'this_year (dieses Jahr)',
      'now-7d': 'now-7d (7 Tage)', 'now-30d': 'now-30d (30 Tage)',
      'now-365d': 'now-365d (365 Tage)', 'now-12m': 'now-12m (12 Monate)',
    },
    color_labels: [
      'Amber – Solar / Energie', 'Blau – HA Primary', 'Grün – Erfolg / Grid',
      'Rot – Fehler / Alarm', 'Lila – Batterie / Domain', 'Cyan – Energie-Rückspeisung',
      'Gelb – Warnung', 'Pink – Domain-Akzent', 'Indigo – Navigation',
      'Hellgrün – Klimaanlage', 'Orange – Heizung', 'Blaugrau – Neutral',
    ],
    sec_energy_dash: 'Energy Dashboard Vorlage',
    btn_load_energy_v: '⚡ Aus Energy-Dashboard (Vertikal)',
    btn_load_energy_h: '⚡ Aus Energy-Dashboard (Horizontal)',
    msg_energy_ok: 'Vorlage erstellt! Spalten wurden automatisch befüllt.',
    msg_energy_err: 'Energy-Dashboard konnte nicht geladen werden:',
    msg_energy_empty: 'Keine Energiequellen im Energy-Dashboard gefunden.',
  },
  en: {
    tab_general: 'General', tab_cols: 'Columns', tab_display: 'Quick Menu Items',
    sec_card: 'Card', sec_advanced: 'Advanced', sec_aggregation: 'Aggregation',
    sec_display: 'Display Options',
    lbl_title: 'Title', lbl_days: 'Days to show', lbl_decimals: 'Decimal places',
    lbl_collection_key: 'Collection Key (Energy)', lbl_custom_start: 'Custom start date',
    lbl_range_mode: 'Time range', range_mode_days: 'Days to show', range_mode_energy: 'Follow Energy datepicker', range_mode_period: 'Fixed period', range_mode_custom: 'Custom start date',
    hint_range_energy: 'Requires: energy-date-selection card in the dashboard (before creating this card)',
    lbl_sort_col: 'Sort column (0-based)',
    lbl_layout: 'Default layout', layout_normal: 'Vertical timeline', layout_transposed: 'Horizontal timeline',
    lbl_default_period: 'Fix period (on load)',
    lbl_stat_type: 'Default statistic type', lbl_date_format: 'Date format',
    lbl_initial_period: 'Start period', lbl_sort_dir: 'Sort direction',
    lbl_period_fallback: 'Period (fallback)',
    agg_hint: '»Automatic« uses the thresholds and periods from the table below:',
    agg_auto: '— Auto —', period_none: '— Automatic —', period_timespan: 'One value for the timespan',
    sec_features: 'Enabled Features',
    sort_asc: 'Ascending', sort_desc: 'Descending',
    stat_mean: 'Mean', stat_sum: 'Sum', stat_max: 'Maximum',
    stat_min: 'Minimum', stat_state: 'State', stat_change: 'Change',
    lbl_card_padding: 'Advanced Layout Settings',
    chk_show_header: 'Header',
    chk_hide_table_header: 'Hide table header',
    chk_sticky_header: 'Sticky header',
    chk_sticky_header_hint: 'Only works if the card has a limited height (e.g. via grid_options → rows).',
    chk_sticky_first_col: 'Sticky 1st column',
    chk_color_bullet: 'Color bullet',
    lbl_bullet_color_hint: '(transposed only)',
    lbl_header_color: 'Header background color',
    lbl_header_text_color: 'Header text color',
    lbl_first_col_color: 'First column background color',
    lbl_first_col_text_color: 'First column text color',
    chk_enable_sort: 'Enable sort',
    chk_zoom: 'Double time range', chk_nav: 'Nav menu', chk_reset: 'Reset button',
    chk_date_links: 'Date links', chk_back: 'Back button',
    chk_show_nav_date: 'Show date', chk_nav_btns: 'Prev/Next buttons', chk_show_quick_menu: 'Show quick menu',
    btn_add_col: '＋ Add column',
    col_fallback: 'Column',
    lbl_type: 'Type', lbl_header: 'Name',
    lbl_date_format_col: 'Date format (column)', lbl_stat_type_col: 'Statistic type',
    lbl_entity: 'Entity', lbl_decimals_col: 'Decimal places',
    lbl_factor: 'Factor', lbl_unit: 'Unit',
    lbl_format: 'Format template', lbl_alias: 'Variable', lbl_alias_hint: 'for use in calc',
    lbl_template: 'Template / Formula',
    lbl_hidden: 'Hide column (data for calc still available)',
    lbl_vars: 'Variables (variable=entity_id, optional stat_type, one per line)',
    chk_hide_unit: 'No unit',
    lbl_unit_hint: 'Unit override',
    lbl_calc_aliases: 'Variables (from variable)',
    lbl_calc_ops: 'Operators',
    lbl_calc_filters: 'Filters',
    lbl_calc_mode_hint: 'Client-side \u2022 Jinja2 fallback',
    lbl_color: 'Text color', lbl_bg_color: 'Background color', lbl_bullet_color: 'Bullet color',
    ph_bg_color: 'e.g. rgba(100,150,200,0.2)', ph_bullet_color: 'e.g. #ff9800',
    lbl_text_align: 'Text alignment', align_left: 'Left', align_center: 'Center', align_right: 'Right',
    lbl_padding: 'Inner padding (px)',
    lbl_cell_padding: 'Cell padding (px)', lbl_row_height: 'Row height (px)', lbl_max_col_width: 'Max. column width (px)',
    lbl_transposed_header: 'First column header (entity)', lbl_transposed_val_header: 'Value column header',
    lbl_transposed_row_default: 'Entity', lbl_transposed_val_default: 'Value',
    lbl_col_width_key: 'First column width (%)', lbl_col_width_value: 'Value column width (%)',
    lbl_text_align_key: 'First column alignment', lbl_text_align_value: 'Value column alignment',
    lbl_card_pad_top: 'top', lbl_card_pad_right: 'right', lbl_card_pad_bottom: 'bottom', lbl_card_pad_left: 'left',
    sec_quick_menu: 'Quick Menu Items',
    btn_add_qmi: '＋ Add item',
    lbl_qmi_title: 'Title (empty = auto)', lbl_qmi_range_mode: 'Time range',
    lbl_qmi_energy_period: 'Energy period',
    lbl_qmi_period: 'Override period', lbl_qmi_sort_col: 'Sort column',
    lbl_qmi_days_to_show: 'Days to show', lbl_qmi_custom_start: 'Custom start date',
    lbl_qmi_date_links: 'Date links', lbl_qmi_enable_sort: 'Sorting',
    lbl_qmi_sticky_header: 'Sticky header', lbl_qmi_sticky_first_col: 'Sticky 1st col',
    lbl_qmi_layout: 'View mode',
    qmi_range_energy: 'Energy period', qmi_range_days: 'Days to show', qmi_range_custom: 'Custom start date',
    qmi_no_change: '— (no change)', qmi_on: 'On', qmi_off: 'Off',
    qmi_layout_normal: 'Vertical timeline', qmi_layout_transposed: 'Horizontal timeline',
    qmi_period_default: 'Default (reset)',
    qmi_energy_labels: { today: 'Today', yesterday: 'Yesterday', this_week: 'This week', this_month: 'This month', this_quarter: 'This quarter', this_year: 'This year', 'now-7d': 'Last 7 days', 'now-30d': 'Last 30 days', 'now-365d': 'Last 365 days', 'now-12m': 'Last 12 months' },
    menu_period: 'Period', menu_view: 'View', menu_range: 'Range',
    menu_revert_auto: 'Automatic', menu_default: 'Default',
    menu_view_horizontal: 'Horizontal timeline', menu_view_normal: 'Vertical timeline',
    menu_timespan: 'One row for the timespan',
    df_default: 'Default', stat_default: 'Default',
    stat_period_labels: { '5minute': '5 minutes', hour: 'Hour', day: 'Day', week: 'Week', month: 'Month', year: 'Year' },
    df_labels: { short: 'Short', medium: 'Medium', long: 'Long', full: 'Full', unixtimestamp: 'Unix timestamp', numeric_dt: 'YYYY.MM.DD HH:mm' },
    type_date: 'Date', type_entity: 'Entity', type_calc: 'Calculation', type_energy: 'Energy ⚡',
    lbl_energy_key: 'Energy type', lbl_energy_load: '⚡ Load Energy Dashboard',
    energy_key_pv_sum: 'PV Total', energy_key_grid_import: 'Grid Import',
    energy_key_grid_export: 'Grid Export', energy_key_battery_charge: 'Battery Charge',
    energy_key_battery_discharge: 'Battery Discharge', energy_key_device_sum: 'All Devices',
    energy_key_pv_n: 'PV', energy_key_device_n: 'Device',
    msg_energy_prefs_loading: 'Loading…',
    msg_energy_prefs_err: 'Energy Dashboard not available',
    energy_default_alias: { pv_sum:'pv', grid_import:'grid_import', grid_export:'grid_export', battery_charge:'charge', battery_discharge:'discharge', device_sum:'device_sum' },
    period_labels: {
      today: 'today', yesterday: 'yesterday',
      this_week: 'this_week', this_month: 'this_month',
      this_quarter: 'this_quarter', this_year: 'this_year',
      'now-7d': 'now-7d', 'now-30d': 'now-30d',
      'now-365d': 'now-365d', 'now-12m': 'now-12m',
    },
    color_labels: [
      'Amber – Solar / Energy', 'Blue – HA Primary', 'Green – Success / Grid',
      'Red – Error / Alert', 'Purple – Battery / Domain', 'Cyan – Energy return',
      'Yellow – Warning', 'Pink – Domain accent', 'Indigo – Navigation',
      'Light green – Climate', 'Orange – Heating', 'Blue-grey – Neutral',
    ],
    sec_energy_dash: 'Energy Dashboard Template',
    btn_load_energy_v: '⚡ Generate from Energy Dashboard (Vertical)',
    btn_load_energy_h: '⚡ Generate from Energy Dashboard (Horizontal)',
    msg_energy_ok: 'Template generated! Columns have been auto-populated.',
    msg_energy_err: 'Could not load Energy Dashboard:',
    msg_energy_empty: 'No energy sources found in the Energy Dashboard.',
  },
};

const DEFAULT_CONFIG = {
  title:        '',
  period:       'day',      // 'hour' | 'day' | '5minute' | 'month' | 'week' | 'year'
  stat_type:    'mean',     // globaler Fallback-Typ
  days_to_show: 7,
  show_header:  true,
  show_back_button:  false,
  scroll:       true,
  date_format:  'short',   // 'short' | 'medium' | 'long' | 'full'
  sort_col:     null,       // Standard-Sortierspalte (0-basiert), null = keine
  sort_dir:     'asc',      // 'asc' | 'desc'
  initial_period: null,     // HA-Perioden-String: 'this_year' | 'this_month' | 'now-12m' | 'now-7d' ...
  show_zoom_out: false,  // +/- Zoom-Schaltflächen in der Toolbar
  show_nav_buttons:  false,  // < > Schaltflächen in der Toolbar
  show_reset_button: true,   // ↺ Reset-Schaltfläche in der Toolbar (default an; nur bei false aus)
  show_date_links:   true,  // Datumszellen als klickbare Links (Zoom auf Periode)
  column_colors:     null,  // null = use DEFAULT_COLUMN_BG_COLORS; [] = disable; custom array overrides per-column palette
  layout:            null,  // null | 'vertical' | 'horizontal'  — Startzustand der Ansicht
  default_period:    null,  // null | 'hour' | 'day' | 'month' | 'year' | 'timespan' — Startperiode
  enable_sort:       true,  // true = Sortierung aktiv (default)
  card_padding:      null,  // Innenabstand der Card in px (null = Standard)
  hide_table_header: false, // Tabellenkopfzeile ausblenden
  sticky_header:     true,  // Kopfzeile bleibt beim Scrollen oben
  sticky_first_col:  true,  // Erste Spalte bleibt beim Scrollen links
  show_color_bullet: false, // Farb-Bullet links von Entity-Label (transponiert)
  header_color:      '',    // Hintergrundfarbe für Tabellenkopf
  header_text_color: '',    // Schriftfarbe für Tabellenkopf
  first_col_color:   '',    // Hintergrundfarbe für erste Spalte
  first_col_text_color: '', // Schriftfarbe für erste Spalte
  cell_padding:      null,  // Zellenabstand td/th in px (null = Standard)
  row_height:        null,  // Zeilenhöhe tr in px (null = Standard)
  max_col_width:     null,  // Maximale Spaltenbreite in px + Ellipsis (null = keine Begrenzung)
  transposed_row_header: '', // Eigene Beschriftung der 1. Spalte in transponierter Ansicht
  transposed_value_header: '', // Eigene Beschriftung der Wert-/Datumsspalten in transponierter Ansicht
  transposed_col_width_key:   null, // Breite der 1. Spalte in % (transponiert)
  transposed_col_width_value: null, // Breite der Wert-Spalten in % (transponiert)
  text_align_key:   '', // Textausrichtung 1. Spalte (alle Ansichten)
  text_align_value: '', // Textausrichtung Wert-Spalten (alle Ansichten)
  card_padding_top:    null, // Card-Innenabstand oben
  card_padding_right:  null, // Card-Innenabstand rechts
  card_padding_bottom: null, // Card-Innenabstand unten
  card_padding_left:   null, // Card-Innenabstand links
  quick_menu_items:    [],   // Schnellmenü-Einträge: [{ title?, energy_period?, period?, sort_col? }]
  show_nav_date:       false, // Datum in der Toolbar anzeigen
  show_quick_menu:     true,  // Schnellmenü-Einträge im Toolbar-Menü anzeigen
};

// ─── Stylesheet ───────────────────────────────────────────────────────────────

const CARD_STYLES = `
  :host { display: block; height: 100%; }
  ha-card {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .card-header {
    display: flex;
    padding: 12px 16px 4px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    column-gap: 8px;
    row-gap: 2px;
    margin-top:1px;    
    margin-bottom: 10px;  
  }

  #period-menu {
    display: none;
    position: fixed;     /* fixed: immune to overflow clipping in any ancestor */
    z-index: 5;       /* always above sticky headers and wrapper cards */
    flex-direction: column;
    min-width: 120px;
    line-height:30px;
    font-size: var(--ha-font-size-m);
    background: var(--ha-card-background, var(--card-background-color, white));
    border-radius: 5px;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    overflow-y: auto;
  }

  #period-menu hr {
    opacity:0.3
  }

  #period-menu button {line-height:30px;}

  .card-header .title {
    color: var(--ha-card-header-color, var(--primary-text-color));
    font-family: var(--ha-card-header-font-family, inherit);
    font-size: 24px;
    font-weight: normal;
    letter-spacing: -0.012em;
    line-height: 48px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 0 1 max-content;
    min-width: 150px;
    max-width: 100%;
  }

  /* Titel + optionaler Zurück-Button als Gruppe – bleibt beim Umbruch linksbündig */
  .card-header-left {
    display: flex;
    align-items: center;
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
  }

  /* Toolbar-Grid: passt sich der eigenen Inhaltsbreite an,
     wächst aber auf volle Breite wenn kein Titel da ist */
  .card-header-right {
    display: grid;
    grid-template-columns: max-content auto max-content;
    align-items: center;
    flex: 0 1 auto;
    min-width: 0;
    gap: 0;
    margin-left: auto;
  }

  .card-header .meta {
    font-size: var(--ha-font-size-m);
    font-weight: var(--ha-font-weight-medium);
    color: var(--primary-text-color);
    white-space: normal;
    word-break: break-word;
    text-align: center;
    padding-bottom: 4px;
    line-height: 1.4;
  }

  .header-toolbar {
    display: contents;
  }
  /* ── Toolbar Datum-Block ───────────────────────────────────── */
  .nav-group {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    position: relative;
    top: 0px;
  }
    
  .nav-left  { justify-content: flex-end; }
  .nav-right { justify-content: flex-start; }
  /* nav-date: Inhaltsbreite, bricht nur zwischen from– und to um */
  .nav-date {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 0 6px;
    color: var(--primary-text-color);
    max-width:40vw;
  }
  .nav-date-start,
  .nav-date-to {
    white-space: nowrap;
    flex: 0 0 auto;
  }
  .nav-date-start { padding-right: 2px; }
  .nav-date-to    { padding-left:  2px; }
  .card-content { padding: 0;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    overflow-x: auto;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    border-bottom-left-radius: var(--ha-card-border-radius, 12px);
    border-bottom-right-radius: var(--ha-card-border-radius, 12px);
  }
  /* Wenn kein Header vorhanden: auch obere Ecken abrunden */
  ha-card.no-header .card-content {
    border-top-left-radius: var(--ha-card-border-radius, 12px);
    border-top-right-radius: var(--ha-card-border-radius, 12px);
  }
  ha-card { position: relative; padding: 0; }
  .card-content.no-scroll { overflow: hidden; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--ha-font-size-m);
  }
  thead tr {
    position: sticky;
    top: 0;
    background-image: linear-gradient(var(--ht-header-bg, transparent), var(--ht-header-bg, transparent));
    background-color: var(--ha-card-background, var(--card-background-color, white));
    z-index: 3;
  }
  thead th {
    text-align: left;
    padding: 16px;
    border-bottom: 2px solid var(--divider-color, rgba(0,0,0,0.12));
    color: var(--ht-header-text, var(--secondary-text-color));
    font-weight: 500;
    font-size: var(--ha-font-size-m);
    letter-spacing: 0.05em;
    white-space: nowrap;
    user-select: text;
    -webkit-user-select: text;
  }
  thead th.right { text-align: right; }
  tbody tr { transition: background 0.15s; }
  tbody tr:nth-child(even) {
    background: var(--table-row-background-color,
      color-mix(in srgb, var(--primary-text-color) 4%, transparent));
  }
  tbody tr:hover {
    background: var(--table-row-active-background-color,
      rgba(var(--rgb-primary-color, 3,169,244), 0.08));
  }
  /* Normalmodus: tr-Hover-Hintergrund deaktivieren, Hover wird einheitlich auf td gemalt
     (gleicher Paint-Zyklus für sticky 1. Spalte und Value-Spalten). */
  ha-card:not(.transposed) tbody tr:hover { background: transparent; }
  ha-card:not(.transposed) tbody tr:hover td {
    box-shadow: inset 0 0 0 1000px var(--table-row-active-background-color,
      rgba(var(--rgb-primary-color, 3,169,244), 0.08));
  }
  /* Normalmodus: sticky 1. Spalte behält den Trenner im Hover-Zustand. */
  ha-card:not(.transposed) tbody tr:hover td:first-child:not(.cell-bullet) {
    box-shadow: inset 0 0 0 1000px var(--table-row-active-background-color, rgba(var(--rgb-primary-color, 3,169,244), 0.08));
  }
  /* Normalmodus: Hover sticky deaktiviert – kein Trenner */
  ha-card:not(.transposed).no-sticky-first-col tbody tr:hover td:first-child:not(.cell-bullet) {
    box-shadow: inset 0 0 0 1000px var(--table-row-active-background-color, rgba(var(--rgb-primary-color, 3,169,244), 0.08));
  }
  /* Transponiert: kein Zebra (jede Zeile = eigene Entity, oft eigene Farbe) */
  ha-card.transposed tbody tr:nth-child(even) { background: transparent; }
  /* Transponiert: tr-Hover-Hintergrund deaktivieren – würde zu doppelter Intensität führen,
     da tbody tr:hover noch einen Background setzt. Nur der box-shadow auf td zählt. */
  ha-card.transposed tbody tr:hover { background: transparent; }
  /* Transponiert: Hover – gleichmäßig via box-shadow auf alle Zellen;
     so stimmt Farbdichte für Zellen mit/ohne background_color und Sticky-Zellen
     werden im gleichen Paint-Zyklus aktualisiert (kein Sync-Versatz). */
  ha-card.transposed tbody tr:hover td {
    box-shadow: inset 0 0 0 1000px var(--table-row-active-background-color,
      rgba(var(--rgb-primary-color, 3,169,244), 0.08));
  }
  tbody td {
    padding: 16px;
    border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.08));
    color: var(--primary-text-color);
    font-size: var(--mdc-typography-body2-font-size, 0.875rem);
    line-height: var(--mdc-typography-body2-line-height, 1.25rem);
    vertical-align: middle;
    white-space: nowrap;
    user-select: text;
    -webkit-user-select: text;
    transition: box-shadow 0.15s ease;
  }
  /* Normalmodus: alle Zellen ohne Schatten-Animation, damit Hover-In/Out in
     erster Spalte und Value-Spalten exakt gleich schnell ist. */
  ha-card:not(.transposed) tbody td {
    transition: none;
  }
  /* Normalmodus: sticky 1. Spalte – nur normal, nicht transponiert */
  ha-card:not(.transposed) thead th:first-child:not(.cell-bullet), 
  ha-card:not(.transposed) tbody td:first-child:not(.cell-bullet) {
    position: sticky;
    left: 0;
    background-image: linear-gradient(var(--ht-first-col-bg, transparent), var(--ht-first-col-bg, transparent));
    background-color: var(--ha-card-background, var(--card-background-color, white));
    color: var(--ht-first-col-text, inherit);
    z-index: 2;
    border-right: 1px solid var(--divider-color, rgba(0,0,0,0.12));
  }
    /* Sticky 1. Spalte: keine separate Animation (wird über die globale
      Normalmodus-Regel für alle Zellen vereinheitlicht). */
  ha-card:not(.transposed) tbody td:first-child:not(.cell-bullet) {
    transition: none;
  }
  /* Normale Ansicht: Zebra auf sticky 1. Spalte */
  ha-card:not(.transposed) tbody tr:nth-child(even):not(:hover) td:first-child:not(.cell-bullet) {
    background-image: linear-gradient(var(--ht-first-col-bg, transparent), var(--ht-first-col-bg, transparent)),
                      linear-gradient(var(--table-row-background-color, color-mix(in srgb, var(--primary-text-color) 4%, transparent)),
                                      var(--table-row-background-color, color-mix(in srgb, var(--primary-text-color) 4%, transparent)));
    background-color: var(--ha-card-background, var(--card-background-color, white));
  }
  /* Normalmodus: Tabellenkopf höherer Z-Index */
  ha-card:not(.transposed) thead th:first-child:not(.cell-bullet) { z-index: 3; }

  tbody tr:last-child td { border-bottom: none; }
  td.right, th.right {
    text-align: var(--ht-val-align, right);
    font-variant-numeric: tabular-nums;
  }
  .unavailable {
    color: var(--secondary-text-color);
    font-style: italic;
  }
  .state-message {
    padding: 16px;
    color: var(--secondary-text-color);
    font-style: italic;
    text-align: center;
  }
  .error-message {
    padding: 12px 16px;
    color: var(--error-color, red);
    font-size: var(--ha-font-size-m);
    background: rgba(var(--rgb-error-color, 255,0,0), 0.05);
    border-left: 3px solid var(--error-color, red);
    margin: 8px 16px;
    border-radius: 2px;
  }
  .loading {
    padding: 16px;
    text-align: center;
    color: var(--secondary-text-color);
  }
  .card-content.loading-stale {
    position: relative;
  }
  .loading-stale-content {
    opacity: 0.45;
    filter: grayscale(0.2);
    pointer-events: none;
  }
  .loading-stale-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--ha-card-background, var(--card-background-color, white)) 35%, transparent);
    pointer-events: none;
    z-index: 4;
  }
  .loading-dots::after {
    content: '.';
    animation: dots 1.5s steps(3, end) infinite;
  }
  @keyframes dots {
    0%  { content: '.';   }
    33% { content: '..';  }
    66% { content: '...'; }
  }
  /* ── Sortierung ────────────────────────────────────────────── */
  thead th[data-col-idx] { cursor: pointer; }
  thead th[data-col-idx]:hover { color: var(--primary-color, var(--primary-text-color)); }
  .sort-icon {
    font-size: 9px;
    margin-left: 3px;
    opacity: 0.25;
    display: inline-block;
  }
  thead th.sort-active .sort-icon { opacity: 1; color: var(--primary-color, #03a9f4); }
  /* ── Transponierte Ansicht: sortierbare erste Spalte ───────── */
  td[data-trans-sort-row], th[data-trans-sort-row] { cursor: pointer; user-select: none; }
  td[data-trans-sort-row]:hover, th[data-trans-sort-row]:hover { color: var(--primary-color, #03a9f4); }
  td.sort-row-active .sort-icon, th.sort-row-active .sort-icon { opacity: 1 !important; color: var(--primary-color, #03a9f4); }
  /* ── Transponierte Ansicht: sticky erste Spalte ────────────── */
  .transposed-first {
    position: sticky;
    left: 0;
    z-index: 2;
    box-shadow: inset -3px 0 0 0 var(--divider-color, rgba(0,0,0,0.12));
  }
  /* Transponiert: sticky Kopfzeile (TH) – opake Farbe für Scroll-Schutz */
  ha-card.transposed thead th.transposed-first {
    background-image: linear-gradient(var(--ht-first-col-bg, transparent), var(--ht-first-col-bg, transparent));
    background-color: var(--ha-card-background, var(--card-background-color, white));
    color: var(--ht-first-col-text, inherit);
  }
  /* Transponiert: sticky 1. Spalte – Basisfarbe, Zebra, Hover */
  ha-card.transposed tbody td.transposed-first {
    background-image: linear-gradient(var(--ht-first-col-bg, transparent), var(--ht-first-col-bg, transparent));
    background-color: var(--ha-card-background, var(--card-background-color, white));
    color: var(--ht-first-col-text, inherit);
  }
  ha-card.transposed tbody tr:hover td.transposed-first {
    /* Divider im Hover-Zustand ausblenden: einheitliches Aussehen aller Zellen */
    box-shadow: inset 0 0 0 1000px var(--table-row-active-background-color,
      rgba(var(--rgb-primary-color, 3,169,244), 0.08));
  }
  /* ── Farb-Bullet (transponiert, eigene Spalte wie HA energy) ── */
  td.cell-bullet {
    width: 48px;
    min-width: 48px;
    box-sizing: border-box;
    padding: 0 0 0 16px;
    vertical-align: middle;
    overflow: visible;
    white-space: nowrap;
  }
  th.cell-bullet {
    width: 48px;
    min-width: 48px;
    box-sizing: border-box;
    padding: 0 0 0 16px;
    overflow: visible;
    white-space: nowrap;
  }
  .bullet {
    display: flex;
    align-items: center;
    width: 32px;
    height: 16px;
    box-sizing: border-box;
    border-radius: var(--ha-border-radius-sm, 4px);
    border-style: solid;
    border-width: 1px;
  }
  /* ── Bullet-Spalte sticky im transponierten Modus ──────────── */
  ha-card.transposed.has-bullet td.cell-bullet,
  ha-card.transposed.has-bullet th.cell-bullet {
    position: sticky;
    left: 0;
    z-index: 2;
  }
  /* Transponiert: Bullet-Spalte – Basisfarbe, Zebra, Hover */
  ha-card.transposed.has-bullet thead th.cell-bullet {
    background-image: linear-gradient(var(--ht-first-col-bg, transparent), var(--ht-first-col-bg, transparent));
    background-color: var(--ha-card-background, var(--card-background-color, white));
  }
  ha-card.transposed.has-bullet tbody td.cell-bullet {
    background-image: linear-gradient(var(--ht-first-col-bg, transparent), var(--ht-first-col-bg, transparent));
    background-color: var(--ha-card-background, var(--card-background-color, white));
  }
  /* .cell-bullet hover: td-Regel oben genügt (box-shadow überlagert bullet-background-color) */
  ha-card.transposed.has-bullet .transposed-first { left: 48px; }
  /* ── Sticky-Overrides ───────────────────────────────────────── */
  ha-card.no-sticky-header thead tr { position: static; }
  ha-card.no-sticky-first-col thead th:first-child:not(.cell-bullet),
  ha-card.no-sticky-first-col tbody td:first-child:not(.cell-bullet) { position: static; box-shadow: none; }
  ha-card.no-sticky-first-col .transposed-first { position: static; box-shadow: none; }
  ha-card:not(.transposed).no-sticky-first-col thead th:first-child:not(.cell-bullet) { font-weight: 400; }
  ha-card.transposed.no-sticky-first-col th.transposed-first { font-weight: 400; }
  ha-card.transposed.has-bullet.no-sticky-first-col td.cell-bullet,
  ha-card.transposed.has-bullet.no-sticky-first-col th.cell-bullet { position: static; }
  ha-card.transposed.has-bullet.no-sticky-first-col .transposed-first { left: 0; }
  /* ── Datumszellen (klickbar wenn Navigation aktiv) ─────────── */
  ha-card.has-nav td.date-cell { cursor: pointer; }
  ha-card.has-nav td.date-cell:hover {
    color: var(--primary-color, #03a9f4);
    text-decoration: underline;
  }
  /* ── Entity-Header/Spalte (klickbar wenn Sortierung deaktiviert) ──── */
  th[data-entity], td[data-entity] { cursor: pointer; }
  th[data-entity]:hover, td[data-entity]:hover {
    color: var(--primary-color, #03a9f4);
    text-decoration: underline;
  }
  /* Stunden-Drill-through (⏱ Hinweis bei period=hour + aggregation.hour=5minute) */
  td.date-cell.hour-drill::after {
    content: '⏱';
    font-size: 0.7em;
    opacity: 0.45;
    margin-left: 4px;
    vertical-align: middle;
  }
  /* aktiv ausgewählte Zeile: kein Link, aber farbige Hervorhebung */
  td.active-row {
    color: var(--primary-color, #03a9f4);
    font-weight: 500;
    cursor: default;
  }
  /* ── Toolbar-Buttons ───────────────────────────────────────── */
  .header-toolbar-btn {
    display: inline-flex;
    justify-content: center;
    min-width: 30px;
    height: 30px;
    font-size: 22px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--secondary-text-color);
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    transition: background 0.15s, color 0.15s;
    line-height: 1;
    padding: 0 2px;
    opacity: 0.8;    
    transition: opacity 0.15s;
  }

  .header-toolbar-btn:disabled {
    opacity: 0.25;
    cursor: default;
  }
  .header-toolbar-btn.zoom {
    font-size: 22px;
    min-width: 30px;
    height: 30px;
    margin-left:10px;
    border-radius: 4px;
  }
  .header-toolbar-btn.menu {
    margin-left:10px;
  }

  .header-toolbar-btn.back {
    font-size: 22px;
    min-width: 30px;
    height: 30px;
    border-radius: 4px;
    margin-right: 4px;
    flex-shrink: 0;
  }
  .header-toolbar-btn:hover { opacity: 1; }
  .header-toolbar-btn:hover:not(:disabled) {
    background: rgba(var(--rgb-primary-color, 3,169,244), 0.1);
    color: var(--primary-color, #03a9f4);
  }
  ha-list-item .muted {
    opacity: 0.5;
  }
  

  .header-toolbar-btn.reset {
    font-size: 22px;
    min-width: 30px;
    height: 30px;
    border: 1px solid var(--divider-color, rgba(0,0,0,0.15));
    border-radius: 4px;
  }
  .toolbar-loading {
    display: block;
    position: absolute;
    left: 4px;
    top: 4px;
    z-index: 2;
  }
  .toolbar-loading::before {
    content: '';
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--divider-color, rgba(0,0,0,0.2));
    border-top-color: var(--primary-color, #03a9f4);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .row-count-warning {
    background: color-mix(in srgb, var(--warning-color, #ff9800) 15%, transparent);
    border-left: 3px solid var(--warning-color, #ff9800);
    color: var(--primary-text-color);
    font-size: var(--ha-font-size-s, 12px);
    padding: 6px 10px;
    border-radius: 4px;
    margin-bottom: 8px;
  }
  /* ── Vergleichsmodus ───────────────────────────────────────── */
  .compare-val {
    opacity: 0.5;
    font-size: 0.85em;
    margin-right: 4px;
    margin-left: 0;
    font-variant-numeric: tabular-nums;
  }
  .compare-subtitle {
    display: block;
    font-size: var(--ha-font-size-s, 11px);
    opacity: 0.55;
    text-align: center;
    white-space: nowrap;
    line-height: 1.2;
    margin-bottom: -2px;
  }
  .compare-subtitle-vs {
    display: inline;
    opacity: 0.55;
    font-size: var(--ha-font-size-s, 11px);
  }
  .cell-multiline {
    white-space: pre-line;
    word-break: break-word;
    display: inline-block;
    max-width: 100%;
  }
`;

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * HTML-Escaping – verhindert XSS für alle aus Config / API geholten Strings.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

function _escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _normalizeTemplateVarName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  let v = raw
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+/, '_');
  if (!v) return '';
  if (!/^[A-Za-z_]/.test(v)) v = `_${v}`;
  return v;
}

function _replaceTemplateToken(template, oldName, newName) {
  if (!template || !oldName || !newName || oldName === newName) return template;
  const escOld = _escapeRegExp(oldName);
  const re = new RegExp(`(^|[^A-Za-z0-9_])(${escOld})(?=$|[^A-Za-z0-9_])`, 'g');
  return String(template).replace(re, `$1${newName}`);
}

function _sanitizeColumnsVariableNames(columns) {
  if (!Array.isArray(columns) || !columns.length) return columns;

  const copied = columns.map(c => ({
    ...c,
    ...(c && typeof c === 'object' && c.vars && typeof c.vars === 'object' ? { vars: { ...c.vars } } : {}),
  }));

  const used = new Set();
  const renameMap = new Map();
  const ensureUnique = (candidate) => {
    if (!candidate) return '';
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    let i = 2;
    while (used.has(`${candidate}_${i}`)) i += 1;
    const unique = `${candidate}_${i}`;
    used.add(unique);
    return unique;
  };

  // 1) Collect + sanitize aliases from col.variable and col.vars keys
  for (const col of copied) {
    if (!col || typeof col !== 'object') continue;

    const oldVar = String(col.variable || '').trim();
    if (oldVar) {
      const normalized = _normalizeTemplateVarName(oldVar);
      const next = ensureUnique(normalized);
      if (next) {
        col.variable = next;
        if (oldVar !== next) renameMap.set(oldVar, next);
      } else {
        delete col.variable;
      }
    }

    if (col.vars && typeof col.vars === 'object') {
      const nextVars = {};
      for (const [oldKey, val] of Object.entries(col.vars)) {
        const normalized = _normalizeTemplateVarName(oldKey);
        const next = ensureUnique(normalized);
        if (!next) continue;
        nextVars[next] = val;
        if (oldKey !== next) renameMap.set(oldKey, next);
      }
      col.vars = nextVars;
    }
  }

  if (renameMap.size > 0) {
    for (const col of copied) {
      if (!col || typeof col !== 'object') continue;
      const t = col.template || col.calc;
      if (!t) continue;
      let nextTemplate = String(t);
      for (const [oldName, newName] of renameMap.entries()) {
        nextTemplate = _replaceTemplateToken(nextTemplate, oldName, newName);
      }
      if ('template' in col || !('calc' in col)) col.template = nextTemplate;
      if ('calc' in col) col.calc = nextTemplate;
    }
    console.warn('[HistoryTableCard] Ungültige Variablennamen wurden normalisiert (erlaubt: A-Z, a-z, 0-9, _; Start mit Buchstabe/_).');
  }

  return copied;
}

function wrapMultilineCellContent(html) {
  if (html === null || html === undefined) return '';
  const text = String(html).replace(/&lt;br\s*\/??\s*&gt;/gi, '\n').replace(/<br\s*\/??\s*>/gi, '\n');
  if (!/[\r\n]/.test(text)) return text;
  return `<span class="cell-multiline">${text}</span>`;
}

/**
 * Returns extra inline style parts (text-align, padding) for a column config object.
 * Returns an array of CSS strings to spread into a styleAttr builder.
 */
function _colExtraStyle(col) {
  if (!col) return [];
  const parts = [];
  if (col.text_align) parts.push(`text-align:${col.text_align}`);
  if (col.padding_top    != null && col.padding_top    !== '') parts.push(`padding-top:${col.padding_top}px`);
  if (col.padding_right  != null && col.padding_right  !== '') parts.push(`padding-right:${col.padding_right}px`);
  if (col.padding_bottom != null && col.padding_bottom !== '') parts.push(`padding-bottom:${col.padding_bottom}px`);
  if (col.padding_left   != null && col.padding_left   !== '') parts.push(`padding-left:${col.padding_left}px`);
  return parts;
}

function _solidColorFromBg(rgba) {
  if (!rgba) return '';
  const m = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return rgba; // pass through e.g. named colors
  return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
}

/**
 * Lokalisiert Dezimalpunkte in einem Template-Ergebnis-String.
 * HA Jinja2 liefert Zahlen immer mit '.' – für de-DE etc. auf ',' umwandeln.
 */
function localizeDecimal(str, locale) {
  const decSep = new Intl.NumberFormat(locale).formatToParts(1.1)
    .find(p => p.type === 'decimal')?.value || '.';
  if (decSep === '.') return str;
  // Nur echte Dezimalstellen umwandeln (digit.digit), keine Versionsnummern o.ä. überschreiben
  return str.replace(/(\d)\.(\d)/g, `$1${decSep}$2`);
}

/**
 * Hängt die Einheit an, wenn der String ein reiner Zahlenwert ist (kein Text-Suffix).
 * Wird für clientseitig gerenderte Format-Templates verwendet, bei denen tryLocalTemplate
 * die Dezimalstellen bereits angewendet hat.
 */
function appendUnitIfNumeric(s, unit, locale) {
  if (!s || !unit) return s;
  const decSep = new Intl.NumberFormat(locale).formatToParts(1.1)
    .find(p => p.type === 'decimal')?.value || '.';
  const esc = decSep === '.' ? '\\.' : decSep;
  if (new RegExp(`^-?\\d+(?:${esc}\\d+)?$`).test(s.trim())) {
    return s.trim() + '\u202f' + unit;
  }
  return s;
}

/**
 * Rundet den numerischen Anteil eines Template-Ergebnisses auf decimals Stellen
 * und hängt bei Bedarf die Einheit an (nur wenn kein Text-Suffix vorhanden).
 * Wird für serverseitig gerenderte Templates verwendet.
 */
function applyDecimalsAndUnit(s, decimals, unit, locale) {
  if (!s) return s;
  const loc = locale || 'de-DE';
  const decSep = new Intl.NumberFormat(loc).formatToParts(1.1)
    .find(p => p.type === 'decimal')?.value || '.';
  const esc = decSep === '.' ? '\\.' : decSep;
  const m = s.trim().match(new RegExp(`^(-?\\d+(?:${esc}\\d+)?)(.*)$`, 's'));
  if (!m) return s;
  const numVal = parseFloat(m[1].replace(decSep, '.'));
  if (isNaN(numVal)) return s;
  const suffix = m[2].trim();
  const formatted = fmtNum(numVal, typeof decimals === 'number' ? decimals : null, loc);
  if (!suffix && unit) return formatted + '\u202f' + unit;
  return formatted + (suffix ? '\u202f' + suffix : '');
}

/**
 * Formatiert ein Datum gemäß Konfiguration und Periode.
 */
function formatDate(date, period, dateFormat, locale) {
  const loc = locale || 'de-DE';
  if (typeof dateFormat === 'object') {
    return new Intl.DateTimeFormat(loc, dateFormat).format(date);
  }
  // Custom formats that bypass Intl presets
  if (dateFormat === 'unixtimestamp') {
    return String(Math.floor(date.getTime() / 1000));
  }
  if (dateFormat === 'numeric_dt') {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  const presets = {
    short:  { year: 'numeric', month: '2-digit', day: '2-digit' },
    medium: { year: 'numeric', month: 'short',   day: 'numeric' },
    long:   { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' },
    full:   { weekday: 'long',  year: 'numeric', month: 'long', day: 'numeric' },
  };
  // Periods coarser than day use their own standalone format (no day component).
  if (period === 'year') {
    return new Intl.DateTimeFormat(loc, { year: 'numeric' }).format(date);
  }
  if (period === 'month') {
    const monthPresets = {
      short:  { year: 'numeric', month: '2-digit' },
      medium: { year: 'numeric', month: 'short' },
      long:   { year: 'numeric', month: 'long' },
      full:   { year: 'numeric', month: 'long' },
    };
    return new Intl.DateTimeFormat(loc, monthPresets[dateFormat] || monthPresets.short).format(date);
  }
  const periodExtras = {
    hour:      { hour: '2-digit', minute: '2-digit' },
    '5minute': { hour: '2-digit', minute: '2-digit' },
    week:      {},
  };
  return new Intl.DateTimeFormat(loc, {
    ...(presets[dateFormat] || presets.short),
    ...(periodExtras[period] || {}),
  }).format(date);
}

/**
/**
 * Lokalisiert eine Zahl mit exakter Nachkommastellen-Anzahl.
 * useGrouping: false verhindert Tausendertrennzeichen in der Tabelle.
 */
function fmtNum(value, decimals, locale) {
  const loc = locale || 'de-DE';
  if (typeof decimals === 'number') {
    return new Intl.NumberFormat(loc, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: false,
    }).format(value);
  }
  // Natürliche Präzision: nur Dezimaltrennzeichen lokalisieren
  const decSep = new Intl.NumberFormat(loc).formatToParts(1.1)
    .find(p => p.type === 'decimal')?.value || '.';
  const s = String(value);
  return decSep === '.' ? s : s.replace('.', decSep);
}

/**
 * Extrahiert den numerischen Wert eines einfachen Berechnungs-Templates,
 * Wertet ein Jinja2-ähnliches Template clientseitig aus und gibt den numerischen Wert zurück.
 * Wird für die Berechnung von "computed variable"-Werten in Calc-Spalten genutzt.
 *
 * Gibt null zurück wenn das Template nicht client-seitig auswertbar ist.
 * Sicherheitshinweis: Ausdruck stammt aus der Lovelace-Konfiguration des Administrators.
 */
function tryClientCalcNumeric(template, variables) {
  if (!template) return null;
  const tpl = template.trim();
  const m = tpl.match(/^\{\{\s*([\s\S]+?)\s*\}\}/);
  if (!m) return null;
  let working = m[1].trim();
  const filters = [];
  for (;;) {
    let depth = 0, pipeIdx = -1;
    for (let i = working.length - 1; i >= 0; i--) {
      const c = working[i];
      if      (c === ')' || c === ']') depth++;
      else if (c === '(' || c === '[') depth--;
      else if (c === '|' && depth === 0) { pipeIdx = i; break; }
    }
    if (pipeIdx < 0) break;
    filters.unshift(working.slice(pipeIdx + 1).trim());
    working = working.slice(0, pipeIdx).trim();
  }
  // Jinja2 → JavaScript expression transformations
  const coreExpr = working
    .replace(/\bTrue\b/g,  'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g,  'null')
    .replace(/\band\b/g,   '&&')
    .replace(/\bor\b/g,    '||')
    .replace(/\bnot\b/g,   '!')
    .replace(/^([\s\S]+?)\s+if\s+([\s\S]+?)\s+else\s+([\s\S]+)$/, '($2 ? $1 : $3)');
  try {
    // Only valid JS identifiers can be function parameters (dot-names like
    // stat_sensor.device are generated by the energy template and must be skipped).
    const VALID_ID = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    const varNames  = Object.keys(variables).filter(k => VALID_ID.test(k));
    const varValues = varNames.map(k => variables[k]);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...varNames, `'use strict'; return (${coreExpr});`);
    let result = fn(...varValues);
    for (const f of filters) {
      if      (f === 'max' && Array.isArray(result)) result = Math.max(...result);
      else if (f === 'min' && Array.isArray(result)) result = Math.min(...result);
      else if (f === 'abs')   result = Math.abs(result);
      else if (f === 'int')   result = Math.trunc(result);
      else if (f === 'float') result = parseFloat(result);
      else if (f === 'round') result = Math.round(result);
      else {
        const rm = f.match(/^round\((\d+)\)$/);
        if (rm) result = parseFloat(result.toFixed(parseInt(rm[1], 10)));
        else return null;
      }
    }
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch (_) {
    return null;
  }
}

/**
 * Clientseitige Auswertung eines Jinja2-ähnlichen Berechnungs-Templates.
 * Unterstützt: Variablen, Arithmetik, Listen [a, b], Filter | max | min | round(N) | abs | int
 * Gibt null zurück wenn das Template nicht client-seitig auswertbar ist.
 *
 * Sicherheitshinweis: Ausdrücke stammen ausschließlich aus der Lovelace-Konfiguration
 * des eingeloggten HA-Administrators – keine Endnutzer-Eingaben.
 */
function tryClientCalc(template, variables, locale, decimals) {
  if (!template) return null;
  const tpl = template.trim();

  // Plain text without {{ }} → literal string (matches Jinja2 behaviour)
  if (!tpl.includes('{{')) return tpl;

  const m = tpl.match(/^\{\{\s*([\s\S]+?)\s*\}\}([\s\S]*)$/);
  if (!m) return null;

  let expr    = m[1].trim();
  const suffix = m[2].trim();

  // Multi-block template (e.g. "{{ a }} {{ b }}") → cannot evaluate client-side
  if (suffix.includes('{{')) return null;

  // Pipe-Filter von rechts extrahieren (klammer-tiefenbewusst)
  const filters = [];
  let working = expr;
  for (;;) {
    let depth = 0, pipeIdx = -1;
    for (let i = working.length - 1; i >= 0; i--) {
      const c = working[i];
      if      (c === ')' || c === ']') depth++;
      else if (c === '(' || c === '[') depth--;
      else if (c === '|' && depth === 0) { pipeIdx = i; break; }
    }
    if (pipeIdx < 0) break;
    filters.unshift(working.slice(pipeIdx + 1).trim());
    working = working.slice(0, pipeIdx).trim();
  }

  // Jinja2 → JavaScript expression transformations
  const coreExpr = working
    .replace(/\bTrue\b/g,  'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g,  'null')
    // Logical operators
    .replace(/\band\b/g,   '&&')
    .replace(/\bor\b/g,    '||')
    .replace(/\bnot\b/g,   '!')
    // Jinja2 inline conditional: "A if B else C" → "(B ? A : C)"
    .replace(/^([\s\S]+?)\s+if\s+([\s\S]+?)\s+else\s+([\s\S]+)$/, '($2 ? $1 : $3)');

  try {
    // Only valid JS identifiers can be function parameters (dot-names like
    // stat_sensor.device are generated by the energy template and must be skipped).
    const VALID_ID = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    const varNames  = Object.keys(variables).filter(k => VALID_ID.test(k));
    const varValues = varNames.map(k => variables[k]);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...varNames, `'use strict'; return (${coreExpr});`);
    let result = fn(...varValues);

    let roundPrec = null;
    for (const f of filters) {
      if      (f === 'max' && Array.isArray(result)) { result = Math.max(...result); }
      else if (f === 'min' && Array.isArray(result)) { result = Math.min(...result); }
      else if (f === 'abs')   { result = Math.abs(result); }
      else if (f === 'int')   { result = Math.trunc(result); roundPrec = 0; }
      else if (f === 'float') { result = parseFloat(result); }
      else if (f === 'round') { result = Math.round(result); roundPrec = 0; }
      else {
        const rm = f.match(/^round\((\d+)\)$/);
        if (rm) { roundPrec = parseInt(rm[1], 10); result = parseFloat(result.toFixed(roundPrec)); }
        else return null; // unbekannter Filter → Server
      }
    }
    if (typeof result !== 'number' || !isFinite(result)) return null;
    const finalDecimals = typeof decimals === 'number' ? decimals : (roundPrec !== null ? roundPrec : null);
    return fmtNum(result, finalDecimals, locale) + (suffix ? '\u202f' + suffix : '');
  } catch (_) {
    return null; // Syntaxfehler im Ausdruck → Server
  }
}

/**
 * Einmalig ein Jinja2-Template serverseitig rendern via HA WebSocket API.
 * Gibt Promise<string> zurück; unsubscribed sofort nach dem ersten Ergebnis.
 *
 * Sicherheitshinweis: template und variables stammen ausschließlich aus der
 * Lovelace-Konfiguration des eingeloggten HA-Administrators – keine Endnutzer-Eingaben.
 */
function renderTemplate(hass, template, variables, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    let unsubFn = null;
    let settled = false;
    let timer   = null;

    const settle = (value, isError) => {
      if (settled) return;
      settled = true;
      if (timer) { clearTimeout(timer); timer = null; }
      if (unsubFn) { try { unsubFn(); } catch (_) {} unsubFn = null; }
      isError ? reject(value) : resolve(value);
    };

    // Timeout: verhindert endloses Warten bei hängenden WS-Subscriptions
    timer = setTimeout(() => settle(new Error('render_template timeout'), true), timeoutMs);

    hass.connection
      .subscribeMessage(
        (msg) => {
          if (settled) return;
          if (msg.error) {
            settle(new Error(String(msg.error.message || msg.error)), true);
          } else {
            const res = msg.result !== undefined ? String(msg.result) : '';
            // HA sendet Jinja2-Fehler (z.B. ZeroDivisionError) mit strict:false
            // manchmal als Ergebnis-String statt als msg.error → als Fehler behandeln
            if (/Error|Exception/i.test(res) && msg.result !== 0 && msg.result !== false) {
              settle(new Error(res), true);
            } else {
              settle(res, false);
            }
          }
        },
        { type: 'render_template', template, variables: variables || {}, strict: false },
      )
      .then((fn) => {
        unsubFn = fn;
        if (settled) { try { fn(); } catch (_) {} }
      })
      .catch((err) => settle(err, true));
  });
}

// ─── Haupt-Kartenklasse ───────────────────────────────────────────────────────

class HistoryTableCard extends HTMLElement {

  /** Kurzer i18n-Lookup für die Karten-Klasse (ohne Editor-Kontext). */
  _tr(key) {
    const lang = (this._hass?.language || 'en').split('-')[0].toLowerCase();
    const tr = EDITOR_TRANSLATIONS[lang] || EDITOR_TRANSLATIONS['en'];
    return tr[key] ?? EDITOR_TRANSLATIONS['en'][key] ?? key;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // Sofort einen Lade-Spinner zeigen, bevor _render() das erste Mal aufgerufen wird.
    // Verhindert das dunkle/leere Karten-Rechteck beim initialen Aufbau.
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { min-height: 60px; display: flex; align-items: center; justify-content: center; }
        .loading { padding: 16px; text-align: center; color: var(--secondary-text-color); }
        .loading-dots::after { content: '.'; animation: dots 1.5s steps(3,end) infinite; }
        @keyframes dots { 0%{content:'.'} 33%{content:'..'} 66%{content:'...'} }
      </style>
      <ha-card><div class="loading"><span class="loading-dots">Lade Daten</span></div></ha-card>`;

    this._config         = { ...DEFAULT_CONFIG };
    this._hass           = null;
    this._rawStats       = {};   // { entityId: [ ...stat rows ] }
    this._tableData      = [];   // columns-Modus: [{ start, iso, cells[] }]
    this._legacyStats    = {};   // entities-Modus: { entityId: [...] }
    this._loading        = false;
    this._error          = null;
    this._rowCountWarning = 0;   // expected rows > WARN threshold; 0 = no warning
    this._energyStart    = null;
    this._energyEnd      = null;
    this._energyUnsubFns  = [];
    this._energyRetry    = null;
    this._energyRetryCount = 0;
    this._energyHistory  = [];   // stack of {start,end} für Zurück-Funktion
    this._pendingNavRange = null;  // set by _applyPeriodToCollection; null = external change expected
    this._fetchTimer     = null;
    this._fetchSeq       = 0;     // monotonic request id to ignore stale async fetch responses
    this._initialized    = false;
    this._effectivePeriod = null; // durch _fetchStatistics / _getEffectivePeriod gesetzt
    this._transposed      = false;   // Ansicht transponieren: Zeilen = Entities, Spalten = Daten
    this._transSortRow    = null;    // Sortierzeile (Entity-Index) in transponierter Ansicht
    this._transSortDir    = 'asc';   // 'asc' | 'desc'
    this._stickyHeader    = true;    // runtime toggle: sticky header
    this._stickyFirstCol  = true;    // runtime toggle: sticky first column
    this._showColorBullet = false;   // runtime toggle: color bullet in transposed view
    this._cachedEnergyPrefs = null;  // cached result of energy/get_prefs for COL_ENERGY columns

  }

  // ── Lovelace Card API ──────────────────────────────────────────────────────

  static getConfigElement() {
    return document.createElement(`${CARD_TAG}-editor`);
  }

  static getStubConfig() {
    return {
      days_to_show: 7,
      columns: [
        { type: 'date', header: 'Datum' },
      ],
      // Aggregation: identisch zu getSuggestedPeriod() im HA Energy-Dashboard.
      // Zeitraum ≤ 3 d → hour-Stats, ≤ 10 d → day, ≤ 60 d → day,
      // ≤ 2 y → month, > 2 y → year (card-spezifisch, kein HA-Äquivalent).
      aggregation: {
        day:       'day',
        week:      'day',
        month:     'day',
        year:      'month',
        multiyear: 'year',
      },
    };
  }

  getCardSize() {
    const rows = this._isColumnsMode()
      ? this._tableData.length
      : Object.values(this._legacyStats).reduce((acc, a) => acc + a.length, 0);
    return Math.max(2, Math.min(Math.ceil(rows / 5) + 2, 10));
  }

  // ── Konfiguration ──────────────────────────────────────────────────────────

  setConfig(config) {
    if (!config.columns && !config.entity && !config.entities && !config.collection_key && !config.period && !config.follow_energy_picker) {
      throw new Error(
        '[HistoryTableCard] Bitte "columns", "entity", "entities" oder "collection_key" konfigurieren.'
      );
    }

    // Auto-upgrade: if entities: contains column-style entries (type, template, vars),
    // treat the whole list as columns: instead of the legacy entities: list.
    let normalizedConfig = config;
    if (!config.columns && Array.isArray(config.entities) &&
        config.entities.some(e => typeof e === 'object' && (e.type || e.template || e.vars))) {
      console.debug('[HistoryTableCard] "entities:" enthaelt Spalten-Eintraege (type/template/vars) → wird als "columns:" interpretiert.');
      normalizedConfig = { ...config, columns: config.entities, entities: undefined };
    }

    if (Array.isArray(normalizedConfig.columns)) {
      normalizedConfig = {
        ...normalizedConfig,
        columns: _sanitizeColumnsVariableNames(normalizedConfig.columns),
      };
    }

    this._config      = { ...DEFAULT_CONFIG, ...normalizedConfig };
    this._periodExplicit = 'period' in normalizedConfig;
    // ── Deprecated config key migration (silent backward compat) ──────────
    // Removed/renamed keys are silently mapped or dropped so old YAML keeps working.
    {
      const c = this._config;
      // show_zoom_buttons → show_zoom_out (renamed)
      if ('show_zoom_buttons' in c) {
        if (c.show_zoom_out === DEFAULT_CONFIG.show_zoom_out) c.show_zoom_out = c.show_zoom_buttons;
        delete c.show_zoom_buttons;
      }
      // disable_sort → enable_sort (inverted rename)
      if ('disable_sort' in c) {
        if (c.enable_sort === DEFAULT_CONFIG.enable_sort) c.enable_sort = !c.disable_sort;
        delete c.disable_sort;
      }
      // show_filter – removed feature, drop silently
      delete c.show_filter;
      // decimals – removed global precision; now per column/entity only
      delete c.decimals;
    }
    this._rawStats    = {};
    this._tableData   = [];
    this._legacyStats = {};
    this._error           = null;
    this._initialized     = false;
    this._effectivePeriod = null;
    // Standard-Sortierung aus Config übernehmen (überschreibbar per Klick)
    this._sortCol = this._config.sort_col != null ? Number(this._config.sort_col) : null;
    this._sortDir = this._config.sort_dir === 'desc' ? 'desc' : 'asc';
    // Layout: transponiert-Zustand aus Config initialisieren
    this._transposed   = (this._config.layout === 'horizontal');
    this._transSortRow = null;
    this._transSortDir = 'asc';
    this._energyHistory       = [];
    this._energyCompareStart   = null;
    this._energyCompareEnd     = null;
    this._compareRawStats      = {};
    this._compareRange         = null;
    this._compareOffset        = 0;
    // default_period = fixer Perioden-Override beim Laden (wie Dropdown "periode fixiert")
    this._periodOverride       = this._config.default_period || '';
    this._stickyHeader    = this._config.sticky_header    !== false;
    this._stickyFirstCol  = this._config.sticky_first_col !== false;
    this._showColorBullet = !!this._config.show_color_bullet;
    this._energyStart    = null;   // veraltete Werte aus vorheriger Session verwerfen
    this._energyEnd      = null;
    // Collection-Key könnte sich geändert haben → Subscription zurücksetzen
    this._teardownEnergySubscription();
    if (this._hass) {
      this._scheduleDataFetch();
      this._setupEnergySubscription();
    }
  }

  _isColumnsMode() {
    return Array.isArray(this._config.columns) && this._config.columns.length > 0;
  }

  _isDateOnlyMode() {
    if (this._isColumnsMode()) {
      // Date-only nur dann, wenn keine sichtbare Nicht-Datumsspalte vorhanden ist.
      // Wichtig: calc-/energy-Spalten ohne entity dürfen hier NICHT als date-only gelten.
      const hasVisibleValueColumn = (this._config.columns || []).some(col => {
        if (!col || col.hidden) return false;
        const isDateCol = col.type === COL_DATE
          || (!col.type && !col.entity && !col.template && !col.calc);
        return !isDateCol;
      });
      return !hasVisibleValueColumn;
    }
    return !this._config.entity && !(this._config.entities && this._config.entities.length);
  }

  // ── hass ──────────────────────────────────────────────────────────────────

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._scheduleDataFetch();
      this._setupEnergySubscription();
    }
  }

  get hass() { return this._hass; }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connectedCallback() {

    if (!this._hass) return;
    if (this._isEnergyMode()) {
      // Energy-Karte: Subscription immer neu aufbauen, da disconnectedCallback sie getrennt hat.
      // _setupEnergySubscription() ist idempotent – gibt sofort zurück wenn bereits subscribed.
      this._setupEnergySubscription();
    } else if (!this._initialized) {
      // Normale Stats-Karte: nur beim ersten Verbinden laden.
      this._scheduleDataFetch();
    }
  }

  disconnectedCallback() {

    this._teardownEnergySubscription();
    if (this._fetchTimer) {
      clearTimeout(this._fetchTimer);
      this._fetchTimer = null;
    }
  }

  // ── Energy-Date-Selection ─────────────────────────────────────────────────

  _setupEnergySubscription() {
    if (!this._isEnergyMode() || !this._hass) return;
    // Bereits aktiv subscribed – nichts tun
    if (this._energyUnsubFns.length > 0) return;
    // Laufenden Retry-Timer löschen (wird gleich ggf. neu gesetzt)
    if (this._energyRetry) {
      clearTimeout(this._energyRetry);
      this._energyRetry = null;
    }

    const rawKey  = this._config.collection_key;
    // connKey matches energy-custom.js: just prepend "_".
    // Default (no collection_key) uses panelUrl for HA >= 2026.4, "_energy" for older.
    const defaultKey = (this._hass.config?.version ?? '0') >= '2026.4'
      ? `_energy_${this._hass.panelUrl}`
      : '_energy';
    const connKey = rawKey ? `_${rawKey}` : defaultKey;

    // initial_period sofort in HA-localStorage schreiben – VOR dem Warten auf coll.
    // Die energy-date-selection-Card liest diesen Wert beim eigenen Initialisieren,
    // sodass sie die Collection bereits mit dem richtigen Zeitraum aufbaut.
    if (this._config.initial_period) {
      try { localStorage.setItem(`energy-default-period-${connKey}`, this._config.initial_period); } catch (_) {}
    }

    const coll    = this._hass.connection[connKey];

    if (!coll) {
      // Wiederholt versuchen (alle 500 ms, max. 40× = 20 Sekunden).
      // Die energy-date-selection-Karte erstellt die Collection erst beim
      // eigenen Initialisieren, was nach unserer Karte passieren kann.
      if (this._energyRetryCount < 40) {
        this._energyRetryCount++;
        this._energyRetry = setTimeout(() => this._setupEnergySubscription(), 500);
      } else {
        const availableKeys = Object.keys(this._hass.connection)
          .filter(k => k.startsWith('_energy'));
        console.warn(
          `[HistoryTableCard] Energy-Collection "${connKey}" nicht gefunden ` +
          `(nach 40 Versuchen). Verfügbare _energy*-Keys auf hass.connection: ` +
          `[${availableKeys.join(', ') || 'keine'}]. ` +
          'Prüfe collection_key in der Konfiguration und ob die energy-date-selection-Karte aktiv ist.'
        );
      }
      return;
    }

    // Collection gefunden – Retry-Zähler zurücksetzen
    this._energyRetryCount = 0;

    // Beim Subscribe: falls initial_period / custom_start_date / custom_end_date konfiguriert,
    // wird der Zeitraum EINMALIG auf die geteilte Collection angewendet (erster Card gewinnt,
    // shared Flag coll.__smcInitApplied). Alle Cards blockieren ihre Callbacks bis das Flag
    // gesetzt ist → nach Page-Reload zeigen alle Cards sofort die konfigurierte Zeitspanne.
    // Danach laufen alle Callbacks ungehindert: Cross-Card-Sync und Navigation funktionieren normal.
    // Ohne konfigurierte Range: kein Blocking, direkt dem Picker folgen.
    const initRange = this._computeLoadRange();

    try {
      const unsub = coll.subscribe((state) => {
        if (!state) return;
        // Callbacks blockieren bis init angewendet (verhindert Flash mit Picker-Default "heute").
        if (initRange && !coll.__smcInitApplied) return;

        // coll.start/end = vom Picker gesetzter Wert (immer aktuell).
        // state.start/end = HA-Backend-Antwort (kann normalisiert/null sein solange Fetch läuft).
        // → coll.start/end hat Vorrang, state.start/end als Fallback.
        const rawS = coll.start ?? state.start;
        const rawE = coll.end   ?? state.end;
        const s = rawS ? (rawS instanceof Date ? rawS : new Date(rawS)) : null;
        const e = rawE ? (rawE instanceof Date ? rawE : new Date(rawE)) : null;

        // Kein gültiger Start-Zeitpunkt → ignorieren (z.B. Zwischenzustand während Fetch).
        if (!s) return;

        // Vergleichszeitraum aus Energy-Picker
        // coll: compare_start / compare_end  (Collection-Objekt)
        // state: startCompare / endCompare   (EnergyData-State-Objekt)
        const rawCS = coll.compare_start ?? state.startCompare ?? null;
        const rawCE = coll.compare_end   ?? state.endCompare   ?? null;
        const cs = rawCS ? (rawCS instanceof Date ? rawCS : new Date(rawCS)) : null;
        const ce = rawCE ? (rawCE instanceof Date ? rawCE : new Date(rawCE)) : null;

        // Always consume pending nav marker. During internal navigation HA can briefly emit
        // compare_start/compare_end as null although compare mode is still active.
        const _pendingNav = this._pendingNavRange;
        this._pendingNavRange = null;

        // Preserve compare range across transient nulls during internal nav refresh.
        let nextCS = cs;
        let nextCE = ce;
        if (!nextCS && this._energyCompareStart && (_pendingNav || this._loading)) {
          nextCS = this._energyCompareStart;
          nextCE = this._energyCompareEnd;
        }

        // Millisekunden-Vergleich – präziser als String(), timezone-unabhängig.
        const prevS  = this._energyStart        ? this._energyStart.getTime()        : null;
        const prevE  = this._energyEnd          ? this._energyEnd.getTime()          : null;
        const prevCS = this._energyCompareStart ? this._energyCompareStart.getTime() : null;
        const prevCE = this._energyCompareEnd   ? this._energyCompareEnd.getTime()   : null;
        const changed = s.getTime() !== prevS
          || (e  ? e.getTime()  : null) !== prevE
          || (nextCS ? nextCS.getTime() : null) !== prevCS
          || (nextCE ? nextCE.getTime() : null) !== prevCE;
        if (changed) {
          if (!_pendingNav) {
            // Range changed by external picker → discard in-card navigation history
            this._energyHistory = [];
          }
          this._energyStart        = s;
          this._energyEnd          = e;
          this._energyCompareStart = nextCS;
          this._energyCompareEnd   = nextCE;
          this._scheduleDataFetch();
        }
      });
      this._energyUnsubFns.push(unsub);

      // Einmalig den konfigurierten Zeitraum setzen (erste Card die subscribed gewinnt).
      // Flag VOR refresh() setzen – auch bei synchronem Callback korrekt.
      // coll.refresh() feuert danach Callback an ALLE subscribed Cards → alle sync auf initRange.
      if (initRange && !coll.__smcInitApplied) {
        coll.__smcInitApplied = true;
        // initial_period in HA-localStorage schreiben → HA stellt den Zeitraum beim nächsten
        // Page-Reload selbst wieder her (genau wie energy-date-selection-Card).
        if (this._config.initial_period) {
          try { localStorage.setItem(`energy-default-period-${connKey}`, this._config.initial_period); } catch (_) {}
        }
        this._applyPeriodToCollection(coll, initRange.start, initRange.end);
      }

      console.debug(`[HistoryTableCard] Energy-Collection "${connKey}" subscribed.`);
    } catch (err) {
      console.warn('[HistoryTableCard] Energy-Subscription fehlgeschlagen:', err);
    }
  }

  _teardownEnergySubscription() {
    for (const fn of this._energyUnsubFns) { try { fn(); } catch (_) {} }
    this._energyUnsubFns   = [];
    this._energyRetryCount = 0;
    if (this._energyRetry) {
      clearTimeout(this._energyRetry);
      this._energyRetry = null;
    }
  }

  /**
   * Setzt start/end auf der Energy-Collection.
   * localStorage-Persistenz erfolgt separat über direkte localStorage.setItem()-Aufrufe
   * (kein coll.setPeriod – dessen API-Signatur erwartet ein HA-internes Period-Objekt,
   * nicht { start, end }).
   */
  _applyPeriodToCollection(coll, start, end) {
    this._pendingNavRange = { start, end };
    coll.start = start;
    coll.end   = end;
    coll.refresh();
  }

  /** Returns true when the card should follow an energy date picker. */
  _isEnergyMode() {
    return !!this._config.collection_key || !!this._config.follow_energy_picker;
  }

  /**
   * Gibt { coll, connKey } für die aktive Energy-Collection zurück.
   * Ohne energy mode: { coll: null, connKey: null }.
   * Ohne expliziten collection_key: panelUrl-Fallback wie energy-custom.js.
   */
  _getEnergyCollectionInfo() {
    if (!this._isEnergyMode()) return { coll: null, connKey: null };
    let connKey;
    if (this._config.collection_key) {
      connKey = `_${this._config.collection_key}`;
    } else {
      // follow_energy_picker ohne expliziten Key → panelUrl-Fallback (wie energy-custom.js)
      connKey = (this._hass?.config?.version ?? '0') >= '2026.4'
        ? `_energy_${this._hass?.panelUrl}`
        : '_energy';
    }
    return { coll: this._hass?.connection?.[connKey] ?? null, connKey };
  }

  // ── Datumsbereich ─────────────────────────────────────────────────────────

  /**
   * Parst einen Datumsstring (YYYY-MM-DD oder ISO) als lokales Mitternacht-Datum.
   * Gibt null zurück wenn leer oder ungültig.
   */
  _parseConfigDate(dateStr) {
    if (!dateStr) return null;
    // 'YYYY-MM-DD' explizit als lokale Zeit parsen (new Date('YYYY-MM-DD') würde UTC liefern)
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Zeitraum fürs initiale LADEN (Subscribe-Init, Page-Load).
   * initial_period hat Vorrang → Energie-Picker wird auf HA-native Periode gesetzt.
   * Fallback: custom_start_date / custom_end_date.
   */
  _computeLoadRange() {
    if (this._config.initial_period) {
      return this._resolveInitialPeriod(this._config.initial_period);
    }
    const startDate = this._parseConfigDate(this._config.custom_start_date);
    if (startDate) {
      const endDate = this._parseConfigDate(this._config.custom_end_date);
      return { start: startDate, end: endDate || new Date() };
    }
    return null;
  }

  /**
   * Zeitraum für den RESET-Button.
   * custom_start_date / custom_end_date hat Vorrang (fester Datumsbereich).
   * Fallback: initial_period.
   */
  _computeResetRange() {
    const startDate = this._parseConfigDate(this._config.custom_start_date);
    if (startDate) {
      const endDate = this._parseConfigDate(this._config.custom_end_date);
      return { start: startDate, end: endDate || new Date() };
    }
    if (this._config.initial_period) {
      return this._resolveInitialPeriod(this._config.initial_period);
    }
    // Fallback for days mode: reset to the configured days_to_show window
    if (this._config.days_to_show) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - this._config.days_to_show);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    return null;
  }

  /**
   * Konvertiert einen HA energy-date-selector Perioden-String in ein { start, end } Datumspaar.
   * Unterstützte Werte (identisch zu HA RANGE_KEYS):
   *   'today'        → heute (Tagesbeginn bis Tagesende)
   *   'yesterday'    → gestern (Tagesbeginn bis Tagesende)
   *   'this_week'    → Montag dieser Woche bis Sonntag
   *   'this_month'   → 1. dieses Monats bis letzter Tag
   *   'this_quarter' → 1. dieses Quartals bis letzter Tag
   *   'this_year'    → 1. Januar bis 31. Dezember
   *   'now-Nd'       → N Tage zurück bis heute (z.B. 'now-7d', 'now-30d', 'now-365d')
   *   'now-Nm'       → N Monate zurück bis heute (z.B. 'now-12m')
   */
  _resolveInitialPeriod(periodKey) {
    const now   = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    if (periodKey === 'today') {
      return { start: today, end: todayEnd };
    }
    if (periodKey === 'yesterday') {
      const s = new Date(today); s.setDate(s.getDate() - 1);
      const e = new Date(s);     e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    if (periodKey === 'this_week') {
      const dow  = today.getDay(); // 0=Sun
      const diff = dow === 0 ? -6 : 1 - dow; // shift to Monday
      const s = new Date(today); s.setDate(today.getDate() + diff);
      const e = new Date(s);     e.setDate(s.getDate() + 6); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    if (periodKey === 'this_month') {
      const s = new Date(today); s.setDate(1);
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e };
    }
    if (periodKey === 'this_quarter') {
      const q = Math.floor(today.getMonth() / 3);
      const s = new Date(today.getFullYear(), q * 3, 1);
      const e = new Date(today.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
      return { start: s, end: e };
    }
    if (periodKey === 'this_year') {
      const s = new Date(today.getFullYear(), 0, 1);
      const e = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start: s, end: e };
    }
    const md = /^now-(\d+)d$/.exec(periodKey);
    if (md) {
      const s = new Date(today); s.setDate(s.getDate() - parseInt(md[1], 10));
      return { start: s, end: new Date(now) };
    }
    const mm = /^now-(\d+)m$/.exec(periodKey);
    if (mm) {
      const s = new Date(today); s.setMonth(s.getMonth() - parseInt(mm[1], 10));
      return { start: s, end: new Date(now) };
    }
    console.warn(`[HistoryTableCard] Unbekannter initial_period-Wert: "${periodKey}". ` +
      'Unterstützte Werte: today, yesterday, this_week, this_month, this_quarter, this_year, now-7d, now-30d, now-365d, now-12m');
    return null;
  }

  _getDateRange() {
    if (this._config.start || this._config.end) {
      const end   = this._config.end   ? new Date(this._config.end) : new Date();
      const start = this._config.start ? new Date(this._config.start) : (() => {
        const s = new Date(end);
        s.setDate(s.getDate() - (this._config.days_to_show || 7));
        return s;
      })();
      return { start, end };
    }
    if (this._energyStart) {
      return { start: this._energyStart, end: this._energyEnd || new Date() };
    }
    // Standalone-Navigation: kein collection_key, aber custom_start_date oder initial_period konfiguriert.
    // Einmalig aus Config initialisieren; Navigation schreibt danach in _energyStart/End.
    if (!this._config.collection_key && (this._config.custom_start_date || this._config.initial_period)) {
      let s = null, e = null;
      if (this._config.custom_start_date) {
        s = this._parseConfigDate(this._config.custom_start_date);
        e = this._parseConfigDate(this._config.custom_end_date) || new Date();
      } else if (this._config.initial_period) {
        const range = this._resolveInitialPeriod(this._config.initial_period);
        if (range) { s = range.start; e = range.end; }
      }
      if (s) {
        this._energyStart = s;
        this._energyEnd   = e || new Date();
        return { start: s, end: this._energyEnd };
      }
    }
    // Kein Energy-Picker aktiv: days_to_show als Fallback
    const end   = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (this._config.days_to_show || 7));
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  /** Schätzt die Anzahl der Tabellenzeilen für eine gegebene Kombination aus Zeitraum + Periode. */
  _computeExpectedRows(start, end, period) {
    if (period === 'timespan') return 1;
    const ms = Math.max(0, end.getTime() - start.getTime());
    const periodMs = {
      '5minute': 5 * 60 * 1000,
      'hour':    60 * 60 * 1000,
      'day':     24 * 60 * 60 * 1000,
      'week':    7 * 24 * 60 * 60 * 1000,
      'month':   30 * 24 * 60 * 60 * 1000,
      'year':    365 * 24 * 60 * 60 * 1000,
    };
    return Math.ceil(ms / (periodMs[period] || (24 * 60 * 60 * 1000)));
  }


  // ── Datenabruf ────────────────────────────────────────────────────────────

  _scheduleDataFetch() {
    if (this._fetchTimer) clearTimeout(this._fetchTimer);
    this._fetchTimer = setTimeout(() => this._fetchStatistics(), 50);
  }

  _collectEntityIds() {
    if (this._isColumnsMode()) {
      const ids = new Set();
      for (const col of this._config.columns) {
        if (!col || typeof col !== 'object') continue;
        if (typeof col.entity === 'string' && col.entity.length > 0) ids.add(col.entity);
        if (col.type === COL_ENERGY && col.energy_key) {
          for (const eid of this._resolveEnergyEntityIds(col.energy_key)) ids.add(eid);
        }
        if (col.vars && typeof col.vars === 'object') {
          for (const v of Object.values(col.vars)) {
            if (!v || typeof v !== 'object') continue;
            const id = v.entity;
            if (typeof id === 'string' && id.length > 0) ids.add(id);
          }
        }
      }
      return [...ids];
    }
    const ents = this._config.entities ||
      (this._config.entity ? [this._config.entity] : []);
    const ids = ents.map(e => (typeof e === 'string' ? e : e.entity))
                    .filter(id => typeof id === 'string' && id.length > 0);
    const missing = ents.filter(e => typeof e === 'object' && !e.entity);
    if (missing.length) {
      console.debug('[HistoryTableCard] Entities-Eintraege ohne "entity"-Schluessel ignoriert:', missing);
    }
    return ids;
  }

  _collectStatTypes() {
    const defaultType = this._config.stat_type || 'mean';
    if (this._isColumnsMode()) {
      const types = new Set([defaultType]);
      for (const col of this._config.columns) {
        if (col.stat_type) types.add(col.stat_type);
        if (col.type === COL_ENERGY) types.add(col.stat_type || 'change');
        if (col.vars) {
          for (const v of Object.values(col.vars)) {
            if (typeof v === 'object' && v.stat_type) types.add(v.stat_type);
          }
        }
      }
      return [...types];
    }
    // Entities-Modus: auch per-Entity stat_type einsammeln
    const types = new Set([defaultType]);
    const ents = this._config.entities || (this._config.entity ? [this._config.entity] : []);
    for (const e of ents) {
      if (typeof e === 'object' && e.stat_type) types.add(e.stat_type);
    }
    return [...types];
  }

  async _fetchStatistics() {
    if (!this._hass) return;
    const fetchSeq = ++this._fetchSeq;
    const isStale = () => fetchSeq !== this._fetchSeq;

    // Warten bis der Energie-Date-Picker seinen Zustand geliefert hat (erster Subscription-Callback).
    if (this._config.collection_key && !this._energyStart) return;

    // Pre-load energy prefs before isDateOnlyMode check so energy entity IDs are known.
    const hasEnergyCol = (this._config.columns || []).some(c => c.type === COL_ENERGY);
    if (hasEnergyCol) await this._ensureEnergyPrefs();
    if (isStale()) return;

    // Datum-only-Modus: kein WS-Aufruf, nur Zeitachse generieren
    if (this._isDateOnlyMode()) {
      this._loading = true;
      this._error   = null;
      this._render();
      const { start, end } = this._getDateRange();
      const period = this._getEffectivePeriod(start, end);
      this._effectivePeriod = period;
      this._buildDateOnlyTimeline(start, end, period);
      if (isStale()) return;
      this._loading     = false;
      this._initialized = true;
      this._render();
      return;
    }

    const entityIds = this._collectEntityIds().filter(id => typeof id === 'string' && id.length > 0);
    if (!entityIds.length) {
      if (this._isColumnsMode()) {
        // Columns-only Konfiguration (z.B. nur date/calc) ohne Statistik-Entities:
        // kein WS-Call nötig, Tabelle direkt aus Zeitachse + Calc-Rendering aufbauen.
        this._loading = true;
        this._error   = null;
        this._render();
        this._rawStats = {};
        this._compareRawStats = {};
        this._compareRange    = null;
        this._compareOffset   = 0;
        await this._buildColumnsTableData();
        if (isStale()) return;
        this._loading     = false;
        this._initialized = true;
        this._render();
        return;
      }
      this._loading = false;
      // Check for common misconfiguration: calc entries placed in entities: instead of columns:
      const ents = this._config.entities || (this._config.entity ? [this._config.entity] : []);
      const hasCalcInEntities = ents.some(e => typeof e === 'object' && (e.type === 'calc' || e.template || e.vars));
      this._error = hasCalcInEntities
        ? 'Konfigurationsfehler: "type: calc"-Spalten muessen unter "columns:" stehen, nicht unter "entities:".'
        : 'Keine Entitaeten konfiguriert.';
      this._initialized = true;
      this._render();
      return;
    }

    this._loading = true;
    this._error   = null;
    this._render();

    const { start, end } = this._getDateRange();
    const period          = this._getEffectivePeriod(start, end);
    this._effectivePeriod = period;

    // Zeilenanzahl schätzen – vor dem WS-Aufruf warnen oder blockieren
    // type:energy-Spalten liefern ihre Daten aus schon voraggregrierten HA-Energiestatistiken –
    // mehrere Unter-Entities (z.B. 3 PV-Panels für pv_sum) werden client-seitig summiert,
    // zählen aber für die Performance-Schätzung wie 1 Spalte (nicht wie N Entities).
    const _energyEntityIds = new Set(
      this._isColumnsMode()
        ? (this._config.columns || []).flatMap(c =>
            c.type === COL_ENERGY && c.energy_key ? this._resolveEnergyEntityIds(c.energy_key) : []
          )
        : []
    );
    const _energyColCount = this._isColumnsMode()
      ? (this._config.columns || []).filter(c => c.type === COL_ENERGY && c.energy_key).length
      : 0;
    const _regularEntityCount = entityIds.filter(id => !_energyEntityIds.has(id)).length;
    const _entityCount   = Math.max(1, _regularEntityCount + _energyColCount);
    const _expectedRows  = this._computeExpectedRows(start, end, period);
    const _expectedPts   = _expectedRows * _entityCount;
    const _WARN_PTS  = 10000;
    const _BLOCK_PTS = 20000;
    // Wenn alle Spalten type:energy sind und Collection-Stats verfügbar sind, werden
    // die Daten aus dem Collection-Cache bedient (kein WS-Aufruf). In diesem Fall ist
    // die Datenpunkt-Begrenzung nicht anwendbar – die Daten sind bereits im Speicher.
    const _willReuseCollection = this._isEnergyMode()
      && !!this._collectionStats
      && _regularEntityCount === 0;
    this._rowCountWarning = (!_willReuseCollection && _expectedPts > _WARN_PTS) ? _expectedRows : 0;
    if (!_willReuseCollection && _expectedPts > _BLOCK_PTS) {
      const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000);
      this._loading = false;
      this._error   = `⚠ Zu viele Datenpunkte: ca. ${_expectedRows.toLocaleString()} Zeilen × ${_entityCount} Entität${_entityCount !== 1 ? 'en' : ''} = ${_expectedPts.toLocaleString()} Datenpunkte (Periode "${period}", ${spanDays} Tage). Bitte Zeitraum verkleinern oder eine längere Periode wählen.`;
      this._render();
      return;
    }

    // Periode validieren ('timespan' ist client-seitig, kein nativer HA-Wert)
    if (!VALID_PERIODS.has(period) && period !== 'timespan') {
      this._loading = false;
      this._error   = `Ungültiger period-Wert: "${period}". Gültige Werte: ${[...VALID_PERIODS].join(', ')}, timespan`;
      this._render();
      return;
    }

    // Stat-Typen validieren
    const rawStatTypes = this._collectStatTypes();
    const invalidTypes = rawStatTypes.filter(t => !VALID_STAT_TYPES.has(t));
    if (invalidTypes.length) {
      console.warn(`[HistoryTableCard] Ungültiger stat_type ignoriert: ${invalidTypes.map(t => `"${t}"`).join(', ')}`);
    }
    const statTypes = rawStatTypes.filter(t => VALID_STAT_TYPES.has(t));
    if (!statTypes.length) {
      this._loading = false;
      this._error   = `Kein gültiger stat_type konfiguriert ("${rawStatTypes.join(', ')}"). Gültige Werte: ${[...VALID_STAT_TYPES].join(', ')}`;
      this._render();
      return;
    }

    // 'year' und 'timespan' werden von HA nicht nativ unterstützt → client-seitig aggregieren
    const wsPeriod = period === 'year'     ? 'month'
                   : period === 'timespan' ? this._getTimespanFetchPeriod(start, end)
                   : period;

    try {
      const result = await this._hass.callWS({
        type:          'recorder/statistics_during_period',
        start_time:    start.toISOString(),
        end_time:      end.toISOString(),
        statistic_ids: entityIds,
        period:        wsPeriod,
        units:         {},
        types:         statTypes,
      });
      if (isStale()) return;

      this._rawStats = {};
      for (const id of entityIds) {
        const rows = result[id] || [];
        this._rawStats[id] = period === 'year'     ? this._aggregateToYear(rows, statTypes)
                           : period === 'timespan' ? this._aggregateToTimespan(rows, statTypes, start)
                           : rows;
      }

      // ── Vergleichszeitraum abrufen (kommt vom Energy-Picker) ──────────────
      const cmpStart = this._energyCompareStart;
      const cmpEnd   = this._energyCompareEnd;
      if (cmpStart) {
        this._compareRange  = { start: cmpStart, end: cmpEnd ?? new Date() };
        this._compareOffset = cmpStart.getTime() - start.getTime();
        try {
          const cmpResult = await this._hass.callWS({
            type:          'recorder/statistics_during_period',
            start_time:    cmpStart.toISOString(),
            end_time:      (cmpEnd ?? new Date()).toISOString(),
            statistic_ids: entityIds,
            period:        wsPeriod,
            units:         {},
            types:         statTypes,
          });
          if (isStale()) return;
          this._compareRawStats = {};
          for (const id of entityIds) {
            const rows = cmpResult[id] || [];
            this._compareRawStats[id] = period === 'year'     ? this._aggregateToYear(rows, statTypes)
                                      : period === 'timespan' ? this._aggregateToTimespan(rows, statTypes, cmpStart)
                                      : rows;
          }
        } catch (err) {
          console.warn('[HistoryTableCard] Vergleichsdaten konnten nicht geladen werden:', err);
          this._compareRawStats = {};
        }
      } else {
        this._compareRawStats = {};
        this._compareRange    = null;
        this._compareOffset   = 0;
      }

      if (this._isColumnsMode()) {
        await this._buildColumnsTableData();
        if (isStale()) return;
      } else {
        this._legacyStats = { ...this._rawStats };
      }

      if (isStale()) return;
      this._loading     = false;
      this._initialized = true;
      this._render();
    } catch (err) {
      if (isStale()) return;
      console.error('[HistoryTableCard] Fehler:', err);
      this._loading = false;
      this._error   = err.message || 'Unbekannter Fehler';
      this._render();
    }
  }

  // ── Columns-Modus: Tabellendaten aufbauen ─────────────────────────────────

  /**
   * Aggregiert Monats-Zeilen (von HA) zu Jahres-Zeilen (client-seitig).
   * HA unterstützt period='year' nicht nativ, daher holen wir Monate und
   * summieren / mitteln hier.
   *
   * Aggregationsregeln:
   *   change / sum / last_reset  → Summe der Monatswerte
   *   mean / state               → arithmetischer Mittelwert (nur nicht-null Monate)
   *   min                        → Minimum aller Monatswerte
   *   max                        → Maximum aller Monatswerte
   */
  _aggregateToYear(monthRows, statTypes) {
    // Gruppiere nach Kalenderjahr (UTC-Jahr aus ISO-String)
    const byYear = new Map();
    for (const row of monthRows) {
      const year = new Date(row.start).getFullYear();
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(row);
    }

    const result = [];
    for (const [year, rows] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
      // start = 1. Januar des Jahres, als ISO-String im selben Format wie HA
      const yearStart = new Date(year, 0, 1);
      const iso       = yearStart.toISOString();
      const out       = { start: iso };

      for (const st of statTypes) {
        const vals = rows.map(r => r[st]).filter(v => v !== null && v !== undefined);
        if (!vals.length) { out[st] = null; continue; }
        switch (st) {
          case 'change':
          case 'sum':
          case 'last_reset':
            out[st] = vals.reduce((a, b) => a + b, 0);
            break;
          case 'min':
            out[st] = Math.min(...vals);
            break;
          case 'max':
            out[st] = Math.max(...vals);
            break;
          case 'mean':
          case 'state':
          default:
            out[st] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
      }
      result.push(out);
    }
    return result;
  }

  /**
   * Gibt den geeigneten HA-Statistik-Abrufzeitraum für den "timespan"-Modus zurück.
   * Die Zeilen werden anschließend client-seitig zu einer einzigen Zeile aggregiert.
   */
  _getTimespanFetchPeriod(start, end) {
    const hours = (end - start) / 3600000;
    if (hours > 24 * 60) return 'month'; // > 60 Tage → Monatswerte
    if (hours > 48)      return 'day';   // > 2 Tage  → Tageswerte
    if (hours > 4)       return 'hour';  // > 4 Stunden → Stundenwerte
    return '5minute';
  }

  /**
   * Aggregiert ALLE übergebenen Zeilen zu einer einzigen Zeile (Zeitspanne).
   * Der Start der Ergebniszeile entspricht rangeStart.
   * Aggregationsregeln identisch zu _aggregateToYear.
   */
  _aggregateToTimespan(rows, statTypes, rangeStart) {
    if (!rows.length) return [];
    const iso = (rangeStart instanceof Date ? rangeStart : new Date(rangeStart)).toISOString();
    const out = { start: iso };
    for (const st of statTypes) {
      const vals = rows.map(r => r[st]).filter(v => v !== null && v !== undefined);
      if (!vals.length) { out[st] = null; continue; }
      switch (st) {
        case 'change':
        case 'sum':
        case 'last_reset':
          out[st] = vals.reduce((a, b) => a + b, 0);
          break;
        case 'min':
          out[st] = Math.min(...vals);
          break;
        case 'max':
          out[st] = Math.max(...vals);
          break;
        case 'mean':
        case 'state':
        default:
          out[st] = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
    }
    return [out];
  }

  /**
   * Erstellt this._tableData = [ { start: Date, iso: string, cells: string[] }, ... ]
   *
   *  - date-Spalten:    clientseitig formatiert
   *  - entity-Spalten:  clientseitig (tryLocalTemplate) oder render_template
   *  - calc-Spalten:    tryClientCalc (client-side) → render_template als Fallback
   *
   * Alle render_template-Aufrufe werden parallel gefeuert (Promise.allSettled).
   */
  async _buildColumnsTableData() {
    const columns         = this._config.columns;
    const period          = this._effectivePeriod || this._config.period || 'day';
    const locale          = this._hass?.language?.replace('_', '-') || 'de-DE';
    const defaultStatType = this._config.stat_type || 'mean';

    // Einheitliche Zeitachse aus allen Entities
    const timeMap = new Map();
    for (const rows of Object.values(this._rawStats)) {
      for (const row of rows) {
        if (!timeMap.has(row.start)) timeMap.set(row.start, new Date(row.start));
      }
    }
    const { end: endBoundary } = this._getDateRange();
    let timeline = [...timeMap.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([iso, date]) => ({ iso, date }))
      // HA recorder liefert manchmal die Zeile start==end_time mit (exklusive Grenze)
      .filter(t => t.date < endBoundary);

    // Fallback für Konfigurationen ohne entity/energy-Spalten (z.B. nur date + calc):
    // Zeitachse aus dem gewählten Bereich erzeugen, damit Calc-Spalten trotzdem gerendert werden.
    if (!timeline.length) {
      const { start: rangeStart, end: rangeEnd } = this._getDateRange();
      const cur = new Date(rangeStart);
      const pushRow = () => {
        const d = new Date(cur);
        timeline.push({ iso: d.toISOString(), date: d });
      };

      if (period === 'timespan') {
        pushRow();
      } else {
        cur.setHours(0, 0, 0, 0);
        // Gleiche Perioden-Normalisierung wie in _buildDateOnlyTimeline
        if (period === 'year') {
          cur.setMonth(0);
          cur.setDate(1);
        } else if (period === 'month') {
          cur.setDate(1);
        } else if (period === 'week') {
          const dow = cur.getDay(); // 0=So, 1=Mo, ...
          const diff = (dow === 0 ? -6 : 1 - dow);
          cur.setDate(cur.getDate() + diff);
        }

        while (cur < rangeEnd) {
          pushRow();
          switch (period) {
            case '5minute': cur.setMinutes(cur.getMinutes() + 5); break;
            case 'hour':    cur.setHours(cur.getHours() + 1);     break;
            case 'day':     cur.setDate(cur.getDate() + 1);       break;
            case 'week':    cur.setDate(cur.getDate() + 7);       break;
            case 'month':   cur.setMonth(cur.getMonth() + 1);     break;
            case 'year':    cur.setFullYear(cur.getFullYear() + 1); break;
            default:        cur.setDate(cur.getDate() + 1);
          }
        }
      }
    }

    if (!timeline.length) { this._tableData = []; return; }

    // Lookup-Cache: "entityId::statType" → Map<iso, number|null>
    const lookupCache = {};
    const getLookup = (entityId, statType) => {
      const key = `${entityId}::${statType}`;
      if (!lookupCache[key]) {
        const m = new Map();
        for (const row of this._rawStats[entityId] || []) {
          m.set(row.start, row[statType] ?? null);
        }
        lookupCache[key] = m;
      }
      return lookupCache[key];
    };

    // Zeilen initialisieren
    const rows = timeline.map(t => ({
      start:        t.date,
      iso:          t.iso,
      cells:        new Array(columns.length).fill(null),
      compareCells: new Array(columns.length).fill(null),
      compareDate:  null,
    }));

    const renderJobs = []; // { rowIdx, colIdx, promise }
    const getColType = col => col.type
      || (col.entity               ? COL_ENTITY : null)
      || (col.template || col.calc ? COL_CALC   : null)
      || COL_DATE;
    const colTypes = columns.map(getColType);

    // ── Phase 1: Rohe Alias-Werte (raw × factor, ohne Format-Transformation) ──────────────
    // Diese werden in entity-Spalten Format-Templates als Variablen übergeben.
    // Formeln wie "{{ consumption * 0.001 }}" erwarten hier den Rohwert in Wh.
    const rawAliasVals = rows.map(row => {
      const vars = {};
      for (const col of columns) {
        const variable = col.variable;
        if (!variable) continue;
        // Date column: expose formatted date string + ISO timestamp
        if (col.type === COL_DATE) {
          const dateFmt = col.date_format || this._config.date_format || 'short';
          vars[variable] = formatDate(row.start, period, dateFmt, locale);
          vars[`${variable}_iso`] = row.iso;
          continue;
        }
        // Energy column: sum of all underlying entity stats → kWh
        if (col.type === COL_ENERGY && col.energy_key) {
          const eids = this._resolveEnergyEntityIds(col.energy_key);
          const st   = col.stat_type || 'change';
          const unit = this._getEnergyColumnUnit(col, eids);
          let sum = 0;
          for (const eid of eids) {
            const raw = getLookup(eid, st).get(row.iso);
            sum += (raw !== undefined && raw !== null) ? raw * this._getEnergyEntityFactor(eid, col.factor, unit) : 0;
          }
          vars[variable] = sum;
          continue;
        }
        if (!col.entity) continue;
        const st  = col.stat_type || defaultStatType;
        const fac = col.factor ?? 1;
        const raw = getLookup(col.entity, st).get(row.iso);
        // Fehlende Werte als 0 (konsistent mit COL_CALC – Jinja2 kann mit None keine Arithmetik)
        vars[variable] = (raw !== undefined && raw !== null) ? raw * fac : 0;
        vars[`${variable}_state`] = this._hass?.states?.[col.entity] || null;
      }
      return vars;
    });

    // ── Calc-Alias: Zykluserkennung ────────────────────────────────────────────────────────
    // Calc-Spalten können Aliase anderer Calc-Spalten verwenden – aber keine Zyklen.
    // DFS-Färbung (0=weiß, 1=grau, 2=schwarz) über den Abhängigkeitsgraph.
    {
      const calcAliasCols = {};   // variable → col
      for (let ci = 0; ci < columns.length; ci++) {
        const col = columns[ci];
        const ct = colTypes[ci];
        if (ct === COL_CALC && col.variable) calcAliasCols[col.variable] = col;
      }
      const calcAliasSet   = new Set(Object.keys(calcAliasCols));
      const cycleAliases   = new Set();
      const colors         = {};
      for (const a of calcAliasSet) colors[a] = 0;
      const getCalcDeps = tpl => {
        const deps = new Set();
        for (const a of calcAliasSet) {
          if (new RegExp(`\\b${_escapeRegExp(a)}\\b`).test(tpl || '')) deps.add(a);
        }
        return deps;
      };
      const dfs = variable => {
        colors[variable] = 1;
        for (const dep of getCalcDeps(calcAliasCols[variable]?.template || calcAliasCols[variable]?.calc || '')) {
          if (colors[dep] === 1) { cycleAliases.add(dep); cycleAliases.add(variable); }
          else if (colors[dep] === 0) dfs(dep);
        }
        colors[variable] = 2;
      };
      for (const a of calcAliasSet) if (colors[a] === 0) dfs(a);
      // Spaltenindizes markieren
      this._cycleCalcColIndices = new Set();
      for (let ci = 0; ci < columns.length; ci++) {
        if (columns[ci].variable && cycleAliases.has(columns[ci].variable)) this._cycleCalcColIndices.add(ci);
      }
    }
    const cycleCalcColIndices = this._cycleCalcColIndices;

    // Calc-Spalten nach Alias-Abhängigkeiten auswerten statt nach YAML-Reihenfolge,
    // damit auch frühere Calc-Spalten Aliase späterer Calc-Spalten nutzen können.
    const calcAliasProviders = new Map(); // variable -> calc column index
    for (let ci = 0; ci < columns.length; ci++) {
      if (colTypes[ci] === COL_CALC && columns[ci].variable) calcAliasProviders.set(columns[ci].variable, ci);
    }
    const calcDepsByCol = new Map();
    const calcEvalOrder = [];
    const calcVisitState = new Map(); // 0=unseen, 1=visiting, 2=done
    const collectCalcDeps = template => {
      const deps = new Set();
      for (const [variable, providerIdx] of calcAliasProviders.entries()) {
        if (new RegExp(`\\b${_escapeRegExp(variable)}\\b`).test(template || '')) deps.add(providerIdx);
      }
      return deps;
    };
    for (let ci = 0; ci < columns.length; ci++) {
      if (colTypes[ci] !== COL_CALC) continue;
      calcDepsByCol.set(ci, collectCalcDeps(columns[ci].template || columns[ci].calc || ''));
      calcVisitState.set(ci, 0);
    }
    const visitCalc = ci => {
      const state = calcVisitState.get(ci);
      if (state === 2 || state === 1) return;
      calcVisitState.set(ci, 1);
      for (const depCi of calcDepsByCol.get(ci) || []) {
        if (depCi !== ci) visitCalc(depCi);
      }
      calcVisitState.set(ci, 2);
      calcEvalOrder.push(ci);
    };
    for (let ci = 0; ci < columns.length; ci++) {
      if (colTypes[ci] === COL_CALC) visitCalc(ci);
    }
    const orderedColumnIndices = [
      ...columns.map((_, ci) => ci).filter(ci => colTypes[ci] !== COL_CALC),
      ...calcEvalOrder,
    ];

    // Akkumulierte Calc-Alias-Werte (pro Spalte in Reihenfolge befüllt, damit nachfolgende
    // Calc-Spalten den Wert verwenden können – wie Entity-Alias, aber für Berechnungen).
    const calcAliasVals = rows.map(() => ({}));

    for (const ci of orderedColumnIndices) {
      const col = columns[ci];
      const colType = colTypes[ci];

      if (colType === COL_DATE) {
        // ── Datumsspalte ────────────────────────────────────────────────
        const dateFmt = col.date_format || this._config.date_format || 'short';
        if (period === 'timespan') {
          // Zeitspanne: "DD.MM.YYYY – DD.MM.YYYY"
          const { start: rStart, end: rEnd } = this._getDateRange();
          const displayEnd = (rEnd.getHours() === 0 && rEnd.getMinutes() === 0 &&
            rEnd.getSeconds() === 0 && rEnd.getMilliseconds() === 0)
            ? new Date(rEnd.getTime() - 1) : rEnd;
          const tsLabel = escapeHtml(
            formatDate(rStart, 'day', dateFmt, locale) + ' \u2013 ' + formatDate(displayEnd, 'day', dateFmt, locale)
          );
          for (let ri = 0; ri < rows.length; ri++) {
            rows[ri].cells[ci] = tsLabel;
          }
        } else {
          for (let ri = 0; ri < rows.length; ri++) {
            rows[ri].cells[ci] = escapeHtml(
              formatDate(rows[ri].start, period, dateFmt, locale)
            );
          }
        }
      } else if (colType === COL_ENTITY) {
        // ── Entity-Spalte ───────────────────────────────────────────────
        const entityId = col.entity;
        const statType = col.stat_type || defaultStatType;
        const decimals = col.decimals ?? 2;
        const factor   = col.factor    ?? 1;
        const unit     = col.hide_unit ? '' : (col.unit !== undefined && col.unit !== '' ? col.unit : (factor !== 1 ? '' : this._getUnit(entityId)));
        const lookup   = getLookup(entityId, statType);

        for (let ri = 0; ri < rows.length; ri++) {
          const rawVal = lookup.get(rows[ri].iso);
          const value  = (rawVal === undefined) ? null : (rawVal === null ? null : rawVal * factor);

          if (value === null) {
            rows[ri].cells[ci] = '<span class="unavailable">–</span>';
            continue;
          }

          rows[ri].cells[ci] = escapeHtml(
            `${fmtNum(value, decimals, locale)}${unit ? '\u202f' + unit : ''}`
          );
        }

      } else if (colType === COL_CALC) {
        // ── Berechnungsspalte ───────────────────────────────────────────
        const template = col.template || col.calc || '';
        const varDefs  = col.vars || {};
        const decimals = col.decimals ?? 2;
        const colUnit  = col.hide_unit ? '' : (col.unit || '');

        for (let ri = 0; ri < rows.length; ri++) {
          // Zirkuläre Alias-Abhängigkeit → Warnung statt Berechnung
          if (cycleCalcColIndices.has(ci)) {
            rows[ri].cells[ci] = '<span class="unavailable" title="Zirkuläre Alias-Abhängigkeit">⚠ loop</span>';
            continue;
          }

          const iso = rows[ri].iso;

          // Berechnungsspalten erhalten berechnete Alias-Werte (Format-Template-Ergebnisse
          // als Zahl), damit z.B. "used" = berechneter Verbrauch-Wert (12,94 kWh) statt
          // roher Sensor-Wert (12940 Wh). Rohwerte werden als Basis-Schicht beibehalten
          // (Fallback wenn kein computed-Wert verfügbar) – col.vars überschreiben zuletzt.
          // calcAliasVals: Werte früherer Calc-Alias-Spalten (Reihenfolge: Spaltenindex).
          const variables = { ...rawAliasVals[ri], ...calcAliasVals[ri] };

          // col.vars: explizite Entity-Referenzen (überschreiben Alias-Werte)
          for (const [variable, varDef] of Object.entries(varDefs)) {
            const vId     = typeof varDef === 'string' ? varDef : varDef.entity;
            const vType   = (typeof varDef === 'object' && varDef.stat_type)
              ? varDef.stat_type
              : defaultStatType;
            const vLookup = getLookup(vId, vType);
            const rawVal  = vLookup.get(iso);
            variables[variable] = (rawVal !== undefined && rawVal !== null)
              ? parseFloat(rawVal)
              : 0;
            variables[`${variable}_state`] = this._hass?.states?.[vId] || null;
          }

          // 1) Clientseitige Auswertung versuchen (kein WS-Call nötig)
          const clientResult = tryClientCalc(template, variables, locale, decimals);
          if (clientResult !== null) {
            rows[ri].cells[ci] = wrapMultilineCellContent(escapeHtml(clientResult + (colUnit ? `\u202f${colUnit}` : '')));
            // Alias-Wert für nachfolgende Calc-Spalten akkumulieren
            if (col.variable) {
              const nr = tryClientCalcNumeric(template, variables);
              if (nr !== null) calcAliasVals[ri][col.variable] = nr;
            }
            continue;
          }

          // 2) Schnell-Prüfung: Division durch Null vor WS-Call
          const divByZero = /\/\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
          let dzMatch;
          let hasDivZero = false;
          while ((dzMatch = divByZero.exec(template)) !== null) {
            const varName = dzMatch[1];
            if (varName in variables && variables[varName] === 0) {
              hasDivZero = true;
              break;
            }
          }
          if (hasDivZero) {
            rows[ri].cells[ci] = '<span class="unavailable" title="Division durch Null">–</span>';
          } else {
            // 3) Serverseitiges Jinja2-Rendering (Fallback für komplexe Templates)
            renderJobs.push({
              rowIdx:       ri,
              colIdx:       ci,
              postUnit:     colUnit,
              postDecimals: decimals,
              promise: renderTemplate(this._hass, template, variables),
            });
          }
        }
      } else if (colType === COL_ENERGY) {
        // ── Energie-Dashboard-Spalte ────────────────────────────────────
        const energyKey = col.energy_key;
        const eids      = this._resolveEnergyEntityIds(energyKey);
        const st        = col.stat_type || 'change';
        const decimals  = col.decimals ?? 2;
        const unit      = this._getEnergyColumnUnit(col, eids);

        for (let ri = 0; ri < rows.length; ri++) {
          let sum = 0; let anyData = false;
          for (const eid of eids) {
            const raw = getLookup(eid, st).get(rows[ri].iso);
            if (raw !== undefined && raw !== null) {
              sum += raw * this._getEnergyEntityFactor(eid, col.factor, unit);
              anyData = true;
            }
          }
          if (!eids.length || !anyData) {
            rows[ri].cells[ci] = '<span class="unavailable">–</span>';
            continue;
          }
          rows[ri].cells[ci] = escapeHtml(`${fmtNum(sum, decimals, locale)}${unit ? '\u202f' + unit : ''}`);
          // Alias: auch in calcAliasVals, damit nachfolgende calc-Spalten den Wert lesen können
          if (col.variable) calcAliasVals[ri][col.variable] = sum;
        }
      }
    }

    // Alle render_template-Aufrufe parallel abwarten
    if (renderJobs.length > 0) {
      const results = await Promise.allSettled(renderJobs.map(j => j.promise));
      for (let i = 0; i < renderJobs.length; i++) {
        const { rowIdx, colIdx, postUnit, postDecimals } = renderJobs[i];
        const outcome = results[i];
        if (outcome.status === 'fulfilled') {
          const localised = localizeDecimal(outcome.value, locale);
          const final = applyDecimalsAndUnit(localised, postDecimals, postUnit, locale);
            rows[rowIdx].cells[colIdx] = wrapMultilineCellContent(escapeHtml(final));
        } else {
          console.warn('[HistoryTableCard] render_template Fehler:', outcome.reason);
          rows[rowIdx].cells[colIdx] =
            '<span class="unavailable" title="Template-Fehler">–</span>';
        }
      }
    }

    // ── Vergleichs-Zellen vorberechnen (async, mit Alias-Variablen) ───────────────────────
    const compareActive = this._compareRange !== null && Object.keys(this._compareRawStats).length > 0;
    if (compareActive) {
      // Offset-Arithmetik: Monats-basiert für month/year, Tages-basiert sonst
      const usesMonthOffset = (period === 'month' || period === 'year');
      let offsetDays = 0, monthOffset = 0;
      if (usesMonthOffset) {
        const mainStart = this._energyStart || this._getDateRange().start;
        const cmpStart  = this._compareRange.start;
        monthOffset = (cmpStart.getFullYear() - mainStart.getFullYear()) * 12
                    + (cmpStart.getMonth()     - mainStart.getMonth());
      } else {
        offsetDays = Math.round(this._compareOffset / (24 * 3600000));
      }

      // Compare-Alias-Lookups: variable → Map<localDateKey, value>
      const cmpAliasLookups = {};
      for (const col of columns) {
        const variable = col.variable;
        if (!variable) continue;
        // Energy column: sum multiple entities → kWh per date key
        if (col.type === COL_ENERGY && col.energy_key) {
          const eids = this._resolveEnergyEntityIds(col.energy_key);
          const st   = col.stat_type || 'change';
          if (!cmpAliasLookups[variable]) cmpAliasLookups[variable] = new Map();
          for (const eid of eids) {
            const fac = this._getEnergyEntityFactor(eid, col.factor, col.unit);
            for (const row of (this._compareRawStats[eid] || [])) {
              const localKey = this._localDateKey(new Date(row.start));
              const val = row[st];
              const converted = (val !== null && val !== undefined) ? val * fac : 0;
              cmpAliasLookups[variable].set(localKey, (cmpAliasLookups[variable].get(localKey) ?? 0) + converted);
            }
          }
          continue;
        }
        if (!col.entity) continue;
        const st  = col.stat_type || defaultStatType;
        const fac = col.factor ?? 1;
        if (!cmpAliasLookups[variable]) cmpAliasLookups[variable] = new Map();
        for (const row of (this._compareRawStats[col.entity] || [])) {
          const localKey = this._localDateKey(new Date(row.start));
          const val = row[st];
          cmpAliasLookups[variable].set(localKey, (val !== null && val !== undefined) ? val * fac : 0);
        }
      }

      // Pro Zeile: Alias-Werte des Vergleichszeitraums aufsammeln
      const compareAliasVals = rows.map((row, ri) => {
        const cmpDate = usesMonthOffset
          ? new Date(row.start.getFullYear(), row.start.getMonth() + monthOffset, 1)
          : new Date(row.start.getFullYear(), row.start.getMonth(), row.start.getDate() + offsetDays);
        const cmpKey  = this._localDateKey(cmpDate);
        rows[ri].compareDate = cmpDate;
        const vars = {};
        for (const [variable, map] of Object.entries(cmpAliasLookups)) {
          vars[variable] = map.get(cmpKey) ?? 0;
        }
        return vars;
      });

      // Compare-Datum für Datumsspalten vorberechnen
      for (let ci = 0; ci < columns.length; ci++) {
        const col = columns[ci];
        const colType = colTypes[ci];
        if (colType !== COL_DATE) continue;
        const dateFmt = col.date_format || this._config.date_format || 'short';
        for (let ri = 0; ri < rows.length; ri++) {
          if (!rows[ri].compareDate) continue;
          rows[ri].compareCells[ci] = escapeHtml(formatDate(rows[ri].compareDate, period, dateFmt, locale));
        }
      }

      const compareRenderJobs = [];

      for (let ci = 0; ci < columns.length; ci++) {
        const col = columns[ci];
        const colType = colTypes[ci];
        if (colType !== COL_ENTITY || !col.entity) continue;

        const entityId = col.entity;
        const statType = col.stat_type || defaultStatType;
        const decimals = col.decimals ?? 2;
        const factor   = col.factor    ?? 1;
        const unit     = col.hide_unit ? '' : (col.unit !== undefined && col.unit !== '' ? col.unit : (factor !== 1 ? '' : this._getUnit(entityId)));
        const cmpLookup = this._buildCompareLookup(entityId, statType);

        for (let ri = 0; ri < rows.length; ri++) {
          const cmpRaw = cmpLookup.get(this._localDateKey(rows[ri].start));
          if (cmpRaw === null || cmpRaw === undefined) continue;
          const cmpVal = cmpRaw * factor;
          rows[ri].compareCells[ci] = escapeHtml(
            `${fmtNum(cmpVal, decimals, locale)}${unit ? '\u202f' + unit : ''}`
          );
        }
      }

      // Compare: Energie-Spalten
      for (let ci = 0; ci < columns.length; ci++) {
        const col = columns[ci];
        if (col.type !== COL_ENERGY || !col.energy_key) continue;
        const eids     = this._resolveEnergyEntityIds(col.energy_key);
        const st       = col.stat_type || 'change';
        const decimals = col.decimals ?? 2;
        const unit     = this._getEnergyColumnUnit(col, eids);

        for (let ri = 0; ri < rows.length; ri++) {
          const cmpKey = this._localDateKey(rows[ri].compareDate || new Date(0));
          let sum = 0; let anyData = false;
          if (col.variable && cmpAliasLookups[col.variable]) {
            // cmpAliasLookups already holds the summed + converted value for this variable
            sum     = cmpAliasLookups[col.variable].get(cmpKey) ?? 0;
            anyData = cmpAliasLookups[col.variable].has(cmpKey);
          } else {
            for (const eid of eids) {
              const fac = this._getEnergyEntityFactor(eid, col.factor, unit);
              const raw = this._compareRawStats[eid]?.find(r => this._localDateKey(new Date(r.start)) === cmpKey);
              if (raw?.[st] !== undefined && raw[st] !== null) { sum += raw[st] * fac; anyData = true; }
            }
          }
          if (!eids.length || !anyData) continue;
          rows[ri].compareCells[ci] = escapeHtml(`${fmtNum(sum, decimals, locale)}${unit ? '\u202f' + unit : ''}`);
        }
      }

      // Compare: Calc-Spalten
      const compareCalcAliasVals = rows.map(() => ({}));
      for (const ci of calcEvalOrder) {
        const col = columns[ci];
        const colType = colTypes[ci];
        if (colType !== COL_CALC) continue;
        if (cycleCalcColIndices.has(ci)) continue;

        const template = col.template || col.calc || '';
        const varDefs  = col.vars || {};
        const decimals = col.decimals ?? 2;
        const colUnit  = col.hide_unit ? '' : (col.unit || '');

        for (let ri = 0; ri < rows.length; ri++) {
          const cmpKey = this._localDateKey(rows[ri].compareDate || new Date(0));
          const variables = { ...compareAliasVals[ri], ...compareCalcAliasVals[ri] };

          // Explicit col.vars from compare raw stats
          for (const [variable, varDef] of Object.entries(varDefs)) {
            const vId    = typeof varDef === 'string' ? varDef : varDef.entity;
            const vType  = (typeof varDef === 'object' && varDef.stat_type) ? varDef.stat_type : defaultStatType;
            const vRows  = this._compareRawStats[vId] || [];
            const vRow   = vRows.find(r => this._localDateKey(new Date(r.start)) === cmpKey);
            const rawVal = vRow?.[vType];
            variables[variable] = (rawVal !== undefined && rawVal !== null) ? parseFloat(rawVal) : 0;
            variables[`${variable}_state`] = this._hass?.states?.[vId] || null;
          }

          const clientResult = tryClientCalc(template, variables, locale, decimals);
          if (clientResult !== null) {
            rows[ri].compareCells[ci] = escapeHtml(clientResult + (colUnit ? `\u202f${colUnit}` : ''));
            if (col.variable) {
              const nr = tryClientCalcNumeric(template, variables);
              if (nr !== null) compareCalcAliasVals[ri][col.variable] = nr;
            }
          } else {
            const divByZero = /\/\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
            let dzMatch; let hasDivZero = false;
            while ((dzMatch = divByZero.exec(template)) !== null) {
              if (variables[dzMatch[1]] === 0) { hasDivZero = true; break; }
            }
            if (!hasDivZero) {
              compareRenderJobs.push({
                rowIdx:       ri,
                colIdx:       ci,
                postUnit:     colUnit,
                postDecimals: decimals,
                isCompare:    true,
                promise: renderTemplate(this._hass, template, variables),
              });
            }
          }
        }
      }

      if (compareRenderJobs.length > 0) {
        const cmpResults = await Promise.allSettled(compareRenderJobs.map(j => j.promise));
        for (let i = 0; i < compareRenderJobs.length; i++) {
          const { rowIdx, colIdx, postUnit, postDecimals } = compareRenderJobs[i];
          const outcome = cmpResults[i];
          if (outcome.status === 'fulfilled') {
            const localised = localizeDecimal(outcome.value, locale);
            const final = applyDecimalsAndUnit(localised, postDecimals, postUnit, locale);
            rows[rowIdx].compareCells[colIdx] = wrapMultilineCellContent(escapeHtml(final));
          }
          // rejected → null bleibt, kein Vergleichswert angezeigt
        }
      }
    }

    this._tableData = rows;
  }

  // ── Hilfsmethoden ─────────────────────────────────────────────────────────

  _getUnit(entityId) {
    return this._hass?.states[entityId]?.attributes?.unit_of_measurement || '';
  }

  _getFriendlyName(entityId, entityConf) {
    if (entityConf?.name) return entityConf.name;
    return this._hass?.states[entityId]?.attributes?.friendly_name || entityId;
  }

  /**
   * Gibt true zurück wenn diese Spalte serverseitiges Jinja2-Rendering benötigt
   * (= tryLocalTemplate / tryClientCalc schlagen fehl).
   * Wird im Edit-Mode genutzt, um die Spaltenüberschrift mit "(s)" zu markieren.
   */
  _colNeedsServerRender(col) {
    const colType = col.type
      || (col.entity               ? COL_ENTITY : null)
      || (col.template || col.calc ? COL_CALC   : null)
      || COL_DATE;
    if (colType === COL_DATE)   return false;
    if (colType === COL_ENERGY) return false;  // energy columns always render client-side
    // Build dummy variables for all column aliases (numeric only, value 1)
    const dummyVars = { value: 1 };
    (this._config?.columns || []).forEach(c => { if (c.variable) dummyVars[c.variable] = 1; });
    if (colType === COL_ENTITY) return false;
    if (colType === COL_CALC) {
      const template = col.template || col.calc || '';
      if (!template) return false;
      Object.keys(col.vars || {}).forEach(a => { dummyVars[a] = 1; });
      // Note: dummyVars may contain dot-named keys (e.g. stat_sensor.device from the energy
      // template). tryClientCalc already filters those out internally via VALID_ID, so the
      // dummy check is safe.
      try { return tryClientCalc(template, dummyVars, 'en', 2) === null; } catch (_) { return true; }
    }
    return false;
  }

  // ── Aggregationsperiode ──────────────────────────────────────────────────

  /**
   * Leitet den "Ansichts-Zeitraum" aus der Zeitspanne start→end ab.
   * Rückgabe: 'hour' | 'day' | 'week' | 'month' | 'year'
   */
  _deriveViewPeriod(start, end) {
    const hours = (end - start) / 3600000;
    if (hours <= 4)     return 'hour';
    if (hours <= 48)    return 'day';
    if (hours <= 240)   return 'week';       // ≤ 10 Tage
    if (hours <= 1440)  return 'month';      // ≤ 60 Tage
    if (hours <= 17520) return 'year';       // ≤ 730 Tage (2 Jahre)
    return 'multiyear';                      // > 2 Jahre
  }

  /**
   * Bestimmt die effektive Statistikperiode für recorder/statistics_during_period.
   *
   * Konfiguration (optional) – flache Map, keine Unterscheidung nach Picker/manuell:
   *   aggregation:
   *     hour:      hour       # Zeitraum ≤ 4h   → stats mit 'hour'
   *     day:       hour       # Zeitraum ≤ 2d   → stats mit 'hour'
   *     week:      hour       # Zeitraum ≤ 10d  → stats mit 'hour'
   *     month:     day        # Zeitraum ≤ 60d  → stats mit 'day'
   *     year:      month      # Zeitraum ≤ 2y   → stats mit 'month'
   *     multiyear: year       # Zeitraum > 2y   → stats mit 'year'
   *
   * Fallback: config.period || 'day'
   */
  _getEffectivePeriod(start, end) {
    if (this._periodOverride) return this._periodOverride;

    // Eingebaute Default-Aggregation: greift wenn kein aggregation:-Block konfiguriert ist.
    // Entspricht den Standardwerten, die der Editor in der Aggregationstabelle anzeigt.
    const DEFAULT_AGG = { hour: 'hour', day: 'day', week: 'day', month: 'day', year: 'month', multiyear: 'year' };

    const agg = this._config.aggregation;
    const viewPeriod = this._deriveViewPeriod(start, end);

    if (!agg) {
      // Kein aggregation-Block: wenn der User 'period:' explizit gesetzt hat, diesen Wert
      // verwenden; sonst automatisch anhand des Zeitraums wählen.
      return this._periodExplicit ? this._config.period : (DEFAULT_AGG[viewPeriod] || 'day');
    }

    // Flache Map: aggregation.hour / aggregation.day / …
    // Rückwärtskompatibel: energy_picker-Unter-Objekt wird auch noch gelesen.
    const map = (agg.hour !== undefined || agg.day !== undefined || agg.month !== undefined)
      ? agg
      : (agg.energy_picker || null);

    if (map) {
      return map[viewPeriod] || DEFAULT_AGG[viewPeriod] || this._config.period || 'day';
    }

    // Altes 'manual'-Schlüsselwort als letzter Fallback
    if (agg.manual) return agg.manual;

    return this._periodExplicit ? this._config.period : (DEFAULT_AGG[viewPeriod] || 'day');
  }

  _getNextLowerPeriod(period) {
    const map = {
      year: 'month',
      month: 'day',
      week: 'day',
      day: 'hour',
      hour: 'hour',
      '5minute': '5minute',
      timespan: 'day',
    };
    return map[period] || 'day';
  }

  // ── Energy-Periode setzen ───────────────────────────────────────────────────

  /**
   * Setzt die energy-date-selection auf den Zeitraum, der durch den geklickten
   * Datumswert und die effektive Statistikperiode definiert wird.
   */
  _setEnergyPeriod(rowStart) {
    const { coll } = this._getEnergyCollectionInfo();
    if (this._config.collection_key && !coll) return;

    const period   = this._effectivePeriod || this._config.period || 'day';
    const targetPeriod = this._periodOverride || period;
    const newStart = new Date(rowStart);
    const newEnd   = new Date(rowStart);

    switch (period) {
      case '5minute': newEnd.setTime(newEnd.getTime() + 5 * 60000); break;
      case 'hour':    newEnd.setHours(newEnd.getHours() + 1);       break;
      case 'day':
        newStart.setHours(0, 0, 0, 0);
        newEnd.setTime(newStart.getTime());
        newEnd.setDate(newEnd.getDate() + 1);
        newEnd.setMilliseconds(newEnd.getMilliseconds() - 1);
        break;
      case 'week':
        newStart.setHours(0, 0, 0, 0);
        newEnd.setTime(newStart.getTime());
        newEnd.setDate(newEnd.getDate() + 7);
        newEnd.setMilliseconds(newEnd.getMilliseconds() - 1);
        break;
      case 'month':
        newStart.setDate(1);
        newStart.setHours(0, 0, 0, 0);
        newEnd.setTime(newStart.getTime());
        newEnd.setMonth(newEnd.getMonth() + 1);
        newEnd.setMilliseconds(newEnd.getMilliseconds() - 1);
        break;
      case 'year':
        newStart.setMonth(0, 1);
        newStart.setHours(0, 0, 0, 0);
        newEnd.setTime(newStart.getTime());
        newEnd.setFullYear(newEnd.getFullYear() + 1);
        newEnd.setMilliseconds(newEnd.getMilliseconds() - 1);
        break;
      default:        newEnd.setDate(newEnd.getDate() + 1);
    }

    // Bereits aktiver Zeitraum: nur dann abbrechen, wenn sich auch die Periode nicht ändert.
    // So funktioniert Drilldown day->hour auch beim Klick auf den aktuell aktiven Tag.
    if (this._energyStart && this._energyEnd &&
        this._energyStart.getTime() === newStart.getTime() &&
        this._energyEnd.getTime()   === newEnd.getTime()) {
      const activePeriod = this._effectivePeriod || this._config.period || 'day';
      if (targetPeriod !== activePeriod) {
        this._scheduleDataFetch();
        return;
      }
      return;
    }

    // Aktuellen Zeitraum vor dem Wechsel sichern
    if (this._energyStart) {
      this._energyHistory.push({ start: new Date(this._energyStart), end: new Date(this._energyEnd || new Date()) });
      if (this._energyHistory.length > 20) this._energyHistory.shift();
    } else {
      // Erster Klick aus dem Standard-Zustand (days-Modus ohne energyStart): Reset-Bereich sichern
      const resetRange = this._computeResetRange();
      if (resetRange) {
        this._energyHistory.push({ start: resetRange.start, end: resetRange.end });
      }
    }

    // Sofort Loading-State setzen
    this._loading = true;
    this._render();

    try {
      if (coll) this._applyPeriodToCollection(coll, newStart, newEnd);
    } catch (err) {
      console.warn('[HistoryTableCard] Energy-Periode setzen fehlgeschlagen:', err);
    }
    this._energyStart = newStart;
    this._energyEnd   = newEnd;
    this._scheduleDataFetch();
  }

  /**
   * Stellt den vorherigen Zeitraum aus dem History-Stack wieder her.
   */
  _goBackEnergyPeriod() {
    if (!this._energyHistory.length) return;
    const { start, end } = this._energyHistory.pop();
    const { coll } = this._getEnergyCollectionInfo();
    if (this._config.collection_key && !coll) return;
    this._loading = true;
    this._render();
    try {
      if (coll) this._applyPeriodToCollection(coll, start, end);
    } catch (err) {
      console.warn('[HistoryTableCard] Energy-Back fehlgeschlagen:', err);
    }
    this._energyStart = start;
    this._energyEnd   = end;
    this._scheduleDataFetch();
  }

  /**
   * Verschiebt den gesamten Zeitraum um die aktuelle Spanne vorwärts oder rückwärts.
   * Start und End werden gleichzeitig verschoben; die Spannengröße bleibt erhalten.
   *
   *  direction = +1  → nächste Zeitspanne
   *  direction = -1  → vorherige Zeitspanne
   *
   * Beispiele (direction = +1):
   *   01.01.2026 – 01.01.2027 (12 Mon.) → 01.01.2027 – 01.01.2028
   *   01.01.2026 – 16.02.2026 (46 Tage) → 16.02.2026 – 03.04.2026
   *   01.03.2026 – 01.04.2026 (1 Mon.)  → 01.04.2026 – 01.05.2026
   */
  _shiftPeriod(direction) {
    const { coll } = this._getEnergyCollectionInfo();
    if (this._config.collection_key && !coll) return;

    const { start, end } = this._getDateRange();
    let newStart, newEnd;

    if (this._isCalendarMonth(start, end)) {
      // Exakter Kalendermonat → sauber zum nächsten/vorherigen Monat springen
      newStart = new Date(start.getFullYear(), start.getMonth() + direction, 1);
      newEnd   = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0,
                          end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds());
    } else {
    const months = this._monthsBetween(start, end);
    if (months >= 1) {
      // Monate verschieben: Monatsgrenzen bleiben sauber
      newStart = new Date(start);
      newStart.setMonth(newStart.getMonth() + direction * months);
      newEnd = new Date(end);
      newEnd.setMonth(newEnd.getMonth() + direction * months);
    } else {
      const spanMs = end.getTime() - start.getTime();
      const days   = Math.round(spanMs / (24 * 3600000));
      if (days >= 1) {
        // Tage verschieben
        newStart = new Date(start);
        newStart.setDate(newStart.getDate() + direction * days);
        newEnd = new Date(end);
        newEnd.setDate(newEnd.getDate() + direction * days);
      } else {
        // Sub-Tages-Spanne (Stunden): ms-Arithmetik
        newStart = new Date(start.getTime() + direction * spanMs);
        newEnd   = new Date(end.getTime()   + direction * spanMs);
      }
    }
    }

    if (this._energyStart) {
      this._energyHistory.push({ start: new Date(this._energyStart), end: new Date(this._energyEnd || new Date()) });
    } else {
      this._energyHistory.push({ start: new Date(start), end: new Date(end) });
    }
    if (this._energyHistory.length > 20) this._energyHistory.shift();
    this._loading = true;
    this._render();
    try {
      if (coll) this._applyPeriodToCollection(coll, newStart, newEnd);
    } catch (err) {
      console.warn('[HistoryTableCard] Zeitraum verschieben fehlgeschlagen:', err);
    }
    this._energyStart = newStart;
    this._energyEnd   = newEnd;
    this._scheduleDataFetch();
  }

  /**
   * Verdoppelt den aktuellen Zeitraum (Zoom-Out).
   * End-Datum bleibt fest; Start wird so weit nach hinten verschoben,
   * dass die neue Spanne doppelt so groß ist wie die aktuelle.
   */
  _zoomOutPeriod() {
    const { coll } = this._getEnergyCollectionInfo();
    if (this._config.collection_key && !coll) return;

    const { start, end } = this._getDateRange();
    const newStart = this._scaleSpanStart(start, end, 2);
    // Kein Fortschritt möglich (min. Einheit bereits erreicht) → keine Aktion
    if (newStart.getTime() === start.getTime()) return;

    if (this._energyStart) {
      this._energyHistory.push({ start: new Date(this._energyStart), end: new Date(this._energyEnd || new Date()) });
    } else {
      this._energyHistory.push({ start: new Date(start), end: new Date(end) });
    }
    if (this._energyHistory.length > 20) this._energyHistory.shift();
    this._loading = true;
    this._render();
    try {
      if (coll) this._applyPeriodToCollection(coll, newStart, new Date(end));
    } catch (err) {
      console.warn('[HistoryTableCard] Zoom-Out fehlgeschlagen:', err);
    }
    this._energyStart = newStart;
    this._energyEnd   = new Date(end);
    this._scheduleDataFetch();
  }

  /**
   * Setzt die Collection auf den konfigurierten initialen Zeitraum zurück.
   */
  _resetToInitialRange() {
    const { coll, connKey } = this._getEnergyCollectionInfo();
    if (this._config.collection_key && !coll) return;

    const defaultPeriod = this._config.default_period || '';
    const periodChanged = (this._periodOverride || '') !== defaultPeriod;

    // Zurücksprung zum Zustand VOR dem ersten Klick auf einen Datumslink.
    // history[0] = der Zeitraum, der aktiv war bevor der erste Klick erfolgte
    // (z. B. der vom Energy-Picker gewählte Monat). Fallback: konfigurierter Standardbereich.
    const initRange = this._energyHistory.length > 0
      ? this._energyHistory[0]
      : this._computeResetRange();
    if (!initRange && !periodChanged) return;

    // Reset: History leeren (kein Zurück mehr möglich) und Zustand zurücksetzen
    this._energyHistory = [];
    // Revert to configured default period on reset (e.g. timespan).
    this._periodOverride = defaultPeriod;

    // If only the period was changed (no range baseline available), reset period only.
    if (!initRange) {
      this._scheduleDataFetch();
      this._render();
      return;
    }

    this._loading = true;
    this._render();
    try {
      this._energyStart = initRange.start;
      this._energyEnd   = initRange.end;
      // initial_period in HA-localStorage schreiben (nur mit collection_key).
      if (coll && connKey && this._config.initial_period && !this._config.custom_start_date) {
        try { localStorage.setItem(`energy-default-period-${connKey}`, this._config.initial_period); } catch (_) {}
      }
      if (coll) this._applyPeriodToCollection(coll, initRange.start, initRange.end);
      this._scheduleDataFetch();
    } catch (err) {
      console.warn('[HistoryTableCard] Reset fehlgeschlagen:', err);
    }
  }

  _zoomInPeriod() {
    const { coll } = this._getEnergyCollectionInfo();
    if (this._config.collection_key && !coll) return;

    const { start, end } = this._getDateRange();
    const newStart = this._scaleSpanStart(start, end, 0.5);
    // Kein Fortschritt möglich (min. Einheit bereits erreicht) → keine Aktion
    if (newStart.getTime() === start.getTime()) return;

    if (this._energyStart) {
      this._energyHistory.push({ start: new Date(this._energyStart), end: new Date(this._energyEnd || new Date()) });
    } else {
      this._energyHistory.push({ start: new Date(start), end: new Date(end) });
    }
    if (this._energyHistory.length > 20) this._energyHistory.shift();
    this._loading = true;
    this._render();
    try {
      if (coll) this._applyPeriodToCollection(coll, newStart, new Date(end));
    } catch (err) {
      console.warn('[HistoryTableCard] Zoom-In fehlgeschlagen:', err);
    }
    this._energyStart = newStart;
    this._energyEnd   = new Date(end);
    this._scheduleDataFetch();
  }

  /**
   * Verschiebt den Start-Zeitpunkt so, dass die Spanne end–start um `factor`
   * skaliert wird. Das End-Datum bleibt immer unverändert.
   *
   *  factor = 2   → Zeitraum verdoppeln  (Zoom-Out)
   *  factor = 0.5 → Zeitraum halbieren  (Zoom-In)
   *
   * Ankerpunkt ist immer `start` (nicht `end`), damit keine
   * Tages-Überlaufprobleme entstehen (z. B. 31.12. − 22 Monate → 03.03.).
   *
   * Beispiele (factor = 2):
   *   01.01.2026 – 31.12.2026  →  01.01.2025 – 31.12.2026
   *   01.01.2025 – 31.12.2026  →  01.01.2023 – 31.12.2026
   *
   * Priorität der Arithmetik:
   *   ≥ 1 Monat → Monats-Arithmetik  (saubere Monatsgrenzen)
   *   ≥ 1 Tag   → Tages-Arithmetik
   *   < 1 Tag   → ms-Arithmetik, Minimum 1 Stunde
   */
  _scaleSpanStart(start, end, factor) {
    const months = this._monthsBetween(start, end);
    if (months >= 1) {
      const newMonths = Math.max(1, Math.round(months * factor));
      // delta > 0 → start weiter zurück; delta < 0 → start vorwärts
      const delta = newMonths - months;
      if (delta !== 0) {
        const d = new Date(start);
        d.setMonth(d.getMonth() - delta);
        // Auf Monatsersten normalisieren – Zoom operiert immer auf Monatsgrenzen.
        // Beispiel: 16.03 − 1 Monat = 16.02 → snap → 01.02
        d.setDate(1);
        return d;
      }
      // delta === 0: 1 Monat kann nicht weiter halbiert werden → Tages-Arithmetik
    }
    const spanMs = end.getTime() - start.getTime();
    const days   = Math.round(spanMs / (24 * 3600000));
    if (days >= 1) {
      const newDays = Math.max(1, Math.round(days * factor));
      const delta   = newDays - days;
      if (delta !== 0) {
        const d = new Date(start);
        d.setDate(d.getDate() - delta);
        return d;
      }
      // delta === 0: 1 Tag kann nicht weiter halbiert werden → ms-Arithmetik
    }
    // Sub-Tages-Spanne (Stunden-Ansicht): ms-Arithmetik, Minimum 1 Stunde
    const newSpanMs = Math.max(3600000, Math.round(spanMs * factor));
    return new Date(start.getTime() - (newSpanMs - spanMs));
  }

  /**
   * Gibt die gerundete Anzahl von Kalendermonaten zwischen start und end zurück.
   * Aufrunden wenn der verbleibende Rest ≥ 15 Tage beträgt, damit z. B.
   * 01.01.2026–31.12.2026 als 12 Monate gezählt wird (nicht als 11).
   */
  /**
   * Hilfsmethode: lokaler Datums-Schlüssel YYYY-MM-DD eines Date-Objekts.
   * Unabhängig von Zeitzonen-Offset und Sommerzeitumstellungen.
   */
  _localDateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  /**
   * Baut eine Lookup-Map: lokaler Datums-Key des Haupt-Rows → compareValue.
   *
   * Für period='month'/'year': Monats-Arithmetik (exakt, DST-sicher).
   * Für period='day'/'hour' etc.: Tages-Arithmetik (DST-sicher).
   * Reiner ms-Offset würde bei DST-Umstellungen oder unterschiedlichen
   * Monatslängen falsche Matches liefern.
   */
  _buildCompareLookup(entityId, statType) {
    const m      = new Map();
    const period = this._effectivePeriod || this._config.period || 'day';

    if ((period === 'month' || period === 'year') && this._compareRange) {
      // Monats-Offset: wie viele Monate liegt cmpStart vor mainStart
      const mainStart   = this._energyStart || this._getDateRange().start;
      const cmpStart    = this._compareRange.start;
      const monthOffset = (cmpStart.getFullYear() - mainStart.getFullYear()) * 12
                        + (cmpStart.getMonth()     - mainStart.getMonth());
      for (const row of (this._compareRawStats[entityId] || [])) {
        const cmpDate  = new Date(row.start);
        // Entsprechendes Hauptzeitraum-Datum: gleicher Monat + (-monthOffset) Monate
        const mainDate = new Date(cmpDate.getFullYear(), cmpDate.getMonth() - monthOffset, 1);
        m.set(this._localDateKey(mainDate), row[statType] ?? null);
      }
    } else {
      // Tages-Offset (DST-sicher durch lokale Datumsarithmetik)
      const offsetDays = Math.round(this._compareOffset / (24 * 3600000));
      for (const row of (this._compareRawStats[entityId] || [])) {
        const cmpDate  = new Date(row.start);
        const mainDate = new Date(cmpDate.getFullYear(), cmpDate.getMonth(), cmpDate.getDate() - offsetDays);
        m.set(this._localDateKey(mainDate), row[statType] ?? null);
      }
    }
    return m;
  }

  _monthsBetween(start, end) {
    let m = (end.getFullYear() - start.getFullYear()) * 12
          + (end.getMonth() - start.getMonth());
    // Restliche Tage prüfen → ggf. aufrunden
    const provisional = new Date(start);
    provisional.setMonth(provisional.getMonth() + m);
    if (end - provisional >= 15 * 24 * 3600000) m++;
    return Math.max(0, m);
  }

  /** Prüft ob start..end exakt einen Kalendermonat umspannt (1. bis letzter Tag desselben Monats). */
  _isCalendarMonth(start, end) {
    if (start.getDate() !== 1) return false;
    if (start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth()) return false;
    return end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  }

  // ── Sort / Filter ─────────────────────────────────────────────────────────

  _cellSortValue(cellHtml) {
    const text = (cellHtml || '').replace(/<[^>]*>/g, '').trim();
    // Normalize comma decimal separator (e.g. "17,1 kWh" → "17.1 kWh") before stripping units
    const normalized = text.replace(/(\d),(\d)/g, '$1.$2');
    const num = parseFloat(normalized.replace(/[^\d.\-]/g, ''));
    return isNaN(num) ? text.toLowerCase() : num;
  }

  _compareSortValues(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  }

  _isInEditMode() {
    // HA sets editMode property directly on the card element
    if (this.editMode) return true;
    // Traverse shadow roots upward to detect dashboard edit mode or card editor preview
    let node = this.parentNode;
    while (node) {
      if (node instanceof ShadowRoot) node = node.host;
      if (!node) break;
      if (node.nodeName === 'HUI-CARD-EDIT-MODE') return true;
      if (node.editMode === true) return true; // wrapper cards (e.g. fullscreen-wrapper-card) have editMode set by HA
      // Card editor dialog: covers HUI-DIALOG-EDIT-CARD and any future naming variations
      if (node.nodeName.startsWith('HUI-DIALOG')) return true;
      // Fallback: any ha-dialog ancestor means we're in a modal editing context
      if (node.nodeName === 'HA-DIALOG') return true;
      node = node.parentNode;
    }
    return false;
  }

  _attachInteractivity() {
    if (!this.shadowRoot) return;
    // Sort: click on column header (normal mode)
    const _period = this._effectivePeriod || this._config?.period || 'day';
    const _sortEnabled = this._config.enable_sort !== false && _period !== 'timespan';
    if (_sortEnabled) {
    this.shadowRoot.querySelectorAll('th[data-col-idx]').forEach(th => {
      th.addEventListener('click', () => {
        const idx = parseInt(th.dataset.colIdx, 10);
        if (this._sortCol === idx) {
          this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this._sortCol = idx;
          this._sortDir = 'asc';
        }
        const scroller = this.shadowRoot.querySelector('.card-content');
        const scrollLeft = scroller?.scrollLeft ?? 0;
        this._render();
        if (scrollLeft) requestAnimationFrame(() => {
          const s = this.shadowRoot.querySelector('.card-content');
          if (s) s.scrollLeft = scrollLeft;
        });
      });
    });
    // Sort: click on entity label or header (transposed mode) → sorts date columns
    // row=-1 means sort by date chronologically
    this.shadowRoot.querySelectorAll('td[data-trans-sort-row], th[data-trans-sort-row]').forEach(el => {
      el.addEventListener('click', () => {
        const row = parseInt(el.dataset.transSortRow, 10);
        if (this._transSortRow === row) {
          this._transSortDir = this._transSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this._transSortRow = row;
          this._transSortDir = 'asc';
        }
        const scrollLeft2 = this.shadowRoot.querySelector('.card-content')?.scrollLeft ?? 0;
        this._render();
        if (scrollLeft2) requestAnimationFrame(() => {
          const s = this.shadowRoot.querySelector('.card-content');
          if (s) s.scrollLeft = scrollLeft2;
        });
      });
    });
    } // end enable_sort
    // Entity header/first-col click → more-info dialog (only when sort is disabled)
    if (!_sortEnabled) {
      this.shadowRoot.querySelectorAll('[data-entity]').forEach(el => {
        el.addEventListener('click', () => {
          const entityId = el.dataset.entity;
          if (!entityId) return;
          this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId } }));
        });
      });
    }
    // Date cell click → energy period setzen (only meaningful with nav)
    const hasNav = !!(this._config.collection_key || this._config.custom_start_date || this._config.initial_period || this._config.show_date_links !== false);
    if (hasNav) {
      this.shadowRoot.querySelectorAll('tbody tr[data-start]').forEach(tr => {
        const startTs = parseInt(tr.dataset.start, 10);
        if (isNaN(startTs)) return;
        tr.querySelectorAll('td.date-cell').forEach(td => {
          td.addEventListener('click', () => {
            if (this._loading) return;
            const currentPeriod = this._effectivePeriod || this._config?.period || 'day';
            // Drill-down should persist so external picker navigation keeps the finer period.
            this._periodOverride = this._getNextLowerPeriod(currentPeriod);
            this._setEnergyPeriod(new Date(startTs));
          });
        });
      });
      const btnBack = this.shadowRoot.querySelector('#btn-back');
      if (btnBack) btnBack.addEventListener('click', () => {
        if (this._loading) return;
        this._goBackEnergyPeriod();
      });
    }

    // Buttons that work in all range modes
    const btnPrev = this.shadowRoot.querySelector('#btn-prev');
    if (btnPrev) btnPrev.addEventListener('click', () => {
      if (this._loading) return;
      this._shiftPeriod(-1);
    });
    const btnNext = this.shadowRoot.querySelector('#btn-next');
    if (btnNext) btnNext.addEventListener('click', () => {
      if (this._loading) return;
      this._shiftPeriod(+1);
    });
    const btnZoomOut = this.shadowRoot.querySelector('#btn-zoom-out');
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => {
      if (this._loading) return;
      this._zoomOutPeriod();
    });
    const btnZoomIn = this.shadowRoot.querySelector('#btn-zoom-in');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => {
      if (this._loading) return;
      this._zoomInPeriod();
    });
    const btnReset = this.shadowRoot.querySelector('#btn-reset');
    if (btnReset) btnReset.addEventListener('click', () => {
      if (this._loading) return;
      this._resetToInitialRange();
    });
    const btnHourperiod = this.shadowRoot.querySelector('#btn-hourperiod');
    if (btnHourperiod) btnHourperiod.addEventListener('click', () => {
      if (this._loading) return;
      this._periodOverride ="hour";
      this._scheduleDataFetch();
    });
    const btnDayperiod = this.shadowRoot.querySelector('#btn-dayperiod');
    if (btnDayperiod) btnDayperiod.addEventListener('click', () => {
      if (this._loading) return;
      this._periodOverride ="day";
      this._scheduleDataFetch();
    });
    const btnMonthyperiod = this.shadowRoot.querySelector('#btn-monthperiod');
    if (btnMonthyperiod) btnMonthyperiod.addEventListener('click', () => {
      if (this._loading) return;
      this._periodOverride ="month";
      this._scheduleDataFetch();
    });
    const btnYearperiod = this.shadowRoot.querySelector('#btn-yearperiod');
    if (btnYearperiod) btnYearperiod.addEventListener('click', () => {
      if (this._loading) return;
      this._periodOverride ="year";
      this._scheduleDataFetch();
    });
    const btnTimespanperiod = this.shadowRoot.querySelector('#btn-timespanperiod');
    if (btnTimespanperiod) btnTimespanperiod.addEventListener('click', () => {
      if (this._loading) return;
      this._periodOverride = "timespan";
      this._scheduleDataFetch();
    });
    const btnClearperiod = this.shadowRoot.querySelector('#btn-clearperiod');
    if (btnClearperiod) btnClearperiod.addEventListener('click', () => {
      if (this._loading) return;
      this._periodOverride ="";
      this._scheduleDataFetch();
    });
    const btnTranspose = this.shadowRoot.querySelector('#btn-transpose');
    if (btnTranspose) btnTranspose.addEventListener('click', () => {
      this._transposed = !this._transposed;
      this._render();
    });

    this.shadowRoot.querySelectorAll('[data-qmi-idx]').forEach(el => {
      el.addEventListener('click', () => {
        if (this._loading) return;
        const qi = +el.dataset.qmiIdx;
        const item = (this._config.quick_menu_items || [])[qi];
        if (!item) return;
        // Zeitraum-Modus: range_type legt fest welches der drei Range-Felder aktiv ist
        const _rt = item.range_type || (item.energy_period ? 'energy' : item.days_to_show != null ? 'days' : item.custom_start ? 'custom_start' : '');
        let _needFetch = false;
        if (_rt === 'energy' && item.energy_period) {
          const range = this._resolveInitialPeriod(item.energy_period);
          if (range) {
            if (this._energyStart) {
              this._energyHistory.push({ start: new Date(this._energyStart), end: new Date(this._energyEnd || new Date()) });
              if (this._energyHistory.length > 20) this._energyHistory.shift();
            }
            this._energyStart = range.start;
            this._energyEnd   = range.end;
            const { coll } = this._getEnergyCollectionInfo();
            if (coll) this._applyPeriodToCollection(coll, range.start, range.end);
            _needFetch = true;
          }
        } else if (_rt === 'days' && item.days_to_show != null) {
          // Setze _energyStart/_energyEnd direkt, damit _getDateRange() nicht den alten Wert zurückgibt
          const end   = new Date();
          const start = new Date();
          start.setDate(start.getDate() - Number(item.days_to_show));
          start.setHours(0, 0, 0, 0);
          if (this._energyStart) {
            this._energyHistory.push({ start: new Date(this._energyStart), end: new Date(this._energyEnd || new Date()) });
            if (this._energyHistory.length > 20) this._energyHistory.shift();
          }
          this._energyStart = start;
          this._energyEnd   = end;
          const { coll: collD } = this._getEnergyCollectionInfo();
          if (collD) this._applyPeriodToCollection(collD, start, end);
          _needFetch = true;
        } else if (_rt === 'custom_start' && item.custom_start) {
          const start = this._parseConfigDate(item.custom_start);
          if (start) {
            const end = new Date();
            if (this._energyStart) {
              this._energyHistory.push({ start: new Date(this._energyStart), end: new Date(this._energyEnd || new Date()) });
              if (this._energyHistory.length > 20) this._energyHistory.shift();
            }
            this._energyStart = start;
            this._energyEnd   = end;
            const { coll: collC } = this._getEnergyCollectionInfo();
            if (collC) this._applyPeriodToCollection(collC, start, end);
            _needFetch = true;
          }
        }
        if (_needFetch) this._scheduleDataFetch();
          if (item.period !== undefined && item.period !== null && item.period !== '') {
            const nextPeriodOverride = item.period === 'default' ? '' : item.period;
            const prevPeriodOverride = this._periodOverride || '';
            if (nextPeriodOverride !== prevPeriodOverride) {
              if (this._energyStart) {
                this._energyHistory.push({ start: new Date(this._energyStart), end: new Date(this._energyEnd || new Date()) });
              } else {
                const prevRange = this._getDateRange();
                this._energyHistory.push({ start: new Date(prevRange.start), end: new Date(prevRange.end) });
              }
              if (this._energyHistory.length > 20) this._energyHistory.shift();
            }
            this._periodOverride = nextPeriodOverride;
            // Show toolbar state changes (e.g. reset button) immediately,
            // even when the upcoming fetch is skipped/returns early.
            this._render();
            this._scheduleDataFetch();
          }
          if (item.sort_col != null) {
            this._sortCol = Number(item.sort_col);
            this._render();
          }
          if ('date_links' in item && item.date_links != null) {
            this._config = { ...this._config, show_date_links: item.date_links };
            this._render();
          }
          if ('enable_sort' in item && item.enable_sort != null) {
            this._config = { ...this._config, enable_sort: item.enable_sort };
            this._render();
          }
          if ('sticky_header' in item && item.sticky_header != null) {
            this._stickyHeader = item.sticky_header;
            this._render();
          }
          if ('sticky_first_col' in item && item.sticky_first_col != null) {
            this._stickyFirstCol = item.sticky_first_col;
            this._render();
          }
          if (item.layout) {
            this._transposed = (item.layout === 'horizontal');
            this._render();
          }
        });
      });

      const btnmenu = this.shadowRoot.querySelector('#dropdown-trigger');
      const menu = this.shadowRoot.querySelector('#period-menu');

      if (btnmenu && menu) {
        // 1. Toggle menu on button click
        btnmenu.addEventListener('click', (e) => {
          e.stopPropagation();
          const isVisible = menu.style.display === 'flex';
          if (!isVisible) {
            const r = btnmenu.getBoundingClientRect();

            // Probe: place menu at (0,0) with visibility:hidden to discover the
            // containing block's origin in viewport coordinates.
            // position:fixed is normally relative to the viewport, but any ancestor
            // with transform/filter/contain:layout creates a new containing block.
            // getBoundingClientRect() always returns viewport coords, so we can
            // derive the offset and convert target positions correctly.
            menu.style.visibility = 'hidden';
            menu.style.top    = '0';
            menu.style.left   = '0';
            menu.style.right  = 'auto';
            menu.style.bottom = 'auto';
            menu.style.display = 'flex';
            const probe  = menu.getBoundingClientRect();
            const cbLeft = probe.left;  // containing-block origin X in viewport coords
            const cbTop  = probe.top;   // containing-block origin Y in viewport coords
            const menuW  = probe.width  || menu.offsetWidth  || 120;
            const menuH  = probe.height || menu.offsetHeight || 100;
            menu.style.display = 'none';
            menu.style.visibility = '';

            // Target viewport coordinates
            const spaceBelow = window.innerHeight - r.bottom - 4;
            const spaceAbove = r.top - 4;
            // Prefer down if it fits; if neither fits, go to the larger space; else go up
            const goesDown  = menuH <= spaceBelow || (menuH > spaceAbove && spaceBelow >= spaceAbove);
            const targetTop  = goesDown
              ? r.bottom + 2
              : r.top - menuH - 2;
            const availSpace = goesDown ? spaceBelow : spaceAbove;
            menu.style.maxHeight = availSpace + 'px';
            // Right-align menu with button, clamped so it never exits the viewport
            let targetLeft = r.right - menuW;
            targetLeft = Math.max(4, Math.min(targetLeft, window.innerWidth - menuW - 4));

            // Convert viewport targets to containing-block coordinates
            menu.style.left   = (targetLeft - cbLeft) + 'px';
            menu.style.right  = 'auto';
            menu.style.top    = (targetTop  - cbTop)  + 'px';
            menu.style.bottom = 'auto';

            // Close if the page scrolls (fixed menu would otherwise detach from button)
            window.addEventListener('scroll', () => { menu.style.display = 'none'; },
              { capture: true, once: true, passive: true });
          }
          menu.style.display = isVisible ? 'none' : 'flex';
        });

        // 2. Close menu when clicking an option
        menu.addEventListener('click', () => {
          menu.style.display = 'none';
        });

        // 3. Close menu when clicking anywhere else (the "background")
        window.addEventListener('click', (e) => {
          // We check if the click target is NOT the menu or the button
          // composedPath() is needed to see through the Shadow DOM boundary
          const path = e.composedPath();
          if (!path.includes(menu) && !path.includes(btnmenu)) {
            menu.style.display = 'none';
          }
        });
      }
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  _render() {
    if (!this.shadowRoot) return;

    const config  = this._config;
    const { start, end } = this._getDateRange();
    const locale  = this._hass?.language?.replace('_', '-') || 'de-DE';
    const period     = this._effectivePeriod || config.period || 'day';
    const showTime    = ['hour', '5minute'].includes(period);
    const fmtDate = new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      ...(showTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
    // Exklusive Periodengrenze (Mitternacht lokale Zeit) → letzten inklusiven Tag anzeigen.
    // Beispiel: energy-picker Jänner → end = 01.02. → Anzeige 31.01.
    const displayEnd = (this._energyStart &&
      end.getHours() === 0 && end.getMinutes() === 0 &&
      end.getSeconds() === 0 && end.getMilliseconds() === 0)
      ? new Date(end.getTime() - 1)
      : end;
    const scrollClass = config.scroll === false ? ' no-scroll' : '';
    const showHeader  = config.show_header !== false;

    const dis = this._loading ? ' disabled' : '';
    const hasInitial   = this._computeLoadRange() !== null || this._computeResetRange() !== null;
    const hasNav       = !!(this._config.collection_key || this._config.custom_start_date || this._config.initial_period || this._config.show_date_links !== false);
    const showZoom     = config.show_zoom_out !== false;
    const showNavBtns   = config.show_nav_buttons  === true;
    const showNavDate   = config.show_nav_date   === true;
    const showQuickMenu = config.show_quick_menu !== false;
    const showReset    = config.show_reset_button !== false && !this._loading && (this._energyHistory.length > 0 || (this._periodOverride || '') !== (config.default_period || ''));
    const _betaCard    = new Set((config.beta_features || '').split(',').map(s => s.trim()));
    const betaH        = _betaCard.has('horizontal');
    const betaBack     = _betaCard.has('backbutton');
    const showBack     = betaBack && hasNav && this._energyHistory.length > 0 && !this._loading && (config.show_back_button ?? false);
    const dateFrom = escapeHtml(fmtDate.format(start));
    const dateTo   = escapeHtml(fmtDate.format(displayEnd));

    // Vergleichs-Subtitle (Datum des Vergleichszeitraums)
    let compareDateLabel = '';
    if (this._compareRange) {
      const cmpShowTime = ['hour', '5minute'].includes(period);
      const fmtCmp = new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        ...(cmpShowTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      });
      const cmpDisplayEnd = (this._compareRange.end.getHours() === 0 && this._compareRange.end.getMinutes() === 0 &&
        this._compareRange.end.getSeconds() === 0 && this._compareRange.end.getMilliseconds() === 0)
        ? new Date(this._compareRange.end.getTime() - 1)
        : this._compareRange.end;
      compareDateLabel = escapeHtml(`${fmtCmp.format(this._compareRange.start)} – ${fmtCmp.format(cmpDisplayEnd)}`);
    }

    const headerToolbar = `
      <span class="nav-group nav-left">
        ${showBack    ? `<ha-icon icon="mdi:arrow-left" class="header-toolbar-btn back" id="btn-back"${dis} title="Zur\u00fcck"></ha-icon>` : ''}
        ${showReset ? `<ha-icon icon="mdi:restore" class="header-toolbar-btn" id="btn-reset"${dis} title="Standard Zeitspanne"></ha-icon>` : ''}
        ${showNavBtns ? `<ha-icon icon="mdi:chevron-left"  class="header-toolbar-btn" id="btn-prev"${dis} title="Vorherige Zeitspanne"></ha-icon>` : ''}
      </span>
      ${showNavDate ? `<span class="meta nav-date">${compareDateLabel ? `<span class="compare-subtitle">${compareDateLabel} <span class="compare-subtitle-vs">vs.</span></span>` : ''}<span class="nav-date-start">${dateFrom} –</span><span class="nav-date-to">${dateTo}</span></span>` : ''}
      <span class="nav-group nav-right">
        ${showNavBtns ? `<ha-icon icon="mdi:chevron-right" class="header-toolbar-btn" id="btn-next"${dis} title="Nächste Zeitspanne"></ha-icon>` : ''}                
        ${showZoom    ? `<ha-icon icon="mdi:magnify-minus" class="header-toolbar-btn zoom" id="btn-zoom-out"${dis} title="Zeitraum verdoppeln"></ha-icon>` : ''}
${(() => {
          const qmis = this._config.quick_menu_items || [];
          if (!showQuickMenu) return '';
          return `
          <div class="dropdown-container" style="position: relative; display: inline-block;">
            <ha-icon icon="mdi:dots-vertical" class="header-toolbar-btn menu" id="dropdown-trigger" title="Zeitraum wählen"></ha-icon>
            <ha-list id="period-menu">
              ${['hour','day','month','year'].map(p => {
                const lbl = (this._tr('stat_period_labels') || {})[p] || p.toUpperCase();
                return this._periodOverride !== p
                  ? `<ha-list-item mwc-list-item tabindex="-1" aria-disabled="false" id="btn-${p}period"${dis}><span class="muted">${this._tr('menu_period')}: </span>${escapeHtml(lbl)}</ha-list-item>`
                  : `<ha-list-item mwc-list-item tabindex="-1"><span class="muted">${this._tr('menu_period')}: ${escapeHtml(lbl)}</span></ha-list-item>`;
              }).join('')}
              ${this._periodOverride !== 'timespan'
                ? `<ha-list-item mwc-list-item tabindex="-1" aria-disabled="false" id="btn-timespanperiod"${dis}><span class="muted">${this._tr('menu_period')}: </span>${escapeHtml(this._tr('menu_timespan'))}</ha-list-item>`
                : `<ha-list-item mwc-list-item tabindex="-1"><span class="muted">${this._tr('menu_period')}: ${escapeHtml(this._tr('menu_timespan'))}</span></ha-list-item>`}
              ${this._periodOverride ? `<ha-list-item mwc-list-item tabindex="-1" aria-disabled="false" id="btn-clearperiod"${dis}><span class="muted">${this._tr('menu_period')}: </span>${escapeHtml(this._tr('menu_revert_auto'))}</ha-list-item>` : ''}
              ${(() => {
                if (!showQuickMenu || !qmis.length) return '';
                const eL = this._tr('qmi_energy_labels') || {};
                const spl = this._tr('stat_period_labels') || {};
                return '<hr>' + qmis.map((item, qi) => {
                  const periodLabel = item.period === 'default' ? this._tr('menu_default')
                    : item.period === 'timespan' ? this._tr('menu_timespan')
                    : item.period ? (spl[item.period] || item.period.toUpperCase()) : '';
                  const layoutLabel = item.layout === 'horizontal' ? '⇄' : item.layout === 'vertical' ? '⇅' : '';
                  const _rt = item.range_type || (item.energy_period ? 'energy' : item.days_to_show != null ? 'days' : item.custom_start ? 'custom_start' : '');
                  const rangeLabel = _rt === 'energy' ? (eL[item.energy_period] || item.energy_period || '') : _rt === 'days' ? (item.days_to_show != null ? item.days_to_show + 'd' : '') : _rt === 'custom_start' ? (item.custom_start || '') : '';
                  const lbl = item.title || [rangeLabel, periodLabel, item.sort_col != null ? 'Sort #' + item.sort_col : '', layoutLabel].filter(Boolean).join(' · ') || '?';
                  return '<ha-list-item mwc-list-item tabindex="-1" aria-disabled="false" data-qmi-idx="' + qi + '"' + dis + '>' + escapeHtml(lbl) + '</ha-list-item>';
                }).join('');
              })()}

            </ha-list>
          </div>`;
        })()}
      </span>
      `;

    const cardTitle   = escapeHtml(config.name || config.title || '');
    const hasVisibleToolbar = showNavBtns || showNavDate || showZoom || showQuickMenu || showBack || showReset;
    const headerHtml  = (showHeader && (cardTitle || showBack || hasVisibleToolbar)) ? `
      <div class="card-header${cardTitle ? '' : ' no-title'}">
        <div class="card-header-left">
          ${cardTitle ? `<span class="title">${cardTitle}</span>` : ''}
        </div>
        <div class="card-header-right">
          ${headerToolbar}
        </div>
      </div>` : (!showHeader && hasVisibleToolbar) ? `<div class="card-header${cardTitle ? '' : ' no-title'}">${cardTitle ? `<span class="title">${cardTitle}</span>` : ''}<div class="card-header-right">${headerToolbar}</div></div>` : (cardTitle ? `<div class="card-header no-toolbar"><span class="title">${cardTitle}</span></div>` : '');

    const rowWarnHtml = (this._rowCountWarning && !this._loading && !this._error)
      ? `<div class="row-count-warning">⚠ Geschätzte Datenmenge: ca. ${this._rowCountWarning.toLocaleString()} Zeilen – Performance kann beeinträchtigt sein. Bitte Zeitraum oder Periode anpassen.</div>`
      : '';

    const hasColumnsData = Array.isArray(this._tableData) && this._tableData.length > 0;
    const hasLegacyData = this._legacyStats && Object.values(this._legacyStats).some(rows => Array.isArray(rows) && rows.length > 0);
    const hasDateOnlyData = Array.isArray(this._dateOnlyRows) && this._dateOnlyRows.length > 0;
    const hasStaleData = hasColumnsData || hasLegacyData || hasDateOnlyData;
    const showLoadingOverlay = this._loading && this._initialized && !this._error && hasStaleData;

    let bodyHtml;
    if (this._error) {
      bodyHtml = `<div class="error-message">${escapeHtml(this._error)}</div>`;
    } else if (this._loading && !showLoadingOverlay) {
      bodyHtml = `<div class="loading"><span class="loading-dots">Lade Daten</span></div>`;
    } else if (!this._initialized) {
      bodyHtml = `<div class="loading"><span class="loading-dots">Lade Daten</span></div>`;
    } else if (this._isDateOnlyMode()) {
      bodyHtml = this._renderDateOnlyTable();
    } else if (this._isColumnsMode()) {
      bodyHtml = this._transposed ? this._renderColumnsTableTransposed() : this._renderColumnsTable();
    } else {
      bodyHtml = this._transposed ? this._renderLegacyBlocksTransposed() : this._renderLegacyBlocks();
    }
    if (showLoadingOverlay) {
      bodyHtml = `<div class="loading-stale-content">${bodyHtml}</div><div class="loading-stale-overlay"><div class="loading"><span class="loading-dots">Lade Daten</span></div></div>`;
    }

    const cardClasses = [
      (this._config.collection_key || this._config.custom_start_date || this._config.initial_period || this._config.show_date_links !== false) ? 'has-nav' : null,
      this._transposed ? 'transposed' : null,
      this._transposed && this._showColorBullet ? 'has-bullet' : null,
      !this._stickyHeader   ? 'no-sticky-header'    : null,
      (!this._stickyFirstCol || (!this._transposed && this._effectivePeriod === 'timespan')) ? 'no-sticky-first-col' : null,
      !headerHtml           ? 'no-header'           : null,
    ].filter(Boolean).join(' ');
    const headerColor     = this._config.header_color      || '';
    const headerTextColor = this._config.header_text_color  || '';
    const firstColColor   = this._config.first_col_color    || '';
    const firstColText    = this._config.first_col_text_color || '';
    const valAlign      = this._config.text_align_value || '';
    const customVarsCss = (headerColor || headerTextColor || firstColColor || firstColText)
      ? `<style>:host{${headerColor ? `--ht-header-bg:${headerColor};` : ''}${headerTextColor ? `--ht-header-text:${headerTextColor};` : ''}${firstColColor ? `--ht-first-col-bg:${firstColColor};` : ''}${firstColText ? `--ht-first-col-text:${firstColText};` : ''}}</style>`
      : ''
    const _cp = (k) => { const v = this._config[k]; if (v == null || v === '') return null; const n = parseFloat(String(v)); return isNaN(n) ? null : n; };
    const _cpLR = (k) => {
      const v = this._config[k];
      if (v == null || v === '') return null;
      const s = String(v).trim();
      if (s.endsWith('%')) return s;
      const n = parseFloat(s);
      return isNaN(n) ? null : `${n}px`;
    };
    const cpTop    = _cp('card_padding_top');
    const cpBottom = _cp('card_padding_bottom');
    const cpLeft   = _cpLR('card_padding_left');
    const cpRight  = _cpLR('card_padding_right');
    const cpFall   = _cp('card_padding');
    const hasDirectional = cpTop != null || cpBottom != null || cpLeft != null || cpRight != null;
    let paddingStyle = ` style="padding:0"`;
    let transposedEdgeCss = '';
    let normalEdgeCss = '';
    let tableMarginCss = '';
    let rightPadCss = '';
    let bottomCss = '';
    if (hasDirectional) {
      if (cpTop) tableMarginCss = `table{margin-top:${cpTop}px}`;
      // bottom: injected via !important style rule (inline style can't override CSS !important)
      if (cpBottom != null) bottomCss = `.card-content{padding-bottom:${cpBottom}px!important}`;
      if (this._transposed) {
        // Always inject left (default 16px) into first cell so the label column has spacing.
        const effLeft = cpLeft ?? '16px';
        transposedEdgeCss += `ha-card.transposed.has-bullet tbody td.cell-bullet,ha-card.transposed.has-bullet thead th.cell-bullet{padding-left:${effLeft}!important}`;
        transposedEdgeCss += `ha-card.transposed:not(.has-bullet) tbody td.transposed-first,ha-card.transposed:not(.has-bullet) thead th.transposed-first{padding-left:${effLeft}!important}`;
        transposedEdgeCss += `ha-card.transposed.has-bullet .transposed-first{left:calc(${effLeft} + 32px)!important}`;
        if (cpRight) {
          // CSS % on table cells has a circular dependency with table width (table width depends on
          // cell widths, cell widths depend on table width). Browsers may resolve % to 0.
          // Convert % to px using the current card width so borders reach the right edge.
          let cpRightResolved = cpRight;
          if (cpRight.endsWith('%')) {
            const pct = parseFloat(cpRight) / 100;
            const cardW = this.getBoundingClientRect().width || this.clientWidth || 0;
            cpRightResolved = cardW > 0 ? `${Math.round(cardW * pct)}px` : null;
          }
          if (cpRightResolved) {
            transposedEdgeCss += `ha-card.transposed tbody td:last-child,ha-card.transposed thead th:last-child{padding-right:${cpRightResolved}!important}`;
          }
        }
      } else {
        // Vertical layout: right padding on .card-content so % is relative to card width (no calc needed).
        // Table borders naturally stop at the right of the content area, which is fine for vertical layout.
        if (cpRight) rightPadCss = `ha-card:not(.transposed) .card-content{padding-right:${cpRight}!important}`;
        const tblMarginParts = [];
        if (cpLeft)  tblMarginParts.push(`margin-left:${cpLeft}`);
        if (tblMarginParts.length) {
          tableMarginCss += `ha-card:not(.transposed) table{${tblMarginParts.join(';')};width:calc(100% - (${cpLeft}))}`;
        }
      }
    } else if (cpFall != null) {
      paddingStyle = ` style="padding:${cpFall}px"`;
    }
    const _rh = (this._config.row_height   != null && this._config.row_height   !== '') ? Number(this._config.row_height)   : (this._transposed ? 44 : 32);
    const _cellPadVal = (this._config.cell_padding != null && this._config.cell_padding !== '') ? Number(this._config.cell_padding) : null;
    let cellPadding = '';
    let rowHeight   = '';
    if (_rh != null) {
      // Enforce exact row height: remove vertical padding so it can't push rows taller,
      // keep horizontal padding from cell_padding, keep vertical-align: middle.
      const hPad = _cellPadVal != null ? `padding-left:${_cellPadVal}px!important;padding-right:${_cellPadVal}px!important;` : '';
      rowHeight = `tr{height:${_rh}px}` +
        `td:not(.cell-bullet),th:not(.cell-bullet){height:${_rh}px;padding-top:0!important;padding-bottom:0!important;vertical-align:middle!important;${hPad}}`;
    } else if (_cellPadVal != null) {
      cellPadding = `td:not(.cell-bullet),th:not(.cell-bullet){padding:${_cellPadVal}px!important}`;
    }
    const keyAlignCss = this._config.text_align_key
      ? (this._transposed
          ? `ha-card.transposed .transposed-first{text-align:${this._config.text_align_key}!important}`
          : `ha-card:not(.transposed) thead th:first-child:not(.cell-bullet),ha-card:not(.transposed) tbody td:first-child:not(.cell-bullet){text-align:${this._config.text_align_key}!important}`)
      : '';
    const valAlignCss = ''; // --ht-val-align is set via inline style on ha-card instead
    const compareActive = this._compareRange !== null && Object.keys(this._compareRawStats || {}).length > 0;
    const _mcwBase = (this._config.max_col_width != null && this._config.max_col_width !== '') ? Number(this._config.max_col_width) : null;
    const _mcw = _mcwBase ? (compareActive ? _mcwBase * 2 : _mcwBase) : null;
    const maxColWidthCss = _mcw ? `td:not(.cell-bullet),th:not(.cell-bullet){max-width:${_mcw}px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}` : '';
    const extraCss = (cellPadding || rowHeight || maxColWidthCss || transposedEdgeCss || normalEdgeCss || tableMarginCss || keyAlignCss || valAlignCss || rightPadCss || bottomCss) ? `<style>${cellPadding}${rowHeight}${maxColWidthCss}${transposedEdgeCss}${normalEdgeCss}${tableMarginCss}${keyAlignCss}${valAlignCss}${rightPadCss}${bottomCss}</style>` : '';
    this.shadowRoot.innerHTML = `
      <style>${CARD_STYLES}</style>
      ${customVarsCss}
      ${extraCss}
      <ha-card${cardClasses ? ` class="${cardClasses}"` : ''}${valAlign ? ` style="--ht-val-align:${valAlign}"` : ''}>
        ${this._loading ? '<span class="toolbar-loading"></span>' : ''}
        ${headerHtml}
        <div class="card-content${scrollClass}${showLoadingOverlay ? ' loading-stale' : ''}"${paddingStyle}>${rowWarnHtml}${bodyHtml}</div>
      </ha-card>`;
    this._attachInteractivity();
  }

  /**
   * Generiert this._dateOnlyRows = [ { start: Date, label: string }, ... ]
   * ohne WS-Aufruf – nur anhand der Zeitspanne und des Periods.
   */
  _buildDateOnlyTimeline(start, end, period) {
    const locale = this._hass?.language?.replace('_', '-') || 'de-DE';

    // Zeitspanne: eine einzige Zeile mit "von – bis"
    if (period === 'timespan') {
      const displayEnd = (end.getHours() === 0 && end.getMinutes() === 0 &&
        end.getSeconds() === 0 && end.getMilliseconds() === 0)
        ? new Date(end.getTime() - 1) : end;
      const fmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
      const label = fmt.format(start) + ' – ' + fmt.format(displayEnd);
      this._dateOnlyRows = [{ start: new Date(start), label }];
      return;
    }

    const fmtOptions = period === 'year'
      ? { year: 'numeric' }
      : period === 'month'
      ? { year: 'numeric', month: 'long' }
      : ['hour', '5minute'].includes(period)
        ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: '2-digit', day: '2-digit' };
    const fmtDate = new Intl.DateTimeFormat(locale, fmtOptions);

    const rows = [];
    const cur  = new Date(start);
    cur.setHours(0, 0, 0, 0);
    // Cursor auf Periodenanfang normalisieren, damit Monats-/Wochenzeilen immer
    // am 1. des Monats bzw. am Montag beginnen – unabhängig vom Startdatum.
    if (period === 'year') {
      cur.setMonth(0);
      cur.setDate(1);
    } else if (period === 'month') {
      cur.setDate(1);
    } else if (period === 'week') {
      // ISO-Woche: Montag als Wochenstart
      const dow = cur.getDay(); // 0=So, 1=Mo, ...
      const diff = (dow === 0 ? -6 : 1 - dow);
      cur.setDate(cur.getDate() + diff);
    }

    while (cur < end) {
      rows.push({ start: new Date(cur), label: fmtDate.format(cur) });
      switch (period) {
        case '5minute': cur.setMinutes(cur.getMinutes() + 5); break;
        case 'hour':    cur.setHours(cur.getHours() + 1);     break;
        case 'day':     cur.setDate(cur.getDate() + 1);       break;
        case 'week':    cur.setDate(cur.getDate() + 7);       break;
        case 'month':   cur.setMonth(cur.getMonth() + 1);     break;
        case 'year':    cur.setFullYear(cur.getFullYear() + 1); break;
        default:        cur.setDate(cur.getDate() + 1);
      }
    }
    this._dateOnlyRows = rows;
  }

  /** Datum-only-Modus: einzelne Datumsspalte, ohne Entities. */
  _renderDateOnlyTable() {
    const rows = this._dateOnlyRows || [];
    if (!rows.length) {
      return '<div class="state-message">Keine Daten im gewählten Zeitraum.</div>';
    }

    const period        = this._effectivePeriod || this._config.period || 'day';
    const hasNav        = !!(this._config.collection_key || this._config.custom_start_date || this._config.initial_period || this._config.show_date_links !== false);
    const hourDrillable = hasNav && (this._config.aggregation?.hour === '5minute');
    const dateClickable = hasNav && this._config.show_date_links !== false && (['hour', 'day', 'week', 'month', 'year'].includes(period));
    const header        = this._config.date_header || 'Datum';
    const active        = this._sortCol === 0;
    const icon          = active ? (this._sortDir === 'asc' ? '▲' : '▼') : '⇅';
    const disableSort   = this._config.enable_sort === false || period === 'timespan';

    let sortedRows = [...rows];
    if (active && !disableSort) {
      sortedRows.sort((a, b) => this._sortDir === 'asc' ? a.start - b.start : b.start - a.start);
    }

    // Aktive Zeile: entspricht dem aktuell in der Energy-Collection gesetzten Zeitraum
    const activeTs = this._energyStart ? this._energyStart.getTime() : null;
    const canDrillLower = this._getNextLowerPeriod(period) !== period;

    const headerHtml = disableSort
      ? `<th>${escapeHtml(header)}</th>`
      : `<th data-col-idx="0">${escapeHtml(header)}<span class="sort-icon">${icon}</span></th>`;
    const bodyRows   = sortedRows.map(row => {
      const isActive  = activeTs !== null && row.start.getTime() === activeTs;
      const clickable = dateClickable && (!isActive || canDrillLower);
      const isHourDrill = period === 'hour' && hourDrillable;
      const cls = clickable
        ? ` class="date-cell${isActive ? ' active-row' : ''}${isHourDrill ? ' hour-drill' : ''}"`
        : (isActive ? ' class="active-row"' : '');
      return `<tr data-start="${row.start.getTime()}"><td${cls}>${escapeHtml(row.label)}</td></tr>`;
    }).join('');

    return `
      <table>
        ${this._config.hide_table_header ? '' : `<thead><tr>${headerHtml}</tr></thead>`}
        <tbody>${bodyRows}</tbody>
      </table>`;
  }

  /** Columns-Modus: einheitliche Mehrspalten-Tabelle. */
  _renderColumnsTable() {
    const columns = this._config.columns;

    if (!this._tableData.length) {
      return '<div class="state-message">Keine Daten im gewählten Zeitraum.</div>';
    }

    const period        = this._effectivePeriod || this._config.period || 'day';
    const hasNav        = !!(this._config.collection_key || this._config.custom_start_date || this._config.initial_period || this._config.show_date_links !== false);
    const hourDrillable = hasNav && (this._config.aggregation?.hour === '5minute');
    const dateClickable = hasNav && this._config.show_date_links !== false && (['hour', 'day', 'week', 'month', 'year'].includes(period));

    // Sortierung anwenden (nicht-destruktiv)
    let rows = [...this._tableData];
    if (this._sortCol !== null && this._sortCol < columns.length) {
      const col = columns[this._sortCol];
      const isDateCol = col.type === COL_DATE
        || (!col.type && !col.entity && !col.template && !col.calc);
      rows.sort((a, b) => {
        if (isDateCol) {
          return this._sortDir === 'asc' ? a.start - b.start : b.start - a.start;
        }
        const av = this._cellSortValue(a.cells[this._sortCol]);
        const bv = this._cellSortValue(b.cells[this._sortCol]);
        return this._sortDir === 'asc'
          ? this._compareSortValues(av, bv)
          : this._compareSortValues(bv, av);
      });
    }

    const headers = columns.map((col, ci) => {
      if (col.hidden) return '';
      const label  = col.name
        || (col.type === COL_ENERGY && col.energy_key ? this._resolveEnergyLabel(col.energy_key) : null)
        || (col.entity ? this._getFriendlyName(col.entity, col) : null)
        || col.entity || 'Wert';
      const isDate = col.type === COL_DATE
        || (!col.type && !col.entity && !col.template && !col.calc);
      if (period === 'timespan' && isDate) return '';
      if (col.hidden) return `<th class="right" style="opacity:0.25" title="${escapeHtml(label)}">—</th>`;
      const active = this._sortCol === ci;
      const cls = [isDate ? null : 'right', active ? 'sort-active' : null].filter(Boolean).join(' ');
      const icon = active ? (this._sortDir === 'asc' ? '▲' : '▼') : '⇅';
      // All header cells are in the sticky thead row → always use gradient trick so
      // semi-transparent entity colors render over --ht-header-bg (not over scrolled body content)
      // Header: --ht-header-bg is the TOP layer so an opaque header_color fully covers entity colors.
      // If header_color is transparent/unset the entity color shows through.
      const bgStyle = col.background_color
        ? `background-image:linear-gradient(var(--ht-header-bg,transparent),var(--ht-header-bg,transparent)),linear-gradient(${col.background_color},${col.background_color});background-color:var(--ha-card-background,var(--card-background-color,white))`
        : '';
      const styleAttr = [col.color ? `color:${col.color}` : '', bgStyle, ..._colExtraStyle(col)].filter(Boolean).join(';');
      const styleStr = styleAttr ? ` style="${styleAttr}"` : '';
      // (s) marker in edit mode for server-side rendered columns
      const sMarker = (this._isInEditMode() && this._colNeedsServerRender(col))
        ? `<span style="opacity:0.4;font-size:0.7em;margin-left:3px;vertical-align:super" title="Jinja2 server-side rendered">(s)</span>`
        : '';
      if (this._config.enable_sort === false || period === 'timespan') {
        const plainCls = [isDate ? null : 'right'].filter(Boolean).join(' ');
        const entityAttrHdr = (!isDate && col.entity) ? ` data-entity="${escapeHtml(col.entity)}"` : '';
        return `<th${plainCls ? ` class="${plainCls}"` : ''}${entityAttrHdr}${styleStr}>${escapeHtml(label)}${sMarker}</th>`;
      }
      return `<th data-col-idx="${ci}"${cls ? ` class="${cls}"` : ''}${styleStr}>${escapeHtml(label)}${sMarker}<span class="sort-icon">${icon}</span></th>`;
    }).join('');

    // ── Vergleichs-Zellen wurden in _buildColumnsTableData vorberechnet ───────────────
    const compareActive = this._compareRange !== null && Object.keys(this._compareRawStats).length > 0;
    const locale        = this._hass?.language?.replace('_', '-') || 'de-DE';
    const showTime      = ['hour', '5minute'].includes(period);
    const fmtDate       = new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      ...(showTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });

    // First visible column index – its cells are sticky (left:0) and must use --ht-first-col-bg as opaque base
    const _firstVisCi = columns.findIndex((c, ci) => {
      if (c.hidden) return false;
      const isDateCol = c.type === COL_DATE || (!c.type && !c.entity && !c.template && !c.calc);
      if (period === 'timespan' && isDateCol) return false;
      return true;
    });
    const bodyRows = rows.map(row => {
      const cells = columns.map((col, ci) => {
        if (col.hidden) return '';
        const isDate = col.type === COL_DATE
          || (!col.type && !col.entity && !col.template && !col.calc);
        if (period === 'timespan' && isDate) return '';
        const isHourDrill = isDate && period === 'hour' && hourDrillable;
        const cls = isDate ? (dateClickable ? ` class="date-cell${isHourDrill ? ' hour-drill' : ''}"` : '') : ' class="right"';
        // Sticky first column must be opaque → use gradient trick with --ht-first-col-bg as base.
        // Other columns use plain background-color (semi-transparent entity colors intentionally
        // mix with the row background for a tinted look).
        const bgStyle = col.background_color
          ? (ci === _firstVisCi
              ? `background-image:linear-gradient(${col.background_color},${col.background_color}),linear-gradient(var(--ht-first-col-bg,transparent),var(--ht-first-col-bg,transparent));background-color:var(--ha-card-background,var(--card-background-color,white))`
              : `background-color:${col.background_color}`)
          : '';
        const styleAttr = [col.color ? `color:${col.color}` : '', bgStyle, ..._colExtraStyle(col)].filter(Boolean).join(';');
        const styleStr = styleAttr ? ` style="${styleAttr}"` : '';
        let cellContent = row.cells[ci] ?? '–';
        if (compareActive && row.compareCells) {
          const cmpStr = row.compareCells[ci];
          if (cmpStr !== null && cmpStr !== undefined) {
            const cmpTitle = row.compareDate ? escapeHtml(fmtDate.format(row.compareDate)) : '';
            cellContent = `<span class="compare-val" title="${cmpTitle}">(${cmpStr})</span>` + cellContent;
          }
        }
        return `<td${cls}${styleStr}>${cellContent}</td>`;
      }).join('');
      return `<tr data-start="${row.start.getTime()}">${cells}</tr>`;
    }).join('');

    return `
      <table>
        ${this._config.hide_table_header ? '' : `<thead><tr>${headers}</tr></thead>`}
        <tbody>${bodyRows}</tbody>
      </table>`;
  }

  /** Columns-Modus transponiert: Zeilen = Entities/Calc, Spalten = Daten. */
  _renderColumnsTableTransposed() {
    const columns = this._config.columns;
    if (!this._tableData.length) {
      return '<div class="state-message">Keine Daten im gew\u00e4hlten Zeitraum.</div>';
    }

    const period        = this._effectivePeriod || this._config.period || 'day';
    const locale        = this._hass?.language?.replace('_', '-') || 'de-DE';
    const compareActive = this._compareRange !== null && Object.keys(this._compareRawStats).length > 0;
    const showTime      = ['hour', '5minute'].includes(period);
    const fmtDate       = new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      ...(showTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });

    // Identify date vs. value column indices
    const dateColIdx = columns.findIndex(col =>
      col.type === COL_DATE || (!col.type && !col.entity && !col.template && !col.calc)
    );
    const valueColIndices = columns
      .map((col, ci) => ({ col, ci }))
      .filter(({ col }) => !(col.type === COL_DATE || (!col.type && !col.entity && !col.template && !col.calc)))
      .map(({ ci }) => ci);

    if (!valueColIndices.length) {
      return '<div class="state-message">Keine Wert-Spalten f\u00fcr transponierte Ansicht.</div>';
    }

    // Date rows in natural ascending order
    let dateRows = [...this._tableData].sort((a, b) => a.start - b.start);

    // Build entity rows (one per value column), vals indexed by dateRows position
    let entityRows = valueColIndices.map(ci => {
      const col   = columns[ci];
      const label = col.name
        || (col.type === COL_ENERGY && col.energy_key ? this._resolveEnergyLabel(col.energy_key) : null)
        || (col.entity ? this._getFriendlyName(col.entity, col) : null)
        || col.entity || 'Wert';
      const vals    = dateRows.map(row => row.cells[ci] ?? '\u2013');
      const cmpVals  = dateRows.map(row => (compareActive && row.compareCells) ? row.compareCells[ci] : null);
      const cmpDates = dateRows.map(row => row.compareDate || null);
      return { ci, col, label, vals, cmpVals, cmpDates };
    });

    // Sort DATE COLUMNS: tsr=-1 → chronological, tsr>=0 → by entity row values
    const tsr = (this._config.enable_sort === false || period === 'timespan') ? null : this._transSortRow;
    const tsd = this._transSortDir;
    if (tsr === -1) {
      const sortIdx = dateRows.map((_, j) => j).sort((ja, jb) =>
        tsd === 'asc' ? dateRows[ja].start - dateRows[jb].start : dateRows[jb].start - dateRows[ja].start
      );
      dateRows = sortIdx.map(j => dateRows[j]);
      for (const er of entityRows) {
        er.vals    = sortIdx.map(j => er.vals[j]);
        er.cmpVals  = sortIdx.map(j => er.cmpVals[j]);
        er.cmpDates = sortIdx.map(j => er.cmpDates[j]);
      }
    } else if (tsr !== null && tsr < entityRows.length) {
      const sortRow    = entityRows[tsr];
      const sortIdx    = dateRows.map((_, j) => j).sort((ja, jb) => {
        const av = this._cellSortValue(sortRow.vals[ja]);
        const bv = this._cellSortValue(sortRow.vals[jb]);
        return tsd === 'asc' ? this._compareSortValues(av, bv) : this._compareSortValues(bv, av);
      });
      dateRows = sortIdx.map(j => dateRows[j]);
      for (const er of entityRows) {
        er.vals    = sortIdx.map(j => er.vals[j]);
        er.cmpVals  = sortIdx.map(j => er.cmpVals[j]);
        er.cmpDates = sortIdx.map(j => er.cmpDates[j]);
      }
    }

    // Header: first <th> sortable when sort enabled
    const _rowHdrCfg = this._config.transposed_row_header;
    const _valHdrCfg = this._config.transposed_value_header;
    const _bothEmpty = period === 'timespan' && !_rowHdrCfg && !_valHdrCfg;
    const _hideHdr   = _bothEmpty || this._config.hide_table_header;
    const entityColLabel = _rowHdrCfg
      || (period === 'timespan' ? (_valHdrCfg ? this._tr('lbl_transposed_row_default') : '') : (dateColIdx >= 0 ? (columns[dateColIdx].name || this._tr('lbl_transposed_row_default')) : this._tr('lbl_transposed_row_default')));
    const _kwStyle = this._config.transposed_col_width_key ? `width:${Number(this._config.transposed_col_width_key)}%` : '';
    const _kwPct = _kwStyle ? ` style="${_kwStyle}"` : '';
    const _vwStyle = this._config.transposed_col_width_value ? `width:${Number(this._config.transposed_col_width_value)}%` : '';
    const _vwPct   = _vwStyle ? ` style="${_vwStyle}"` : '';
    const dateHeaderCells = dateRows.map(row => {
      if (period === 'timespan') {
        const valHdr = _valHdrCfg || (_rowHdrCfg ? this._tr('lbl_transposed_val_default') : '');
        return `<th class="right"${_vwPct}>${escapeHtml(valHdr)}</th>`;
      }
      const dateCellRaw = this._config.transposed_value_header
        ? escapeHtml(this._config.transposed_value_header)
        : (dateColIdx >= 0 ? (row.cells[dateColIdx] ?? '') : escapeHtml(fmtDate.format(row.start)));
      return `<th class="right"${_vwPct}>${dateCellRaw}</th>`;
    }).join('');
    const hdrActive = tsr === -1;
    const hdrIcon   = hdrActive ? (tsd === 'asc' ? '\u25b2' : '\u25bc') : '\u21c5';
    const hdrCls    = `transposed-first${hdrActive ? ' sort-row-active' : ''}`;
    const hdrAttrs  = (this._config.enable_sort === false || period === 'timespan') ? '' : ` data-trans-sort-row="-1"`;
    const hdrIconHtml = (this._config.enable_sort === false || period === 'timespan') ? '' : `<span class="sort-icon">${hdrIcon}</span>`;
    const headers = `<th class="${hdrCls}"${hdrAttrs}${_kwPct}>${escapeHtml(entityColLabel)}${hdrIconHtml}</th>${dateHeaderCells}`;

    // Body rows: first cell is sortable (click → sort date columns by this entity)
    const showBullet  = this._showColorBullet || entityRows.some(r => !r.col.hidden && r.col.bullet);
    const bodyRows = entityRows.map(({ ci, col, label, vals, cmpVals, cmpDates }, rowIdx) => {
      if (col.hidden) return '';
      const bgStyle   = col.background_color ? `background-color:${col.background_color}` : '';
      const extraStyleParts = _colExtraStyle(col).filter(s => !s.startsWith('text-align'));
      const styleAttr = [col.color ? `color:${col.color}` : '', bgStyle, ...extraStyleParts].filter(Boolean).join(';');
      const styleStr  = styleAttr ? ` style="${styleAttr}"` : '';
      // Sticky first cell: use background-image trick so semi-transparent entity colors
      // render over an opaque card-background base (prevents see-through on scroll)
      const firstBgStyle = col.background_color
        ? `background-image:linear-gradient(${col.background_color},${col.background_color}),linear-gradient(var(--ht-first-col-bg,transparent),var(--ht-first-col-bg,transparent));background-color:var(--ha-card-background,var(--card-background-color,white))`
        : '';
      const firstStyle = [col.color ? `color:${col.color}` : '', firstBgStyle].filter(Boolean).join(';');
      const firstStyleStr = firstStyle ? ` style="${firstStyle}"` : '';
      const active    = tsr === rowIdx;
      const icon      = active ? (tsd === 'asc' ? '\u25b2' : '\u25bc') : '\u21c5';
      const firstCls  = `transposed-first${active ? ' sort-row-active' : ''}`;
      const rowAttrs  = (this._config.enable_sort === false || period === 'timespan') ? '' : ` data-trans-sort-row="${rowIdx}"`;
      const rowIcon   = (this._config.enable_sort === false || period === 'timespan') ? '' : `<span class="sort-icon">${icon}</span>`;
      const entityAttrFirst = (this._config.enable_sort === false || period === 'timespan') && col.entity ? ` data-entity="${escapeHtml(col.entity)}"` : '';
      // (s) marker in edit mode for server-side rendered columns
      const sMarker = (this._isInEditMode() && this._colNeedsServerRender(col))
        ? `<span style="opacity:0.4;font-size:0.7em;margin-left:3px;vertical-align:super" title="Jinja2 server-side rendered">(s)</span>`
        : '';

      let bulletTd = '';
      if (showBullet) {
        const showEntityBullet = this._showColorBullet ? col.bullet !== false : !!col.bullet;
        const hasExplicitColor = !!(col.bullet_color || col.background_color);
        if (showEntityBullet && hasExplicitColor) {
          const solidColor = col.bullet_color || _solidColorFromBg(col.background_color);
          const bgColor = solidColor
            ? (/^#[0-9a-f]{6}$/i.test(solidColor)
                ? `${solidColor}7F`
                : `color-mix(in srgb, ${solidColor} 50%, transparent)`)
            : 'transparent';
          const bulletCellBg = col.background_color
            ? `background-image:linear-gradient(${col.background_color},${col.background_color}),linear-gradient(var(--ht-first-col-bg,transparent),var(--ht-first-col-bg,transparent));background-color:var(--ha-card-background,var(--card-background-color,white))`
            : '';
          bulletTd = `<td class="cell-bullet"${bulletCellBg ? ` style="${bulletCellBg}"` : ''}><div class="bullet" style="border-color:${solidColor || 'transparent'};background-color:${bgColor};"></div></td>`;
        } else {
          bulletTd = '<td class="cell-bullet"></td>';
        }
      }

      const valueCells = vals.map((cellContent, di) => {
        const cmpStr  = cmpVals[di];
        const cmpDate = cmpDates[di];
        let content   = cellContent;
        if (cmpStr !== null && cmpStr !== undefined) {
          const cmpTitle = cmpDate ? escapeHtml(fmtDate.format(cmpDate)) : '';
          content = `<span class="compare-val" title="${cmpTitle}">(${cmpStr})</span>` + content;
        }
        return `<td class="right"${styleStr}>${content}</td>`;
      }).join('');

      return `<tr>${bulletTd}<td class="${firstCls}"${rowAttrs}${entityAttrFirst}${firstStyleStr ? firstStyleStr : (styleStr || '')}>${escapeHtml(label)}${sMarker}${rowIcon}</td>${valueCells}</tr>`;
    }).join('');

    const bulletHdrCell = showBullet ? '<th class="cell-bullet"></th>' : '';
    const _colgroup = (() => {
      const cols = [];
      if (showBullet) cols.push('<col style="width:48px">');
      if (_kwStyle) cols.push(`<col style="${_kwStyle}">`);
      if (_vwStyle) {
        for (let _ci = 0; _ci < dateRows.length; _ci++) cols.push(`<col style="${_vwStyle}">`);
      }
      return cols.length ? `<colgroup>${cols.join('')}</colgroup>` : '';
    })();
    return `
      <table>
        ${_colgroup}
        ${_hideHdr ? '' : `<thead><tr>${bulletHdrCell}${headers}</tr></thead>`}
        <tbody>${bodyRows}</tbody>
      </table>`;
  }

  /** Entities-Modus transponiert: Zeilen = Entities, Spalten = Daten. */
  _renderLegacyBlocksTransposed() {
    const config   = this._config;
    const period   = this._effectivePeriod || config.period || 'day';
    const locale   = this._hass?.language?.replace('_', '-') || 'de-DE';
    const dateFmt  = config.date_format || 'short';
    const showTime = ['hour', '5minute'].includes(period);
    const fmtDate  = new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      ...(showTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
    const entities   = config.entities || (config.entity ? [config.entity] : []);
    const normalized = entities.map(e => (typeof e === 'string' ? { entity: e } : e));
    if (!normalized.length) {
      return '<div class="state-message">Keine Entit\u00e4ten konfiguriert.</div>';
    }

    // Build timeline (sorted ascending, filtered at range boundary)
    const timeMap = new Map();
    for (const ec of normalized) {
      for (const row of (this._legacyStats[ec.entity] || [])) {
        if (!timeMap.has(row.start)) timeMap.set(row.start, new Date(row.start));
      }
    }
    const { end: endBoundary } = this._getDateRange();
    let timeline = [...timeMap.entries()]
      .sort((a, b) => a[1] - b[1])
      .filter(([, date]) => date < endBoundary);
    if (!timeline.length) {
      return '<div class="state-message">Keine Daten im gew\u00e4hlten Zeitraum.</div>';
    }

    // Column metadata per entity
    const cols = normalized.map(ec => {
      const sc = this._hass?.states?.[ec.entity]?.attributes?.state_class;
      const statType = chooseAllowedStatType(ec.stat_type || config.stat_type || 'mean', [sc]).statType;
      const decimals = ec.decimals ?? 2;
      const factor   = ec.factor   ?? 1;
      const unit     = ec.unit     ?? (factor !== 1 ? '' : this._getUnit(ec.entity));
      const header   = ec.name || ec.label || this._getFriendlyName(ec.entity, ec);
      const lookup   = new Map();
      for (const row of (this._legacyStats[ec.entity] || [])) {
        lookup.set(row.start, row[statType] ?? null);
      }
      return { header, decimals, factor, unit, lookup, entity: ec.entity, color: ec.color, background_color: ec.background_color, bullet_color: ec.bullet_color, text_align: ec.text_align, padding_top: ec.padding_top, padding_right: ec.padding_right, padding_bottom: ec.padding_bottom, padding_left: ec.padding_left, hidden: ec.hidden };
    });

    // Build entity rows with pre-computed formatted cell values (indexed by timeline position)
    let entityRows = cols.map(c => {
      const vals = timeline.map(([iso]) => {
        const raw = c.lookup.get(iso);
        if (raw === null || raw === undefined) return '\u2013';
        return escapeHtml(`${fmtNum(raw * c.factor, c.decimals, locale)}${c.unit ? '\u202f' + c.unit : ''}`);
      });
      return { c, vals };
    });

    // Sort DATE COLUMNS: tsr=-1 → chronological, tsr>=0 → by entity row values
    const tsr = (this._config.enable_sort === false || period === 'timespan') ? null : this._transSortRow;
    const tsd = this._transSortDir;
    if (tsr === -1) {
      const sortIdx = timeline.map((_, j) => j).sort((ja, jb) =>
        tsd === 'asc' ? timeline[ja][1] - timeline[jb][1] : timeline[jb][1] - timeline[ja][1]
      );
      timeline = sortIdx.map(j => timeline[j]);
      for (const er of entityRows) {
        er.vals = sortIdx.map(j => er.vals[j]);
      }
    } else if (tsr !== null && tsr < entityRows.length) {
      const sortRow = entityRows[tsr];
      const sortIdx = timeline.map((_, j) => j).sort((ja, jb) => {
        const av = this._cellSortValue(sortRow.vals[ja]);
        const bv = this._cellSortValue(sortRow.vals[jb]);
        return tsd === 'asc' ? this._compareSortValues(av, bv) : this._compareSortValues(bv, av);
      });
      timeline = sortIdx.map(j => timeline[j]);
      for (const er of entityRows) {
        er.vals = sortIdx.map(j => er.vals[j]);
      }
    }

    // Header: first <th> is sortable (click → sort date columns chronologically)
    const hdrActive  = tsr === -1;
    const hdrIcon    = hdrActive ? (tsd === 'asc' ? '\u25b2' : '\u25bc') : '\u21c5';
    const hdrCls     = `transposed-first${hdrActive ? ' sort-row-active' : ''}`;
    const hdrAttrsL  = (this._config.enable_sort === false || period === 'timespan') ? '' : ` data-trans-sort-row="-1"`;
    const hdrIconL   = (this._config.enable_sort === false || period === 'timespan') ? '' : `<span class="sort-icon">${hdrIcon}</span>`;
    const _rowHdrCfgL = this._config.transposed_row_header;
    const _valHdrCfgL = this._config.transposed_value_header;
    const _bothEmptyL = period === 'timespan' && !_rowHdrCfgL && !_valHdrCfgL;
    const _hideHdrL   = _bothEmptyL || this._config.hide_table_header;
    const entityLabelL = _rowHdrCfgL || (_valHdrCfgL ? this._tr('lbl_transposed_row_default') : (period !== 'timespan' ? this._tr('lbl_transposed_row_default') : ''));
    const _kwStyleL = this._config.transposed_col_width_key ? `width:${Number(this._config.transposed_col_width_key)}%` : '';
    const _kwPctL = _kwStyleL ? ` style="${_kwStyleL}"` : '';
    const _vwStyleL = this._config.transposed_col_width_value ? `width:${Number(this._config.transposed_col_width_value)}%` : '';
    const _vwPctL   = _vwStyleL ? ` style="${_vwStyleL}"` : '';
    const dateHeaders = timeline.map(([iso, date]) => {
      if (this._config.transposed_value_header) {
        return `<th class="right"${_vwPctL}>${escapeHtml(this._config.transposed_value_header)}</th>`;
      }
      if (period === 'timespan') {
        const valHdr = _valHdrCfgL || (_rowHdrCfgL ? this._tr('lbl_transposed_val_default') : '');
        return `<th class="right"${_vwPctL}>${escapeHtml(valHdr)}</th>`;
      }
      let dateStr;
      {
        dateStr = formatDate(date, period, dateFmt, locale);
      }
      return `<th class="right"${_vwPctL}>${escapeHtml(dateStr)}</th>`;
    }).join('');
    const headers = `<th class="${hdrCls}"${hdrAttrsL}${_kwPctL}>${escapeHtml(entityLabelL)}${hdrIconL}</th>${dateHeaders}`;

    // Body: one row per entity; first cell sortable when sort enabled
    const showBulletL  = this._showColorBullet || entityRows.some(r => !r.c.hidden && r.c.bullet);
    const bodyRows = entityRows.map(({ c, vals }, rowIdx) => {
      if (c.hidden) return '';
      const extraStylePartsL = _colExtraStyle(c).filter(s => !s.startsWith('text-align'));
      const styleAttr = [c.color ? `color:${c.color}` : '', c.background_color ? `background-color:${c.background_color}` : '', ...extraStylePartsL].filter(Boolean).join(';');
      const styleStr  = styleAttr ? ` style="${styleAttr}"` : '';
      const firstBgStyleL = c.background_color
        ? `background-image:linear-gradient(${c.background_color},${c.background_color}),linear-gradient(var(--ht-first-col-bg,transparent),var(--ht-first-col-bg,transparent));background-color:var(--ha-card-background,var(--card-background-color,white))`
        : '';
      const firstStyle = [c.color ? `color:${c.color}` : '', firstBgStyleL].filter(Boolean).join(';');
      const firstStyleStr = firstStyle ? ` style="${firstStyle}"` : '';
      const active    = tsr === rowIdx;
      const icon      = active ? (tsd === 'asc' ? '\u25b2' : '\u25bc') : '\u21c5';
      const firstCls  = `transposed-first${active ? ' sort-row-active' : ''}`;
      const rowAttrs  = (this._config.enable_sort === false || period === 'timespan') ? '' : ` data-trans-sort-row="${rowIdx}"`;
      const rowIcon   = (this._config.enable_sort === false || period === 'timespan') ? '' : `<span class="sort-icon">${icon}</span>`;
      const entityAttrFirstL = (this._config.enable_sort === false || period === 'timespan') && c.entity ? ` data-entity="${escapeHtml(c.entity)}"` : '';

      let bulletTdL = '';
      if (showBulletL) {
        const showEntityBulletL = this._showColorBullet ? c.bullet !== false : !!c.bullet;
        const hasExplicitColorL = !!(c.bullet_color || c.background_color);
        if (showEntityBulletL && hasExplicitColorL) {
          const solidColorL = c.bullet_color || _solidColorFromBg(c.background_color);
          const bgColorL = solidColorL
            ? (/^#[0-9a-f]{6}$/i.test(solidColorL)
                ? `${solidColorL}7F`
                : `color-mix(in srgb, ${solidColorL} 50%, transparent)`)
            : 'transparent';
          const bulletCellBgL = c.background_color
            ? `background-image:linear-gradient(${c.background_color},${c.background_color}),linear-gradient(var(--ht-first-col-bg,transparent),var(--ht-first-col-bg,transparent));background-color:var(--ha-card-background,var(--card-background-color,white))`
            : '';
          bulletTdL = `<td class="cell-bullet"${bulletCellBgL ? ` style="${bulletCellBgL}"` : ''}><div class="bullet" style="border-color:${solidColorL || 'transparent'};background-color:${bgColorL};"></div></td>`;
        } else {
          bulletTdL = '<td class="cell-bullet"></td>';
        }
      }

      const valueCells = vals.map(cellContent =>
        `<td class="right"${styleStr}>${cellContent}</td>`
      ).join('');

      return `<tr>${bulletTdL}<td class="${firstCls}"${rowAttrs}${entityAttrFirstL}${firstStyleStr ? firstStyleStr : (styleStr || '')}>${escapeHtml(c.label)}${rowIcon}</td>${valueCells}</tr>`;
    }).join('');

    const bulletHdrCellL = showBulletL ? '<th class="cell-bullet"></th>' : '';
    const _colgroupL = (() => {
      const cols = [];
      if (showBulletL) cols.push('<col style="width:48px">');
      if (_kwStyleL) cols.push(`<col style="${_kwStyleL}">`);
      if (_vwStyleL) {
        for (let _ci = 0; _ci < timeline.length; _ci++) cols.push(`<col style="${_vwStyleL}">`);
      }
      return cols.length ? `<colgroup>${cols.join('')}</colgroup>` : '';
    })();
    return `
      <table>
        ${_colgroupL}
        ${_hideHdrL ? '' : `<thead><tr>${bulletHdrCellL}${headers}</tr></thead>`}
        <tbody>${bodyRows}</tbody>
      </table>`;
  }

  /** Entities-Modus: alle Entities in einer gemeinsamen Tabelle nebeneinander. */
  _renderLegacyBlocks() {
    const config  = this._config;
    const period  = this._effectivePeriod || config.period || 'day';
    const hasNav        = !!(this._config.collection_key || this._config.custom_start_date || this._config.initial_period || this._config.show_date_links !== false);
    const hourDrillable = hasNav && (this._config.aggregation?.hour === '5minute');
    const dateClickable = hasNav && this._config.show_date_links !== false && (['hour', 'day', 'week', 'month', 'year'].includes(period));
    const locale  = this._hass?.language?.replace('_', '-') || 'de-DE';
    const dateFmt = config.date_format || 'short';
    const showTime = ['hour', '5minute'].includes(period);
    const fmtDate  = new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      ...(showTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
    const entities   = config.entities || (config.entity ? [config.entity] : []);
    const normalized = entities.map(e => (typeof e === 'string' ? { entity: e } : e));

    if (!normalized.length) {
      return '<div class="state-message">Keine Entitäten konfiguriert.</div>';
    }

    // Einheitliche Zeitachse über alle Entities
    const timeMap = new Map();
    for (const ec of normalized) {
      for (const row of (this._legacyStats[ec.entity] || [])) {
        if (!timeMap.has(row.start)) timeMap.set(row.start, new Date(row.start));
      }
    }
    const { end: endBoundary } = this._getDateRange();
    // HA recorder liefert manchmal die Zeile start==end_time mit (exklusive Grenze)
    const timeline = [...timeMap.entries()]
      .sort((a, b) => a[1] - b[1])
      .filter(([, date]) => date < endBoundary);

    if (!timeline.length) {
      return '<div class="state-message">Keine Daten im gewählten Zeitraum.</div>';
    }

    // Spalten-Metadaten + Lookup-Map pro Entity
    const cols = normalized.map(ec => {
      const sc = this._hass?.states?.[ec.entity]?.attributes?.state_class;
      const statType = chooseAllowedStatType(ec.stat_type || config.stat_type || 'mean', [sc]).statType;
      const decimals = ec.decimals ?? 2;
      const factor   = ec.factor   ?? 1;
      const unit     = ec.unit     ?? (factor !== 1 ? '' : this._getUnit(ec.entity));
      const header   = ec.name || ec.label || this._getFriendlyName(ec.entity, ec);
      const lookup   = new Map();
      for (const row of (this._legacyStats[ec.entity] || [])) {
        lookup.set(row.start, row[statType] ?? null);
      }
      // Vergleichs-Lookup (mainTimestamp → compareValue)
      const cmpLookup = (this._compareRange !== null && Object.keys(this._compareRawStats).length > 0)
        ? this._buildCompareLookup(ec.entity, statType)
        : null;
      return { header, statType, decimals, factor, unit, lookup, cmpLookup, entity: ec.entity, color: ec.color, background_color: ec.background_color, bullet_color: ec.bullet_color, text_align: ec.text_align, padding_top: ec.padding_top, padding_right: ec.padding_right, padding_bottom: ec.padding_bottom, padding_left: ec.padding_left };
    });

    // Zeilen aufbauen (col 0 = Datum, col 1..N = Entity-Werte)
    let rows = timeline.map(([iso, date]) => {
      let dateStr;
      if (period === 'timespan') {
        // Eine einzige Zeile: gesamten Zeitraum anzeigen
        const { end: rEnd } = this._getDateRange();
        const displayEnd = (rEnd.getHours() === 0 && rEnd.getMinutes() === 0 &&
          rEnd.getSeconds() === 0 && rEnd.getMilliseconds() === 0)
          ? new Date(rEnd.getTime() - 1) : rEnd;
        dateStr = formatDate(date, 'day', dateFmt, locale) + ' – ' + formatDate(displayEnd, 'day', dateFmt, locale);
      } else {
        dateStr = formatDate(date, period, dateFmt, locale);
      }
      return {
        date,
        cells: [
          escapeHtml(dateStr),
          ...cols.map(c => {
            const raw = c.lookup.get(iso);
            if (raw === null || raw === undefined) return '–';
            const value = raw * c.factor;
            return escapeHtml(`${fmtNum(value, c.decimals, locale)}${c.unit ? '\u202f' + c.unit : ''}`);
          }),
        ],
      };
    });

    // Sortierung anwenden
    const colCount = cols.length + 1;
    if (this._sortCol !== null && this._sortCol < colCount) {
      if (this._sortCol === 0) {
        rows.sort((a, b) => this._sortDir === 'asc' ? a.date - b.date : b.date - a.date);
      } else {
        rows.sort((a, b) => {
          const av = this._cellSortValue(a.cells[this._sortCol]);
          const bv = this._cellSortValue(b.cells[this._sortCol]);
          return this._sortDir === 'asc'
            ? this._compareSortValues(av, bv)
            : this._compareSortValues(bv, av);
        });
      }
    }

    // Header-Zeile mit Sortier-Indikatoren
    const colDefs = [{ label: 'Datum', isDate: true, color: null, background_color: null, entity: null }, ...cols.map(c => ({ label: c.name, isDate: false, color: c.color, background_color: c.background_color, entity: c.entity }))];
    const headers = colDefs.map(({ label, isDate, color, background_color, entity }, ci) => {
      const active = this._sortCol === ci;
      const cls = [isDate ? null : 'right', active ? 'sort-active' : null].filter(Boolean).join(' ');
      const icon = active ? (this._sortDir === 'asc' ? '▲' : '▼') : '⇅';
      const styleAttr = [color ? `color:${color}` : '', background_color ? `background-color:${background_color}` : '', ..._colExtraStyle(_col)].filter(Boolean).join(';');
      const styleStr = styleAttr ? ` style="${styleAttr}"` : '';
      if (this._config.enable_sort === false || period === 'timespan') {
        const plainCls = [isDate ? null : 'right'].filter(Boolean).join(' ');
        const entityAttrHdr = (!isDate && entity) ? ` data-entity="${escapeHtml(entity)}"` : '';
        return `<th${plainCls ? ` class="${plainCls}"` : ''}${entityAttrHdr}${styleStr}>${escapeHtml(label)}</th>`;
      }
      return `<th data-col-idx="${ci}"${cls ? ` class="${cls}"` : ''}${styleStr}>${escapeHtml(label)}<span class="sort-icon">${icon}</span></th>`;
    }).join('');

    const bodyRows = rows.map(row =>
      `<tr data-start="${row.date.getTime()}">${row.cells.map((cell, ci) => {
        const isHourDrill = ci === 0 && period === 'hour' && hourDrillable;
        const cls = ci === 0 ? (dateClickable ? ` class="date-cell${isHourDrill ? ' hour-drill' : ''}"` : '') : ' class="right"';
        if (ci === 0) {
          let dateCellContent = cell;
          if (this._compareRange) {
            const usesMonthOffset = (period === 'month' || period === 'year');
            let cmpDate;
            if (usesMonthOffset) {
              const mainStart = this._energyStart || this._getDateRange().start;
              const cmpStart  = this._compareRange.start;
              const mOff = (cmpStart.getFullYear() - mainStart.getFullYear()) * 12
                         + (cmpStart.getMonth()    - mainStart.getMonth());
              cmpDate = new Date(row.date.getFullYear(), row.date.getMonth() + mOff, 1);
            } else {
              const offsetDays = Math.round(this._compareOffset / (24 * 3600000));
              cmpDate = new Date(row.date.getFullYear(), row.date.getMonth(), row.date.getDate() + offsetDays);
            }
            const cmpStr   = escapeHtml(formatDate(cmpDate, period, dateFmt, locale));
            const cmpTitle = escapeHtml(fmtDate.format(cmpDate));
            dateCellContent = `<span class="compare-val" title="${cmpTitle}">(${cmpStr})</span>` + dateCellContent;
          }
          return `<td${cls}>${dateCellContent}</td>`;
        }
        const c = cols[ci - 1];
        let cellContent = cell;
        if (c.cmpLookup) {
          const cmpRaw = c.cmpLookup.get(this._localDateKey(row.date));
          if (cmpRaw !== null && cmpRaw !== undefined) {
            const cmpVal = cmpRaw * c.factor;
            const cmpStr = escapeHtml(`${fmtNum(cmpVal, c.decimals, locale)}${c.unit ? '\u202f' + c.unit : ''}`);
            const offsetDays = Math.round(this._compareOffset / (24 * 3600000));
            const cmpDate = new Date(row.date.getFullYear(), row.date.getMonth(), row.date.getDate() + offsetDays);
            const cmpTitle = escapeHtml(fmtDate.format(cmpDate));
            cellContent = `<span class="compare-val" title="${cmpTitle}">(${cmpStr})</span>` + cellContent;
          }
        }
        const entityStyleAttr = [c.color ? `color:${c.color}` : '', c.background_color ? `background-color:${c.background_color}` : '', ..._colExtraStyle(c)].filter(Boolean).join(';');
        const entityStyleStr = entityStyleAttr ? ` style="${entityStyleAttr}"` : '';
        return `<td${cls}${entityStyleStr}>${cellContent}</td>`;
      }).join('')}</tr>`
    ).join('');

    return `
      <table>
        ${this._config.hide_table_header ? '' : `<thead><tr>${headers}</tr></thead>`}
        <tbody>${bodyRows}</tbody>
      </table>`;
  }

  // ── Energy column helpers ──────────────────────────────────────────────────

  /** Load and cache energy/get_prefs.
   *  In energy mode the shared EnergyCollection already holds prefs – reuse
   *  them to avoid a duplicate WS call (same as native energy-dashboard cards). */
  async _ensureEnergyPrefs() {
    if (this._cachedEnergyPrefs) return this._cachedEnergyPrefs;
    // Reuse prefs from the shared energy collection when available (no extra WS call).
    if (this._isEnergyMode()) {
      const { coll } = this._getEnergyCollectionInfo();
      if (coll?.prefs?.energy_sources) {
        this._cachedEnergyPrefs = coll.prefs;
        return this._cachedEnergyPrefs;
      }
    }
    try {
      const raw = await this._hass.connection.sendMessagePromise({ type: 'energy/get_prefs' });
      const prefs = raw?.energy_sources ? raw : (raw?.result ?? raw ?? {});
      this._cachedEnergyPrefs = prefs;
    } catch (e) {
      console.warn('[HistoryTableCard] energy/get_prefs failed:', e);
      this._cachedEnergyPrefs = { energy_sources: [], device_consumption: [] };
    }
    return this._cachedEnergyPrefs;
  }

  /** Parse cached prefs into typed collections. */
  _parsedEnergyPrefs() {
    const p = this._cachedEnergyPrefs || {};
    const sources = p.energy_sources || [];
    const solar = sources.filter(s => s.type === 'solar').map(s => s.stat_energy_from).filter(Boolean);
    const waterStats = new Set();
    const addStat = (set, val) => {
      if (!val) return;
      if (typeof val === 'string') {
        const v = val.trim();
        if (v) set.add(v);
        return;
      }
      if (Array.isArray(val)) {
        for (const x of val) addStat(set, x);
        return;
      }
      if (typeof val === 'object') {
        addStat(set, val.statistic_id);
        addStat(set, val.entity_id);
        addStat(set, val.stat_water);
      }
    };
    const collectWater = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      ['stat_water_from', 'stat_water_to', 'stat_water', 'stat_water_usage', 'stat_water_consumption', 'stat_water_total']
        .forEach(k => addStat(waterStats, obj[k]));
      ['stat_water_entity', 'water_statistic_id', 'water_entity', 'water_entity_id']
        .forEach(k => addStat(waterStats, obj[k]));
    };
    let gridImport = null, gridExport = null, batteryCharge = null, batteryDischarge = null;
    for (const s of sources) {
      collectWater(s);
      if (s.type === 'grid') {
        if (!gridImport) gridImport = s.stat_energy_from || s.flow_from?.[0]?.stat_energy_from || null;
        if (!gridExport) gridExport = s.stat_energy_to   || s.flow_to?.[0]?.stat_energy_to   || null;
      }
      if (s.type === 'battery') {
        if (s.stat_energy_to   && !batteryCharge)    batteryCharge    = s.stat_energy_to;
        if (s.stat_energy_from && !batteryDischarge) batteryDischarge = s.stat_energy_from;
      }
      for (const f of s.flow_from || []) collectWater(f);
      for (const f of s.flow_to || []) collectWater(f);
    }
    for (const d of (p.device_consumption || [])) collectWater(d);
    // Only top-level devices: skip entries already counted by a parent
    // (included_whole_home_energy_manager: true = old flag; included_in_stat = new "vorgelagertes Gerät" field)
    const devices = (p.device_consumption || [])
      .filter(d => !d.included_whole_home_energy_manager && !d.included_in_stat)
      .map(d => d.stat_consumption)
      .filter(Boolean);
    const nestedDevices = (p.device_consumption || [])
      .filter(d => d.included_in_stat || d.included_whole_home_energy_manager)
      .filter(d => d.stat_consumption)
      .map(d => ({ stat: d.stat_consumption, name: d.name || null, parentStat: d.included_in_stat || null }));
    return {
      solar,
      gridImport,
      gridExport,
      batteryCharge,
      batteryDischarge,
      devices,
      nestedDevices,
      waterStats: [...waterStats],
    };
  }

  /** Return entity IDs for a given energy_key. */
  _resolveEnergyEntityIds(energyKey) {
    if (!this._cachedEnergyPrefs) return [];
    // Stable direct reference: stat:sensor.my_entity
    if (energyKey?.startsWith('stat:')) return [energyKey.slice(5)];
    const { solar, gridImport, gridExport, batteryCharge, batteryDischarge, devices, nestedDevices } = this._parsedEnergyPrefs();
    if (energyKey === 'pv_sum')            return solar;
    if (energyKey === 'grid_import')       return gridImport    ? [gridImport]    : [];
    if (energyKey === 'grid_export')       return gridExport    ? [gridExport]    : [];
    if (energyKey === 'battery_charge')    return batteryCharge ? [batteryCharge] : [];
    if (energyKey === 'battery_discharge') return batteryDischarge ? [batteryDischarge] : [];
    if (energyKey === 'device_sum')        return devices;
    const pvM = energyKey?.match(/^pv_(\d+)$/);
    if (pvM) { const idx = parseInt(pvM[1], 10) - 1; return solar[idx] ? [solar[idx]] : []; }
    const devM = energyKey?.match(/^device_(\d+)$/);
    if (devM) { const idx = parseInt(devM[1], 10) - 1; return devices[idx] ? [devices[idx]] : []; }
    const nestM = energyKey?.match(/^nested_(\d+)$/);
    if (nestM) { const idx = parseInt(nestM[1], 10) - 1; return nestedDevices[idx] ? [nestedDevices[idx].stat] : []; }
    return [];
  }

  /** Human-readable label for an energy_key.
   *  Static translation for well-known keys; friendly name from hass.states for pv_N/device_N/nested_N. */
  _resolveEnergyLabel(energyKey) {
    if (energyKey?.startsWith('stat:')) return this._getFriendlyName(energyKey.slice(5), {});
    const lang = (this._hass?.language || 'en').split('-')[0].toLowerCase();
    const dict = EDITOR_TRANSLATIONS[lang] || EDITOR_TRANSLATIONS['en'];
    const trKey = `energy_key_${energyKey}`;
    if (dict[trKey] !== undefined) return dict[trKey];
    if (this._cachedEnergyPrefs) {
      const { solar, devices, nestedDevices } = this._parsedEnergyPrefs();
      const pvM = energyKey?.match(/^pv_(\d+)$/);
      if (pvM) { const eid = solar[parseInt(pvM[1], 10) - 1]; if (eid) return this._getFriendlyName(eid, {}); }
      const devM = energyKey?.match(/^device_(\d+)$/);
      if (devM) { const eid = devices[parseInt(devM[1], 10) - 1]; if (eid) return this._getFriendlyName(eid, {}); }
      const nestM2 = energyKey?.match(/^nested_(\d+)$/);
      if (nestM2) { const nd = nestedDevices[parseInt(nestM2[1], 10) - 1]; if (nd) return nd.name || this._getFriendlyName(nd.stat, {}); }
    }
    return energyKey;
  }

  /** Wh → kWh factor (auto-detected from entity state), or col.factor override. */
  _getEnergyEntityFactor(entityId, colFactor, colUnit = null) {
    if (colFactor !== undefined && colFactor !== null) return Number(colFactor);
    const state = this._hass?.states?.[entityId];
    // Prefer statistics_unit_of_measurement: that is the unit the statistics API actually returns.
    // Falls back to unit_of_measurement for entities that don't expose the statistics attribute.
    const unit = state?.attributes?.statistics_unit_of_measurement
               ?? state?.attributes?.unit_of_measurement;
    const targetUnit = String(colUnit || '').toLowerCase();
    if (targetUnit === 'kw' && unit === 'W') return 0.001;
    if ((targetUnit === 'm3' || targetUnit === 'm³') && unit === 'L') return 0.001;
    return unit === 'Wh' ? 0.001 : 1;
  }

  /** Default display unit for an energy column when no explicit unit is configured. */
  _getEnergyColumnUnit(col, entityIds = null) {
    if (col?.hide_unit) return '';
    // Preserve explicit unit override, including empty string.
    if (col?.unit !== undefined && col?.unit !== null) return String(col.unit);

    const eids = Array.isArray(entityIds) ? entityIds : this._resolveEnergyEntityIds(col?.energy_key);
    if (!eids.length) return 'kWh';

    for (const eid of eids) {
      const state = this._hass?.states?.[eid];
      const rawUnit = state?.attributes?.statistics_unit_of_measurement
        ?? state?.attributes?.unit_of_measurement;
      if (!rawUnit) continue;
      const unit = String(rawUnit).trim();
      const lower = unit.toLowerCase();
      if (lower === 'wh') return 'kWh';
      if (lower === 'w') return 'kW';
      if (lower === 'l') return 'm3';
      return unit;
    }

    return 'kWh';
  }
}

// ─── Minimaler GUI-Editor ─────────────────────────────────────────────────────

class HistoryTableCardEditor extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config      = {};
    this._hass        = null;
    this._tab         = 'general';
    this._expandedCol = -1;
    this._expandedQmi = -1;
    this._padOpen     = null;
    this._ownUpdate   = false;  // prevents setConfig re-render when we fire config-changed
    this._energyMsg   = null;   // { type: 'ok'|'err', text: string } feedback after energy load
    this._cachedEnergyPrefs = null;  // editor's own energy prefs cache (separate from card)
  }

  _t(key) {
    const lang = (this._hass?.language || 'en').split('-')[0].toLowerCase();
    const tr = EDITOR_TRANSLATIONS[lang] || EDITOR_TRANSLATIONS['en'];
    return tr[key] ?? EDITOR_TRANSLATIONS['en'][key] ?? key;
  }

  setConfig(config) {
    // HA calls setConfig after every config-changed event we dispatch ourselves.
    // Skip re-render in that case to avoid destroying focused inputs / pickers.
    if (this._ownUpdate) { this._ownUpdate = false; return; }
    this._config = JSON.parse(JSON.stringify(config));
    // Removed global precision key; keep precision only per column/entity.
    delete this._config.decimals;
    // Auto-migrate legacy entity/entities → columns
    if (!Array.isArray(this._config.columns)) {
      const ents = Array.isArray(this._config.entities)
        ? this._config.entities
        : (this._config.entity ? [this._config.entity] : []);
      const cols = [{ type: 'date', name: 'Datum' }];
      for (const e of ents) {
        const ec = typeof e === 'string' ? { entity: e } : { ...e };
        cols.push({ type: 'entity', name: ec.name || ec.entity || '', ...ec });
      }
      this._config.columns = cols;
      delete this._config.entities;
      delete this._config.entity;
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  _fire() {
    this._ownUpdate = true;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _detectCollectionKeyFromDashboardPicker() {
    try {
      const queue = [document];
      const seen = new Set();
      while (queue.length) {
        const root = queue.shift();
        if (!root || seen.has(root) || !root.querySelectorAll) continue;
        seen.add(root);
        const all = root.querySelectorAll('*');
        for (const el of all) {
          if (el?.shadowRoot) queue.push(el.shadowRoot);
          const cfg = el?.config || el?._config || el?.__config || el?.cardConfig || null;
          const tag = (el?.tagName || '').toLowerCase();
          const isEnergyPicker =
            tag.includes('energy-date-selection')
            || cfg?.type === 'energy-date-selection'
            || cfg?.type === 'custom:energy-date-selection';
          if (!isEnergyPicker) continue;
          const key = cfg?.collection_key;
          if (typeof key === 'string' && key.trim()) return key.trim();
        }
      }
    } catch (_) {}
    return null;
  }

  _detectCollectionKey() {
    // Enumerate live _energy* collections on hass.connection and prefer
    // the collection key for the CURRENT dashboard (panelUrl).
    const existing = this._config.collection_key || null;
    if (existing) return existing;

    // Prefer explicit collection_key from the active energy-date-selection card.
    const pickerKey = this._detectCollectionKeyFromDashboardPicker();
    if (pickerKey) return pickerKey;

    try {
      const allKeys = [...new Set([
        ...Object.keys(this._hass.connection),
        ...Object.getOwnPropertyNames(this._hass.connection),
      ])];
      const candidates = allKeys.filter(k => /^_energy(_\S+)?$/.test(k));
      if (!candidates.length) return null;

      const panelUrl = String(this._hass?.panelUrl || '').trim();
      const panelKey = panelUrl ? `_energy_${panelUrl}` : null;

      // 1) Exact match for this dashboard panel
      if (panelKey && candidates.includes(panelKey)) return panelKey.slice(1);
      // 2) Generic legacy energy collection
      if (candidates.includes('_energy')) return 'energy';
      // 3) Unambiguous single candidate fallback
      if (candidates.length === 1) return candidates[0].slice(1);
    } catch (_) {}
    return null;
  }

  _set(key, value) {
    if (key === '__range_mode') {
      // Virtual key: translate to actual config fields
      const c = { ...this._config };
      // Clear all mode-specific keys first
      delete c.follow_energy_picker;
      delete c.custom_start_date;
      delete c.initial_period;
      delete c.collection_key;
      if (value !== 'days') delete c.days_to_show;
      else if (c.days_to_show == null) c.days_to_show = 7;
      if (value === 'energy') {
        // Auto-detect collection_key — this is all that's needed to follow the Energy datepicker
        const detectedKey = this._detectCollectionKey();
        if (detectedKey) c.collection_key = detectedKey;
      } else if (value === 'period') {
        // Use previously set initial_period or default to 'today' (first valid entry)
        c.initial_period = this._config.initial_period || 'today';
      } else if (value === 'custom') {
        // Use today as sentinel (non-empty so HA won't strip it)
        const today = new Date().toISOString().slice(0, 10);
        c.custom_start_date = this._config.custom_start_date || today;
      }
      // 'days' → only days_to_show remains (already set)
      this._config = c;
      this._fire(); this._render();
      return;
    }
    if (value === null || value === undefined || value === '') {
      const c = { ...this._config }; delete c[key]; this._config = c;
    } else {
      this._config = { ...this._config, [key]: value };
    }
    this._fire();
  }

  _colType(col) {
    return col.type || (col.entity ? 'entity' : (col.template || col.calc ? 'calc' : 'date'));
  }

  // ── Energy column helpers ──────────────────────────────────────────────────

  /** Load and cache energy/get_prefs, then trigger re-render. */
  async _ensureEnergyPrefs() {
    if (this._cachedEnergyPrefs) return this._cachedEnergyPrefs;
    try {
      const raw = await this._hass.connection.sendMessagePromise({ type: 'energy/get_prefs' });
      const prefs = raw?.energy_sources ? raw : (raw?.result ?? raw ?? {});
      this._cachedEnergyPrefs = prefs;
    } catch (e) {
      console.warn('[HistoryTableCard] energy/get_prefs failed:', e);
      this._cachedEnergyPrefs = { energy_sources: [], device_consumption: [] };
    }
    return this._cachedEnergyPrefs;
  }

  /** Parse cached prefs into typed collections for easy access. */
  _parsedEnergyPrefs() {
    const p = this._cachedEnergyPrefs || {};
    const sources = p.energy_sources || [];
    const solar = sources.filter(s => s.type === 'solar').map(s => s.stat_energy_from).filter(Boolean);
    const waterStats = new Set();
    const addStat = (set, val) => {
      if (!val) return;
      if (typeof val === 'string') {
        const v = val.trim();
        if (v) set.add(v);
        return;
      }
      if (Array.isArray(val)) {
        for (const x of val) addStat(set, x);
        return;
      }
      if (typeof val === 'object') {
        addStat(set, val.statistic_id);
        addStat(set, val.entity_id);
        addStat(set, val.stat_water);
      }
    };
    const collectWater = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      ['stat_water_from', 'stat_water_to', 'stat_water', 'stat_water_usage', 'stat_water_consumption', 'stat_water_total']
        .forEach(k => addStat(waterStats, obj[k]));
      ['stat_water_entity', 'water_statistic_id', 'water_entity', 'water_entity_id']
        .forEach(k => addStat(waterStats, obj[k]));
    };
    let gridImport = null, gridExport = null, batteryCharge = null, batteryDischarge = null;
    for (const s of sources) {
      collectWater(s);
      if (s.type === 'grid') {
        if (!gridImport)  gridImport  = s.stat_energy_from || s.flow_from?.[0]?.stat_energy_from || null;
        if (!gridExport)  gridExport  = s.stat_energy_to   || s.flow_to?.[0]?.stat_energy_to   || null;
      }
      if (s.type === 'battery') {
        if (s.stat_energy_to   && !batteryCharge)    batteryCharge    = s.stat_energy_to;
        if (s.stat_energy_from && !batteryDischarge) batteryDischarge = s.stat_energy_from;
      }
      if (s.type === 'water') {
        addStat(waterStats, s.stat_water_usage || s.stat_water || s.stat_energy_from);
      }
      for (const f of s.flow_from || []) collectWater(f);
      for (const f of s.flow_to || []) collectWater(f);
    }
    for (const d of (p.device_consumption || [])) collectWater(d);
    // Only top-level devices: skip sub-devices already counted by a parent meter
    // (included_whole_home_energy_manager: true = old flag; included_in_stat = new "vorgelagertes Gerät" field)
    const devices = (p.device_consumption || [])
      .filter(d => !d.included_whole_home_energy_manager && !d.included_in_stat)
      .map(d => d.stat_consumption)
      .filter(Boolean);
    const nestedDevices = (p.device_consumption || [])
      .filter(d => d.included_in_stat || d.included_whole_home_energy_manager)
      .filter(d => d.stat_consumption)
      .map(d => ({ stat: d.stat_consumption, name: d.name || null, parentStat: d.included_in_stat || null }));
    return {
      solar,
      gridImport,
      gridExport,
      batteryCharge,
      batteryDischarge,
      devices,
      nestedDevices,
      waterStats: [...waterStats],
    };
  }

  /** Return the list of entity IDs contributing to a given energy_key. */
  _resolveEnergyEntityIds(energyKey) {
    if (!this._cachedEnergyPrefs) return [];
    // Stable direct reference: stat:sensor.my_entity
    if (energyKey?.startsWith('stat:')) return [energyKey.slice(5)];
    const { solar, gridImport, gridExport, batteryCharge, batteryDischarge, devices, nestedDevices } = this._parsedEnergyPrefs();
    if (energyKey === 'pv_sum')          return solar;
    if (energyKey === 'grid_import')     return gridImport    ? [gridImport]    : [];
    if (energyKey === 'grid_export')     return gridExport    ? [gridExport]    : [];
    if (energyKey === 'battery_charge')  return batteryCharge ? [batteryCharge] : [];
    if (energyKey === 'battery_discharge') return batteryDischarge ? [batteryDischarge] : [];
    if (energyKey === 'device_sum')      return devices;
    const pvM = energyKey?.match(/^pv_(\d+)$/);
    if (pvM) { const idx = parseInt(pvM[1], 10) - 1; return solar[idx] ? [solar[idx]] : []; }
    const devM = energyKey?.match(/^device_(\d+)$/);
    if (devM) { const idx = parseInt(devM[1], 10) - 1; return devices[idx] ? [devices[idx]] : []; }
    const nestM = energyKey?.match(/^nested_(\d+)$/);
    if (nestM) { const idx = parseInt(nestM[1], 10) - 1; return nestedDevices[idx] ? [nestedDevices[idx].stat] : []; }
    return [];
  }

  /** Human-readable label for an energy_key (editor variant). */
  _resolveEnergyLabel(energyKey) {
    if (energyKey?.startsWith('stat:')) {
      const eid = energyKey.slice(5);
      return this._hass?.states?.[eid]?.attributes?.friendly_name || eid;
    }
    const lang = (this._hass?.language || 'en').split('-')[0].toLowerCase();
    const dict = EDITOR_TRANSLATIONS[lang] || EDITOR_TRANSLATIONS['en'];
    const trKey = `energy_key_${energyKey}`;
    if (dict[trKey] !== undefined) return dict[trKey];
    if (this._cachedEnergyPrefs) {
      const { solar, devices, nestedDevices } = this._parsedEnergyPrefs();
      const pvM = energyKey?.match(/^pv_(\d+)$/);
      if (pvM) { const eid = solar[parseInt(pvM[1], 10) - 1]; if (eid) return this._hass?.states?.[eid]?.attributes?.friendly_name || eid; }
      const devM = energyKey?.match(/^device_(\d+)$/);
      if (devM) { const eid = devices[parseInt(devM[1], 10) - 1]; if (eid) return this._hass?.states?.[eid]?.attributes?.friendly_name || eid; }
      const nestM2 = energyKey?.match(/^nested_(\d+)$/);
      if (nestM2) { const nd = nestedDevices[parseInt(nestM2[1], 10) - 1]; if (nd) return nd.name || this._hass?.states?.[nd.stat]?.attributes?.friendly_name || nd.stat; }
    }
    return energyKey;
  }

  /** Auto-conversion factor for an entity: Wh → kWh = 0.001, else 1. */
  _getEnergyEntityFactor(entityId, colFactor, colUnit = null) {
    if (colFactor !== undefined && colFactor !== null) return Number(colFactor);
    const state = this._hass?.states?.[entityId];
    const unit = state?.attributes?.statistics_unit_of_measurement
               ?? state?.attributes?.unit_of_measurement;
    const targetUnit = String(colUnit || '').toLowerCase();
    if (targetUnit === 'kw' && unit === 'W') return 0.001;
    if ((targetUnit === 'm3' || targetUnit === 'm³') && unit === 'L') return 0.001;
    return unit === 'Wh' ? 0.001 : 1;
  }

  // ── Energy Dashboard auto-config ───────────────────────────────────────────

  async _loadEnergyConfig(transposed = false) {
    if (!this._hass) return;

    // Warn if existing non-date columns would be overwritten
    const existingCols = this._config.columns || [];
    if (existingCols.some(c => c.type !== 'date')) {
      const lang = this._hass?.language?.startsWith('de') ? 'de' : 'en';
      const msg = lang === 'de'
        ? 'Die aktuell konfigurierten Spalten werden überschrieben. Fortfahren?'
        : 'The currently configured columns will be overwritten. Continue?';
      if (!window.confirm(msg)) return;
    }

    let prefs;
    try {
      prefs = await this._hass.connection.sendMessagePromise({ type: 'energy/get_prefs' });
    } catch (err) {
      this._energyMsg = { type: 'err', text: `${this._t('msg_energy_err')} ${err.message || err}` };
      this._render();
      return;
    }

    // sendMessagePromise resolves with msg.result, but guard against wrapped responses
    const rawPrefs = prefs?.energy_sources ? prefs : (prefs?.result ?? prefs ?? {});

    // Log to browser console so developer tools can show the raw structure
    console.log('[HistoryTableCard] energy/get_prefs →', JSON.parse(JSON.stringify(rawPrefs)));

    const sources = rawPrefs.energy_sources || [];
    const gridImports  = [];
    const gridExports  = [];
    const solarPanels  = [];
    const waterStats = new Set();
    let batteryCharge    = null;
    let batteryDischarge = null;

    const pushStat = (set, value) => {
      if (!value) return;
      if (typeof value === 'string') {
        const v = value.trim();
        if (v) set.add(v);
        return;
      }
      if (Array.isArray(value)) {
        for (const x of value) pushStat(set, x);
        return;
      }
      if (typeof value === 'object') {
        pushStat(set, value.statistic_id);
        pushStat(set, value.entity_id);
        pushStat(set, value.stat_water);
      }
    };
    const collectWater = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      // Different HA versions / integrations use slightly different property names.
      [
        'stat_water_from', 'stat_water_to', 'stat_water',
        'stat_water_usage', 'stat_water_consumption', 'stat_water_total',
        'stat_water_entity', 'water_statistic_id', 'water_entity', 'water_entity_id',
      ].forEach(k => pushStat(waterStats, obj[k]));
    };

    for (const src of sources) {
      collectWater(src);
      if (src.type === 'grid') {
        // Modern HA (2024+): stat_energy_from / stat_energy_to directly on the source object.
        // Legacy HA: nested inside flow_from[] / flow_to[] arrays.
        console.log('[HistoryTableCard] grid source keys:', Object.keys(src), '| stat_energy_from:', src.stat_energy_from, '| stat_energy_to:', src.stat_energy_to);
        if (src.stat_energy_from) {
          gridImports.push(src.stat_energy_from);
        } else {
          for (const f of src.flow_from || []) if (f.stat_energy_from) gridImports.push(f.stat_energy_from);
      if (s.type === 'water') {
        addStat(waterStats, s.stat_water_usage || s.stat_water || s.stat_energy_from);
      }
        }
        if (src.stat_energy_to) {
          gridExports.push(src.stat_energy_to);
        } else {
          for (const f of src.flow_to || []) if (f.stat_energy_to) gridExports.push(f.stat_energy_to);
        }
      } else if (src.type === 'solar') {
        if (src.stat_energy_from) solarPanels.push(src.stat_energy_from);
      } else if (src.type === 'battery') {
        if (src.stat_energy_to)   batteryCharge    = src.stat_energy_to;
        if (src.stat_energy_from) batteryDischarge = src.stat_energy_from;
      } else if (src.type === 'water') {
        // Native water source in newer Energy dashboard variants.
        pushStat(waterStats, src.stat_water_usage || src.stat_water || src.stat_energy_from);
      }
      for (const f of src.flow_from || []) collectWater(f);
      for (const f of src.flow_to || []) collectWater(f);
    }
    for (const d of (rawPrefs.device_consumption || [])) collectWater(d);

    console.log('[HistoryTableCard] After parsing — gridImports:', gridImports, '| gridExports:', gridExports, '| solar:', solarPanels);

    if (!gridImports.length && !gridExports.length && !solarPanels.length && !waterStats.size) {
      this._energyMsg = {
        type: 'err',
        text: `${this._t('msg_energy_empty')} — sources: ${sources.length}, prefs keys: [${Object.keys(rawPrefs).join(', ') || 'none'}]. Check browser console for details.`,
      };
      this._render();
      return;
    }

    const gridImport = gridImports[0] || null;
    const gridExport = gridExports[0] || null;
    const hasBattery = !!(batteryCharge && batteryDischarge);

    // Top-level devices from device_consumption — already in energy/get_prefs response, no extra request.
    // Filter out sub-devices (have a parent via included_in_stat or old included_whole_home_energy_manager flag).
    const topDevices = (rawPrefs.device_consumption || [])
      .filter(d => !d.included_whole_home_energy_manager && !d.included_in_stat)
      .filter(d => d.stat_consumption);

    // Nested (sub-) devices — grouped by parent stat_consumption
    const allDeviceConsumption = rawPrefs.device_consumption || [];
    const nestedByParent = {}; // parentStat → [{stat, name}]
    for (const d of allDeviceConsumption) {
      if ((d.included_in_stat || d.included_whole_home_energy_manager) && d.stat_consumption) {
        const parentStat = d.included_in_stat || null;
        if (!nestedByParent[parentStat]) nestedByParent[parentStat] = [];
        nestedByParent[parentStat].push({ stat: d.stat_consumption, name: d.name || null });
      }
    }
    // Sequential index across ALL nested devices (for nested_N energy_key)
    let nestedSeq = 0;
    const nestedIndexByStat = {}; // stat → 1-based nested_N index
    for (const d of allDeviceConsumption) {
      if ((d.included_in_stat || d.included_whole_home_energy_manager) && d.stat_consumption) {
        nestedSeq++;
        nestedIndexByStat[d.stat_consumption] = nestedSeq;
      }
    }

    // Friendly name from hass.states — no extra API request needed
    const getFriendlyName = (entityId) =>
      this._hass?.states?.[entityId]?.attributes?.friendly_name
      || entityId.replace(/^sensor\./, '').replace(/_/g, ' ');

    const colorProp = transposed ? 'bullet_color' : 'background_color';
    const clr = transposed ? {
      solar:        '#ff9800',
      gridIn:       '#2196f3',
      gridOut:      '#00bcd4',
      batCharge:    '#9c27b0',
      batDischarge: '#4caf50',
      water:        '#00acc1',
      verbrauch:    '#607d8b',
      autarkie:     '#4caf50',
      device:       '#ff5722',
    } : {
      solar:        'rgba(255, 152,   0, 0.2)',
      gridIn:       'rgba( 33, 150, 243, 0.2)',
      gridOut:      'rgba(  0, 188, 212, 0.2)',
      batCharge:    'rgba(156,  39, 176, 0.2)',
      batDischarge: 'rgba(139, 195,  74, 0.2)',
      water:        'rgba(  0, 172, 193, 0.2)',
      verbrauch:    'rgba( 96, 125, 139, 0.2)',
      autarkie:     'rgba( 76, 175,  80, 0.2)',
      device:       'rgba(255,  87,  34, 0.2)',
    };
    const lighterColor = transposed
      ? (c) => c
      : (rgba) => rgba.replace(/(\d*\.?\d+)\)$/, (_, a) => `${(+a * 0.5).toFixed(2)})`);

    const columns = [];

    // 1. Date column
    columns.push({ type: 'date', name: 'Datum' });

    // 2. PV Gesamt — type: energy, energy_key: pv_sum (auto-sums all solar panels)
    if (solarPanels.length > 0) {
      columns.push({
        type:        COL_ENERGY,
        energy_key:  'pv_sum',
        variable:    'pv',
        name:        'PV Gesamt',
        decimals:    2,
        [colorProp]: clr.solar,
      });
    }

    // 3. Grid import (Netzbezug) — type: energy
    if (gridImport) {
      columns.push({
        type:        COL_ENERGY,
        energy_key:  'grid_import',
        variable:    'consumption',
        name:        'Netzbezug',
        decimals:    2,
        [colorProp]: clr.gridIn,
      });
    }

    // 4. Grid export (Einspeisung) — type: energy
    if (gridExport) {
      columns.push({
        type:        COL_ENERGY,
        energy_key:  'grid_export',
        variable:    'feed',
        name:        'Einspeisung',
        decimals:    2,
        [colorProp]: clr.gridOut,
      });
    }

    // 5. Battery charge (Laden) — type: energy
    if (hasBattery) {
      columns.push({
        type:        COL_ENERGY,
        energy_key:  'battery_charge',
        variable:    'charge',
        name:        'Laden',
        decimals:    2,
        [colorProp]: clr.batCharge,
      });
    }

    // 6. Battery discharge (Entladen) — type: energy
    if (hasBattery) {
      columns.push({
        type:        COL_ENERGY,
        energy_key:  'battery_discharge',
        variable:    'discharge',
        name:        'Entladen',
        decimals:    2,
        [colorProp]: clr.batDischarge,
      });
    }

    // 7. Verbrauch (total household consumption) — type: calc
    //    = grid_import + solar_own_use  = consumption + (pv - feed)  [+/- battery net]
    //    All energy variables are already in kWh (factor handled by type:energy columns).
    if (gridImport && solarPanels.length > 0) {
      let expr = 'consumption + pv';
      if (gridExport) expr += ' - feed';
      if (hasBattery) expr += ' + discharge - charge';
      columns.push({
        type:        COL_CALC,
        template:    `{{ ${expr} }}`,
        unit:        'kWh',
        variable:    'used',
        name:        'Verbrauch',
        decimals:    2,
        [colorProp]: clr.verbrauch,
      });
    }

    // 8. Autarkie (self-sufficiency %) — type: calc
    //    = 100 * (1 - grid_import / total_consumption)
    if (gridImport && solarPanels.length > 0) {
      let denom = 'consumption + pv';
      if (gridExport) denom += ' - feed';
      if (hasBattery) denom += ' + discharge - charge';
      columns.push({
        type:        COL_CALC,
        template:    `{{ [0, 100 - (100 * consumption / (${denom}))] | max }}`,
        unit:        '%',
        name:        'Autarkie',
        [colorProp]: clr.autarkie,
      });
    }

    // 9. Geräte Gesamt — type: energy, only if top-level devices exist
    if (topDevices.length > 0) {
      columns.push({
        type:        COL_ENERGY,
        energy_key:  'device_sum',
        variable:  'device_sum',
        name:        'Geräte Gesamt',
        decimals:    2,
        [colorProp]: clr.device,
      });
    }

    // 10+. Individual devices — type: energy, name from d.name (HA config) or friendly_name
    //      After each device, insert its nested sub-devices (lighter color, no variable)
    if (topDevices.length > 1) {
      for (let i = 0; i < topDevices.length; i++) {
        const d = topDevices[i];
        const devName = d.name || getFriendlyName(d.stat_consumption);
        columns.push({
          type:        COL_ENERGY,
          energy_key:  `stat:${d.stat_consumption}`,
          variable:  `stat_${d.stat_consumption}`,
          name:        devName,
          decimals:    2,
          [colorProp]: clr.device,
        });
        // Nested sub-devices of this parent
        for (const nd of nestedByParent[d.stat_consumption] || []) {
          columns.push({
            type:        COL_ENERGY,
            energy_key:  `stat:${nd.stat}`,
            variable:  `stat_${nd.stat}`,
            name:        nd.name || getFriendlyName(nd.stat),
            decimals:    2,
            [colorProp]: lighterColor(clr.device),
          });
        }
      }
    }

    // Individual solar panels — type: energy, name from hass.states (no extra API call)
    //     Only added when multiple panels exist (single panel already covered by pv_sum above).
    if (solarPanels.length > 1) {
      for (let i = 0; i < solarPanels.length; i++) {
        columns.push({
          type:        COL_ENERGY,
          energy_key:  `stat:${solarPanels[i]}`,
          name:        getFriendlyName(solarPanels[i]),
          decimals:    2,
          [colorProp]: clr.solar,
        });
      }
    }

    // Wasser-Sensoren am Tabellenende importieren; Einheit aus dem Sensor unverändert übernehmen.
    if (waterStats.size > 0) {
      let waterIdx = 0;
      for (const stat of waterStats) {
        waterIdx += 1;
        const waterUnit = this._hass?.states?.[stat]?.attributes?.statistics_unit_of_measurement
          ?? this._hass?.states?.[stat]?.attributes?.unit_of_measurement
          ?? '';
        columns.push({
          type:        COL_ENERGY,
          energy_key:  `stat:${stat}`,
          variable:    `water_${waterIdx}`,
          name:        getFriendlyName(stat),
          unit:        waterUnit,
          decimals:    3,
          [colorProp]: clr.water,
        });
      }
    }

    // ── Collection key detection ───────────────────────────────────────────
    const existingCollectionKey = this._config.collection_key || null;
    const pickerCollectionKey = this._detectCollectionKeyFromDashboardPicker();

    // Enumerate all live _energy* collections on hass.connection.
    // connection key format: _<collection_key>  (matching energy-custom.js convention)
    const foundCandidates = [];
    try {
      const allKeys = [...new Set([
        ...Object.keys(this._hass.connection),
        ...Object.getOwnPropertyNames(this._hass.connection),
      ])];
      for (const k of allKeys.filter(k => /^_energy(_\S+)?$/.test(k))) {
        foundCandidates.push(k.slice(1)); // strip leading '_' → becomes the collection_key value
      }
    } catch (_) {}

    // Priority: keep existing → active picker key → current dashboard key (panelUrl) → legacy _energy
    // → single unambiguous candidate.
    let detectedCollectionKey = existingCollectionKey;
    if (!detectedCollectionKey) {
      if (pickerCollectionKey) {
        detectedCollectionKey = pickerCollectionKey;
      } else if (foundCandidates.includes('energy')) {
        detectedCollectionKey = 'energy';
      } else {
        const panelUrl = String(this._hass?.panelUrl || '').trim();
        const panelCandidate = panelUrl ? `energy_${panelUrl}` : null;
        if (panelCandidate && foundCandidates.includes(panelCandidate)) {
          detectedCollectionKey = panelCandidate;
        } else if (foundCandidates.length === 1) {
          detectedCollectionKey = foundCandidates[0];
        }
      }
    }

    const warnings = [];
    if (!solarPanels.length) warnings.push('no solar sensors found — Verbrauch/Autarkie skipped');
    if (!gridImport)         warnings.push('no grid import sensor');
    if (!gridExport)         warnings.push('no grid export sensor');
    if (!waterStats.size)    warnings.push('no water sensors in Energy dashboard prefs');
    if (!detectedCollectionKey) {
      warnings.push('collection_key not set — no live _energy* collections found; open the Energy Dashboard first, then regenerate');
    } else if (pickerCollectionKey && detectedCollectionKey === pickerCollectionKey) {
      warnings.push(`Using collection_key from active energy-date-selection card: "${detectedCollectionKey}"`);
    } else if (foundCandidates.length > 1 && !existingCollectionKey) {
      // Multiple candidates: we selected panel-specific or legacy key; warn for transparency.
      warnings.push(`Multiple energy collections found: ${foundCandidates.map(c => `"${c}"`).join(', ')} — using "${detectedCollectionKey}" (dashboard-aware selection); change collection_key in Code-Editor if needed`);
    }

    const summaryParts = [
      gridImport          ? `Grid↓ ${gridImport}`            : null,
      gridExport          ? `Grid↑ ${gridExport}`            : null,
      solarPanels.length  ? `Solar[${solarPanels.length}]: ${solarPanels.join(', ')}` : null,
      hasBattery          ? `Battery: ${batteryCharge} / ${batteryDischarge}` : null,
      waterStats.size     ? `Water[${waterStats.size}]: ${[...waterStats].join(', ')}` : null,
      topDevices.length   ? `Devices[${topDevices.length}]: ${topDevices.map(d => d.stat_consumption).join(', ')}` : null,
      detectedCollectionKey ? `Collection: ${detectedCollectionKey}` : 'Collection: not set',
      ...warnings.map(w => `⚠ ${w}`),
    ].filter(Boolean);

    console.log('[HistoryTableCard] Detected:', summaryParts.join(' | '));

    // Always go to cols tab: follow_energy_picker handles the picker subscription automatically.
    const newTab = 'cols';

    const baseConfig = {
      sort_col:    0,
      sort_dir:    'desc',
      columns,
    };
    const newConfig = transposed ? { ...this._config, ...baseConfig,
      layout:                  'horizontal',
      default_period:          'timespan',
      show_header:             false,
      show_date_links:         false,
      show_reset_button:       false,
      hide_table_header:       false,
      sticky_header:           false,
      sticky_first_col:        false,
      show_color_bullet:       true,
      card_padding:            0,
      transposed_row_header:   'Quelle',
      card_padding_right:      '20%',
      transposed_value_header: 'Verbrauch',
      show_quick_menu:         false,
      text_align_key:          'left',
      text_align_value:        'right',
      enable_sort:             false,
      title:                   'Quellen',
    } : { ...this._config, ...baseConfig,
      initial_period:   'today',
      layout:           'vertical',
      max_col_width:     100,
    };
    delete newConfig.follow_energy_picker; // explicit collection_key is always set below
    // Nur zeitbereichs-relevante Keys pro Modus behalten
    if (transposed) {
      // Horizontale Ansicht: default_period:'timespan' steuert den Zeitbereich → andere entfernen
      delete newConfig.initial_period;
      delete newConfig.days_to_show;
      delete newConfig.days_to_show;
      delete newConfig.custom_start_date;
      delete newConfig.custom_end_date;
    } else {
      // Vertikale Ansicht: period + initial_period steuern → andere entfernen
      delete newConfig.days_to_show;
      delete newConfig.default_period;
      delete newConfig.custom_start_date;
      delete newConfig.custom_end_date;
    }
    if (detectedCollectionKey) {
      newConfig.collection_key = detectedCollectionKey;
      // Mit collection_key steuert der Energy-Picker den Zeitbereich;
      // period ('day' ist ohnehin Default) und initial_period sind redundant.
      delete newConfig.period;
      delete newConfig.initial_period;
    } else {
      delete newConfig.collection_key;
    }
    this._config = newConfig;

    this._energyMsg = {
      type: warnings.length ? 'warn' : 'ok',
      text: summaryParts.join('\n'),
    };
    this._tab         = newTab;
    this._expandedCol = -1;
    this._fire();
    this._render();
  }

  // ── render ─────────────────────────────────────────────────────────────────

  _render() {
    const c = { ...DEFAULT_CONFIG, ...this._config };
    const betaQ = new Set((c.beta_features || '').split(',').map(s => s.trim())).has('quick');
    const t = (!betaQ && this._tab === 'display') ? 'general' : this._tab;
    const isDe = (this._hass?.language || '').toLowerCase().startsWith('de');
    const helpUrl = isDe ? 'https://www.libe.net/energy-table' : 'https://www.libe.net/en/energy-table';

    this.shadowRoot.innerHTML = `
<style>
  :host { display: block; font-family: var(--ha-font-family, Roboto, sans-serif); color: var(--primary-text-color); }
  .tabs { display: flex; border-bottom: 2px solid var(--divider-color, #e0e0e0); margin-bottom: 16px; }
  .tab-btn { flex: 1; padding: 10px 4px; background: none; border: none; border-bottom: 2px solid transparent;
    margin-bottom: -2px; cursor: pointer; font-size: 13px; font-weight: 500;
    color: var(--secondary-text-color); transition: color .2s, border-color .2s; }
  .tab-btn.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px;
    color: var(--secondary-text-color); margin: 16px 0 6px; }
  .row { display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-end; flex-wrap: wrap; }
  .row > * { flex: 1; min-width: 120px; }
  input.ha-textfield { display: block; width: 100%; height: 40px; font-size: 15px; padding: 0 12px; border: 1px solid var(--input-idle-line-color, rgba(128,128,128,.5)); border-radius: 4px 4px 0 0; background: var(--input-fill-color, var(--card-background-color, #fff)); color: var(--primary-text-color); box-sizing: border-box; }
  input.ha-textfield:focus { border-color: var(--primary-color); outline: none; }
  .field-wrap { display: flex; flex-direction: column; }
  .field-label { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 3px; }

  select.hs {
    width: 100%; height: 40px; padding: 0 36px 0 12px; box-sizing: border-box;
    border: 1px solid var(--input-idle-line-color, rgba(128,128,128,.5));
    border-radius: 4px 4px 0 0;
    background-color: var(--card-background-color, var(--ha-card-background, #fff));
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z' fill='%23888'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 8px center;
    color: var(--primary-text-color); font-size: 15px; cursor: pointer;
    -webkit-appearance: none; appearance: none; outline: none; }
  select.hs:focus { border-color: var(--primary-color); }
  .col-list { display: flex; flex-direction: column; gap: 6px; }
  .col-item { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 6px; }
  .col-item--hidden > .col-hdr { opacity: 0.5; }
  .col-hdr { display: flex; align-items: center; padding: 8px 10px; gap: 8px; cursor: pointer;
    background: var(--secondary-background-color, rgba(0,0,0,.03)); user-select: none;
    border-radius: 6px 6px 0 0; }
  .col-hdr:hover { background: var(--hover-color, rgba(0,0,0,.06)); }
  .badge { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px;
    border-radius: 10px; color: #fff; flex-shrink: 0; }
  .badge.date   { background: #4caf50; }
  .badge.entity { background: #1976d2; }
  .badge.calc   { background: #f57c00; }
  .col-label { flex: 1; font-size: 13px; }
  .col-acts { display: flex; gap: 2px; }
  .ibtn { background: none; border: none; cursor: pointer; padding: 4px 6px; border-radius: 4px;
    color: var(--secondary-text-color); font-size: 14px; line-height: 1; }
  .ibtn:hover { background: var(--hover-color); color: var(--primary-color); }
  .ibtn.del:hover { color: #e53935; }
  .drag-handle { cursor: grab; padding: 4px 6px; color: var(--secondary-text-color); touch-action: none; font-size: 16px; line-height: 1; flex-shrink: 0; user-select: none; }
  .drag-handle:active { cursor: grabbing; }
  .drag-active { opacity: 0.35; }
  .drop-ind { height: 2px; margin: 1px 4px; background: var(--primary-color); border-radius: 2px; pointer-events: none; }
  .col-body { padding: 12px; border-top: 1px solid var(--divider-color, #e0e0e0);
    display: flex; flex-direction: column; gap: 8px;
    overflow-x: hidden; overflow-y: visible; }
  .add-btn { width: 100%; margin-top: 8px; padding: 10px; border: 2px dashed var(--primary-color);
    border-radius: 6px; background: none; color: var(--primary-color); font-size: 13px;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .add-btn:hover { background: var(--primary-color); color: #fff; }
  .help-link-row { margin-top: 8px; text-align: right; font-size: 12px; }
  .help-link-row a { color: var(--primary-color); text-decoration: underline; }
  .checks { display: flex; flex-direction: column; gap: 4px 0; padding-left: 8px; }
  .qmi-list { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
  .qmi-item { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 6px; }
  .qmi-hdr { display: flex; align-items: center; padding: 8px 10px; gap: 8px; cursor: pointer;
    background: var(--secondary-background-color, rgba(0,0,0,.03)); user-select: none;
    border-radius: 6px 6px 0 0; }
  .qmi-hdr:hover { background: var(--hover-color, rgba(0,0,0,.06)); }
  .qmi-hdr.collapsed { border-radius: 6px; }
  .qmi-idx { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px;
    border-radius: 10px; background: var(--primary-color, #03a9f4); color: #fff; flex-shrink: 0; }
  .qmi-label { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .qmi-del { cursor: pointer; color: var(--error-color, #b00020); padding: 4px 6px; border-radius: 4px; font-size: 14px; line-height: 1; }
  .qmi-del:hover { background: var(--error-color, #b00020); color: #fff; }
  .qmi-body { padding: 12px; border-top: 1px solid var(--divider-color, #e0e0e0);
    display: flex; flex-direction: column; gap: 8px; }
  .entity-input { 
    height: 56px;display: block; width: 100%; box-sizing: border-box; padding: 16px 12px 8px;
    background: var(--input-fill-color, var(--card-background-color, #fff));
    color: var(--primary-text-color); border: none;
    border-bottom: 1px solid var(--input-idle-line-color, rgba(128,128,128,.5));
    border-radius: 4px 4px 0 0; font-size: 15px; outline: none; }
  .entity-input:focus { border-bottom-color: var(--primary-color); }
  .entity-input-wrap { position: relative; overflow: visible; }
  .entity-input-label { position: absolute; top: 4px; left: 12px; font-size: 11px;
    color: var(--secondary-text-color); pointer-events: none; }
  .color-picker-wrap { position: relative; }
  .color-picker-list {
    display: none; position: absolute; bottom: 100%; top: auto; left: 0; right: 0; z-index: 1000;
    background: var(--card-background-color, var(--ha-card-background, #fff));
    border: 1px solid var(--divider-color, rgba(0,0,0,0.15));
    border-radius: 4px 4px 0 0;
    box-shadow: 0 -4px 12px rgba(0,0,0,0.25);
    max-height: 220px; overflow-y: auto; }
  .color-picker-option {
    padding: 7px 12px; cursor: pointer; font-size: 11px; font-family: monospace;
    border-bottom: 1px solid rgba(128,128,128,0.1); }
  .color-picker-option:last-child { border-bottom: none; }
  .color-picker-option:hover { filter: brightness(0.88) saturate(1.4); }
  /* ── Padding compass ──────────────────────────────────────────── */
  .pad-display-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 8px; }
  .pad-compass {
    display: grid;
    grid-template-areas: '. top .' 'left center right' '. bottom .';
    grid-template-columns: 72px 1fr 72px;
    grid-template-rows: auto 1fr auto;
    gap: 4px;
    border: 1px solid var(--divider-color, rgba(0,0,0,.12));
    border-radius: 6px;
    padding: 8px;
  }
  .pad-compass .pad-top    { grid-area: top; }
  .pad-compass .pad-left   { grid-area: left; }
  .pad-compass .pad-right  { grid-area: right; }
  .pad-compass .pad-center { grid-area: center; }
  .pad-compass .pad-bottom { grid-area: bottom; }
  .pad-side-field { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  input.pad-side-input { width: 64px; height: 36px; font-size: 14px; padding: 0 6px; text-align: center; }
  .pad-center-block { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px;
    border: 1px solid var(--divider-color, rgba(0,0,0,.08)); border-radius: 4px; }
  .pad-colors { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 180px; }
  /* ── Benutzerdefiniertes Entity-Autocomplete-Dropdown ──────────────────── */
  .entity-dropdown {
    display: none; position: absolute; top: 100%; left: 0; right: auto; z-index: 2000;
    min-width: 100%; width: max-content; max-width: min(720px, calc(100vw - 48px));
    background: var(--ha-card-background, var(--card-background-color, #fff));
    border: 1px solid var(--divider-color, rgba(0,0,0,.15)); border-top: none;
    border-radius: 0 0 4px 4px; box-shadow: 0 4px 12px rgba(0,0,0,.25);
    max-height: 220px; overflow-x: auto; overflow-y: scroll; scrollbar-gutter: stable; }
  .entity-dropdown.open { display: block; }
  .entity-dropdown-item {
    padding: 8px 12px; cursor: pointer; font-size: 13px; font-family: monospace;
    border-bottom: 1px solid rgba(128,128,128,.08);
    white-space: nowrap; min-width: max-content; overflow: visible; text-overflow: clip;
    color: var(--primary-text-color);
    background: var(--ha-card-background, var(--card-background-color, #fff)); }
  .entity-dropdown-item:hover, .entity-dropdown-item.highlighted {
    background: var(--primary-color, #03a9f4); color: #fff; }
  /* ── Formel-Assistent ──────────────────────────────────────────────────── */
  .calc-wizard {
    border: 1px solid var(--divider-color, rgba(0,0,0,.12)); border-radius: 6px;
    padding: 8px; margin-bottom: 4px; background: var(--secondary-background-color, rgba(0,0,0,.02)); }
  .calc-wizard-section { margin-bottom: 6px; }
  .calc-wizard-section:last-child { margin-bottom: 0; }
  .calc-wizard-label { font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .06em; color: var(--secondary-text-color); margin-bottom: 4px; }
  .calc-wizard-btns { display: flex; flex-wrap: wrap; gap: 3px; }
  .cwb { padding: 3px 8px; font-size: 12px; border-radius: 4px; font-family: monospace;
    border: 1px solid var(--divider-color, rgba(0,0,0,.2)); cursor: pointer; user-select: none;
    background: var(--card-background-color, #fff); color: var(--primary-text-color);
    white-space: nowrap; line-height: 1.5; }
  .cwb:hover { background: var(--primary-color, #03a9f4); color: #fff;
    border-color: var(--primary-color, #03a9f4); }
  .cwb.var-btn  { background: rgba(33,150,243,.1); border-color: rgba(33,150,243,.4); }
  .cwb.var-btn:hover  { background: #1976d2; color: #fff; }
  .cwb.filter-btn { background: rgba(76,175,80,.1); border-color: rgba(76,175,80,.4); }
  .cwb.filter-btn:hover { background: #388e3c; color: #fff; }
  .cwb.const-btn  { background: rgba(156,39,176,.1); border-color: rgba(156,39,176,.4); }
  .cwb.const-btn:hover  { background: #7b1fa2; color: #fff; }
</style>
<div>
  <div class="tabs">
    <button class="tab-btn${t==='general'?' active':''}" data-tab="general">${this._t('tab_general')}</button>
    <button class="tab-btn${t==='cols'?' active':''}" data-tab="cols">${this._t('tab_cols')}</button>
    ${betaQ ? `<button class="tab-btn${t==='display'?' active':''}" data-tab="display">${this._t('tab_display')}</button>` : ''}
  </div>
  ${t === 'general' ? this._tplGeneral(c) : ''}
  ${t === 'cols'    ? this._tplColumnsList(c) : ''}
  ${t === 'display' ? this._tplDisplay(c) : ''}
  <div class="help-link-row"><a href="${helpUrl}" target="_blank" rel="noopener noreferrer">Beispiele und Hilfe</a></div>
</div>`;

    this._attachListeners();
  }

  // ── templates ─────────────────────────────────────────────────────────────

  _tplGeneral(c) {
    const t = k => this._t(k);
    const pl = this._t('period_labels');
    const statOpts = [['mean','stat_mean'],['sum','stat_sum'],['max','stat_max'],['min','stat_min'],['state','stat_state'],['change','stat_change']];
    const msg = this._energyMsg;
    const _betaG = new Set((c.beta_features || '').split(',').map(s => s.trim()));
    const betaH          = _betaG.has('horizontal');
    const betaEL         = _betaG.has('extendedlayout');
    const betaNavDate    = _betaG.has('navdate');
    const betaNavButtons = _betaG.has('navbuttons');
    const betaZoomOut    = _betaG.has('zoomout');
    const betaBackButton = _betaG.has('backbutton');
    const padKeys = ['card_padding_top','card_padding_right','card_padding_bottom','card_padding_left',
      'text_align_key','text_align_value','cell_padding','row_height','max_col_width',
      'header_color','header_text_color','first_col_color','first_col_text_color'];
    if (this._padOpen === null) this._padOpen = padKeys.some(k => c[k] != null && c[k] !== '');
    const padOpen = this._padOpen;
    const checks = [['show_nav_date','chk_show_nav_date'],['show_nav_buttons','chk_nav_btns'],['show_quick_menu','chk_show_quick_menu'],
      ['show_zoom_out','chk_zoom'],['show_reset_button','chk_reset'],['show_date_links','chk_date_links'],
      ['show_back_button','chk_back'],['enable_sort','chk_enable_sort'],
      ['sticky_header','chk_sticky_header'],
      ['sticky_first_col','chk_sticky_first_col'],
      ['show_color_bullet','chk_color_bullet']];
    const bgColorOpts = DEFAULT_COLUMN_BG_COLORS.map((clr, pi) =>
      `<div class="color-picker-option" data-color="${escapeHtml(clr)}"
            style="background:${clr};color:var(--primary-text-color)">
        <span style="font-weight:500">${escapeHtml(this._t('color_labels')[pi] || clr)}</span>
        <span style="opacity:0.6;font-size:10px;margin-left:6px">${escapeHtml(clr)}</span>
      </div>`
    ).join('');
    const textColorOpts = DEFAULT_TEXT_COLORS.map((clr, pi) => {
      const hex = clr.replace('#','');
      const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
      const bright = (r*299 + g*587 + b*114) / 1000;
      const fg = bright > 128 ? '#000' : '#fff';
      return `<div class="color-picker-option" data-color="${escapeHtml(clr)}"
            style="background:${clr};color:${fg}">
        <span style="font-weight:500">${escapeHtml(clr)}</span>
      </div>`;
    }).join('');
    return `
<div class="section-title">${t('sec_energy_dash')}</div>
<div class="row" style="align-items:stretch">
  <button class="add-btn" data-action="load-energy-v" style="margin-top:0;border-style:solid;flex:1">${t('btn_load_energy_v')}</button>
  <button class="add-btn" data-action="load-energy-h" style="margin-top:0;border-style:solid;flex:1${betaH ? '' : ';display:none'}">${t('btn_load_energy_h')}</button>
</div>
${msg ? `<div style="padding:8px 0;font-size:12px;white-space:pre-line;word-break:break-word;color:${msg.type==='ok'?'var(--success-color,#4caf50)':msg.type==='warn'?'var(--warning-color,#ff9800)':'var(--error-color,#e53935)'}">${escapeHtml(msg.text)}</div>` : ''}
<div class="section-title">${t('sec_card')}</div>
<div class="row">
  <div class="field-wrap" style="flex:2">
    <span class="field-label">${t('lbl_title')}</span>
    <input class="ha-textfield" data-cfg-key="title" placeholder="${t('lbl_title')}" value="${escapeHtml(c.title || '')}">
  </div>
  <div class="field-wrap" style="flex:1">
    <span class="field-label">${t('lbl_date_format')}</span>
    <select class="hs" data-cfg-key="date_format">
      ${['short','medium','long','full','numeric_dt','unixtimestamp'].map(f =>
        `<option value="${f}"${c.date_format===f?' selected':''}>${t('df_labels')[f] || f}</option>`).join('')}
    </select>
  </div>
</div>
${(() => {
  const rm = (c.collection_key || c.follow_energy_picker) ? 'energy'
    : ('custom_start_date' in c) ? 'custom'
    : c.initial_period ? 'period'
    : 'days';
  return `
<div class="row">
  <div class="field-wrap" style="flex:1">
    <span class="field-label">${t('lbl_range_mode')}</span>
    <select class="hs" data-cfg-key="__range_mode">
      <option value="days"${rm==='days'?' selected':''}>${t('range_mode_days')}</option>
      <option value="energy"${rm==='energy'?' selected':''}>${t('range_mode_energy')}</option>
      <option value="period"${rm==='period'?' selected':''}>${t('range_mode_period')}</option>
      <option value="custom"${rm==='custom'?' selected':''}>${t('range_mode_custom')}</option>
    </select>
  </div>
  <div class="field-wrap" style="flex:1">
    ${rm === 'days' ? `
    <span class="field-label">${t('lbl_days')}</span>
    <input class="ha-textfield" data-cfg-key="days_to_show" type="number" min="1" value="${c.days_to_show ?? 7}">` : rm === 'period' ? `
    <span class="field-label">${t('lbl_initial_period')}</span>
    <select class="hs" data-cfg-key="initial_period">
      ${Object.entries(pl).map(([v,l]) =>
        `<option value="${v}"${c.initial_period===v?' selected':''}>${escapeHtml(l)}</option>`).join('')}
    </select>` : rm === 'custom' ? `
    <span class="field-label">${t('lbl_custom_start')}</span>
    <input class="ha-textfield" data-cfg-key="custom_start_date" type="date" value="${escapeHtml(c.custom_start_date || '')}">` : ''}
  </div>
</div>
${rm === 'energy' ? `<div class="field-label" style="margin:-4px 0 8px;font-size:11px;opacity:0.65">${escapeHtml(t('hint_range_energy'))}</div>` : ''}
`;
})()}
<div class="section-title">${t('sec_advanced')}</div>
<div class="row">
  <div class="field-wrap">
    <span class="field-label">${t('lbl_sort_col')}</span>
    <input class="ha-textfield" data-cfg-key="sort_col" placeholder="${t('lbl_sort_col')}" type="number" value="${c.sort_col ?? ''}">
  </div>
  <div class="field-wrap">
    <span class="field-label">${t('lbl_sort_dir')}</span>
    <select class="hs" data-cfg-key="sort_dir">
      <option value="asc"${c.sort_dir!=='desc'?' selected':''}>${t('sort_asc')}</option>
      <option value="desc"${c.sort_dir==='desc'?' selected':''}>${t('sort_desc')}</option>
    </select>
  </div>
</div>
<div class="section-title"${betaH ? '' : ' style="display:none"'}>${t('sec_display')}</div>
<div class="row"${betaH ? '' : ' style="display:none"'}>
  <div class="field-wrap">
    <span class="field-label">${t('lbl_layout')}</span>
    <select class="hs" data-cfg-key="layout">
      <option value="vertical"${c.layout !== 'horizontal'?' selected':''}>${t('layout_normal')}</option>
      <option value="horizontal"${c.layout==='horizontal'?' selected':''}>${t('layout_transposed')}</option>
    </select>
  </div>
</div>

<div class="section-title">${t('sec_features')}</div>
<div class="checks">
  ${checks.filter(([k]) =>
    k !== 'show_color_bullet' &&
    (k !== 'show_nav_date'    || betaNavDate) &&
    (k !== 'show_nav_buttons' || betaNavButtons) &&
    (k !== 'show_zoom_out'    || betaZoomOut) &&
    (k !== 'show_back_button' || betaBackButton)
  ).map(([k,tk]) => `
    <ha-formfield label="${escapeHtml(t(tk))}">
      <ha-checkbox data-cfg-bool="${k}"${c[k] !== false ? ' checked' : ''}></ha-checkbox>
    </ha-formfield>${k === 'sticky_header' ? `
    <div class="field-label" style="margin:0 0 4px 36px;font-size:11px;opacity:0.65">${escapeHtml(t('chk_sticky_header_hint'))}</div>` : ''}`).join('')}
  ${betaH && c.layout === 'horizontal' ? `
    <ha-formfield label="${escapeHtml(t('chk_color_bullet'))}">  
      <ha-checkbox data-cfg-bool="show_color_bullet"${c.show_color_bullet ? ' checked' : ''}></ha-checkbox>
    </ha-formfield>` : ''}
</div>

<div class="section-title">${t('sec_aggregation')}</div>
<div class="row">
  <div class="field-wrap">
    <span class="field-label">${t('lbl_default_period')}</span>
    <select class="hs" data-cfg-key="default_period">
      <option value=""${!c.default_period?' selected':''}>&#8212; ${t('period_none')} &#8212;</option>
      ${['hour','day','month','year','timespan'].map(p =>
        `<option value="${p}"${c.default_period===p?' selected':''}>${p === 'timespan' ? t('period_timespan') : (t('stat_period_labels')[p] || p.toUpperCase())}</option>`).join('')}
    </select>
  </div>
</div>
<div class="field-label" style="margin-bottom:8px;font-size:12px;opacity:0.75">${t('agg_hint')}</div>
${[['hour','≤ 4 h','hour'],['day','≤ 2 d','hour'],['week','≤ 10 d','day'],['month','≤ 60 d','day'],['year','≤ 2 y','month'],['multiyear','> 2 y','year']].reduce((rows, [key, label, def], i) => {
  const curRaw = ((c.aggregation || {})[key] != null ? (c.aggregation || {})[key] : '') || def;
  const cur = curRaw === '5minute' ? 'hour' : curRaw;
  const spl = t('stat_period_labels');
  const sel = `<div class="field-wrap" style="flex:1">
    <span class="field-label">${label}</span>
    <select class="hs" data-agg-key="${key}">
      ${['hour','day','week','month','year'].map(p =>
        `<option value="${p}"${cur===p?' selected':''}>${spl[p] || p}</option>`).join('')}
    </select>
  </div>`;
  if (i % 3 === 0) rows.push([]);
  rows[rows.length - 1].push(sel);
  return rows;
}, []).map(row => `<div class="row">${row.join('')}</div>`).join('')}
<div class="section-title" data-action="toggle-pad" style="cursor:pointer;display:${betaEL ? 'flex' : 'none'};align-items:center;justify-content:space-between">
  <span>${t('lbl_card_padding')}</span>
  <span style="line-height:1;transition:transform .2s;transform:rotate(${padOpen?180:0}deg)">▾</span>
</div>
<div class="pad-display-row" style="${!betaEL || !padOpen ? 'display:none' : ''}">
  <div class="pad-compass">
    <div class="pad-top">
      <div class="pad-side-field">
        <span class="field-label">${t('lbl_card_pad_top')}</span>
        <input class="ha-textfield pad-side-input" data-cfg-key="card_padding_top" type="text" placeholder="px" value="${c.card_padding_top ?? ''}">
      </div>
    </div>
    <div class="pad-left">
      <div class="pad-side-field">
        <span class="field-label">${t('lbl_card_pad_left')}</span>
        <input class="ha-textfield pad-side-input" data-cfg-key="card_padding_left" type="text" placeholder="px/%" value="${c.card_padding_left ?? ''}">
      </div>
    </div>
    <div class="pad-center">
      <div class="pad-center-block">
        <div class="field-wrap">
          <span class="field-label">${t('lbl_text_align_key')}</span>
          <select class="hs" data-cfg-key="text_align_key">
            <option value=""${!c.text_align_key?' selected':''}>—</option>
            <option value="left"${c.text_align_key==='left'?' selected':''}>${t('align_left')}</option>
            <option value="center"${c.text_align_key==='center'?' selected':''}>${t('align_center')}</option>
            <option value="right"${c.text_align_key==='right'?' selected':''}>${t('align_right')}</option>
          </select>
        </div>
        <div class="field-wrap">
          <span class="field-label">${t('lbl_text_align_value')}</span>
          <select class="hs" data-cfg-key="text_align_value">
            <option value=""${!c.text_align_value?' selected':''}>—</option>
            <option value="left"${c.text_align_value==='left'?' selected':''}>${t('align_left')}</option>
            <option value="center"${c.text_align_value==='center'?' selected':''}>${t('align_center')}</option>
            <option value="right"${c.text_align_value==='right'?' selected':''}>${t('align_right')}</option>
          </select>
        </div>
        ${c.layout === 'horizontal' ? `
        <div class="field-wrap">
          <span class="field-label">${t('lbl_col_width_key')}</span>
          <input class="ha-textfield" data-cfg-key="transposed_col_width_key" type="number" min="1" max="99" placeholder="%" value="${c.transposed_col_width_key ?? ''}">
        </div>
        <div class="field-wrap">
          <span class="field-label">${t('lbl_col_width_value')}</span>
          <input class="ha-textfield" data-cfg-key="transposed_col_width_value" type="number" min="1" max="99" placeholder="%" value="${c.transposed_col_width_value ?? ''}">
        </div>
        <div class="field-wrap">
          <span class="field-label">${t('lbl_transposed_header')}</span>
          <input class="ha-textfield" data-cfg-key="transposed_row_header" placeholder="${t('lbl_transposed_row_default')}" value="${escapeHtml(c.transposed_row_header || '')}">
        </div>
        <div class="field-wrap">
          <span class="field-label">${t('lbl_transposed_val_header')}</span>
          <input class="ha-textfield" data-cfg-key="transposed_value_header" placeholder="${t('lbl_transposed_val_default')}" value="${escapeHtml(c.transposed_value_header || '')}">
        </div>` : ''}
        <div class="field-wrap">
          <span class="field-label">${t('lbl_cell_padding')}</span>
          <input class="ha-textfield" data-cfg-key="cell_padding" type="number" min="0" value="${c.cell_padding ?? ''}">
        </div>
        <div class="field-wrap">
          <span class="field-label">${t('lbl_row_height')}</span>
          <input class="ha-textfield" data-cfg-key="row_height" type="number" min="0" value="${c.row_height ?? ''}">
        </div>
        <div class="field-wrap">
          <span class="field-label">${t('lbl_max_col_width')}</span>
          <input class="ha-textfield" data-cfg-key="max_col_width" type="number" min="20" placeholder="px" value="${c.max_col_width ?? ''}">
        </div>
      </div>
    </div>
    <div class="pad-right">
      <div class="pad-side-field">
        <span class="field-label">${t('lbl_card_pad_right')}</span>
        <input class="ha-textfield pad-side-input" data-cfg-key="card_padding_right" type="text" placeholder="px/%" value="${c.card_padding_right ?? ''}">
      </div>
    </div>
    <div class="pad-bottom">
      <div class="pad-side-field">
        <span class="field-label">${t('lbl_card_pad_bottom')}</span>
        <input class="ha-textfield pad-side-input" data-cfg-key="card_padding_bottom" type="text" placeholder="px" value="${c.card_padding_bottom ?? ''}">
      </div>
    </div>
  </div>
  <div class="pad-colors">
    <div style="display:flex;gap:6px">
      <div class="color-picker-wrap entity-input-wrap" style="flex:1">
        <span class="entity-input-label">${t('lbl_header_color')}</span>
        <input type="text" class="entity-input bg-color-input"
               data-cfg-color-key="header_color"
               value="${escapeHtml(c.header_color || '')}"
               placeholder="rgba(…)" autocomplete="off"
               style="${c.header_color ? `background:${c.header_color}` : ''}">
        <div class="color-picker-list">${bgColorOpts}</div>
      </div>
      <div class="color-picker-wrap entity-input-wrap" style="flex:1">
        <span class="entity-input-label">${t('lbl_header_text_color')}</span>
        <input type="text" class="entity-input bg-color-input"
               data-cfg-color-key="header_text_color" data-color-type="text"
               value="${escapeHtml(c.header_text_color || '')}"
               placeholder="#rrggbb" autocomplete="off"
               style="${c.header_text_color ? `background:${c.header_text_color};color:white` : ''}">
        <div class="color-picker-list">${textColorOpts}</div>
      </div>
    </div>
    <div style="display:flex;gap:6px">
      <div class="color-picker-wrap entity-input-wrap" style="flex:1">
        <span class="entity-input-label">${t('lbl_first_col_color')}</span>
        <input type="text" class="entity-input bg-color-input"
               data-cfg-color-key="first_col_color"
               value="${escapeHtml(c.first_col_color || '')}"
               placeholder="rgba(…)" autocomplete="off"
               style="${c.first_col_color ? `background:${c.first_col_color}` : ''}">
        <div class="color-picker-list">${bgColorOpts}</div>
      </div>
      <div class="color-picker-wrap entity-input-wrap" style="flex:1">
        <span class="entity-input-label">${t('lbl_first_col_text_color')}</span>
        <input type="text" class="entity-input bg-color-input"
               data-cfg-color-key="first_col_text_color" data-color-type="text"
               value="${escapeHtml(c.first_col_text_color || '')}"
               placeholder="#rrggbb" autocomplete="off"
               style="${c.first_col_text_color ? `background:${c.first_col_text_color};color:white` : ''}">
        <div class="color-picker-list">${textColorOpts}</div>
      </div>
    </div>
  </div>
</div>
`;
  }

  _tplDisplay(c) {
    const t = k => this._t(k);
    const _betaD = new Set((c.beta_features || '').split(',').map(s => s.trim()));
    const betaH = _betaD.has('horizontal');
    return `
<div class="qmi-list">
  ${(c.quick_menu_items || []).map((item, qi) => {
    const qmis = c.quick_menu_items;
    const energyPeriods = ['today','yesterday','this_week','this_month','this_quarter','this_year','now-7d','now-30d','now-365d','now-12m'];
    const itemRangeType = item.range_type || (item.energy_period ? 'energy' : item.days_to_show != null ? 'days' : item.custom_start ? 'custom_start' : '');
    const eL = t('qmi_energy_labels') || {};
    const spl = t('stat_period_labels') || {};
    const periodLabel = item.period === 'default' ? t('qmi_period_default') : item.period ? (spl[item.period] || item.period) : '';
    const rangeLabel = itemRangeType === 'energy' ? (eL[item.energy_period] || item.energy_period || '') : itemRangeType === 'days' ? (item.days_to_show != null ? item.days_to_show + 'd' : '') : itemRangeType === 'custom_start' ? (item.custom_start || '') : '';
    const autoLabel = item.title || [rangeLabel, periodLabel].filter(Boolean).join(' · ') || '?';
    const open = this._expandedQmi === qi;
    return `<div class="qmi-item">
  <div class="qmi-hdr${open ? '' : ' collapsed'}" data-action="toggle-qmi" data-idx="${qi}">
    <span class="qmi-idx">#${qi + 1}</span>
    <span class="qmi-label">${escapeHtml(autoLabel)}</span>
    <div class="col-acts">
      <span class="drag-handle" title="Ziehen zum Verschieben">⠿</span>
      <button class="ibtn del" data-action="qmi-del" data-idx="${qi}">✕</button>
    </div>
  </div>
  ${open ? `<div class="qmi-body">
  <div class="field-wrap"><span class="field-label">${t('lbl_qmi_title')}</span>
    <input class="ha-textfield" data-qmi-key="${qi}" data-qmi-field="title" placeholder="(auto)" value="${escapeHtml(item.title || '')}">
  </div>
  <div class="field-wrap"><span class="field-label">${t('lbl_qmi_range_mode')}</span>
    <select class="hs" data-qmi-key="${qi}" data-qmi-field="range_type" data-qmi-rangetype-sel="${qi}">
      <option value=""${!itemRangeType ? ' selected' : ''}>${t('qmi_no_change')}</option>
      <option value="energy"${itemRangeType === 'energy' ? ' selected' : ''}>${t('qmi_range_energy')}</option>
      <option value="days"${itemRangeType === 'days' ? ' selected' : ''}>${t('qmi_range_days')}</option>
      <option value="custom_start"${itemRangeType === 'custom_start' ? ' selected' : ''}>${t('qmi_range_custom')}</option>
    </select>
  </div>
  <div data-qmi-rangetype-sub="${qi}-energy" style="${itemRangeType === 'energy' ? '' : 'display:none'}">
    <div class="field-wrap"><span class="field-label">${t('lbl_qmi_energy_period')}</span>
      <select class="hs" data-qmi-key="${qi}" data-qmi-field="energy_period">
        <option value="">—</option>
        ${energyPeriods.map(p => `<option value="${p}"${item.energy_period === p ? ' selected' : ''}>${escapeHtml((t('qmi_energy_labels') || {})[p] || p)}</option>`).join('')}
      </select>
    </div>
  </div>
  <div data-qmi-rangetype-sub="${qi}-days" style="${itemRangeType === 'days' ? '' : 'display:none'}">
    <div class="field-wrap"><span class="field-label">${t('lbl_qmi_days_to_show')}</span>
      <input class="ha-textfield" type="number" min="1" data-qmi-key="${qi}" data-qmi-field="days_to_show" value="${item.days_to_show != null ? item.days_to_show : ''}">
    </div>
  </div>
  <div data-qmi-rangetype-sub="${qi}-custom_start" style="${itemRangeType === 'custom_start' ? '' : 'display:none'}">
    <div class="field-wrap"><span class="field-label">${t('lbl_qmi_custom_start')}</span>
      <input class="ha-textfield" type="date" data-qmi-key="${qi}" data-qmi-field="custom_start" value="${escapeHtml(item.custom_start || '')}">
    </div>
  </div>
  <div class="field-wrap"><span class="field-label">${t('lbl_qmi_period')}</span>
    <select class="hs" data-qmi-key="${qi}" data-qmi-field="period">
      <option value="">—</option>
      ${['hour','day','month','year'].map(p =>
        `<option value="${p}"${item.period === p ? ' selected' : ''}>${(t('stat_period_labels') || {})[p] || p}</option>`).join('')}
      <option value="timespan"${item.period === 'timespan' ? ' selected' : ''}>${t('period_timespan')}</option>
      <option value="default"${item.period === 'default' ? ' selected' : ''}>${escapeHtml(t('qmi_period_default'))}</option>
    </select>
  </div>
  <div class="field-wrap"><span class="field-label">${t('lbl_qmi_sort_col')}</span>
    <input class="ha-textfield" type="number" min="0" data-qmi-key="${qi}" data-qmi-field="sort_col" value="${item.sort_col != null ? item.sort_col : ''}">
  </div>
  <div class="field-wrap"><span class="field-label">${t('lbl_qmi_date_links')}</span>
    <select class="hs" data-qmi-key="${qi}" data-qmi-field="date_links" data-qmi-bool="1">
      <option value=""${!('date_links' in item) ? ' selected' : ''}>${t('qmi_no_change')}</option>
      <option value="true"${item.date_links === true ? ' selected' : ''}>${t('qmi_on')}</option>
      <option value="false"${item.date_links === false ? ' selected' : ''}>${t('qmi_off')}</option>
    </select>
  </div>
  <div class="field-wrap"><span class="field-label">${t('lbl_qmi_enable_sort')}</span>
    <select class="hs" data-qmi-key="${qi}" data-qmi-field="enable_sort" data-qmi-bool="1">
      <option value=""${!('enable_sort' in item) ? ' selected' : ''}>${t('qmi_no_change')}</option>
      <option value="true"${item.enable_sort === true ? ' selected' : ''}>${t('qmi_on')}</option>
      <option value="false"${item.enable_sort === false ? ' selected' : ''}>${t('qmi_off')}</option>
    </select>
  </div>
  <div class="field-wrap"><span class="field-label">${t('lbl_qmi_sticky_header')}</span>
    <select class="hs" data-qmi-key="${qi}" data-qmi-field="sticky_header" data-qmi-bool="1">
      <option value=""${!('sticky_header' in item) ? ' selected' : ''}>${t('qmi_no_change')}</option>
      <option value="true"${item.sticky_header === true ? ' selected' : ''}>${t('qmi_on')}</option>
      <option value="false"${item.sticky_header === false ? ' selected' : ''}>${t('qmi_off')}</option>
    </select>
  </div>
  <div class="field-wrap"><span class="field-label">${t('lbl_qmi_sticky_first_col')}</span>
    <select class="hs" data-qmi-key="${qi}" data-qmi-field="sticky_first_col" data-qmi-bool="1">
      <option value=""${!('sticky_first_col' in item) ? ' selected' : ''}>${t('qmi_no_change')}</option>
      <option value="true"${item.sticky_first_col === true ? ' selected' : ''}>${t('qmi_on')}</option>
      <option value="false"${item.sticky_first_col === false ? ' selected' : ''}>${t('qmi_off')}</option>
    </select>
  </div>
  <div class="field-wrap"><span class="field-label">${t('lbl_qmi_layout')}</span>
    <select class="hs" data-qmi-key="${qi}" data-qmi-field="layout">
      <option value=""${!item.layout ? ' selected' : ''}>${t('qmi_no_change')}</option>
      <option value="vertical"${item.layout === 'vertical' ? ' selected' : ''}>${t('qmi_layout_normal')}</option>
      ${betaH ? `<option value="horizontal"${item.layout === 'horizontal' ? ' selected' : ''}>${t('qmi_layout_transposed')}</option>` : ''}
    </select>
  </div>
  </div>` : ''}
</div>`;
  }).join('') || ''}
</div>
<button class="add-btn" id="btn-add-qmi" style="margin-top:4px">${t('btn_add_qmi')}</button>`;
  }

  _tplColumnsList(c) {
    const cols = c.columns || [];
    return `
<div class="col-list">
  ${cols.map((col, i) => this._tplColItem(col, i)).join('')}
</div>
<button class="add-btn" data-action="add-col">${this._t('btn_add_col')}</button>`;
  }

  _tplColItem(col, i) {
    const type  = this._colType(col);
    const label = col.name
      || (type === COL_ENERGY && col.energy_key ? this._resolveEnergyLabel(col.energy_key) : null)
      || (col.entity ? (this._hass?.states?.[col.entity]?.attributes?.friendly_name || col.entity) : null)
      || `${this._t('col_fallback')} ${i + 1}`;
    const open  = this._expandedCol === i;
    return `
<div class="col-item${col.hidden ? ' col-item--hidden' : ''}">
  <div class="col-hdr" data-action="toggle-col" data-idx="${i}">
    <span class="badge ${type}">${type}</span>
    <span class="col-label">${escapeHtml(label)}</span>
    <div class="col-acts">
      <span class="drag-handle" title="Ziehen zum Verschieben">⠿</span>
      <button class="ibtn del" data-action="col-del" data-idx="${i}">✕</button>
    </div>
  </div>
  ${open ? this._tplColBody(col, i) : ''}
</div>`;
  }

  _tplColBody(col, i) {
    const type = this._colType(col);
    const t = k => this._t(k);
    const statOpts = [['mean','stat_mean'],['sum','stat_sum'],['max','stat_max'],['min','stat_min'],['state','stat_state'],['change','stat_change']];
    const colorLabels = this._t('color_labels');
    // Verfügbare Entity-Aliases für den Formel-Assistenten der Berechnungsspalte
    const calcAliases = (this._config.columns || [])
      .filter((c, ci) => ci !== i && c.variable && (c.entity || c.template || c.calc || c.type === COL_ENERGY || c.type === COL_DATE))
      .map(c => c.variable);
    // Aliases aus col.vars ebenfalls in den Wizard aufnehmen
    const varAliases = Object.keys(col.vars || {}).filter(a => !calcAliases.includes(a));
    const allCalcAliases = [...calcAliases, ...varAliases];
    // Energy key options (built from cached prefs)
    const _buildEnergyKeyOptions = () => {
      if (!this._cachedEnergyPrefs) return null;
      const ep = this._parsedEnergyPrefs();
      const opts = [];
      const values = new Set();
      const pushOpt = (value, label, selected = false) => {
        values.add(value);
        opts.push(`<option value="${value}"${selected ? ' selected' : ''}>${label}</option>`);
      };
      const sel = col.energy_key || '';
      if (ep.solar.length > 0) pushOpt('pv_sum', escapeHtml(t('energy_key_pv_sum')), sel === 'pv_sum');
      if (ep.solar.length > 1) ep.solar.forEach((eid, j) => {
        const k = `stat:${eid}`;
        const isSelected = sel === k || sel === `pv_${j+1}`;
        pushOpt(k, `${escapeHtml(t('energy_key_pv_n'))} ${j+1}: ${escapeHtml(eid)}`, isSelected);
      });
      if (ep.gridImport)       pushOpt('grid_import', escapeHtml(t('energy_key_grid_import')), sel === 'grid_import');
      if (ep.gridExport)       pushOpt('grid_export', escapeHtml(t('energy_key_grid_export')), sel === 'grid_export');
      if (ep.batteryCharge)    pushOpt('battery_charge', escapeHtml(t('energy_key_battery_charge')), sel === 'battery_charge');
      if (ep.batteryDischarge) pushOpt('battery_discharge', escapeHtml(t('energy_key_battery_discharge')), sel === 'battery_discharge');
      if (ep.devices.length > 0) pushOpt('device_sum', escapeHtml(t('energy_key_device_sum')), sel === 'device_sum');
      ep.devices.forEach((eid, j) => {
        const k = `stat:${eid}`;
        const isSelected = sel === k || sel === `device_${j+1}`;
        pushOpt(k, `${escapeHtml(t('energy_key_device_n'))} ${j+1}: ${escapeHtml(eid)}`, isSelected);
        // Nested sub-devices of this parent device
        ep.nestedDevices.filter(nd => nd.parentStat === eid).forEach((nd) => {
          const gi = ep.nestedDevices.indexOf(nd);
          const nk = `stat:${nd.stat}`;
          const isNestSelected = sel === nk || sel === `nested_${gi+1}`;
          const label = nd.name || nd.stat;
          pushOpt(nk, `\u00a0\u00a0\u21b3 ${escapeHtml(t('energy_key_device_n'))}: ${escapeHtml(label)}`, isNestSelected);
        });
      });
      // Nested devices without a known parent (included_whole_home_energy_manager)
      ep.nestedDevices.filter(nd => !ep.devices.includes(nd.parentStat) && nd.parentStat === null).forEach((nd) => {
        const gi = ep.nestedDevices.indexOf(nd);
        const nk = `stat:${nd.stat}`;
        const isNestSelected = sel === nk || sel === `nested_${gi+1}`;
        const label = nd.name || nd.stat;
        pushOpt(nk, `\u21b3 ${escapeHtml(t('energy_key_device_n'))}: ${escapeHtml(label)}`, isNestSelected);
      });
      (ep.waterStats || []).forEach((eid, j) => {
        const k = `stat:${eid}`;
        pushOpt(k, `Water ${j + 1}: ${escapeHtml(eid)}`, sel === k);
      });
      if (sel && sel.startsWith('stat:') && !values.has(sel)) {
        const customStat = sel.slice(5);
        pushOpt(sel, `${escapeHtml(this._resolveEnergyLabel(sel))}: ${escapeHtml(customStat)}`, true);
      }
      return opts.join('');
    };
    const energyKeyOptions = _buildEnergyKeyOptions();
    return `
<div class="col-body">
  <div class="row">
    <div class="field-wrap">
      <span class="field-label">${t('lbl_type')}</span>
      <select class="hs" data-col-key="type" data-col-idx="${i}">
        <option value="date"  ${type==='date'  ?'selected':''}>${t('type_date')}</option>
        <option value="energy"${type==='energy'?'selected':''}>${t('type_energy')}</option>
        <option value="entity"${type==='entity'?'selected':''}>${t('type_entity')}</option>
        <option value="calc"  ${type==='calc'  ?'selected':''}>${t('type_calc')}</option>
      </select>
    </div>
    <div class="field-wrap">
      <span class="field-label">${t('lbl_header')}</span>
      <input class="ha-textfield" data-col-key="name" data-col-idx="${i}" placeholder="${t('lbl_header')}" value="${escapeHtml(col.name || '')}">
    </div>
  </div>
  ${type === 'date' ? `
  <div class="row">
    <div class="field-wrap">
      <span class="field-label">${t('lbl_date_format_col')}</span>
      <select class="hs" data-col-key="date_format" data-col-idx="${i}">
        <option value="">${t('df_default')}</option>
        ${['short','medium','long','full','numeric_dt','unixtimestamp'].map(f =>
          `<option value="${f}"${col.date_format===f?' selected':''}>${t('df_labels')[f] || f}</option>`).join('')}
      </select>
    </div>
    <div class="field-wrap" style="flex:1">
      <span class="field-label">=${t('lbl_alias')} <small style="opacity:.5;font-size:10px">${t('lbl_alias_hint')}</small></span>
      <input class="ha-textfield" data-col-key="variable" data-col-idx="${i}" placeholder="${t('lbl_alias')}" value="${escapeHtml(col.variable || '')}">
    </div>
  </div>
  <div class="row" style="align-items:center">
    <label class="ha-check-row" style="display:flex;align-items:center;gap:6px;cursor:pointer">
      <ha-checkbox data-col-bool="hidden" data-col-idx="${i}"${col.hidden ? ' checked' : ''}></ha-checkbox>
      <span style="font-size:13px">${t('lbl_hidden')}</span>
    </label>
  </div>` : ''}
  ${type === 'entity' ? (() => {
    const entityStateClass = this._hass?.states?.[col.entity]?.attributes?.state_class;
    const entityStatOpts = statOptionsForStateClass(entityStateClass);
    const entityStatSmart = smartStatTypeForStateClass(entityStateClass);
    const ltsStates = Object.entries(this._hass?.states || {})
      .filter(([, s]) => s?.attributes?.state_class).map(([id]) => id).sort();
    return `
  <div class="entity-input-wrap">
    <span class="entity-input-label">${t('lbl_entity')}</span>
    <input type="text" class="entity-input" data-col-key="entity" data-col-idx="${i}"
           value="${escapeHtml(col.entity || '')}" autocomplete="off"
           data-entity-ac="${i}" placeholder="entity_id">
    <div class="entity-dropdown" id="entity-dropdown-${i}">
      ${ltsStates.map(id =>
        `<div class="entity-dropdown-item" data-entity-id="${escapeHtml(id)}" data-ac-idx="${i}">${escapeHtml(id)}</div>`
      ).join('')}
    </div>
  </div>
  <div class="row">
    <div class="field-wrap">
      <span class="field-label">${t('lbl_stat_type_col')}</span>
      <select class="hs" data-col-key="stat_type" data-col-idx="${i}">
        ${entityStatOpts.map(([v,k]) => `<option value="${v}"${(col.stat_type || entityStatSmart) === v ? ' selected' : ''}>${t(k)}</option>`).join('')}
      </select>
    </div>
    <div class="field-wrap" style="flex:1">
      <span class="field-label">=${t('lbl_alias')} <small style="opacity:.5;font-size:10px">${t('lbl_alias_hint')}</small></span>
      <input class="ha-textfield" data-col-key="variable" data-col-idx="${i}" placeholder="${t('lbl_alias')}" value="${escapeHtml(col.variable || '')}">
    </div>
  </div>
  <div class="row" style="align-items:center">
    <label class="ha-check-row" style="display:flex;align-items:center;gap:6px;cursor:pointer">
      <ha-checkbox data-col-bool="hidden" data-col-idx="${i}"${col.hidden ? ' checked' : ''}></ha-checkbox>
      <span style="font-size:13px">${t('lbl_hidden')}</span>
    </label>
  </div>
  ${!col.hidden ? `
  <div class="row" style="align-items:flex-end;flex-wrap:wrap;gap:6px">
    <div class="field-wrap" style="flex:0 0 auto">
      <span class="field-label">${t('lbl_decimals_col')}</span>
      <input class="ha-textfield" data-col-key="decimals" data-col-idx="${i}" placeholder="${t('lbl_decimals_col')}" type="number" value="${col.decimals ?? ''}">
    </div>
    <div class="field-wrap" style="flex:1;min-width:100px">
      <span class="field-label" style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <span>${t('lbl_unit_hint')}</span>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:normal">
          <ha-checkbox data-col-bool="hide_unit" data-col-idx="${i}"${col.hide_unit ? ' checked' : ''}></ha-checkbox>
          <span style="font-size:11px;opacity:.7">${t('chk_hide_unit')}</span>
        </label>
      </span>
      <input class="ha-textfield" data-col-key="unit" data-col-idx="${i}"
             placeholder="${escapeHtml(this._hass?.states[col.entity]?.attributes?.unit_of_measurement || 'auto')}"
             value="${escapeHtml(col.unit || '')}"
             style="${col.hide_unit ? 'opacity:0.4' : ''}">
    </div>
  </div>` : ''}
  `;
  })() : ''}
  ${type === 'energy' ? (() => {
    const eids = this._resolveEnergyEntityIds(col.energy_key);
    const scs = eids.map(id => this._hass?.states?.[id]?.attributes?.state_class).filter(Boolean);
    const model = chooseAllowedStatType(col.stat_type || 'change', scs);
    const energyStatOpts = model.opts;
    const energyStatSelected = model.statType;
    return `
  ${energyKeyOptions === null ? `
  <div style="margin:4px 0 8px">
    <button type="button" class="add-btn" data-action="load-energy-prefs" style="background:rgba(255,152,0,.12);border-color:rgba(255,152,0,.4)">
      ${escapeHtml(t('lbl_energy_load'))}
    </button>
  </div>` : `
  <div class="row">
    <div class="field-wrap" style="flex:1">
      <span class="field-label">${t('lbl_energy_key')}</span>
      <select class="hs" data-col-key="energy_key" data-col-idx="${i}">
        ${energyKeyOptions}
      </select>
    </div>
  </div>`}
  <div class="row">
    <div class="field-wrap">
      <span class="field-label">${t('lbl_stat_type_col')}</span>
      <select class="hs" data-col-key="stat_type" data-col-idx="${i}">
        ${energyStatOpts.map(([v,k]) => `<option value="${v}"${energyStatSelected===v?' selected':''}>${t(k)}</option>`).join('')}
      </select>
    </div>
    <div class="field-wrap" style="flex:1">
      <span class="field-label">=${t('lbl_alias')} <small style="opacity:.5;font-size:10px">${t('lbl_alias_hint')}</small></span>
      <input class="ha-textfield" data-col-key="variable" data-col-idx="${i}" placeholder="${t('lbl_alias')}" value="${escapeHtml(col.variable || '')}">
    </div>
  </div>
  <div class="row" style="align-items:center">
    <label class="ha-check-row" style="display:flex;align-items:center;gap:6px;cursor:pointer">
      <ha-checkbox data-col-bool="hidden" data-col-idx="${i}"${col.hidden ? ' checked' : ''}></ha-checkbox>
      <span style="font-size:13px">${t('lbl_hidden')}</span>
    </label>
  </div>
  ${!col.hidden ? `
  <div class="row" style="align-items:flex-end;flex-wrap:wrap;gap:6px">
    <div class="field-wrap" style="flex:0 0 auto">
      <span class="field-label">${t('lbl_decimals_col')}</span>
      <input class="ha-textfield" data-col-key="decimals" data-col-idx="${i}" type="number" placeholder="2" value="${col.decimals ?? ''}">
    </div>
    <div class="field-wrap" style="flex:1;min-width:100px">
      <span class="field-label" style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <span>${t('lbl_unit_hint')}</span>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:normal">
          <ha-checkbox data-col-bool="hide_unit" data-col-idx="${i}"${col.hide_unit ? ' checked' : ''}></ha-checkbox>
          <span style="font-size:11px;opacity:.7">${t('chk_hide_unit')}</span>
        </label>
      </span>
      <input class="ha-textfield" data-col-key="unit" data-col-idx="${i}" placeholder="kWh" value="${escapeHtml(col.unit || '')}" style="${col.hide_unit ? 'opacity:0.4' : ''}">
    </div>
  </div>` : ''}
  `;
  })() : ''}
  ${type === 'calc' ? `
  <div class="row">
    <div class="field-wrap" style="flex:1">
      <span class="field-label">=${t('lbl_vars')} <small style="opacity:.5;font-size:10px">(${t('lbl_alias')}=entity_id, stat_type optional)</small></span>
      <div id="vars-list-${i}" style="display:flex;flex-direction:column;gap:4px;margin-bottom:4px">
        ${Object.entries(col.vars || {}).map(([variable, v], vi) => {
          const entityId = typeof v === 'string' ? v : (v?.entity || '');
          const varStatType = typeof v === 'object' && typeof v?.stat_type === 'string' ? v.stat_type : '';
          const varStateClass = this._hass?.states?.[entityId]?.attributes?.state_class;
          const varModel = chooseAllowedStatType(varStatType, [varStateClass]);
          const varStatOpts = varModel.opts;
          const varStatSelected = varModel.statType;
          const allStates = Object.entries(this._hass?.states || {}).filter(([, s]) => s?.attributes?.state_class).map(([id]) => id).sort();
          return `<div class="var-row" style="display:flex;align-items:center;gap:4px">
            <input class="ha-textfield" style="width:90px;flex-shrink:0" placeholder="variable"
                   data-var-variable="${i}" data-var-idx="${vi}" value="${escapeHtml(variable)}">
            <span style="opacity:.5">=</span>
            <div class="entity-input-wrap" style="flex:1;min-width:0;position:relative">
              <input type="text" class="entity-input" style="width:100%"
                     data-var-entity-ac="${i}-${vi}" placeholder="entity_id"
                     value="${escapeHtml(entityId)}" autocomplete="off">
              <div class="entity-dropdown" id="var-entity-dropdown-${i}-${vi}">
                ${allStates.map(id => `<div class="entity-dropdown-item" data-entity-id="${escapeHtml(id)}" data-var-ac-key="${i}-${vi}">${escapeHtml(id)}</div>`).join('')}
              </div>
            </div>
            <select class="hs" data-var-stat-type="${i}-${vi}" style="width:110px;flex-shrink:0" title="${t('lbl_stat_type_col')}">
              ${varStatOpts.map(([v,k]) => `<option value="${v}"${varStatSelected===v?' selected':''}>${t(k)}</option>`).join('')}
            </select>
            <button type="button" class="ibtn del" data-action="var-del" data-col-idx="${i}" data-var-idx="${vi}" style="flex-shrink:0">✕</button>
          </div>`;
        }).join('')}
      </div>
      <button type="button" class="add-btn" data-action="var-add" data-col-idx="${i}" style="margin-top:0">＋ Var</button>
    </div>
  </div>
  <div class="calc-wizard">
    <div class="calc-wizard-section" id="calc-variable-section-${i}"${!allCalcAliases.length ? ' style="display:none"' : ''}>
      <div class="calc-wizard-label">${t('lbl_calc_aliases')}</div>
      <div class="calc-wizard-btns" id="calc-variable-btns-${i}">
        ${allCalcAliases.map(a => `<button type="button" class="cwb var-btn" data-cwi="${i}" data-cw-insert="${escapeHtml(a)}">${escapeHtml(a)}</button>`).join('')}
      </div>
    </div>
    <div class="calc-wizard-section">
      <div class="calc-wizard-label">${t('lbl_calc_ops')}</div>
      <div class="calc-wizard-btns">
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert="{{ " style="background:rgba(255,152,0,.12);border-color:rgba(255,152,0,.5)">{{</button>
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert="+">+</button>
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert="-">-</button>
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert="*">*</button>
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert="/">/</button>
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert="(">(</button>
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert=")">)</button>
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert="[">[</button>
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert="]">]</button>
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert=",">,</button>
        <button type="button" class="cwb const-btn" data-cwi="${i}" data-cw-insert="* 0.001">* 0.001</button>
        <button type="button" class="cwb const-btn" data-cwi="${i}" data-cw-insert="* 1000">* 1000</button>
        <button type="button" class="cwb" data-cwi="${i}" data-cw-insert=" }}" style="background:rgba(255,152,0,.12);border-color:rgba(255,152,0,.5)">}}</button>
      </div>
    </div>
    <div class="calc-wizard-section">
      <div class="calc-wizard-label">${t('lbl_calc_filters')}</div>
      <div class="calc-wizard-btns">
        <button type="button" class="cwb filter-btn" data-cwi="${i}" data-cw-insert=" | max"> | max</button>
        <button type="button" class="cwb filter-btn" data-cwi="${i}" data-cw-insert=" | min"> | min</button>
        <button type="button" class="cwb filter-btn" data-cwi="${i}" data-cw-insert=" | abs"> | abs</button>
        <button type="button" class="cwb filter-btn" data-cwi="${i}" data-cw-insert=" | int"> | int</button>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="field-wrap" style="flex:1">
      <span class="field-label">${t('lbl_template')} <small style="opacity:.5;font-size:10px;font-family:monospace">${t('lbl_calc_mode_hint')}</small></span>
      <textarea class="ha-textfield" data-col-key="template" data-col-idx="${i}"
                placeholder="{{ variable1 + variable2 }}" rows="3"
                style="height:auto;padding:8px 12px;resize:vertical;font-family:monospace">${escapeHtml(col.template || col.calc || '')}</textarea>
    </div>
  </div>
  <div class="field-wrap">
    <span class="field-label">=${t('lbl_alias')} <small style="opacity:.5;font-size:10px">${t('lbl_alias_hint')}</small></span>
    <input class="ha-textfield" data-col-key="variable" data-col-idx="${i}" placeholder="${t('lbl_alias')}" value="${escapeHtml(col.variable || '')}">
  </div>
  <div class="row" style="align-items:center">
    <label class="ha-check-row" style="display:flex;align-items:center;gap:6px;cursor:pointer">
      <ha-checkbox data-col-bool="hidden" data-col-idx="${i}"${col.hidden ? ' checked' : ''}></ha-checkbox>
      <span style="font-size:13px">${t('lbl_hidden')}</span>
    </label>
  </div>
  ${!col.hidden ? `
  <div class="row" style="align-items:flex-end;flex-wrap:wrap;gap:6px">
    <div class="field-wrap" style="flex:0 0 auto">
      <span class="field-label">${t('lbl_decimals_col')}</span>
      <input class="ha-textfield" data-col-key="decimals" data-col-idx="${i}" type="number" placeholder="2" value="${col.decimals ?? ''}">
    </div>
    <div class="field-wrap" style="flex:1;min-width:100px">
      <span class="field-label" style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <span>${t('lbl_unit_hint')}</span>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:normal">
          <ha-checkbox data-col-bool="hide_unit" data-col-idx="${i}"${col.hide_unit ? ' checked' : ''}></ha-checkbox>
          <span style="font-size:11px;opacity:.7">${t('chk_hide_unit')}</span>
        </label>
      </span>
      <input class="ha-textfield" data-col-key="unit" data-col-idx="${i}" placeholder="${t('lbl_unit')}" value="${escapeHtml(col.unit || '')}" style="${col.hide_unit ? 'opacity:0.4' : ''}">
    </div>
  </div>
  ` : ''}` : ''}
  ${!col.hidden ? `
  <div class="row" style="align-items:flex-end">
    <div class="color-picker-wrap entity-input-wrap" style="flex:1">
      <span class="entity-input-label">${t('lbl_color')}</span>
      <input type="text" class="entity-input bg-color-input"
             data-col-key="color" data-col-idx="${i}" data-color-type="text"
             value="${escapeHtml(col.color || '')}"
             placeholder="#rrggbb"
             autocomplete="off"
             style="${col.color ? `background:${col.color};color:white` : ''}">
      <div class="color-picker-list">
        ${DEFAULT_TEXT_COLORS.map((clr, pi) => {
          const hex = clr.replace('#','');
          const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
          const fg = (r*299 + g*587 + b*114) / 1000 > 128 ? '#000' : '#fff';
          return `<div class="color-picker-option" data-color="${escapeHtml(clr)}"
                style="background:${clr};color:${fg}">
            <span style="font-weight:500">${escapeHtml(clr)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="color-picker-wrap entity-input-wrap" style="flex:1">
      <span class="entity-input-label">${t('lbl_bg_color')}</span>
      <input type="text" class="entity-input bg-color-input"
             data-col-key="background_color" data-col-idx="${i}"
             value="${escapeHtml(col.background_color || '')}"
             placeholder="${t('ph_bg_color')}"
             autocomplete="off"
             style="${col.background_color ? `background:${col.background_color};color:${col.color || 'var(--primary-text-color)'}` : ''}">
      <div class="color-picker-list">
        ${DEFAULT_COLUMN_BG_COLORS.map((clr, pi) =>
          `<div class="color-picker-option" data-color="${escapeHtml(clr)}"
                style="background:${clr};color:${escapeHtml(col.color || 'var(--primary-text-color)')}">
            <span style="font-weight:500">${escapeHtml(colorLabels[pi] || clr)}</span>
            <span style="opacity:0.6;font-size:10px;margin-left:6px">${escapeHtml(clr)}</span>
          </div>`
        ).join('')}
      </div>
    </div>
  </div>
  ${this._config.layout === 'horizontal' ? `
  <div class="row" style="align-items:flex-end">
    <div class="color-picker-wrap entity-input-wrap" style="flex:1">
      <span class="entity-input-label">${t('lbl_bullet_color')} <small style="opacity:0.6">${t('lbl_bullet_color_hint')}</small></span>
      <input type="text" class="entity-input bg-color-input"
             data-col-key="bullet_color" data-col-idx="${i}"
             value="${escapeHtml(col.bullet_color || '')}"
             placeholder="${t('ph_bullet_color')}"
             autocomplete="off"
             style="${col.bullet_color ? `background:${col.bullet_color};color:white` : ''}">
      <div class="color-picker-list">
        ${DEFAULT_COLUMN_BG_COLORS.map((clr, pi) => {
          const solid = _solidColorFromBg(clr);
          return `<div class="color-picker-option" data-color="${escapeHtml(solid)}"
                style="background:${solid};color:white">
            <span style="font-weight:500">${escapeHtml(colorLabels[pi] || solid)}</span>
            <span style="opacity:0.6;font-size:10px;margin-left:6px">${escapeHtml(solid)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div style="flex:1"></div>
  </div>` : ''}` : ''}
</div>`;
  }

  // ── event listeners ────────────────────────────────────────────────────────

  _attachListeners() {
    const sr = this.shadowRoot;

    // tabs
    sr.querySelectorAll('.tab-btn').forEach(btn =>
      btn.addEventListener('click', () => { this._tab = btn.dataset.tab; this._expandedCol = -1; this._render(); })
    );

    // global textfields (input elements with data-cfg-key)
    sr.querySelectorAll('input.ha-textfield[data-cfg-key]').forEach(el => {
      el.addEventListener('change', () => {
        let v = el.value;
        if (el.type === 'number') { v = v === '' ? null : Number(v); if (isNaN(v)) v = null; }
        this._set(el.dataset.cfgKey, v);
      });
    });

    // global ha-textfield (web components) with data-cfg-key
    sr.querySelectorAll('ha-textfield[data-cfg-key]').forEach(el => {
      el.addEventListener('change', () => {
        let v = el.value;
        if (el.type === 'number') { v = v === '' ? null : Number(v); if (isNaN(v)) v = null; }
        this._set(el.dataset.cfgKey, v);
      });
    });

    // global selects
    sr.querySelectorAll('select.hs[data-cfg-key]').forEach(el =>
      el.addEventListener('change', () => this._set(el.dataset.cfgKey, el.value))
    );

    // aggregation selects
    sr.querySelectorAll('select.hs[data-agg-key]').forEach(el =>
      el.addEventListener('change', () => {
        const key = el.dataset.aggKey;
        const val = el.value;
        const agg = JSON.parse(JSON.stringify(this._config.aggregation || {}));
        if (val) agg[key] = val; else delete agg[key];
        if (Object.keys(agg).length === 0) {
          const c = { ...this._config }; delete c.aggregation; this._config = c;
        } else {
          this._config = { ...this._config, aggregation: agg };
        }
        this._fire();
      })
    );

    // global checkboxes
    sr.querySelectorAll('ha-checkbox[data-cfg-bool]').forEach(el =>
      el.addEventListener('change', () => this._set(el.dataset.cfgBool, el.checked))
    );

    // per-column boolean checkboxes (e.g. hidden, hide_unit)
    sr.querySelectorAll('ha-checkbox[data-col-bool]').forEach(el => {
      el.addEventListener('change', () => {
        const key = el.dataset.colBool;
        const idx = +el.dataset.colIdx;
        const cols = JSON.parse(JSON.stringify(this._config.columns || []));
        if (el.checked) cols[idx] = { ...cols[idx], [key]: true };
        else delete cols[idx][key];
        this._config = { ...this._config, columns: cols };
        this._fire();
        if (key === 'hide_unit' || key === 'hidden') this._render(); // Felder sofort ein-/ausblenden
      });
    });

    // calc column vars textarea (variable=entity_id, one per line) – legacy handler, kept for YAML backward compat
    sr.querySelectorAll('textarea[data-col-vars]').forEach(el => {
      el.addEventListener('change', () => {
        const idx = +el.dataset.colVars;
        const vars = {};
        el.value.split('\n').forEach(line => {
          const eq = line.indexOf('=');
          if (eq > 0) {
            const variable = line.slice(0, eq).trim();
            const entity = line.slice(eq + 1).trim();
            if (variable && entity) vars[variable] = entity;
          }
        });
        const cols = JSON.parse(JSON.stringify(this._config.columns || []));
        if (Object.keys(vars).length) cols[idx] = { ...cols[idx], vars };
        else delete cols[idx].vars;
        this._config = { ...this._config, columns: cols };
        this._fire();
      });
    });

    // ── Calc vars entity-picker rows ─────────────────────────────────────────

    /** Refreshes calc wizard variable buttons without a full editor re-render */
    const _refreshWizardAliases = (colIdx) => {
      const section = sr.getElementById(`calc-variable-section-${colIdx}`);
      const btnsDiv = sr.getElementById(`calc-variable-btns-${colIdx}`);
      if (!section || !btnsDiv) return;
      const list = sr.getElementById(`vars-list-${colIdx}`);
      const varAliases = list
        ? [...list.querySelectorAll(`[data-var-variable="${colIdx}"]`)].map(el => el.value.trim()).filter(Boolean)
        : [];
      const calcAliases = (this._config.columns || [])
        .filter((c, ci) => ci !== colIdx && c.variable && (c.entity || c.template || c.calc || c.type === COL_ENERGY || c.type === COL_DATE))
        .map(c => c.variable);
      const allAliases = [...calcAliases, ...varAliases.filter(a => !calcAliases.includes(a))];
      section.style.display = allAliases.length ? '' : 'none';
      btnsDiv.innerHTML = allAliases.map(a =>
        `<button type="button" class="cwb var-btn" data-cwi="${colIdx}" data-cw-insert="${escapeHtml(a)}">${escapeHtml(a)}</button>`
      ).join('');
      // Note: new buttons handled by delegated click listener on sr
    };

    const _refreshEntityStatTypeSelect = (colIdx, entityId, preferredValue = null) => {
      const sel = sr.querySelector(`select[data-col-key="stat_type"][data-col-idx="${colIdx}"]`);
      if (!sel) return;
      const stateObj = this._hass?.states?.[entityId];
      if (!stateObj) return;
      const sc = stateObj.attributes?.state_class;
      const opts = statOptionsForStateClass(sc);
      const smart = smartStatTypeForStateClass(sc);
      sel.innerHTML = opts.map(([v, k]) => `<option value="${v}">${this._t(k)}</option>`).join('');
      const allowed = new Set(opts.map(([v]) => v));
      const next = allowed.has(smart) ? smart : (opts[0]?.[0] || 'mean');
      sel.value = next;
      const current = this._config.columns?.[colIdx]?.stat_type;
      if (current === next) return;
      const cols = JSON.parse(JSON.stringify(this._config.columns || []));
      if (!cols[colIdx]) return;
      cols[colIdx] = { ...cols[colIdx], stat_type: next };
      this._config = { ...this._config, columns: cols };
      this._fire();
    };

    const _refreshVarStatTypeSelect = (rowEl, colIdx) => {
      const entityEl = rowEl.querySelector(`input[data-var-entity-ac^="${colIdx}-"]`);
      const statSel  = rowEl.querySelector(`select[data-var-stat-type^="${colIdx}-"]`);
      if (!entityEl || !statSel) return;
      const entityId = entityEl.value.trim();
      const sc = this._hass?.states?.[entityId]?.attributes?.state_class;
      const model = chooseAllowedStatType(statSel.value, [sc]);
      const opts = model.opts;
      const prev = statSel.value || '';
      const optionHtml = opts.map(([v, k]) => `<option value="${v}">${this._t(k)}</option>`).join('');
      statSel.innerHTML = optionHtml;
      const allowed = new Set(opts.map(([v]) => v));
      const next = allowed.has(prev) ? prev : model.smart;
      statSel.value = next;
    };

    const _syncVarsFromRows = (colIdx) => {
      const list = sr.getElementById(`vars-list-${colIdx}`);
      if (!list) return;
      const vars = {};
      const defaultStatType = this._config.columns?.[colIdx]?.stat_type || this._config.stat_type || 'mean';
      list.querySelectorAll('.var-row').forEach(row => {
        const aliasEl  = row.querySelector(`[data-var-variable="${colIdx}"]`);
        const entityEl = row.querySelector(`[data-var-entity-ac^="${colIdx}-"]`);
        const statEl   = row.querySelector(`[data-var-stat-type^="${colIdx}-"]`);
        const variable  = aliasEl?.value.trim();
        const entity = entityEl?.value.trim();
        const statType = statEl?.value?.trim();
        if (variable && entity) {
          if (statType && statType !== defaultStatType) vars[variable] = { entity, stat_type: statType };
          else vars[variable] = entity;
        }
      });
      const cols = JSON.parse(JSON.stringify(this._config.columns || []));
      if (Object.keys(vars).length) cols[colIdx] = { ...cols[colIdx], vars };
      else { delete cols[colIdx].vars; }
      this._config = { ...this._config, columns: cols };
      this._fire();
      _refreshWizardAliases(colIdx);
    };

    /** Adds a new empty var row to the vars-list div without re-rendering */
    const _appendVarRow = (colIdx) => {
      const list = sr.getElementById(`vars-list-${colIdx}`);
      if (!list) return;
      const vi = list.querySelectorAll('.var-row').length;
      const allStates = Object.entries(this._hass?.states || {}).filter(([, s]) => s?.attributes?.state_class).map(([id]) => id).sort();
      const rowEl = document.createElement('div');
      rowEl.className = 'var-row';
      rowEl.style.cssText = 'display:flex;align-items:center;gap:4px';
      rowEl.innerHTML = `
        <input class="ha-textfield" style="width:90px;flex-shrink:0" placeholder="variable"
               data-var-variable="${colIdx}" data-var-idx="${vi}" value="">
        <span style="opacity:.5">=</span>
        <div class="entity-input-wrap" style="flex:1;min-width:0;position:relative">
          <input type="text" class="entity-input" style="width:100%"
                 data-var-entity-ac="${colIdx}-${vi}" placeholder="entity_id"
                 value="" autocomplete="off">
          <div class="entity-dropdown" id="var-entity-dropdown-${colIdx}-${vi}">
            ${allStates.map(id => `<div class="entity-dropdown-item" data-entity-id="${escapeHtml(id)}" data-var-ac-key="${colIdx}-${vi}">${escapeHtml(id)}</div>`).join('')}
          </div>
        </div>
        <select class="hs" data-var-stat-type="${colIdx}-${vi}" style="width:110px;flex-shrink:0" title="${this._t('lbl_stat_type_col')}">
          ${statOptionsForStateClass(null).map(([v, k]) => `<option value="${v}">${this._t(k)}</option>`).join('')}
        </select>
        <button type="button" class="ibtn del" data-action="var-del" data-col-idx="${colIdx}" data-var-idx="${vi}" style="flex-shrink:0">✕</button>`;
      list.appendChild(rowEl);
      // Wire up AC and change handlers for the new row
      _wireVarRow(rowEl, colIdx);
      _refreshVarStatTypeSelect(rowEl, colIdx);
    };

    /** Wires variable change + entity-AC + delete for a single var-row element */
    const _wireVarRow = (rowEl, colIdx) => {
      // Alias input → sync
      rowEl.querySelectorAll(`[data-var-variable]`).forEach(inp => {
        inp.addEventListener('change', () => _syncVarsFromRows(colIdx));
      });
      // Per-variable stat_type
      rowEl.querySelectorAll(`[data-var-stat-type]`).forEach(sel => {
        sel.addEventListener('change', () => _syncVarsFromRows(colIdx));
      });
      // Delete button
      rowEl.querySelectorAll('[data-action="var-del"]').forEach(btn => {
        btn.addEventListener('click', () => {
          rowEl.remove();
          _syncVarsFromRows(colIdx);
        });
      });
      // Entity autocomplete for var rows
      rowEl.querySelectorAll('input[data-var-entity-ac]').forEach(inp => {
        const key = inp.dataset.varEntityAc;
        const dd  = rowEl.querySelector(`#var-entity-dropdown-${key}`);
        if (!dd) return;
        let highlighted = -1;

        const getVisible = () => [...dd.querySelectorAll('.entity-dropdown-item')]
          .filter(el => el.style.display !== 'none');

        const filter = (query) => {
          const q = query.trim().toLowerCase();
          let visible = 0;
          dd.querySelectorAll('.entity-dropdown-item').forEach(el => {
            const show = !q || el.dataset.entityId.toLowerCase().includes(q);
            el.style.display = show ? '' : 'none';
            if (show) visible++;
          });
          highlighted = -1;
          if (visible > 0) {
            const colBody = inp.closest('.col-body');
            const wrap = inp.closest('.entity-input-wrap');
            if (colBody && wrap) {
              const bodyRect = colBody.getBoundingClientRect();
              const wrapRect = wrap.getBoundingClientRect();
              const inputRect = inp.getBoundingClientRect();
              const width = Math.max(inputRect.width, Math.min(Math.floor(inputRect.width + 135), Math.floor(bodyRect.right - wrapRect.left - 4)));
              dd.style.left = '0px';
              dd.style.right = 'auto';
              dd.style.width = `${width}px`;
              dd.style.maxWidth = `${width}px`;
            }
          }
          dd.classList.toggle('open', visible > 0);
        };

        dd.addEventListener('mousedown', e => {
          if (!e.target.closest('.entity-dropdown-item')) e.preventDefault();
        });

        const pick = (value) => {
          inp.value = value;
          dd.classList.remove('open');
          _refreshVarStatTypeSelect(rowEl, colIdx);
          _syncVarsFromRows(colIdx);
        };

        inp.addEventListener('input',  () => { filter(inp.value); _refreshVarStatTypeSelect(rowEl, colIdx); });
        inp.addEventListener('change', () => { _refreshVarStatTypeSelect(rowEl, colIdx); _syncVarsFromRows(colIdx); });
        inp.addEventListener('focus',  () => filter(inp.value));
        inp.addEventListener('blur',   () => setTimeout(() => dd.classList.remove('open'), 200));
        inp.addEventListener('keydown', e => {
          const items = getVisible();
          if (!items.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[highlighted]?.classList.remove('highlighted');
            highlighted = Math.min(highlighted + 1, items.length - 1);
            items[highlighted]?.classList.add('highlighted');
            items[highlighted]?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[highlighted]?.classList.remove('highlighted');
            highlighted = Math.max(highlighted - 1, 0);
            items[highlighted]?.classList.add('highlighted');
            items[highlighted]?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter' && highlighted >= 0) {
            e.preventDefault();
            pick(items[highlighted].dataset.entityId);
          } else if (e.key === 'Escape') {
            dd.classList.remove('open');
          }
        });
        dd.querySelectorAll('.entity-dropdown-item').forEach(item =>
          item.addEventListener('mousedown', e => { e.preventDefault(); pick(item.dataset.entityId); })
        );
      });
      _refreshVarStatTypeSelect(rowEl, colIdx);
    };

    // Wire existing var-rows (rendered from current config)
    sr.querySelectorAll('[id^="vars-list-"]').forEach(list => {
      const colIdx = parseInt(list.id.replace('vars-list-', ''), 10);
      list.querySelectorAll('.var-row').forEach(row => _wireVarRow(row, colIdx));
    });

    // "＋ Var" button
    sr.querySelectorAll('[data-action="var-add"]').forEach(btn => {
      btn.addEventListener('click', () => _appendVarRow(+btn.dataset.colIdx));
    });

    // global color pickers (header_color, first_col_color, header_text_color, first_col_text_color)
    sr.querySelectorAll('input[data-cfg-color-key]').forEach(el => {
      const key = el.dataset.cfgColorKey;
      const isTextColor = el.dataset.colorType === 'text';
      el.addEventListener('input', () => {
        // Live preview only – no _set/_render to avoid innerHTML replacement and focus loss
        el.style.background = el.value || '';
        el.style.color = el.value && isTextColor ? 'white' : '';
      });
      el.addEventListener('change', () => {
        el.style.background = el.value || '';
        el.style.color = el.value && isTextColor ? 'white' : '';
        this._set(key, el.value || null);
      });
      const list = el.closest('.color-picker-wrap')?.querySelector('.color-picker-list');
      if (list) {
        el.addEventListener('focus', () => { list.style.display = 'block'; });
        el.addEventListener('click', () => { list.style.display = 'block'; });
        el.addEventListener('blur',  () => { setTimeout(() => { list.style.display = 'none'; }, 150); });
        list.querySelectorAll('.color-picker-option').forEach(opt => {
          opt.addEventListener('mousedown', e => {
            e.preventDefault();
            el.value = opt.dataset.color;
            el.dispatchEvent(new Event('input',  { bubbles: false }));
            el.dispatchEvent(new Event('change', { bubbles: false }));
            list.style.display = 'none';
          });
        });
      }
    });

    // expand/collapse column
    sr.querySelectorAll('.col-hdr[data-action="toggle-col"]').forEach(el =>
      el.addEventListener('click', e => {
        e.stopPropagation();
        const idx = +el.dataset.idx;
        this._expandedCol = this._expandedCol === idx ? -1 : idx;
        this._render();
      })
    );

    // column up/down/delete
    const _colMutate = (idx, fn) => {
      const cols = JSON.parse(JSON.stringify(this._config.columns || []));
      fn(cols, idx);
      this._config = { ...this._config, columns: cols };
      this._fire(); this._render();
    };

    sr.querySelectorAll('[data-action="col-del"]').forEach(el =>
      el.addEventListener('click', e => {
        e.stopPropagation();
        const idx = +el.dataset.idx;
        _colMutate(idx, (cols, i) => {
          cols.splice(i, 1);
          if (this._expandedCol >= i) this._expandedCol = Math.max(-1, this._expandedCol - 1);
        });
      })
    );
    this._attachDragSort(sr, '.col-list', '.col-item',
      () => this._config.columns || [],
      cols  => { this._config = { ...this._config, columns: cols }; this._fire(); this._render(); },
      () => this._expandedCol,
      i    => { this._expandedCol = i; });

    const addColBtn = sr.querySelector('[data-action="add-col"]');
    if (addColBtn) addColBtn.addEventListener('click', () => {
      const cols = JSON.parse(JSON.stringify(this._config.columns || []));
      cols.push({ type: 'entity', header: '', entity: '' });
      this._expandedCol = cols.length - 1;
      this._config = { ...this._config, columns: cols };
      this._fire(); this._render();
    });

    const energyBtnV = sr.querySelector('[data-action="load-energy-v"]');
    if (energyBtnV) energyBtnV.addEventListener('click', () => this._loadEnergyConfig(false));
    const energyBtnH = sr.querySelector('[data-action="load-energy-h"]');
    if (energyBtnH) energyBtnH.addEventListener('click', () => this._loadEnergyConfig(true));

    // Auto-load energy prefs when an energy column is shown in editor
    if (!this._cachedEnergyPrefs && (this._config.columns || []).some(c => c.type === COL_ENERGY)) {
      this._ensureEnergyPrefs().then(() => this._render());
    }

    // Load-energy-prefs button (inside energy column editor)
    sr.querySelectorAll('[data-action="load-energy-prefs"]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.disabled = true;
        this._ensureEnergyPrefs().then(() => this._render());
      });
    });

    // column field changes (textfields, selects, entity inputs)
    sr.querySelectorAll('[data-col-key]').forEach(el => {
      const key = el.dataset.colKey;
      const idx = +el.dataset.colIdx;
      const tag = el.tagName.toLowerCase();

      const apply = (value) => {
        const cols = JSON.parse(JSON.stringify(this._config.columns || []));
        if (value === '' || value === null || value === undefined) delete cols[idx][key];
        else cols[idx] = { ...cols[idx], [key]: value };
        if (key === 'type') {
          if (value === 'date')   ['entity','template','calc','format','factor','unit','energy_key'].forEach(k => delete cols[idx][k]);
          if (value === 'entity') ['template','calc','energy_key','format'].forEach(k => delete cols[idx][k]);
          if (value === 'calc')   ['entity','energy_key'].forEach(k => delete cols[idx][k]);
          if (value === 'energy') ['entity','template','calc','format','factor','vars'].forEach(k => delete cols[idx][k]);
        }
        // Auto-fill/update variable when energy_key changes
        if (key === 'energy_key') {
          const defAliases = this._t('energy_default_alias') || {};
          const prevEnergyKey = this._config.columns?.[idx]?.energy_key || '';
          const prevDefault   = defAliases[prevEnergyKey] || prevEnergyKey.replace(/[^a-z0-9_]/g, '_') || '';
          const newDefault    = defAliases[value] || value?.replace(/[^a-z0-9_]/g, '_') || '';
          const curAlias      = cols[idx].variable || '';
          // Update variable if unset OR if it still matches the previous auto-fill default
          if ((!curAlias || curAlias === prevDefault || curAlias === prevEnergyKey) && newDefault) {
            cols[idx].variable = newDefault;
          }
          // Auto-select compatible stat_type based on selected energy entities.
          const eids = this._resolveEnergyEntityIds(value);
          const scs = eids.map(id => this._hass?.states?.[id]?.attributes?.state_class).filter(Boolean);
          const model = chooseAllowedStatType(cols[idx].stat_type || 'change', scs);
          cols[idx].stat_type = model.statType;
        }
        this._config = { ...this._config, columns: cols };
        this._fire();
      };

      if (key === 'color') {
        const syncTextColorPreview = () => {
          el.style.background = el.value || '';
          el.style.color = el.value ? 'white' : '';
          apply(el.value);
          // keep background_color input text readable
          const bgInp = sr.querySelector(`input.bg-color-input[data-col-key="background_color"][data-col-idx="${idx}"]`);
          if (bgInp && bgInp.value) bgInp.style.color = el.value || 'var(--primary-text-color)';
        };
        el.addEventListener('input',  syncTextColorPreview);
        el.addEventListener('change', syncTextColorPreview);
        const list = el.closest('.color-picker-wrap')?.querySelector('.color-picker-list');
        if (list) {
          el.addEventListener('focus', () => { list.style.display = 'block'; });
          el.addEventListener('click', () => { list.style.display = 'block'; });
          el.addEventListener('blur',  () => { setTimeout(() => { list.style.display = 'none'; }, 150); });
        }
      } else if (key === 'background_color') {
        const syncBgPreview = () => {
          const colorTf = sr.querySelector(`ha-textfield[data-col-key="color"][data-col-idx="${idx}"]`);
          const fgColor = colorTf?.value || 'var(--primary-text-color)';
          el.style.background = el.value || '';
          el.style.color = el.value ? fgColor : '';
          apply(el.value);
        };
        el.addEventListener('input',  syncBgPreview);
        el.addEventListener('change', syncBgPreview);
        // show popup on focus/click, hide on blur
        const list = el.closest('.color-picker-wrap')?.querySelector('.color-picker-list');
        if (list) {
          el.addEventListener('focus', () => { list.style.display = 'block'; });
          el.addEventListener('click', () => { list.style.display = 'block'; });
          el.addEventListener('blur',  () => { setTimeout(() => { list.style.display = 'none'; }, 150); });
        }
      } else if (key === 'bullet_color') {
        const syncBulletPreview = () => {
          el.style.background = el.value || '';
          el.style.color = el.value ? 'white' : '';
          apply(el.value);
        };
        el.addEventListener('input',  syncBulletPreview);
        el.addEventListener('change', syncBulletPreview);
        const list = el.closest('.color-picker-wrap')?.querySelector('.color-picker-list');
        if (list) {
          el.addEventListener('focus', () => { list.style.display = 'block'; });
          el.addEventListener('click', () => { list.style.display = 'block'; });
          el.addEventListener('blur',  () => { setTimeout(() => { list.style.display = 'none'; }, 150); });
        }
      } else if (tag === 'select') {
        el.addEventListener('change', () => { apply(el.value); this._render(); });
        // energy_key: if config has no value yet, auto-save the browser's default (first option)
        if (key === 'energy_key' && !this._config.columns?.[idx]?.energy_key && el.value) {
          apply(el.value);
        }
      } else if (tag === 'input' && key === 'entity') {
        el.addEventListener('input',  () => {
          apply(el.value);
        });
        el.addEventListener('change', () => {
          apply(el.value);
          _refreshEntityStatTypeSelect(idx, el.value, this._config.columns?.[idx]?.stat_type);
          this._render();
        });
      } else {
        el.addEventListener('change', () => {
          let v = el.value;
          if (el.type === 'number') { v = v === '' ? null : Number(v); if (isNaN(v)) v = null; }
          apply(v);
        });
      }
    });

    // color-picker popup option clicks
    sr.querySelectorAll('.color-picker-option').forEach(opt => {
      opt.addEventListener('mousedown', e => {
        e.preventDefault(); // prevent input blur before we read the value
        const color = opt.dataset.color;
        const idx = +opt.closest('.color-picker-wrap').querySelector('input.bg-color-input').dataset.colIdx;
        const inp = opt.closest('.color-picker-wrap').querySelector('input.bg-color-input');
        if (inp) {
          inp.value = color;
          inp.dispatchEvent(new Event('input',  { bubbles: false }));
          inp.dispatchEvent(new Event('change', { bubbles: false }));
          opt.closest('.color-picker-list').style.display = 'none';
        }
      });
    });

    // quick menu item field changes (editor)
    sr.querySelectorAll('[data-qmi-key][data-qmi-field]').forEach(el => {
      el.addEventListener('change', () => {
        const idx = +el.dataset.qmiKey;
        const field = el.dataset.qmiField;
        const items = JSON.parse(JSON.stringify(this._config.quick_menu_items || []));
        let v = el.value;
        if (el.type === 'number') { v = v === '' ? null : Number(v); if (isNaN(v)) v = null; }
        if (el.dataset.qmiBool) {
          // boolean select: 'true' → true, 'false' → false, '' → delete field
          if (v === '') { delete items[idx][field]; }
          else items[idx] = { ...items[idx], [field]: v === 'true' };
        } else {
          if (v === '' || v === null) { delete items[idx][field]; }
          else items[idx] = { ...items[idx], [field]: v };
        }
        this._config = { ...this._config, quick_menu_items: items };
        this._fire();
      });
    });
    // delete quick menu item (new data-action="qmi-del" style; keep legacy data-qmi-del for safety)
    const _qmiMutate = (idx, fn) => {
      const items = JSON.parse(JSON.stringify(this._config.quick_menu_items || []));
      fn(items, idx);
      this._config = { ...this._config, quick_menu_items: items };
      this._fire(); this._render();
    };

    sr.querySelectorAll('[data-action="qmi-del"]').forEach(el =>
      el.addEventListener('click', e => {
        e.stopPropagation();
        const idx = +el.dataset.idx;
        _qmiMutate(idx, (items, i) => {
          items.splice(i, 1);
          if (this._expandedQmi >= i) this._expandedQmi = Math.max(-1, this._expandedQmi - 1);
        });
      })
    );
    this._attachDragSort(sr, '.qmi-list', '.qmi-item',
      () => this._config.quick_menu_items || [],
      items => { this._config = { ...this._config, quick_menu_items: items }; this._fire(); this._render(); },
      () => this._expandedQmi,
      i    => { this._expandedQmi = i; });

    sr.querySelectorAll('[data-action="toggle-pad"]').forEach(el =>
      el.addEventListener('click', () => { this._padOpen = !this._padOpen; this._render(); })
    );
    sr.querySelectorAll('[data-action="toggle-qmi"]').forEach(el =>
      el.addEventListener('click', e => {
        e.stopPropagation();
        const idx = +el.dataset.idx;
        this._expandedQmi = this._expandedQmi === idx ? -1 : idx;
        this._render();
      })
    );
    // range_type: show/hide sub-field containers without re-render
    sr.querySelectorAll('[data-qmi-rangetype-sel]').forEach(sel => {
      const qi = sel.dataset.qmiRangetypeSel;
      const updateSubs = () => {
        ['energy', 'days', 'custom_start'].forEach(rt => {
          const sub = sr.querySelector(`[data-qmi-rangetype-sub="${qi}-${rt}"]`);
          if (sub) sub.style.display = sel.value === rt ? '' : 'none';
        });
      };
      sel.addEventListener('change', updateSubs);
    });
    // add quick menu item
    const addQmiBtn = sr.querySelector('#btn-add-qmi');
    if (addQmiBtn) addQmiBtn.addEventListener('click', () => {
      const items = JSON.parse(JSON.stringify(this._config.quick_menu_items || []));
      items.push({});
      this._expandedQmi = items.length - 1;
      this._config = { ...this._config, quick_menu_items: items };
      this._fire(); this._render();
    });

    // ── Benutzerdefiniertes Entity-Autocomplete-Dropdown ─────────────────────
    sr.querySelectorAll('input[data-entity-ac]').forEach(inp => {
      const idx = inp.dataset.entityAc;
      const dd  = sr.getElementById(`entity-dropdown-${idx}`);
      if (!dd) return;
      let highlighted = -1;

      const getVisible = () => [...dd.querySelectorAll('.entity-dropdown-item')]
        .filter(el => el.style.display !== 'none');

      const filter = (query) => {
        const q = query.trim().toLowerCase();
        let visible = 0;
        dd.querySelectorAll('.entity-dropdown-item').forEach(el => {
          const show = !q || el.dataset.entityId.toLowerCase().includes(q);
          el.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        highlighted = -1;
          if (visible > 0) {
            const colBody = inp.closest('.col-body');
            const wrap = inp.closest('.entity-input-wrap');
            if (colBody && wrap) {
              const bodyRect = colBody.getBoundingClientRect();
              const wrapRect = wrap.getBoundingClientRect();
              const inputRect = inp.getBoundingClientRect();
              const width = Math.max(inputRect.width, Math.min(Math.floor(inputRect.width + 135), Math.floor(bodyRect.right - wrapRect.left - 4)));
              dd.style.left = '0px';
              dd.style.right = 'auto';
              dd.style.width = `${width}px`;
              dd.style.maxWidth = `${width}px`;
            }
          }
        dd.classList.toggle('open', visible > 0);
      };

      dd.addEventListener('mousedown', e => {
        if (!e.target.closest('.entity-dropdown-item')) e.preventDefault();
      });

      const pick = (value) => {
        inp.value = value;
        dd.classList.remove('open');
        inp.dispatchEvent(new Event('change', { bubbles: false }));
      };

      inp.addEventListener('input',  () => filter(inp.value));
      inp.addEventListener('focus',  () => filter(inp.value));
      inp.addEventListener('blur',   () => setTimeout(() => dd.classList.remove('open'), 200));
      inp.addEventListener('keydown', e => {
        const items = getVisible();
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          items[highlighted]?.classList.remove('highlighted');
          highlighted = Math.min(highlighted + 1, items.length - 1);
          items[highlighted]?.classList.add('highlighted');
          items[highlighted]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          items[highlighted]?.classList.remove('highlighted');
          highlighted = Math.max(highlighted - 1, 0);
          items[highlighted]?.classList.add('highlighted');
          items[highlighted]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && highlighted >= 0) {
          e.preventDefault();
          pick(items[highlighted].dataset.entityId);
        } else if (e.key === 'Escape') {
          dd.classList.remove('open');
        }
      });
      dd.querySelectorAll('.entity-dropdown-item').forEach(item =>
        item.addEventListener('mousedown', e => { e.preventDefault(); pick(item.dataset.entityId); })
      );
    });

    // ── Formel-Assistent: Text an Cursor-Position in Textarea einfügen ────────
    // Event delegation so dynamically added variable buttons also work
    // Guard: only register once per shadow root to prevent duplicate inserts on re-render
    if (!sr._cwInsertListenerAdded) {
      sr._cwInsertListenerAdded = true;
      // Prevent focus from leaving the textarea before click handler runs.
      sr.addEventListener('mousedown', e => {
        const btn = e.target.closest('[data-cw-insert]');
        if (!btn) return;
        e.preventDefault();
      });
      sr.addEventListener('click', e => {
      const btn = e.target.closest('[data-cw-insert]');
      if (!btn) return;
      e.stopPropagation();
      const insert = btn.dataset.cwInsert;
      const idx    = btn.dataset.cwi;
      const ta     = sr.querySelector(`textarea[data-col-key="template"][data-col-idx="${idx}"]`);
      if (!ta) return;
      const active = document.activeElement === ta;
      const rememberedStart = Number.isFinite(Number(ta.dataset.cwSelStart)) ? Number(ta.dataset.cwSelStart) : null;
      const rememberedEnd   = Number.isFinite(Number(ta.dataset.cwSelEnd))   ? Number(ta.dataset.cwSelEnd)   : null;
      const start  = active
        ? (ta.selectionStart ?? ta.value.length)
        : (rememberedStart ?? ta.value.length);
      const end    = active
        ? (ta.selectionEnd ?? start)
        : (rememberedEnd ?? start);
      const prevScrollTop = ta.scrollTop;
      const before = ta.value.slice(0, start);
      const after  = ta.value.slice(end);
      let newPos;
      // Leeres Feld: automatisch mit {{ }} umhüllen
      if (!ta.value.trim() && !insert.includes('{{') && !insert.includes('}}')) {
        const token = insert.trim();
        ta.value = `{{ ${token} }}`;
        newPos = 3 + token.length;
      } else {
        ta.value = before + insert + after;
        newPos = before.length + insert.length;
      }
      ta.dispatchEvent(new Event('change', { bubbles: false }));
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
      ta.dataset.cwSelStart = String(newPos);
      ta.dataset.cwSelEnd   = String(newPos);
      ta.scrollTop = prevScrollTop;
    });
    }

    // Keep latest caret position for calc template insertions.
    sr.querySelectorAll('textarea[data-col-key="template"]').forEach(ta => {
      const rememberSel = () => {
        ta.dataset.cwSelStart = String(ta.selectionStart ?? 0);
        ta.dataset.cwSelEnd   = String(ta.selectionEnd ?? ta.selectionStart ?? 0);
      };
      ta.addEventListener('focus', rememberSel);
      ta.addEventListener('click', rememberSel);
      ta.addEventListener('keyup', rememberSel);
      ta.addEventListener('select', rememberSel);
      ta.addEventListener('input', rememberSel);
    });
  }

  _attachDragSort(sr, listSel, itemSel, getList, setList, getExp, setExp) {
    const listEl = sr.querySelector(listSel);
    if (!listEl) return;
    listEl.querySelectorAll(itemSel + ' .drag-handle').forEach(handle => {
      // Prevent drag-handle click from toggling the parent col/qmi item
      handle.addEventListener('click', e => e.stopPropagation());
      handle.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const item     = handle.closest(itemSel);
        const allItems = () => [...listEl.querySelectorAll(':scope > ' + itemSel)];
        const fromIdx  = allItems().indexOf(item);
        let toIdx      = fromIdx;
        handle.setPointerCapture(e.pointerId);
        // Ghost clone follows the cursor
        const rect  = item.getBoundingClientRect();
        const ghost = item.cloneNode(true);
        ghost.style.cssText = [
          'position:fixed',
          `left:${rect.left}px`, `top:${rect.top}px`, `width:${rect.width}px`,
          'opacity:0.85', 'pointer-events:none', 'z-index:9999',
          'box-shadow:0 4px 16px rgba(0,0,0,.3)',
          'background:var(--ha-card-background,var(--card-background-color,#fff))',
          'border-radius:6px',
        ].join(';');
        document.body.appendChild(ghost);
        item.classList.add('drag-active');
        const offsetY = e.clientY - rect.top;
        const getDropIdx = y => {
          const els = allItems();
          for (let i = 0; i < els.length; i++) {
            const r = els[i].getBoundingClientRect();
            if (y < r.top + r.height / 2) return i;
          }
          return els.length;
        };
        const showInd = idx => {
          listEl.querySelectorAll('.drop-ind').forEach(d => d.remove());
          const els = allItems();
          const ind = Object.assign(document.createElement('div'), { className: 'drop-ind' });
          if (idx < els.length) els[idx].before(ind);
          else if (els.length) els[els.length - 1].after(ind);
        };
        const onMove = ev => {
          ghost.style.top = (ev.clientY - offsetY) + 'px';
          toIdx = getDropIdx(ev.clientY);
          showInd(toIdx);
        };
        const onUp = () => {
          handle.removeEventListener('pointermove',   onMove);
          handle.removeEventListener('pointerup',     onUp);
          handle.removeEventListener('pointercancel', onUp);
          ghost.remove();
          item.classList.remove('drag-active');
          listEl.querySelectorAll('.drop-ind').forEach(d => d.remove());
          const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
          if (insertAt === fromIdx) return;
          const list = JSON.parse(JSON.stringify(getList()));
          const [moved] = list.splice(fromIdx, 1);
          list.splice(insertAt, 0, moved);
          const exp = getExp();
          let newExp = exp;
          if      (exp === fromIdx)                                         newExp = insertAt;
          else if (fromIdx < insertAt && exp > fromIdx && exp <= insertAt)  newExp = exp - 1;
          else if (fromIdx > insertAt && exp >= insertAt && exp < fromIdx)  newExp = exp + 1;
          setExp(newExp);
          setList(list);
        };
        handle.addEventListener('pointermove',   onMove);
        handle.addEventListener('pointerup',     onUp);
        handle.addEventListener('pointercancel', onUp);
      });
    });
  }
}

// ─── Registrierung ────────────────────────────────────────────────────────────

customElements.define(CARD_TAG,             HistoryTableCard);
customElements.define(`${CARD_TAG}-editor`, HistoryTableCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type:             CARD_TAG,
  name:             CARD_NAME,
  description:      'Historische Statistikdaten als flexible Mehrspalten-Tabelle mit Jinja2-Support und energy-date-selection.',
  preview:          true,
  documentationURL: 'https://github.com/LiBe-net/history-table-card',
});

console.info(
  `%c ${CARD_NAME} %c v${CARD_VERSION} see https://www.libe.net/energy-table`,
  'color:white;background:#1976d2;font-weight:bold;padding:2px 4px;border-radius:3px 0 0 3px;',
  'color:#1976d2;background:#e3f2fd;font-weight:bold;padding:2px 4px;border-radius:0 3px 3px 0;',
);
