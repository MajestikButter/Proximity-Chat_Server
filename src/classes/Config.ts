import fs from "fs";
import path from "path";

interface ConfigData {
  server_name: string;
  server_password: string;
  server_address: string;
  server_port: number;
  http_server_port: number;
  https_enabled: boolean;
  https_server_port: number;
  show_logs: boolean;
  max_distance: number;
  spectator_to_player: boolean;
  ice_servers: RTCIceServer[];
}

const DEF_CONFIG_STR = `{
  /**
   * The name of the server.
   * Default: "MCBE Proximity Chat Server"
   */
  "server_name": "MCBE Proximity Chat Server",

  /**
   * The password required to join the proximity server through the web client.
   * Default: ""
   */
  "server_password": "",

  /**
   * The address the server will listen on.
   * Default: localhost
   */
  "server_address": "localhost",

  /**
   * The port the server will listen on.
   * Default: 8000
   */
  "server_port": 8000,

  /**
   * The port the http server will listen on.
   * Default: 8001
   */
  "http_server_port": 8001,

  /**
   * Enables HTTPS server mode. Certificates are required and placed in the certs folder as certs/key.pem and certs/cert.pem.
   * Default: false
   */
  "https_enabled": false,

  /**
   * The port the https server will listen on.
   * Default: 8002
   */
  "https_server_port": 8002,

  /**
   * Whether the console should log debug messages.
   * Default: true
   */
  "show_logs": true,

  /**
   * The max distance a player can hear from.
   * Default: 25
   */
  "max_distance": 25,

  /**
   * Enables non-spectator mode players hearing players in spectator mode.
   * Default: false
   */
  "spectator_to_player": false,

  /**
   * Specifies the turn and stun servers to use for webrtc communication.
   */
  "ice_servers": [
    {
      "urls": "turn:openrelay.metered.ca:80",
      "username": "openrelayproject",
      "credential": "openrelayproject"
    },
    {
      "urls": "turn:openrelay.metered.ca:443",
      "username": "openrelayproject",
      "credential": "openrelayproject"
    },
    {
      "urls": "stun:stun1.l.google.com:19302"
    },
    {
      "urls": "stun:stun2.l.google.com:19302"
    },
    {
      "urls": "stun:stun3.l.google.com:19302"
    },
    {
      "urls": "stun:stun4.l.google.com:19302"
    }
  ]
}`;

function parseConfig(str: string): ConfigData {
  const commentRegex = /(?:(.*)\/\/.*)|(\/\*(?:.|\s)*?\*\/)/g;
  const fixed = str.replace(commentRegex, "$1");
  return JSON.parse(fixed);
}

const DEF_CONFIG_DATA = parseConfig(DEF_CONFIG_STR);

export class Config {
  private data: ConfigData;

  constructor() {
    const configPath = path.join(__dirname, "config.json");
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, DEF_CONFIG_STR);
      this.data = Object.assign({}, DEF_CONFIG_DATA);
      return;
    }
    const configStr = fs.readFileSync(configPath, "utf8").toString();
    this.data = Object.assign({}, DEF_CONFIG_DATA, parseConfig(configStr));
  }

  get<k extends keyof ConfigData>(key: k): ConfigData[k] {
    return this.data[key];
  }
}
