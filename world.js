"use strict";
const SpacePort = (() => {
  const T = window.THREE,
    cache = new Map(),
    geo = new Map();
  const skins = [
    "#88e4b3",
    "#ad94ef",
    "#f7b76a",
    "#77cde6",
    "#f5a9b9",
    "#8bd5b7",
    "#b5b1fa",
    "#b2d77e",
    "#8ec9ff",
    "#dc9be6",
    "#f7c56c",
    "#7fdaca",
  ];
  const coats = ["#f08340", "#3988bd", "#a16ccb", "#efaa42"];
  const navy = "#29324e",
    boot = "#444967",
    trim = "#e7ded5",
    dark = "#201e39";
  function mat(c) {
    if (!cache.has(c))
      cache.set(c, new T.MeshStandardMaterial({ color: c, roughness: 0.73 }));
    return cache.get(c);
  }
  function geometry(key, make) {
    if (!geo.has(key)) geo.set(key, make());
    return geo.get(key);
  }
  function shape(parent, g, c, x, y, z, sx = 1, sy = 1, sz = 1) {
    const m = new T.Mesh(g, mat(c));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }
  function group(p, x = 0, y = 0, z = 0) {
    const g = new T.Group();
    if (p) p.add(g);
    g.position.set(x, y, z);
    return g;
  }
  function box(p, c, x, y, z, w, h, d, round = 0.06) {
    const r = Math.min(round, w * 0.42, h * 0.42, d * 0.42),
      g = geometry(["b", w, h, d, r].join(","), () => {
        const b = new T.BoxGeometry(w, h, d, 4, 4, 4),
          pos = b.attributes.position,
          normal = b.attributes.normal,
          v = new T.Vector3(),
          k = new T.Vector3(),
          n = new T.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          k.set(
            T.MathUtils.clamp(v.x, -w / 2 + r, w / 2 - r),
            T.MathUtils.clamp(v.y, -h / 2 + r, h / 2 - r),
            T.MathUtils.clamp(v.z, -d / 2 + r, d / 2 - r),
          );
          n.subVectors(v, k).normalize();
          v.copy(k).addScaledVector(n, r);
          pos.setXYZ(i, v.x, v.y, v.z);
          normal.setXYZ(i, n.x, n.y, n.z);
        }
        return b;
      });
    return shape(p, g, c, x, y, z);
  }
  const ball = (p, c, x, y, z, w, h, d) =>
    shape(
      p,
      geometry("s", () => new T.SphereGeometry(1, 16, 12)),
      c,
      x,
      y,
      z,
      w,
      h,
      d,
    );
  function cyl(p, c, x, y, z, top, base, h, n = 16) {
    return shape(
      p,
      geometry(
        ["c", top, base, h, n].join(","),
        () => new T.CylinderGeometry(top, base, h, n),
      ),
      c,
      x,
      y,
      z,
    );
  }
  function ring(p, c, x, y, z, r, t) {
    return shape(
      p,
      geometry(["r", r, t].join(","), () => new T.TorusGeometry(r, t, 6, 32)),
      c,
      x,
      y,
      z,
    );
  }
  function compress(root) {
    // Bake static pieces with common material into a single draw call per colour.
    root.updateWorldMatrix(true, true);
    const inv = root.matrixWorld.clone().invert(),
      batches = new Map(),
      mx = new T.Matrix4(),
      nm = new T.Matrix3(),
      v = new T.Vector3();
    root.traverse((m) => {
      if (!m.isMesh) return;
      const g = m.geometry,
        P = g.attributes.position,
        N = g.attributes.normal,
        I = g.index;
      mx.multiplyMatrices(inv, m.matrixWorld);
      nm.getNormalMatrix(mx);
      let b = batches.get(m.material);
      if (!b) {
        b = { p: [], n: [], i: [] };
        batches.set(m.material, b);
      }
      const off = b.p.length / 3;
      for (let j = 0; j < P.count; j++) {
        v.fromBufferAttribute(P, j).applyMatrix4(mx);
        b.p.push(v.x, v.y, v.z);
        v.fromBufferAttribute(N, j).applyNormalMatrix(nm);
        b.n.push(v.x, v.y, v.z);
      }
      if (I) for (let j = 0; j < I.count; j++) b.i.push(off + I.getX(j));
      else for (let j = 0; j < P.count; j++) b.i.push(off + j);
    });
    root.clear();
    for (const [material, b] of batches) {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(b.p, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(b.n, 3));
      g.setIndex(b.i);
      g.userData.baked = true;
      root.add(new T.Mesh(g, material));
    }
    return root;
  }
  function alien(id) {
    const p = group(),
      k = id % 4,
      skin = skins[id],
      coat = coats[(id + Math.floor(id / 4)) % 4];
    for (const side of [-1, 1]) {
      box(p, navy, side * 0.28, 0.41, 0, 0.39, 0.64, 0.4, 0.1);
      box(p, boot, side * 0.29, 0.17, 0.1, 0.49, 0.3, 0.66, 0.12);
      box(p, "#9b9aaf", side * 0.29, 0.065, 0.1, 0.5, 0.085, 0.65);
      const arm = group(p, side * 0.51, 1.05, 0);
      arm.rotation.z = side * 0.16;
      box(arm, coat, side * 0.035, -0.03, 0, 0.35, 0.6, 0.47, 0.14);
      box(arm, navy, side * 0.04, -0.29, 0.015, 0.32, 0.12, 0.42);
      ball(arm, skin, side * 0.04, -0.4, 0.03, 0.157, 0.17, 0.18);
    }
    box(p, navy, 0, 0.77, 0, 0.83, 0.29, 0.56, 0.1);
    box(p, coat, 0, 1.08, 0, 0.94, 0.78, 0.61, 0.17);
    box(p, "#41405e", 0, 1.02, 0.317, 0.043, 0.58, 0.03);
    box(p, trim, 0.24, 1.2, 0.303, 0.2, 0.115, 0.03);
    box(p, "#ffcf60", 0.24, 1.2, 0.329, 0.13, 0.043, 0.015);
    box(p, navy, 0, 1.45, 0.005, 0.63, 0.16, 0.55, 0.08);
    box(p, "#47506a", 0, 1.09, -0.34, 0.72, 0.63, 0.31, 0.1);
    ball(p, skin, 0, 1.89, 0, 0.66, 0.55, 0.5);
    for (const side of [-1, 1]) {
      if (k === 0) {
        const a = cyl(p, skin, side * 0.33, 2.42, 0, 0.04, 0.065, 0.35);
        a.rotation.z = -side * 0.4;
        ball(p, "#b3ed99", side * 0.4, 2.59, 0, 0.09, 0.09, 0.085);
      }
      if (k === 1) {
        const a = ball(p, skin, side * 0.61, 2.08, 0, 0.19, 0.43, 0.15);
        a.rotation.z = -side * 0.83;
        const b = ball(p, "#e3a5c4", side * 0.68, 2.16, 0.09, 0.07, 0.24, 0.05);
        b.rotation.z = -side * 0.83;
      }
      if (k === 2) {
        const horn = cyl(
          p,
          "#ffdb99",
          side * 0.41,
          2.37,
          0.005,
          0.012,
          0.155,
          0.39,
          8,
        );
        horn.rotation.z = -side * 0.32;
      }
      if (k === 3) ball(p, skin, side * 0.61, 1.95, 0, 0.15, 0.12, 0.16);
      const ex = side * (k === 3 ? 0.3 : 0.25);
      ball(p, "#f7ede7", ex, 1.96, 0.39, 0.174, 0.2, 0.096);
      ball(p, dark, ex + 0.012, 1.968, 0.465, 0.113, 0.15, 0.056);
      ball(p, "#ffffff", ex - 0.024, 2.031, 0.514, 0.032, 0.042, 0.016);
      ball(p, "#eea59c", side * 0.43, 1.82, 0.367, 0.1, 0.043, 0.028);
    }
    if (k === 3) {
      ball(p, trim, 0, 2.21, 0.36, 0.138, 0.132, 0.08);
      ball(p, dark, 0, 2.215, 0.42, 0.08, 0.081, 0.035);
      ball(p, "#fff", -0.017, 2.245, 0.452, 0.023, 0.023, 0.01);
    }
    ball(p, dark, 0, 1.748, 0.48, 0.08, 0.036, 0.025);
    return compress(p);
  }
  function cargo(id) {
    const p = group();
    if (id === 0) {
      box(p, "#d96a44", 0, 0.18, 0, 0.79, 0.34, 0.54, 0.09);
      box(p, "#ffe1a3", 0, 0.38, 0, 0.86, 0.11, 0.59);
      box(p, "#709b80", 0, 0.24, 0, 0.14, 0.39, 0.61);
    }
    if (id === 1) {
      cyl(p, "#77bbdf", 0, 0.34, 0, 0.21, 0.24, 0.62);
      cyl(p, "#d0f5f0", 0, 0.39, 0, 0.238, 0.237, 0.18);
      cyl(p, "#f7ab52", 0, 0.7, 0, 0.15, 0.14, 0.11);
      box(p, "#fff8da", 0, 0.4, 0.235, 0.16, 0.09, 0.03);
    }
    if (id === 2) {
      for (let i = 0; i < 2; i++) {
        const book = group(p, 0, 0.075 + i * 0.17, 0);
        book.rotation.y = i * 0.23;
        box(book, trim, 0, 0.055, 0, 0.61, 0.105, 0.43);
        for (const y of [-0.01, 0.12])
          box(book, i ? "#5e88cb" : "#a264a6", 0, y, 0, 0.67, 0.035, 0.47);
      }
    }
    if (id === 3) {
      cyl(p, "#d58a62", 0, 0.19, 0, 0.22, 0.15, 0.36, 10);
      cyl(p, "#815f54", 0, 0.38, 0, 0.185, 0.185, 0.03);
      for (const s of [-1, 1]) {
        const l = ball(
          p,
          s < 0 ? "#7bc580" : "#a3dd83",
          s * 0.105,
          0.53,
          0,
          0.09,
          0.19,
          0.07,
        );
        l.rotation.z = -s * 0.6;
      }
    }
    if (id === 4) {
      ball(p, "#424459", 0, 0.33, 0, 0.31, 0.29, 0.28);
      cyl(p, "#e5ab37", 0, 0.33, 0, 0.306, 0.306, 0.18);
      box(p, "#443a40", 0, 0.33, 0.296, 0.13, 0.13, 0.028).rotation.z =
        Math.PI / 4;
      cyl(p, "#737789", 0, 0.625, 0, 0.115, 0.12, 0.09);
      const fuse = cyl(p, "#d89552", 0.035, 0.733, 0, 0.027, 0.034, 0.16);
      fuse.rotation.z = -0.35;
      ball(p, "#ffb856", 0.068, 0.81, 0, 0.047, 0.05, 0.047);
    }
    if (id === 5) {
      ball(p, "#ae74df", 0, 0.39, 0, 0.265, 0.39, 0.25);
      for (const [x, y, z] of [
        [-0.1, 0.48, 0.213],
        [0.11, 0.37, 0.226],
        [-0.03, 0.23, 0.216],
        [0.19, 0.57, 0.125],
        [-0.22, 0.34, 0.12],
      ])
        ball(p, "#8de2a1", x, y, z, 0.062, 0.063, 0.032);
      const tip = cyl(p, "#b17ee0", 0, 0.73, 0, 0.018, 0.12, 0.16, 12);
      tip.rotation.z = -0.13;
    }
    return compress(p);
  }
  function light(scene) {
    scene.add(new T.HemisphereLight(0xffeff2, 0xb0a0da, 2.05));
    const sun = new T.DirectionalLight(0xffead3, 2.65);
    sun.position.set(-4, 7, 5);
    scene.add(sun);
    const rim = new T.DirectionalLight(0x9dcfff, 2.3);
    rim.position.set(3, 3, -5);
    scene.add(rim);
  }
  function sky() {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 384;
    const ctx = c.getContext("2d"),
      g = ctx.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, "#242955");
    g.addColorStop(0.43, "#796b9c");
    g.addColorStop(0.76, "#fab9a1");
    g.addColorStop(1, "#f9c69d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 768, 384);
    let s = 901;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < 175; i++) {
      const x = rand() * 768,
        y = rand() * 250;
      ctx.fillStyle = "rgba(255,247,230," + (0.2 + rand() * 0.55) + ")";
      ctx.fillRect(x, y, rand() * 1.6 + 0.5, 1.3);
    }
    ctx.save();
    ctx.translate(550, 119);
    ctx.rotate(-0.27);
    ctx.strokeStyle = "#f3bca4";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 96, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
    const pg = ctx.createLinearGradient(0, -52, 10, 50);
    pg.addColorStop(0, "#ffe0b0");
    pg.addColorStop(0.55, "#e1a6a7");
    pg.addColorStop(1, "#ab90b1");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(0, 0, 49, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#ffdbba";
    ctx.beginPath();
    ctx.ellipse(0, 0, 96, 15, 0, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = ["#b894ac", "#a087a1", "#80768c"][j];
      ctx.beginPath();
      ctx.moveTo(0, 384);
      for (let x = -20; x <= 800; x += 20) {
        const y =
          274 + j * 27 - rand() * (25 + j * 5) - Math.cos(x * 0.018 + j) * 9;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(800, 384);
      ctx.fill();
    }
    return c.toDataURL();
  }
  function station() {
    const p = group();
    box(p, "#988ca2", 0, -0.58, -4, 34, 0.7, 24);
    box(p, "#656985", 0, -0.244, -1, 10, 0.35, 7);
    box(p, "#9092a6", 0, -0.09, 0, 6.7, 0.23, 5.8);
    for (let z = -2; z < 3; z += 0.82) {
      for (const x of [-2.65, 2.66]) {
        box(p, "#ffc069", x, 0.031, z, 0.13, 0.019, 0.42);
      }
    }
    for (const x of [-2.45, 2.45]) {
      box(p, "#545b78", x, 1.75, -1.94, 0.48, 3.6, 0.65);
      box(p, "#bfc0cd", x, 1.9, -1.57, 0.47, 3, 0.21);
      box(p, "#ffb459", x, 2.52, -1.456, 0.12, 0.84, 0.045);
      box(p, "#69738b", x, 0.4, -1.53, 0.62, 0.6, 0.44);
    }
    box(p, "#b4b6c6", 0, 3.73, -1.93, 5.45, 0.53, 0.8);
    box(p, "#424963", 0, 3.69, -1.5, 3.2, 0.32, 0.08);
    for (let i = -1; i < 2; i++) {
      const a = box(p, "#ffbc62", i * 0.39, 3.75, -1.447, 0.16, 0.18, 0.035);
      a.rotation.z = 0.75;
      const b = box(p, "#ffbc62", i * 0.39, 3.64, -1.447, 0.16, 0.18, 0.035);
      b.rotation.z = -0.75;
    }
    for (let j = 0; j < 7; j++) {
      const x = -8 + j * 2.3,
        z = -6 - (j % 3) * 2,
        h = 1 + (j % 3) * 0.55;
      box(p, "#88839b", x, h * 0.5 - 0.4, z, 1.4, h, 1.75);
      box(p, "#b8aabc", x, h - 0.3, z, 1.59, 0.15, 1.95);
      for (const a of [-0.36, 0.36])
        box(p, "#e7be9c", x + a, h * 0.64 - 0.2, z + 0.88, 0.41, 0.16, 0.035);
    }
    for (const [x, z] of [
      [-3.5, -1.2],
      [-3.9, -0.3],
      [3.6, -2.6],
    ]) {
      box(p, "#ba8869", x, 0.25, z, 0.85, 0.65, 0.73);
      for (const a of [-0.3, 0.3])
        box(p, boot, x + a, 0.25, z, 0.09, 0.68, 0.77);
    }
    // An arrival shuttle parked beyond the boarding arch.
    const ship = group(p, -4.8, 1.15, -4.2);
    ship.rotation.y = 0.38;
    ball(ship, "#e2d5c8", 0, 0, 0, 1.8, 0.48, 0.65);
    ball(ship, "#454e71", 0.62, 0.31, 0.07, 0.68, 0.31, 0.47);
    box(ship, "#d27f52", -0.5, -0.12, 0, 1.9, 0.13, 2);
    for (const x of [-0.6, 0.65])
      box(ship, boot, x, -0.55, 0, 0.12, 0.32, 0.64);
    return compress(p);
  }
  function shadow(p, x, z, w, d) {
    const m = new T.Mesh(
      geometry("shadow", () => new T.CircleGeometry(1, 28)),
      new T.MeshBasicMaterial({
        color: 0x50465f,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.041, z);
    m.scale.set(w, d, 1);
    p.add(m);
    return m;
  }
  let renderer,
    scene,
    cam,
    actor,
    caseRoot,
    lid,
    contents,
    bar,
    portSky,
    host,
    raf = 0,
    last = 0,
    nowCase,
    open = false,
    angle = 0.1,
    departure = null,
    t0 = 0,
    view = "person",
    frameCount = 0;
  const reduced = () => matchMedia("(prefers-reduced-motion:reduce)").matches;
  let gpuUnavailable = false;
  function create() {
    if (gpuUnavailable) return false;
    if (renderer) return true;
    try {
      renderer = new T.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch (e) {
      renderer = null;
      gpuUnavailable = true;
      return false;
    }
    renderer.setPixelRatio(1);
    renderer.setClearColor(0, 0);
    scene = new T.Scene();
    scene.fog = new T.FogExp2(0xc2a3ad, 0.043);
    light(scene);
    scene.add(station());
    cam = new T.PerspectiveCamera(35, 1, 0.1, 70);
    shadow(scene, -0.54, 0.3, 0.8, 0.48);
    shadow(scene, 1.08, 0.54, 0.87, 0.49);
    bar = group(scene, -1.54, 0.85, -1.35);
    box(bar, "#e7b576", 1.5, 0, 0, 3, 0.15, 0.15);
    for (let i = 0; i < 7; i++)
      box(bar, "#d37253", 0.22 + i * 0.4, 0, 0.078, 0.17, 0.15, 0.018);
    caseRoot = group(scene, 1.07, 0.04, 0.55);
    caseRoot.rotation.y = -0.13;
    box(caseRoot, navy, 0, 0.27, 0, 1.38, 0.51, 0.77, 0.12);
    box(caseRoot, "#7988a0", 0, 0.54, 0, 1.37, 0.1, 0.76);
    lid = group(caseRoot, 0, 0.53, -0.36);
    box(lid, "#b8855a", 0, 0.07, 0.36, 1.42, 0.16, 0.82, 0.08);
    for (const x of [-0.47, 0.47])
      box(lid, "#576078", x, 0.085, 0.36, 0.1, 0.18, 0.84);
    box(lid, "#ffd692", 0, 0.16, 0.36, 0.31, 0.024, 0.19);
    contents = group(caseRoot, 0, 0.56, 0);
    portSky = sky();
    return true;
  }
  function disposeGroup(g) {
    if (!g) return;
    g.traverse((m) => {
      if (m.geometry?.userData.baked) m.geometry.dispose();
    });
    g.removeFromParent();
  }
  function select(p) {
    nowCase = p;
    departure = null;
    angle = 0.1;
    view = "person";
    open = false;
    if (!renderer) return;
    disposeGroup(actor);
    actor = alien(p.face);
    scene.add(actor);
    actor.position.set(-0.54, 0.05, 0.35);
    actor.rotation.y = 0.22;
    for (const m of [...contents.children]) disposeGroup(m);
    p.bag.forEach((id, i) => {
      const m = cargo(id);
      m.scale.setScalar(0.77);
      m.position.x = i ? 0.34 : -0.34;
      contents.add(m);
    });
    contents.visible = false;
    lid.rotation.x = 0;
    bar.rotation.z = 0;
  }
  function placeCamera() {
    const w = host.clientWidth,
      h = host.clientHeight,
      aspect = w / Math.max(1, h);
    const cameraZ = Math.max(5.05, 4.1 / aspect),
      focus = view === "cargo" ? [0.57, 1.12, 0.15] : [-0.02, 1.42, 0];
    cam.position.set(
      focus[0] + Math.sin(angle) * 2.35,
      view === "cargo" ? 3.5 : 2.08,
      cameraZ + (view === "cargo" ? -0.38 : 0.2),
    );
    cam.lookAt(...focus);
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    const scale = Math.min(1, 900 / w, 560 / h);
    if (
      renderer.domElement.width !== Math.round(w * scale) ||
      renderer.domElement.height !== Math.round(h * scale)
    )
      renderer.setSize(Math.round(w * scale), Math.round(h * scale), false);
  }
  function draw(t) {
    if (!host?.isConnected || host.offsetWidth === 0 || document.hidden) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(draw);
    if (t - last < (reduced() ? 90 : 40)) return;
    last = t;
    placeCamera();
    const phase = (t - t0) / 1000,
      progress = departure ? Math.min((t - departure.at) / 720, 1) : 0;
    actor.position.set(
      -0.54 + (departure && !departure.pass ? progress * 2.8 : 0),
      0.055 + (reduced() ? 0 : Math.sin(phase * 2.2) * 0.021),
      0.35 - (departure?.pass ? progress * 2 : 0),
    );
    actor.rotation.y = 0.16 + progress * (departure?.pass ? 2.8 : 1.35);
    lid.rotation.x += ((open ? -1.63 : 0) - lid.rotation.x) * 0.32;
    contents.visible = open;
    bar.rotation.z = departure?.pass ? Math.min(1, progress * 3) * 1.37 : 0;
    renderer.render(scene, cam);
    frameCount++;
  }
  function mount(el, p, opened = false) {
    stop();
    host = el;
    if (!create()) {
      select(p);
      el.classList.add("flat");
      el.innerHTML =
        '<img class="backupActor" src="assets/actor-' +
        p.face +
        '.webp" alt="방문객의 실제 모습"><div class="flatbox"></div>';
      setOpen(opened);
      return;
    }
    el.style.backgroundImage = "url(" + portSky + ")";
    el.replaceChildren(renderer.domElement);
    select(p);
    setOpen(opened);
    t0 = performance.now();
    raf = requestAnimationFrame(draw);
    let down = null,
      startX = 0,
      startY = 0;
    el.onpointerdown = (e) => {
      down = startX = e.clientX;
      startY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    el.onpointermove = (e) => {
      if (down !== null) {
        turn((e.clientX - down) * 0.009);
        down = e.clientX;
      }
    };
    el.onpointercancel = () => (down = null);
    el.onpointerup = (e) => {
      down = null;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 7) return;
      const rect = el.getBoundingClientRect(),
        ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((e.clientY - rect.top) / rect.height) * 2,
        ),
        cam,
      );
      const hit = ray.intersectObjects([caseRoot, actor], true)[0];
      if (!hit) return;
      let obj = hit.object;
      while (obj && obj !== caseRoot && obj !== actor) obj = obj.parent;
      if (obj === caseRoot) document.querySelector("[data-act=cargo]")?.click();
      if (obj === actor) document.querySelector("[data-act=compare]")?.click();
    };
  }
  function setOpen(v) {
    open = v;
    view = v ? "cargo" : "person";
    if (!renderer && host) {
      host
        .closest(".visual")
        ?.querySelectorAll("[data-act=left],[data-act=right]")
        .forEach((btn) => (btn.hidden = true));
      const b = host.querySelector(".flatbox");
      if (b)
        b.innerHTML = v
          ? nowCase.bag
              .map((x) => '<img src="assets/item-' + x + '.webp" alt="">')
              .join("")
          : "▣";
    }
  }
  function turn(x) {
    angle = Math.max(-0.85, Math.min(0.85, angle + x));
  }
  function leave(pass) {
    departure = { at: performance.now(), pass };
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    host = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && renderer && host?.isConnected && !raf)
      raf = requestAnimationFrame(draw);
  });
  // Asset baking reuses the play models to keep portraits, cargo references and the 3D scene identical.
  function bake(kind, id) {
    const s = new T.Scene();
    light(s);
    const obj = kind === "item" ? cargo(id) : alien(id);
    s.add(obj);
    obj.rotation.y = kind === "item" ? -0.43 : 0.07;
    const c = new T.PerspectiveCamera(kind === "item" ? 29 : 27, 1, 0.1, 20);
    if (kind === "item") {
      c.position.set(0.35, 0.9, 1.81);
      c.lookAt(0, 0.36, 0);
    } else if (kind === "face") {
      c.position.set(0, 2.03, 2.92);
      c.lookAt(0, 1.96, 0);
    } else {
      c.position.set(0.55, 1.75, 6.25);
      c.lookAt(0, 1.28, 0);
    }
    const r =
      bake.r ||
      (bake.r = new T.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      }));
    r.setSize(
      kind === "actor" ? 320 : 176,
      kind === "actor" ? 320 : 176,
      false,
    );
    r.setClearColor(0, 0);
    r.render(s, c);
    const url = r.domElement.toDataURL("image/webp", 0.88);
    disposeGroup(obj);
    return url;
  }
  return {
    mount,
    stop,
    setOpen,
    turn,
    leave,
    bake,
    sky,
    get frames() {
      return frameCount;
    },
  };
})();
