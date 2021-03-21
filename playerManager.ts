import { delay } from "https://deno.land/std@0.90.0/async/mod.ts";
import { WebSocket } from "https://deno.land/std@0.90.0/ws/mod.ts";

// this playerManager is spawned _per_ websocket connection
// it manages the player data for that player, storing it in a 'shared' dictionary on
// the players UUID

const SERVER_TICK_MS = 1000 / 60;

interface PlayerState {
  uuid: string;
  name: string;
  pos: {
    x: number;
    y: number;
  };
  connected: boolean;
}

interface PlayerManagerSettings {
  uuid: string;
  sock: WebSocket;
}

const playerStates: Record<string, PlayerState> = {};

export const spawnPlayerManager = async ({
  uuid,
  sock,
}: PlayerManagerSettings) => {
  let playerState = playerStates?.[uuid];

  if (!playerState) {
    playerState = {
      uuid,
      name: "hardcodedusername",
      pos: { x: Math.random()* 300, y: Math.random() * 300 },
      connected: true,
    };
    playerStates[uuid] = playerState;
  }

  let timeElapsedMs = 0;
  let tStop = 0;
  let tStart = 0;

  sock.send(JSON.stringify({ type: 'create_player', data: playerState}));

  while (!sock.isClosed && playerState.connected) {
    const delta = tStop ? tStop - tStart : 0;
    tStart = performance.now();
    await delay(SERVER_TICK_MS); // don't go ham on positional updates...
    timeElapsedMs += delta;
    const timeElapsedS = timeElapsedMs / 1000;

    playerState = playerStates[uuid];

    playerState.pos.x = 700 + Math.cos(2 * Math.PI * timeElapsedS) * 40;
    playerState.pos.y = 100 + Math.sin(2 * Math.PI * timeElapsedS) * 40;

    try {
      sock.send(JSON.stringify({ type: 'move_player', data: {uuid: playerState.uuid, pos: playerState.pos}}));
    } catch (err) {
      console.error(`failed to send: ${err}`);

      if (sock.isClosed) {
        playerState.connected = false;
      }
    }

    playerStates[uuid] = playerState;
    tStop = performance.now();
  }
};

export const killPlayerManager = ({ uuid, sock }: PlayerManagerSettings) => {
  playerStates[uuid].connected = false;
};
