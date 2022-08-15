import fs from "fs";
import path from "path";

interface ConfigData {
  server_name: string;
  server_password: string;
  server_address: string;
  server_port: number;
  show_logs: boolean;
  max_distance: number;
  spectator_to_player: boolean;
  https_enabled: boolean;
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
   "server_address": "",

  /**
   * The port the server will listen on.
   * Default: 8080
   */
  "server_port": 8080,

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
    * Enables HTTPS server mode. Certificates are required and placed in the certs folder as certs/key.pem and certs/cert.pem.
    * Default: false
    */
    "https_enabled": false
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
