const { ChildProcess, fork } = require("child_process");

/**
 * @type {ChildProcess}
 */
let prevProc;
let controller;
require("esbuild").build({
  entryPoints: ["./src/index.ts"],
  outfile: "./dist/index.js",
  minify: true,
  bundle: true,
  target: "es2022",
  format: "cjs",
  sourcemap: "linked",
  watch: {
    onRebuild: (error, result) => {
      if (error) {
        console.error(error);
      } else {
        console.log("Build successful", result);
        if (prevProc) {
          controller.abort();
        }
        controller = new AbortController();
        const { signal } = controller;
        prevProc = fork("dist/index.js", {
          signal,
        });
        prevProc.on("spawn", () => {
          console.log("\nSpawned ChildProcess\n");
        });
        prevProc.on("error", (err) => {
          if (err.name != "AbortError") {
            console.error(err);
          }
        });
      }
    },
  },
  platform: "node",
  external: ["esbuild"],
});
