require("esbuild").buildSync({
  entryPoints: ["./src/index.ts"],
  outfile: "./dist/index.js",
  minify: true,
  bundle: true,
  target: "es2022",
  format: "cjs",
  sourcemap: "linked",
  platform: "node",
  external: ["esbuild"],
});
