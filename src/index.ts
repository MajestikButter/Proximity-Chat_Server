import { Client } from "./classes/Client";
import { Server } from "./classes/Server";

const server = new Server();

server.on("loginRequest", (ws, message) => {
  if (!server.info.password || server.info.password === message.data.password) {
    const linkClient = server.findClientByCode(message.data.linkCode);
    if (!linkClient) {
      server.send(ws, "loginFailed", {
        reason: `Couldn't find a minecraft connection with link code: ${message.data.linkCode}`,
      });
      return;
    }

    if (linkClient.linkedClient) {
      server.send(ws, "loginFailed", {
        reason: `The Minecraft client with the link code '${message.data.linkCode}' is already linked to another client`,
      });
      return;
    }

    const client = server.addClient(ws, false);
    client.name = linkClient.name;
    linkClient.linkedClient = client;
    client.linkedClient = linkClient;
    linkClient.sendMCMessage(`You are now linked`);

    server.send(ws, "loginSuccess", {
      name: client.name,
      id: client.id,
      config: {
        maxDistance: server.config.get("max_distance"),
        spectatorToPlayer: server.config.get("spectator_to_player"),
        iceServers: server.config.get("ice_servers"),
      },
      client: ClientInfo(client),
    });
  } else {
    server.send(ws, "loginFailed", { reason: "The password is incorrect" });
  }
});

server.on("join", (ws, msg) => {
  const client = server.getClient(ws);
  if (!client) return;
  console.log(`${client.id} joined`);
  for (let [cws, sclient] of server.clients) {
    if (sclient.isMCClient || sclient.id == client.id) continue;

    console.log("adding client");
    server.send(cws, "addClient", { client: ClientInfo(client) });
  }
});

server.on("sendSignal", (ws, msg) => {
  const client = server.findClientById(msg.data.to);
  const fromClient = server.getClient(ws);

  if (!client || !fromClient) return;

  server.send(client.ws, "sendSignal", {
    client: ClientInfo(client),
    from: ClientInfo(fromClient),
    signalData: msg.data.signalData,
  });
});

server.on("receiveSignal", (ws, msg) => {
  const client = server.findClientById(msg.data.to);
  const fromClient = server.getClient(ws);
  if (!client || !fromClient) return;
  server.send(client.ws, "receiveSignal", {
    client: ClientInfo(client),
    from: ClientInfo(fromClient),
    signalData: msg.data.signalData,
  });
});

function ClientInfo(client: Client) {
  return {
    name: client.name,
    isMCClient: client.isMCClient,
    isLinked: !!client.linkedClient,
    id: client.id,
  };
}

async function wait(time: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, time);
  });
}

// Disabled as I do not know of a working way to check for spectator without operator
// async function isSpectator(client: Client) {
//   const s = await client.runMCCommand("testfor @s[m=s]");
//   const c = await client.runMCCommand("testfor @s[m=c]");
//   const a = await client.runMCCommand("testfor @s[m=a]");
//   return !(s.victim || c.victim || a.victim);
// }
async function positionFetch() {
  for (let client of server.clients.values()) {
    if (!client.isMCClient) continue;

    const v = await client.runMCCommand("/querytarget @s");
    try {
      const info = JSON.parse(v.details)[0];
      const { x, y, z } = info.position;
      client.pos = [x, y, z];
      client.dimension = info.dimension;
      client.yRot = info.yRot;
      // client.isSpectator = await isSpectator(client);
      client.isSpectator = false;
      client.updateClients(server.clients.values());
    } catch {}
  }
  await wait(5);
  await positionFetch();
}
positionFetch();
