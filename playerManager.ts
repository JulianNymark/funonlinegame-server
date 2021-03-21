import { delay } from "https://deno.land/std@0.90.0/async/mod.ts";
import { WebSocket } from "https://deno.land/std@0.90.0/ws/mod.ts";

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
      pos: { x: 100, y: 100 },
      connected: true,
    };
    playerStates[uuid] = playerState;
  }

  let timeElapsedMs = 0;
  let tStop = 0;
  let tStart = 0;

  while (!sock.isClosed && playerState.connected) {
    const delta = tStop ? tStop - tStart : 0;
    tStart = performance.now();
    await delay(SERVER_TICK_MS); // don't go ham on positional updates...
    timeElapsedMs += delta;
    const timeElapsedS = timeElapsedMs / 1000;

    playerState = playerStates[uuid];

    playerState.pos.x = Math.cos(2 * Math.PI * timeElapsedS) * 100;
    playerState.pos.y = Math.sin(2 * Math.PI * timeElapsedS) * 100;

    try {
      sock.send(JSON.stringify(playerState));
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
