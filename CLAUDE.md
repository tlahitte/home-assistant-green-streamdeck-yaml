# CLAUDE.md — Project Context for AI Sessions

## What this project is

`home-assistant-streamdeck-yaml` is a Python app that connects an Elgato Stream Deck to Home Assistant over WebSocket. Buttons are configured via `configuration.yaml`. This file documents the work done to package the project as a **local Home Assistant addon** on a **HA Green** (aarch64, Alpine Linux 3.23.3).

---

## Target hardware

- **HA box**: Home Assistant Green — aarch64 (ARM64)
- **HA OS**: Alpine Linux 3.23.3, HA OS 6.12.77-haos
- **Stream Deck**: Elgato Stream Deck MK.2 (USB ID `0fd9:0080`, HID at `/dev/hidraw0`)
  - 3 rows × 5 columns = 15 physical buttons
  - Button order in `configuration.yaml` is strictly **list index = position** (index 0 = row 0 col 0, index 5 = row 1 col 0, etc.)
  - There are NO `row`/`col` keys in the button model — pydantic will raise `ValidationError` if you add them

---

## Addon files (at repo root)

### `config.yaml` — HA Supervisor addon manifest

Key fields that were hard to get right:

- `protected: false` — required, otherwise hardware access is blocked; set as the default
- `full_access: true` — adds cgroup rules (`a *:* rwm`), but does **not** bind-mount `/dev/hidraw0` by itself
- `devices: [/dev/hidraw0]` — required to bind-mount the HID node into the container
- `host_network: true` — required so `localhost:8123` resolves to HA
- `map: [config:rw]` — mounts `/config` (HA config dir) read-write
- **No `init: false`** — adding this causes Supervisor to inject Docker's tini as PID 1, which conflicts with the container's init
- **No `build.yaml`** — Supervisor warns it is deprecated; delete it if it exists
- `arch: [aarch64]` — addon only targets aarch64 in this setup

### `Dockerfile`

Uses plain `alpine:3.23` (NOT the HA base image which includes s6-overlay). This avoids the s6-overlay PID 1 conflict. Key points:

- `--break-system-packages` required for all pip installs on Alpine 3.23 / Python 3.12 (PEP 668)
- `ENV SETUPTOOLS_SCM_PRETEND_VERSION=1.0.0` required because git is not available during addon build
- Build deps installed then removed (`apk del .build-deps`) to keep image small
- App installed with `pip3 install --no-cache-dir --no-deps --break-system-packages -e .`

### `run.sh`

Plain bash (NOT `with-contenv bashio`). Reads `/data/options.json` via `jq`. Exports:
- `HASS_HOST=localhost:8123`
- `HASS_TOKEN`, `WEBSOCKET_PROTOCOL`, `STREAMDECK_CONFIG`

---

## On-box paths

| Path | Contents |
|------|----------|
| `/config/streamdeck_yaml/configuration.yaml` | Active Stream Deck config (from addon `map: config:rw`) |
| `/config/streamdeck_yaml/includes/` | Reusable YAML button includes (optional) |
| `/config/streamdeck_yaml/assets/` | Custom icons (optional) |
| `/data/options.json` | Addon options injected by Supervisor at runtime |

The app crashes with `FileNotFoundError` if `STREAMDECK_CONFIG` doesn't exist. The config dir must be created before first start:
```bash
sudo mkdir -p /config/streamdeck_yaml
cp /path/to/configuration.yaml /config/streamdeck_yaml/configuration.yaml
```

---

## Supervisor workflow gotchas

- **"Check for updates" is mandatory** before Rebuild when `config.yaml` changes. Supervisor caches addon metadata separately from the Docker image — without it, the old manifest is used even after a fresh image build.
- Correct workflow for any `config.yaml` change: **Check for updates → Rebuild → Start**
- Uninstall + reinstall forces a clean slate if the above cycle doesn't work
- Build logs: Add-ons → the addon → "Log" tab

---

## Common errors and fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `s6-overlay-suexec: fatal: can only run as pid 1` | HA base image has s6-overlay; Supervisor or `init: false` injects tini as PID 1 | Use `alpine:3.23` base instead of HA base image |
| `Could not open HID device` | `/dev/hidraw0` not bind-mounted into container | Add `devices: [/dev/hidraw0]` to `config.yaml` |
| `pip install` exit code 1 on Alpine | PEP 668 blocks system-wide pip on Python 3.12 | Add `--break-system-packages` to all pip commands |
| `setuptools_scm` fails | No `.git` during addon build | Add `ENV SETUPTOOLS_SCM_PRETEND_VERSION=1.0.0` to Dockerfile |
| `ValidationError: extra fields not permitted` | Button config uses `row`/`col` keys | Remove them; buttons are positioned by list index only |
| `FileNotFoundError` on config path | Config dir missing on first run | `sudo mkdir -p /config/streamdeck_yaml` and copy config file |
| "rendering failed" on a button | Action-only button (no `entity_id`) falls through to state render | Add explicit `icon_mdi` + `icon_background_color` to all buttons without `entity_id` |
| Supervisor ignores `config.yaml` changes | Supervisor metadata cache not invalidated | Must click "Check for updates" in Add-on Store before rebuild |

---

## Button configuration rules

- Buttons with `entity_id` get automatic state-based icon coloring (on/off)
- Buttons without `entity_id` (multi-entity action buttons) **must** have explicit `icon_mdi` and `icon_background_color` — otherwise "rendering failed"
- `icon_background_color` accepts hex strings: `"#1a1a2e"`, `"#4a0000"`, etc.
- `icon_mdi` uses Material Design Icons names (e.g., `home-lightbulb-off`, `led-strip`, `lightbulb`)
- List order = button position on the deck; do not use `row`/`col`

---

## Python app internals (relevant parts)

- **Entry point**: `home_assistant_streamdeck_yaml.py` (single-file app)
- **Button model**: Pydantic v1 (`"pydantic<2"`). No `row`/`col` fields on the model.
- **Icon rendering**: `try_render_icon()` at line ~326. Falls back to `DEFAULT_MDI_ICONS` per domain when `icon_mdi` is None and `entity_id` is set.
- **MDI icons**: Downloaded from unpkg CDN on first use and cached in `assets/` as SVGs
- **WebSocket**: Connects to `ws://localhost:8123/api/websocket` using a HA long-lived access token
- **Config**: Loaded from `STREAMDECK_CONFIG` env var; `auto_reload: true` watches the file for changes

---

## HA addon options (configured in HA UI)

| Option | Description |
|--------|-------------|
| `hass_token` | HA long-lived access token (create in HA profile settings) |
| `websocket_protocol` | `ws` for local (plain HTTP), `wss` for TLS/remote |
| `streamdeck_config` | Path to the config file inside the container (default: `/config/streamdeck_yaml/configuration.yaml`) |

> **Protocol note**: On HA Green accessed locally, use `ws` (not `wss`). The WS connection goes to `localhost:8123` inside the container via host networking.
