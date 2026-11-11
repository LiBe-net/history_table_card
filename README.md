# History Table Card

Custom Lovelace card for Home Assistant that turns long-term statistics into a flexible, sortable table – with calculated columns, Energy dashboard integration and period navigation.

[![History Table Card demonstration](https://www.libe.net/storage/926x515/T3JGMZilpEfMXno0doKnhVBR9OeXdb4tDv540u7Q.gif)](https://www.libe.net/storage/926x515/T3JGMZilpEfMXno0doKnhVBR9OeXdb4tDv540u7Q.webm)

📖 **Documentation, configuration examples and screenshots:** [English](https://www.libe.net/en/energy-table) · [Deutsch](https://www.libe.net/energy-table)

## Features

- Long-term statistics of any entity as table columns – `change`, `sum` and `state` for meters, `mean`, `min` and `max` for measurements
- Energy dashboard sources as ready-made columns; the editor templates **⚡ Vertical** and **⚡ Horizontal** build a complete table from your Energy dashboard
- Calculated columns (`calc`) with variables and Jinja2 templates, e.g. self-consumption, balance or self-sufficiency
- Time range by number of days, fixed period, custom start date or synced with the Energy date picker (`collection_key`), including compare mode
- Adaptive aggregation from hour to year, sorting, sticky header and first column, quick menu, previous/next navigation and zoom-out
- Vertical or transposed (horizontal) layout, colors per column and a full visual editor

## Installation

History Table Card is part of the HACS default repository: open HACS, search for **History Table Card** and download it.

[![Open your Home Assistant instance and open this repository in the Home Assistant Community Store](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=LiBe-net&repository=history_table_card&category=plugin)


## Support

If you find this project useful, you can support its development:

<a href="https://www.buymeacoffee.com/libe.net" rel="nofollow">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" width="217" height="60">
</a>

## License

MIT — see [LICENSE](LICENSE).
