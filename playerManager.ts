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

  let timeElapsed = 0;

  while (!sock.isClosed && playerState.connected) {
    await delay(SERVER_TICK_MS);
    timeElapsed += SERVER_TICK_MS;

    playerState = playerStates[uuid];

    playerState.pos.x = Math.cos(Math.PI * timeElapsed) * 100;
    playerState.pos.y = Math.sin(Math.PI * timeElapsed) * 100;

    try {
      sock.send(JSON.stringify(playerState));
    } catch (err) {
      console.error(`failed to send: ${err}`);
  
      if (sock.isClosed) {
        playerState.connected = false;
      }
    }

    playerStates[uuid] = playerState;
  }
};

export const killPlayerManager = ({uuid, sock}: PlayerManagerSettings) => {
  playerStates[uuid].connected = false;
}