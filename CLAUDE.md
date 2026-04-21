# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What this project is

`home-assistant-streamdeck-yaml` is a Python app that connects an Elgato Stream Deck to Home Assistant over WebSocket. Buttons are configured via `configuration.yaml`. It also ships as a **local Home Assistant addon** targeting **HA Green** (aarch64, Alpine Linux 3.23.3).

---

## Development commands

The project uses [devbox](https://www.jetify.com/devbox) to pin system dependencies (Python, hidapi, libusb, cairo). Inside a devbox shell (`devbox shell`), `uv` is available and dependencies are auto-installed.

```bash
# Run the app (reads .env for HASS_HOST, HASS_TOKEN, etc.)
devbox run start          # or: source .env && uv run python home_assistant_streamdeck_yaml.py

# Run tests
devbox run test           # or: uv run python -m pytest

# Run a single test file
uv run python -m pytest tests/test_app.py -v

# Run a single test by name
uv run python -m pytest tests/test_app.py::test_name -v

# Lint / format (also run by pre-commit)
uv run ruff check --fix home_assistant_streamdeck_yaml.py
uv run ruff format home_assistant_streamdeck_yaml.py

# Type-check
uv run mypy home_assistant_streamdeck_yaml.py

# Regenerate README (runs embedded code examples in markdown)
devbox run readme
```

Environment variables (copy `.env.example` → `.env`):

| Variable | Description |
|---|---|
| `HASS_HOST` | `host:port` of HA instance |
| `HASS_TOKEN` | HA long-lived access token |
| `WEBSOCKET_PROTOCOL` | `ws` (local) or `wss` (TLS/remote) |
| `STREAMDECK_CONFIG` | Absolute path to `configuration.yaml` |

CI runs `pytest` on Python 3.11 via GitHub Actions (`.github/workflows/pytest.yml`). Coverage must stay ≥ 70%.

---

## Architecture

The entire app is a **single Python file**: `home_assistant_streamdeck_yaml.py` (~3 000 lines). There are no sub-packages.

### Data model (Pydantic v1, `pydantic<2`)

```
Config
  └── pages: list[Page]           # named, cycle-able pages
  └── anonymous_pages: list[Page] # hidden, reached via go-to-page only
        └── buttons: list[Button]
        └── dials:   list[Dial]
```

`Button` and `Dial` both inherit `_ButtonDialBase`. All models use `extra="forbid"` — unknown YAML keys raise `ValidationError`. Button position = list index (no `row`/`col` fields).

Key classes:
- `_ButtonDialBase` (line 87) — shared fields: `entity_id`, `service`, `icon_mdi`, Jinja template fields
- `Button` (line 244) — adds `special_type`, `text`, `icon_background_color`, etc.
- `Dial` (line 610) — adds `dial_event_type`, `attributes` for Stream Deck+
- `Page` (line 856) — holds button/dial lists; `sort_dials()` pairs TURN+PUSH dials
- `Config` (line 913) — loads YAML, manages page navigation, brightness, auto-reload

### YAML loading with `!include`

`safe_load_yaml()` (line 2996) registers a custom `!include` constructor that:
- Inlines a single file: `buttons: !include includes/home.yaml`
- Inlines with variable substitution: `!include {file: foo.yaml, vars: {NAME: val}}`
- Flattens list includes in-place (a list `!include` inside a list is extended, not nested)

`_traverse_yaml()` (line 2972) does the variable substitution pass.

### WebSocket event loop

`run()` (line 2903) → `_run_connection_session()` (line 2858):

1. Opens WebSocket to `ws[s]://<host>/api/websocket` and authenticates
2. Fetches full HA state snapshot (`get_states`)
3. Renders all button images (`update_all_key_images`)
4. Registers callbacks: `_on_press_callback`, `_on_dial_event_callback`, `_on_touchscreen_event_callback`
5. Subscribes to `state_changed` events (`subscribe_state_changes`)
6. Enters `handle_changes()` — an infinite loop that processes incoming WS messages and re-renders affected buttons

On disconnect, it retries with configurable `retry_delay`.

### Icon rendering pipeline

`update_key_image()` (line 2156) → builds a PIL image for each button:
- MDI SVGs are fetched from unpkg CDN and cached in `assets/` as PNGs via `_download_and_save_mdi()` (line 1923) using cairosvg
- Jinja2 templates in any field are rendered by `_render_jinja()` (line 1812) with HA state helpers (`states()`, `is_state()`, `state_attr()`, etc.) available as template filters/globals
- Buttons without `entity_id` **must** have explicit `icon_mdi` + `icon_background_color`, or rendering fails

### Stream Deck+ support

Dials and touchscreen are handled separately from buttons. `update_all_dials()` / `update_dial()` (lines 2065, 2113) render the LCD strip. `Page.sort_dials()` pairs TURN and PUSH dial event types into a sorted list for the 4-dial layout.

### Special button types (`special_type` field)

`next-page`, `previous-page`, `go-to-page`, `close-page`, `empty`, `light-control`, `spotify` — handled inside `_handle_key_press()` (line 2453).

---

## Addon files (at repo root)

### `config.yaml` — HA Supervisor addon manifest

Key fields that were hard to get right:

- `protected: false` — required, otherwise hardware access is blocked
- `full_access: true` — adds cgroup rules (`a *:* rwm`), but does **not** bind-mount `/dev/hidraw0` by itself
- `devices: [/dev/hidraw0]` — required to bind-mount the HID node into the container
- `host_network: true` — required so `localhost:8123` resolves to HA
- `map: [config:rw]` — mounts `/config` (HA config dir) read-write
- **No `init: false`** — adding this causes Supervisor to inject tini as PID 1, conflicting with the container's init
- **No `build.yaml`** — Supervisor warns it is deprecated
- `arch: [aarch64]` — addon only targets aarch64 in this setup

### `Dockerfile`

Uses plain `alpine:3.23` (NOT the HA base image which includes s6-overlay). Key points:

- `--break-system-packages` required for all pip installs on Alpine 3.23 / Python 3.12 (PEP 668)
- `ENV SETUPTOOLS_SCM_PRETEND_VERSION=1.0.0` required because git is not available during addon build
- Build deps installed then removed (`apk del .build-deps`) to keep image small

### `run.sh`

Plain bash (NOT `with-contenv bashio`). Reads `/data/options.json` via `jq`. Exports `HASS_HOST`, `HASS_TOKEN`, `WEBSOCKET_PROTOCOL`, `STREAMDECK_CONFIG`.

---

## On-box paths

| Path | Contents |
|------|----------|
| `/config/streamdeck_yaml/configuration.yaml` | Active Stream Deck config |
| `/config/streamdeck_yaml/includes/` | Reusable YAML button includes |
| `/config/streamdeck_yaml/assets/` | Custom icons |
| `/data/options.json` | Addon options injected by Supervisor at runtime |

The app crashes with `FileNotFoundError` if `STREAMDECK_CONFIG` doesn't exist. Create the dir before first start:
```bash
sudo mkdir -p /config/streamdeck_yaml
cp /path/to/configuration.yaml /config/streamdeck_yaml/configuration.yaml
```

---

## Supervisor workflow gotchas

- **"Check for updates" is mandatory** before Rebuild when `config.yaml` changes — Supervisor caches addon metadata separately from the Docker image.
- Correct workflow for any `config.yaml` change: **Check for updates → Rebuild → Start**
- Build logs: Add-ons → the addon → "Log" tab

---

## Common errors and fixes

| Error | Cause | Fix |
|---|---|---|
| `s6-overlay-suexec: fatal: can only run as pid 1` | HA base image has s6-overlay; Supervisor injects tini as PID 1 | Use `alpine:3.23` base instead of HA base image |
| `Could not open HID device` | `/dev/hidraw0` not bind-mounted | Add `devices: [/dev/hidraw0]` to `config.yaml` |
| `pip install` exit code 1 on Alpine | PEP 668 blocks system-wide pip on Python 3.12 | Add `--break-system-packages` to all pip commands |
| `setuptools_scm` fails | No `.git` during addon build | Add `ENV SETUPTOOLS_SCM_PRETEND_VERSION=1.0.0` to Dockerfile |
| `ValidationError: extra fields not permitted` | Button config uses `row`/`col` keys | Remove them; buttons are positioned by list index only |
| `FileNotFoundError` on config path | Config dir missing on first run | `sudo mkdir -p /config/streamdeck_yaml` and copy config file |
| "rendering failed" on a button | Action-only button (no `entity_id`) falls through to state render | Add explicit `icon_mdi` + `icon_background_color` |
| Supervisor ignores `config.yaml` changes | Supervisor metadata cache not invalidated | Click "Check for updates" in Add-on Store before rebuild |

---

## Button configuration rules

- Buttons with `entity_id` get automatic state-based icon coloring (on/off)
- Buttons without `entity_id` **must** have explicit `icon_mdi` and `icon_background_color` — otherwise "rendering failed"
- `icon_background_color` accepts hex strings: `"#1a1a2e"`, `"#4a0000"`, etc.
- `icon_mdi` uses Material Design Icons names (e.g., `home-lightbulb-off`, `led-strip`, `lightbulb`)
- List order = button position on the deck; do not use `row`/`col`

---

## HA addon options (configured in HA UI)

| Option | Description |
|---|---|
| `hass_token` | HA long-lived access token |
| `websocket_protocol` | `ws` for local (plain HTTP), `wss` for TLS/remote |
| `streamdeck_config` | Path to the config file inside the container (default: `/config/streamdeck_yaml/configuration.yaml`) |

> On HA Green accessed locally, use `ws`. The WS connection goes to `localhost:8123` inside the container via host networking.
