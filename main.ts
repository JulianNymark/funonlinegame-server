// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import { serve } from "https://deno.land/std@0.90.0/http/server.ts";
import {
  acceptWebSocket,
  isWebSocketCloseEvent,
  isWebSocketPingEvent,
  WebSocket,
} from "https://deno.land/std@0.90.0/ws/mod.ts";
import { v4 } from "https://deno.land/std@0.90.0/uuid/mod.ts";

import { killPlayerManager, spawnPlayerManager } from "./playerManager.ts";

async function handleWs(sock: WebSocket) {
  console.log("socket connected!");

  const uuid = v4.generate();

  spawnPlayerManager({ uuid, sock });

  try {
    for await (const ev of sock) {
      if (typeof ev === "string") {
        console.log("ws: client text", ev);
        await sock.send(ev);
      } else if (ev instanceof Uint8Array) {
        console.log("ws: client binary data", ev);
      } else if (isWebSocketPingEvent(ev)) {
        const [, body] = ev;
        console.log("ws: client PING", body);
      } else if (isWebSocketCloseEvent(ev)) {
        const { code, reason } = ev;
        killPlayerManager({ uuid, sock });
        console.log("ws: client closed the connection", code, reason);
      }
    }
  } catch (err) {
    console.error(`failed to receive frame: ${err}`);

    if (!sock.isClosed) {
      await sock.close(1000).catch(console.error);
    }
  }
}

if (import.meta.main) {
  /** websocket echo server */
  const port = Deno.args[0] || "8765";
  console.log(`websocket server is running on :${port}`);
  for await (const req of serve(`:${port}`)) {
    const { conn, r: bufReader, w: bufWriter, headers } = req;
    acceptWebSocket({
      conn,
      bufReader,
      bufWriter,
      headers,
    })
      .then(handleWs)
      .catch(async (err: Error) => {
        console.error(`failed to accept websocket: ${err}`);
        await req.respond({ status: 400 });
      });
  }
}
