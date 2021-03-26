import { delay } from "https://deno.land/std@0.90.0/async/mod.ts";
import { WebSocket } from "https://deno.land/std@0.90.0/ws/mod.ts";
import { Vector2 } from "https://deno.land/x/gmath@0.1.8/mod.ts";
import { PLAYER_SPEED, SERVER_TICK_MS } from "./constants.ts";

// this playerManager is spawned _per_ websocket connection
// it manages the player data for that player, storing it in a 'shared' dictionary on
// the players UUID

interface Position {
  x: number;
  y: number;
}

interface PlayerState {
  uuid: string;
  name: string;
  pos: Position;
  connected: boolean;
}

interface PlayerManagerSettings {
  uuid: string;
  sock: WebSocket;
}

interface ReqMovePlayer {
  type: "req_move_player";
  data: {
    uuid: string;
    vec: Position;
  };
}

interface ReqKillPlayer {
  type: "req_kill_player";
  data: {
    uuid: string;
  };
}

interface ReqNewPlayer {
  type: "req_new_player";
  data: {
    uuid: string;
    name: string;
  };
}

type Message = ReqMovePlayer | ReqKillPlayer | ReqNewPlayer;

const playerStates: Record<string, PlayerState> = {};

const initializePlayer = (uuid: string) => {
  let playerState = playerStates?.[uuid];

  if (!playerState) {
    playerState = {
      uuid,
      name: "",
      pos: { x: 0, y: 0 },
      connected: true,
    };
    playerStates[uuid] = playerState;
  }

  return playerState;
}

export const spawnPlayerManager = async ({
  uuid,
  sock,
}: PlayerManagerSettings) => {
  const socketPlayerState = initializePlayer(uuid);

  let timeElapsedMs = 0;
  let tStop = 0;
  let tStart = 0;

  sock.send(JSON.stringify({ type: "create_player", data: socketPlayerState }));

  while (!sock.isClosed && socketPlayerState.connected) {
    const delta = tStop ? tStop - tStart : 0;
    tStart = performance.now();
    await delay(SERVER_TICK_MS); // don't go ham on positional updates...
    timeElapsedMs += delta;
    // const timeElapsedS = timeElapsedMs / 1000;

    // send all player positions to socket
    for (const playerState of Object.values(playerStates)) {
      try {
        sock.send(
          JSON.stringify({
            type: "move_player",
            data: { uuid: playerState.uuid, pos: playerState.pos },
          })
        );
      } catch (err) {
        console.error(`failed to send: ${err}`);

        if (sock.isClosed) {
          playerStates[uuid].connected = false;
        }
      }

      tStop = performance.now();
    }
  }
};

export const killPlayerManager = ({ uuid, sock }: PlayerManagerSettings) => {
  playerStates[uuid].connected = false;
};

export const messageHandler = ({
  jsonMessage,
  uuid,
  sock,
}: PlayerManagerSettings & { jsonMessage: string }) => {
  const message = JSON.parse(jsonMessage) as Message;
  switch (message.type) {
    case "req_move_player":
      movePlayer(message);
      break;
    case "req_kill_player":
      killPlayer(message);
      break;
    case "req_new_player":
      newPlayer(message);
      break;
    default:
      console.error(`unknown message: ${message}`);
      break;
  }
};

const movePlayer = (reqMovePlayer: ReqMovePlayer) => {
  const playerState = playerStates[reqMovePlayer.data.uuid];

  const vec: Vector2 = new Vector2(
    reqMovePlayer.data.vec.x,
    reqMovePlayer.data.vec.y
  ).normal();
  vec.mul(PLAYER_SPEED);

  playerState.pos.x += vec.x;
  playerState.pos.y += vec.y;

  // playerState.pos.x = 700 + Math.cos(2 * Math.PI * timeElapsedS) * 40;
  // playerState.pos.y = 100 + Math.sin(2 * Math.PI * timeElapsedS) * 40;

  playerStates[reqMovePlayer.data.uuid] = playerState;
};

const killPlayer = (reqKillPlayer: ReqKillPlayer) => {};

const newPlayer = (reqNewPlayer: ReqNewPlayer) => {
  const playerState = playerStates[reqNewPlayer.data.uuid];

  playerState.name = reqNewPlayer.data.name;
  playerState.pos.x = Math.random() * 300;
  playerState.pos.y = Math.random() * 300;

  playerStates[reqNewPlayer.data.uuid] = playerState;
};
