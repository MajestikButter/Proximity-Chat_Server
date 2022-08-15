import { Config } from "./Config";
import { Logger } from "./Logger";
import { Client } from "./Client";

import WebSocket, { WebSocketServer } from "ws";
import { Server as HSServer } from "https";
import { Server as HServer } from "http";
import { createConnection, Server as TServer } from "net";

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
  http: HServer;
  https?: HSServer;
  ws: WebSocketServer;
  wss?: WebSocketServer;
  tcp: TServer;
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
    const host = address.length ? address : "localhost";
    const base_port = this.config.get("server_port");
    const https_port = this.config.get("https_server_port");
    const http_port = this.config.get("http_server_port");

    this.tcp = new TServer((conn) => {
      conn.once("data", (buf) => {
        // A TLS handshake record starts with byte 22.
        const isHttp = buf[0] === 22 && this.config.get("https_enabled");
        const proxy = createConnection(isHttp ? https_port : http_port, host, function () {
          proxy.write(buf);
          conn.pipe(proxy).pipe(conn);
        });
      });
    }).listen(base_port, host);
    this.logger.log(`Server started on ${host}:${base_port}`);

    if (this.config.get("https_enabled")) {
      this.https = new HSServer(this.certs(), (req, res) => {
        console.log("incoming https");
        res.writeHead(200);
        res.end('{"content":"aaaaaaaa"}');
      }).listen(https_port, host);
      this.logger.log(`HTTPS Server started on ${host}:${https_port}`);
    }

    this.http = new HServer((req, res) => {
      console.log("incoming http");
      res.writeHead(200);
      res.end('{"content":"aaaaaaaa"}');
    }).listen(http_port, host);
    this.logger.log(`HTTP Server started on ${host}:${http_port}`);

    const { ws, wss } = this.createWebSocketServers();
    this.ws = ws;
    this.wss = wss;

    this.logger.log("Server created");
  }

  createWebSocketServers() {
    const handleConnection = (ws: WebSocket.WebSocket) => {
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
    };

    let wss: WebSocketServer | undefined;
    if (this.https) {
      wss = new WebSocketServer({ server: this.https });
      wss.on("connection", handleConnection);
      this.logger.log(`Secure WebSocket started`);
    }

    const ws = new WebSocketServer({ server: this.http });
    ws.on("connection", handleConnection);
    this.logger.log(`WebSocket started`);
    return { ws, wss };
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
