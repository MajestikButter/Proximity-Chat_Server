import fs from "fs";

interface ConfigData {
  server_name: string;
  server_password: string;
  server_address: string;
  server_port: number;
  show_logs: boolean;
  max_distance: number;
  spectator_to_player: boolean;
}

const DEF_CONFIG_DATA: ConfigData = {
  server_name: "MCBE Proximity Chat Server",
  server_password: "",
  server_address: "localhost",
  server_port: 8080,
  show_logs: false,
  max_distance: 25,
  spectator_to_player: false
};

export class Config {
  private data: ConfigData;

  constructor() {
    const configStr = fs.readFileSync("./config.json", "utf8").toString();
    const commentRegex = /(?:(.*)\/\/.*)|(\/\*(?:.|\s)*?\*\/)/g;
    const fixed = configStr.replace(commentRegex, "$1");
    this.data = Object.assign({}, DEF_CONFIG_DATA, JSON.parse(fixed));
  }

  get<k extends keyof ConfigData>(key: k): ConfigData[k] {
    return this.data[key];
  }
}
