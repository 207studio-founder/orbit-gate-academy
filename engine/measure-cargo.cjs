// Sample horizontal cross sections of the same pixel meshes used in the truck.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const wasm = fs.readFileSync(path.join(root, "assets/port.wasm"));
const api = new WebAssembly.Instance(new WebAssembly.Module(wasm)).exports;
function measure(code) {
  const ptr = api.preview_mesh(0, code),
    count = api.preview_count();
  const data = new DataView(api.memory.buffer, ptr, count * 16);
  const points = Array.from({ length: count }, (_, i) =>
    [0, 4, 8].map((k) => data.getFloat32(i * 16 + k, true)),
  );
  const low = [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k]))),
    high = [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k])));
  const sizes = high.map((v, k) => v - low[k]);
  const profile = [sizes[0], sizes[1], sizes[2]];
  for (const fraction of [0.14, 0.34, 0.54, 0.72, 0.89]) {
    const y = low[1] + fraction * sizes[1],
      xs = [],
      zs = [];
    for (let i = 0; i < count; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = points[i + j],
          b = points[i + ((j + 1) % 3)];
        if (a[1] > y === b[1] > y) continue;
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
        zs.push(a[2] + t * (b[2] - a[2]));
      }
    profile.push(
      xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
      zs.length ? Math.max(...zs) - Math.min(...zs) : 0,
    );
  }
  return profile.map((v) => Math.round(v * 100));
}
const rows = Array.from({ length: 36 }, (_, i) => measure(i));
fs.writeFileSync(
  path.join(root, "cargo-profiles.js"),
  "// Width, height, depth and five measured silhouette slices per physical cargo mesh.\nconst CargoProfiles = " +
    JSON.stringify(rows) +
    ";\n",
);
