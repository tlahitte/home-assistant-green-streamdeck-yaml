import { List, Action, ActionPanel, Toast, getPreferenceValues, showToast } from "@raycast/api";

interface Preferences {
  haUrl: string;
  haToken: string;
}

interface Room {
  name: string;
  icon: string;
  entities: string[];
}

const ROOMS: Room[] = [
  {
    name: "Living Room",
    icon: "🛋️",
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
    entities: [
      "light.smart_multicolor_bulb",
      "light.smart_multicolor_bulb_2",
    ],
  },
  {
    name: "All Rooms",
    icon: "🏠",
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

async function callLightService(
  action: "turn_on" | "turn_off",
  entities: string[],
  prefs: Preferences,
): Promise<void> {
  const res = await fetch(`${prefs.haUrl}/api/services/light/${action}`, {
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

  async function handleAction(action: "turn_on" | "turn_off") {
    const label = action === "turn_on" ? "on" : "off";
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Turning ${room.name} ${label}…`,
    });
    try {
      await callLightService(action, room.entities, prefs);
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
          <Action title="Turn On" onAction={() => handleAction("turn_on")} />
          <Action
            title="Turn Off"
            shortcut={{ modifiers: ["cmd"], key: "t" }}
            onAction={() => handleAction("turn_off")}
          />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  return (
    <List navigationTitle="Room Lights">
      {ROOMS.map((room) => (
        <RoomItem key={room.name} room={room} />
      ))}
    </List>
  );
}
