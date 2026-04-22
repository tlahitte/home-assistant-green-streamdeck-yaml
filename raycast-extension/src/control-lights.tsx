import { List, Action, ActionPanel, Toast, getPreferenceValues, showToast } from "@raycast/api";

interface Preferences {
  haUrl: string;
  haToken: string;
}

interface Room {
  name: string;
  icon: string;
  domain: "light" | "switch";
  entities: string[];
}

const ROOMS: Room[] = [
  {
    name: "Living Room",
    icon: "🛋️",
    domain: "light",
    entities: [
      "light.led_bulb_t2_gu10_cct",
      "light.led_bulb_t2_gu10_cct_2",
      "light.wled_s3matrix01",
      "light.wled_bar02",
      "light.smartplug_03",
      "light.smartplug_desk",
    ],
  },
  {
    name: "Bedroom",
    icon: "🛏️",
    domain: "light",
    entities: [
      "light.smart_multicolor_bulb",
      "light.smart_multicolor_bulb_2",
    ],
  },
  {
    name: "Kitchen",
    icon: "🍳",
    domain: "switch",
    entities: [
      "switch.wifi_smart_switch_switch_1",
      "switch.wifi_smart_switch_switch_2",
    ],
  },
  {
    name: "All Rooms",
    icon: "🏠",
    domain: "light",
    entities: [
      "light.led_bulb_t2_gu10_cct",
      "light.led_bulb_t2_gu10_cct_2",
      "light.wled_s3matrix01",
      "light.wled_bar02",
      "light.smartplug_03",
      "light.smartplug_desk",
      "light.smart_multicolor_bulb",
      "light.smart_multicolor_bulb_2",
    ],
  },
];

interface HAState {
  entity_id: string;
  state: string;
}

async function isAnyOn(entities: string[], prefs: Preferences): Promise<boolean> {
  const res = await fetch(`${prefs.haUrl}/api/states`, {
    headers: { Authorization: `Bearer ${prefs.haToken}` },
  });
  if (!res.ok) throw new Error(`HA returned ${res.status}: ${res.statusText}`);
  const states = (await res.json()) as HAState[];
  return states.some((s) => entities.includes(s.entity_id) && s.state === "on");
}

async function callService(
  domain: "light" | "switch",
  action: "turn_on" | "turn_off",
  entities: string[],
  prefs: Preferences,
): Promise<void> {
  const res = await fetch(`${prefs.haUrl}/api/services/${domain}/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${prefs.haToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entity_id: entities }),
  });
  if (!res.ok) throw new Error(`HA returned ${res.status}: ${res.statusText}`);
}

function RoomItem({ room }: { room: Room }) {
  const prefs = getPreferenceValues<Preferences>();

  async function handleToggle() {
    const toast = await showToast({ style: Toast.Style.Animated, title: `${room.name}…` });
    try {
      const anyOn = await isAnyOn(room.entities, prefs);
      const action = anyOn ? "turn_off" : "turn_on";
      await callService(room.domain, action, room.entities, prefs);
      toast.style = Toast.Style.Success;
      toast.title = `${room.name} ${anyOn ? "off" : "on"}`;
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed";
      toast.message = err instanceof Error ? err.message : String(err);
    }
  }

  async function handleExplicit(action: "turn_on" | "turn_off") {
    const label = action === "turn_on" ? "on" : "off";
    const toast = await showToast({ style: Toast.Style.Animated, title: `${room.name}…` });
    try {
      await callService(room.domain, action, room.entities, prefs);
      toast.style = Toast.Style.Success;
      toast.title = `${room.name} ${label}`;
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed";
      toast.message = err instanceof Error ? err.message : String(err);
    }
  }

  return (
    <List.Item
      title={room.name}
      icon={room.icon}
      actions={
        <ActionPanel>
          <Action title="Toggle" onAction={handleToggle} />
          <Action
            title="Turn On"
            shortcut={{ modifiers: ["cmd"], key: "o" }}
            onAction={() => handleExplicit("turn_on")}
          />
          <Action
            title="Turn Off"
            shortcut={{ modifiers: ["cmd"], key: "t" }}
            onAction={() => handleExplicit("turn_off")}
          />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  return (
    <List navigationTitle="Room Controls">
      {ROOMS.map((room) => (
        <RoomItem key={room.name} room={room} />
      ))}
    </List>
  );
}
