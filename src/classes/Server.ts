import WebSocket, { WebSocketServer } from "ws";
import { Config } from "./Config";
import { Logger } from "./Logger";
import { Client } from "./Client";

interface ServerInfo {
  name: string;
  password: string;
}
export class Server {
  config = new Config();
  logger = new Logger(this.config.get("show_logs"));
  clients = new Map<WebSocket, Client>();
  server: WebSocketServer;
  info: ServerInfo;

  constructor() {
    this.info = {
      name: this.config.get("server_name"),
      password: this.config.get("server_password"),
    };

    this.server = this.createWebSocketServer();

    this.logger.log("Server created");
  }

  createWebSocketServer() {
    const host = this.config.get("server_address");
    const port = process.env.PORT ? parseInt(process.env.PORT) : this.config.get("server_port");
    const wss = new WebSocketServer({
      host,
      port,
    });
    this.logger.log(`WebSocket started on port ${port}`);

    wss.on("connection", (ws) => {
      this.logger.log("New connection");

      this.logger.log("Connection established");
      const mcTimeout = setTimeout(() => {
        if (!this.getClient(ws)) {
          const client = this.addClient(ws, true);
        }
      }, 5000);

      ws.on("message", (rawData, isBinary) => {
        const message = rawData.toString();
        try {
          var data = JSON.parse(message);
        } catch {
          return ws.send(rawData);
        }

        const client = this.getClient(ws);
        const type = client?.isMCClient ? data.header.eventName : data.type;

        if (this.#eventListeners["*"]) {
          for (let callback of this.#eventListeners["*"]) {
            callback(ws, data);
          }
        }

        if (!this.#eventListeners[type]) return;
        for (let callback of this.#eventListeners[type]) {
          callback(ws, data);
        }
      });

      ws.on("close", () => {
        clearTimeout(mcTimeout);
        this.removeClient(ws);
      });
    });

    return wss;
  }

  sendAll(type: string, data: any, filter: (ws: WebSocket, client: Client) => boolean = () => true) {
    for (let [ws, client] of this.clients) {
      if (filter(ws, client)) this.send(ws, type, data);
    }
  }

  addClient(ws: WebSocket, mcClient: boolean) {
    if (this.clients.has(ws)) throw new Error("Client already exists");

    const client = new Client(ws, this, mcClient);
    this.clients.set(ws, client);
    return client;
  }
  getClient(ws: WebSocket) {
    return this.clients.get(ws);
  }
  removeClient(ws: WebSocket) {
    this.logger.log("Client removed");
    const client = this.getClient(ws);
    this.clients.delete(ws);
    for (let entry of this.clients) {
      if (entry[1].linkedClient == client) {
        delete entry[1].linkedClient;
        entry[1].linkDisconnected();
      }
    }
  }
  findClientById(id: string) {
    for (let client of this.clients.values()) {
      if (client.id == id) return client;
    }
    return;
  }
  findClientByCode(code: string) {
    code = code.toLowerCase();
    for (let client of this.clients.values()) {
      if (client.linkCode == code) return client;
    }
    return;
  }

  send(ws: WebSocket, type: string, data: any) {
    ws.send(
      JSON.stringify({
        type,
        server: {
          name: this.info.name,
        },
        data,
      })
    );
  }

  #eventListeners: {
    [type: string]: ((websocket: WebSocket, data: Message | any) => void)[];
  } = {};

  on(type: string | "*", callback: (websocket: WebSocket, message: Message | any) => void) {
    if (!this.#eventListeners[type]) this.#eventListeners[type] = [];
    this.#eventListeners[type].push(callback);
  }
}

interface Message {
  type: string;
  client: {};
  data: any;
}
