#!/bin/bash
set -e

CONFIG=/data/options.json

HASS_TOKEN=$(jq --raw-output '.hass_token' "${CONFIG}")
WEBSOCKET_PROTOCOL=$(jq --raw-output '.websocket_protocol // "ws"' "${CONFIG}")
STREAMDECK_CONFIG=$(jq --raw-output '.streamdeck_config // "/config/streamdeck_yaml/configuration.yaml"' "${CONFIG}")

export HASS_HOST="localhost:8123"
export HASS_TOKEN="${HASS_TOKEN}"
export WEBSOCKET_PROTOCOL="${WEBSOCKET_PROTOCOL}"
export STREAMDECK_CONFIG="${STREAMDECK_CONFIG}"

echo "[INFO] Starting Home Assistant Stream Deck YAML"
echo "[INFO] Config: ${STREAMDECK_CONFIG}"
echo "[INFO] WebSocket: ${WEBSOCKET_PROTOCOL}://localhost:8123"

exec home-assistant-streamdeck-yaml
