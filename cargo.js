"use strict";
const PortCore = (() => {
  let promise = null;
  function load() {
    if (!promise)
      promise = fetch("assets/port.wasm?r=31")
        .then((r) => {
          if (!r.ok) throw Error("3D 엔진 로드 실패");
          return r.arrayBuffer();
        })
        .then((bytes) => WebAssembly.instantiate(bytes, {}))
        .then((r) => r.instance.exports)
        .catch((e) => {
          promise = null;
          throw e;
        });
    return promise;
  }
  return { load };
})();
const Cargo = (() => {
  const names = [
    "급식 도시락",
    "축제 음료",
    "도서관 책",
    "씨앗 화분",
    "핵폭탄",
    "우주 괴물의 알",
  ];
  const colors = ["살구색", "청록색", "파란색", "풀색", "꿀빛", "보라색"];
  const parts = [
    "잠금쇠와 손잡이",
    "좁은 병목과 마개",
    "책등과 겹친 종이",
    "흙 위의 잎",
    "빛나는 고리 조각",
    "껍질 돌기와 금",
  ];
  const shifts = [0, 2, 4, 1, 5, 3];
  const code = (kind, form) => kind + 6 * form;
  function shape(sample) {
    const k = sample % 6,
      v = Math.floor(sample / 6);
    return {
      color: (k + shifts[v]) % 6,
      outline: [0, 1, 0, 1, 2, 2][k],
      detail: parts[k],
      profile: CargoProfiles[sample],
    };
  }
  const starter = () => ({
    mode: "shape",
    examples: names.map((_, k) => ({ code: k, label: k })),
    tests: [],
    award: false,
    cursor: 0,
  });
  function snapshot(state) {
    return {
      mode: state.mode,
      examples: state.examples.map((e) => ({ code: e.code, label: e.label })),
    };
  }
  function nearest(model, sample) {
    const a = shape(sample);
    let best = null,
      score = Infinity;
    for (const row of model.examples) {
      const b = shape(row.code);
      const d =
        model.mode === "color"
          ? Number(a.color !== b.color)
          : a.profile.reduce(
              (sum, value, i) => sum + (value - b.profile[i]) ** 2,
              0,
            );
      if (d <= score) {
        score = d;
        best = row;
      }
    }
    return best;
  }
  function evaluate(model) {
    const samples = Array.from({ length: 12 }, (_, i) =>
      code(i % 6, 4 + Math.floor(i / 6)),
    );
    return samples.map((n) => ({ code: n, guess: nearest(model, n).label }));
  }
  function formOf(p, i) {
    return code(p.bag[i], p.forms?.[i] ?? 0);
  }
  function description(n) {
    const a = shape(n);
    return colors[a.color] + " · " + a.detail;
  }
  return {
    names,
    colors,
    parts,
    code,
    shape,
    formOf,
    description,
    starter,
    snapshot,
    nearest,
    evaluate,
  };
})();
const PortArt = (() => {
  const geometry = new Map();
  function mesh(api, kind, code) {
    const key = kind + ":" + code;
    if (geometry.has(key)) return geometry.get(key);
    const ptr = api.preview_mesh(kind, code),
      n = api.preview_count(),
      view = new DataView(api.memory.buffer, ptr, n * 16),
      tri = [];
    for (let i = 0; i < n; i += 3) {
      const j = i * 16,
        points = [];
      for (let p = 0; p < 3; p++) {
        const k = j + p * 16;
        points.push([
          view.getFloat32(k, true),
          view.getFloat32(k + 4, true),
          view.getFloat32(k + 8, true),
        ]);
      }
      tri.push({
        points,
        color:
          "rgb(" +
          view.getUint8(j + 12) +
          "," +
          view.getUint8(j + 13) +
          "," +
          view.getUint8(j + 14) +
          ")",
      });
    }
    geometry.set(key, tri);
    return tri;
  }
  function render(canvas, geo, avatar, yaw, pitch, zoom) {
    const ctx = canvas.getContext("2d"),
      w = canvas.width,
      h = canvas.height,
      scale =
        Math.min(w, h) * (avatar === 2 ? 0.94 : avatar ? 0.355 : 0.7) * zoom;
    const sy = Math.sin(yaw),
      cy = Math.cos(yaw),
      sp = Math.sin(pitch),
      cp = Math.cos(pitch),
      mid = avatar === 2 ? 1.45 : avatar ? 1.1 : 0.415;
    const polys = [];
    for (const t of geo) {
      const pts = t.points.map(([x, Y, z]) => {
        const y = Y - mid,
          q = z * cy + x * sy;
        return [
          (x * cy - z * sy) * scale + w / 2,
          h * 0.5 - (y * cp - q * sp) * scale,
          q * cp + y * sp,
        ];
      });
      polys.push({ pts, z: pts[0][2] + pts[1][2] + pts[2][2], color: t.color });
    }
    polys.sort((a, b) => a.z - b.z);
    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.54;
    for (const { pts, color } of polys) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle = color;
      ctx.fill();
      ctx.stroke();
    }
  }
  return { mesh, render };
})();
const stillSpecimens = new Map();
class OrbitSpecimen extends HTMLElement {
  connectedCallback() {
    if (this.firstChild) return;
    this.canvas = document.createElement("canvas");
    this.append(this.canvas);
    this.avatar = this.hasAttribute("portrait")
      ? 2
      : Number(this.hasAttribute("avatar"));
    this.large = this.hasAttribute("interactive");
    this.yaw = this.avatar ? 0.12 : 0.54;
    this.pitch = this.avatar ? 0.035 : 0.27;
    this.zoom = 1;
    this.canvas.width = this.canvas.height = this.large ? 148 : 100;
    if (this.large) {
      this.canvas.tabIndex = 0;
      this.canvas.setAttribute("role", "group");
      this.canvas.setAttribute(
        "aria-label",
        "3D 모형 · 드래그 또는 방향키로 돌리기, 더하기와 빼기로 확대 축소",
      );
      let drag = null;
      this.canvas.onpointerdown = (e) => {
        drag = [e.clientX, e.clientY];
        this.canvas.setPointerCapture(e.pointerId);
      };
      this.canvas.onpointermove = (e) => {
        if (!drag) return;
        this.rotate(
          (e.clientX - drag[0]) * 0.014,
          (e.clientY - drag[1]) * 0.013,
        );
        drag = [e.clientX, e.clientY];
      };
      this.canvas.onpointerup = this.canvas.onpointercancel = () =>
        (drag = null);
      this.canvas.onkeydown = (e) => {
        let d = {
          ArrowLeft: [-0.25, 0],
          ArrowRight: [0.25, 0],
          ArrowUp: [0, 0.18],
          ArrowDown: [0, -0.18],
        }[e.key];
        if (d) {
          e.preventDefault();
          this.rotate(...d);
        } else if (["+", "=", "-"].includes(e.key)) {
          e.preventDefault();
          this.magnify(e.key === "-" ? -0.12 : 0.12);
        }
      };
      const controls = document.createElement("div");
      controls.className = "spinTools";
      for (const [label, name, fn] of [
        ["↶", "왼쪽으로 돌리기", () => this.rotate(-0.38, 0)],
        ["↷", "오른쪽으로 돌리기", () => this.rotate(0.38, 0)],
        ["−", "축소", () => this.magnify(-0.12)],
        ["+", "확대", () => this.magnify(0.12)],
      ]) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.setAttribute("aria-label", name);
        b.onclick = fn;
        controls.append(b);
      }
      this.append(controls);
    }
    PortCore.load()
      .then((api) => {
        this.api = api;
        this.draw();
      })
      .catch(() => {
        this.canvas.replaceWith(
          document.createTextNode("3D 연결 실패 · 새로고침해 주세요"),
        );
      });
  }
  magnify(delta) {
    this.zoom = Math.max(0.7, Math.min(1.45, this.zoom + delta));
    this.draw();
  }
  rotate(dx, dy) {
    this.yaw += dx;
    this.pitch = Math.max(-1.1, Math.min(1.25, this.pitch + dy));
    this.draw();
  }
  draw() {
    if (!this.api || !this.isConnected) return;
    const code = Number(this.getAttribute("code") || 0);
    const key = this.avatar + ":" + code;
    if (!this.large && stillSpecimens.has(key)) {
      this.canvas.getContext("2d").drawImage(stillSpecimens.get(key), 0, 0);
      return;
    }
    PortArt.render(
      this.canvas,
      PortArt.mesh(this.api, this.avatar, code),
      this.avatar,
      this.yaw,
      this.pitch,
      this.zoom,
    );
    if (!this.large) {
      const copy = document.createElement("canvas");
      copy.width = this.canvas.width;
      copy.height = this.canvas.height;
      copy.getContext("2d").drawImage(this.canvas, 0, 0);
      stillSpecimens.set(key, copy);
    }
  }
  static get observedAttributes() {
    return ["code"];
  }
  attributeChangedCallback() {
    if (this.canvas) this.draw();
  }
}
customElements.define("orbit-specimen", OrbitSpecimen);
function specimen(code, interactive = false, avatar = false) {
  return (
    '<orbit-specimen code="' +
    Number(code) +
    '" ' +
    (interactive ? "interactive " : "") +
    (avatar ? "avatar " : "") +
    "></orbit-specimen>"
  );
}
