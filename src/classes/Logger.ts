export class Logger {
  showLogs: boolean;

  constructor(showLogs: boolean) {
    this.showLogs = showLogs;
  }

  log(...data: any[]) {
    if (this.showLogs) {
      console.log(...data);
    }
  }

  error(...data: any[]) {
    console.error(...data);
  }
}
