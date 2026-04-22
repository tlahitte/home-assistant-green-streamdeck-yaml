/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Home Assistant URL - URL of your Home Assistant instance, e.g. http://homeassistant.local:8123 */
  "haUrl": string,
  /** Long-Lived Access Token - Create one at HA Profile → Long-Lived Access Tokens */
  "haToken": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `control-lights` command */
  export type ControlLights = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `control-lights` command */
  export type ControlLights = {}
}

