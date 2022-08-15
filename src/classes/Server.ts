import WebSocket, { WebSocketServer } from "ws";
import { Config } from "./Config";
import { Logger } from "./Logger";
import { Client } from "./Client";
import { Server as HSServer } from "https";
import { Server as HServer } from "http";
import * as fs from "fs";
import path from "path";

interface ServerInfo {
  name: string;
  password: string;
}
export class Server {
  config = new Config();
  logger = new Logger(this.config.get("show_logs"));
  clients = new Map<WebSocket, Client>();
  http: HServer | HSServer;
  server: WebSocketServer;
  info: ServerInfo;

  certs() {
    const certsPath = path.join(__dirname, "certs");
    const key = path.join(certsPath, "key.pem");
    const cert = path.join(certsPath, "cert.pem");
    if (!fs.existsSync(certsPath) || !fs.existsSync(key) || !fs.existsSync(cert)) {
      throw new Error("HTTPS is enabled but certs were not provided");
    }

    return {
      key: fs.readFileSync(key),
      cert: fs.readFileSync(cert),
    };
  }
  constructor() {
    this.info = {
      name: this.config.get("server_name"),
      password: this.config.get("server_password"),
    };

    const address = this.config.get("server_address");
    const host = address?.length ? address : "localhost";
    const port = process.env.PORT ? parseInt(process.env.PORT) : this.config.get("server_port");
    if (this.config.get("https_enabled")) {
      this.http = new HSServer(this.certs()).listen(port, host);
    } else {
      this.http = new HServer().listen(port, host);
    }
    this.logger.log(`HTTP${this.config.get("https_enabled") ? "S" : ""} Server started on ${host}:${port}`);

    this.server = this.createWebSocketServer();

    this.logger.log("Server created");
  }

  createWebSocketServer() {
    const wss = new WebSocketServer({ server: this.http });
    this.logger.log(`WebSocket started`);

    wss.on("connection", (ws) => {
      this.logger.log("New connection");

      this.logger.log("Connection established");
      const mcTimeout = setTimeout(() => {
        if (!this.getClient(ws)) {
          this.addClient(ws, true);
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
