import { WebSocket } from "ws";
import crypto from "crypto";
import { Server } from "./Server";

export class Client {
  id: string;
  name: string = "Unknown";
  pos: [number, number, number] = [0, 0, 0];
  yRot: number = 0;
  dimension: number = 0;
  isSpectator: boolean = false;
  linkCode: string = "";
  linkedClient?: Client;

  constructor(public ws: WebSocket, private server: Server, public isMCClient: boolean) {
    this.id = crypto.randomUUID();

    this.server.logger.log("Client created");

    if (isMCClient) {
      this.runMCCommand("getlocalplayername").then((data) => {
        this.name = data.localplayername;
      });
      this.linkCode = crypto.randomUUID().split("-")[0];

      this.sendMCMessage(`Your link code is ${this.linkCode}`);
    }
  }

  updateClients(clients: IterableIterator<Client>) {
    if (!this.isMCClient || !this.linkedClient) return;

    const id = this.linkedClient.id;
    for (let client of clients) {
      if (client.isMCClient || !client.linkedClient) continue;
      this.server.send(client.ws, "updatePlayer", {
        id,
        pos: this.pos,
        dimension: this.dimension,
        yRot: this.yRot,
      });
    }
  }

  runMCCommand(command: string) {
    const requestId = crypto.randomUUID();
    this.sendMC(
      {
        requestId,
        messagePurpose: "commandRequest",
      },
      { commandLine: command }
    );
    return new Promise<any>((resolve, reject) => {
      this.server.on("*", (ws, data) => {
        if (data.header?.requestId === requestId) {
          resolve(data.body);
        }
      });
    });
  }

  sendMCMessage(message: string) {
    this.runMCCommand(`/w @s ${message}`);
  }

  sendMC(header: any, body: any) {
    const sendData = {
      header: Object.assign(
        {
          version: 1,
          requestId: crypto.randomUUID(),
        },
        header
      ),
      body,
    };
    this.ws.send(JSON.stringify(sendData));
  }

  send(type: string, data: any) {
    this.server.send(this.ws, type, data);
  }

  linkDisconnected() {
    if (this.isMCClient) {
      this.sendMCMessage("Your link has been disconnected. Your link code is: " + this.linkCode);
    }
  }
}
