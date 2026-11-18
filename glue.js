// Browser glue for Orbit Gate. All game logic lives in orbit_gate.wasm (Rust);
// this file forwards input, issues the WebGL calls for the draw list the core
// returns, and shows the panels. It keeps no game state of its own.
const qs = new URLSearchParams(location.search);
const S = 3; // CSS pixels per low-res pixel: one pixel scale for the whole world
const NAMES = ["모루", "핀토", "라케", "수벨", "도라미", "키오"];
const CARGO = ["학교 급식", "핵폭탄", "괴물 알"];
const CHANGE = { 1: "머리 염색", 2: "안경 착용", 3: "흉터 치료" };
const LABELS = ["운전석", "화물칸 1", "판정 레버", "운전기사", "AI 감식대"];
const CUES = ["날짜", "얼굴", "화물 모양", "화물 색", "허가증", "트럭 번호(통째로 외우기)"];
const NOT_YET = "이 버전에 없는 것: 그물총과 도주·괴물 사건, 경제와 감시탑, 5주기 허가증과 무한 모드, 캐릭터 꾸미기, 소리, 화물 3종(씨앗 화분·축제 음료·도서관 책).";
const REASON = [
  "문제 없는 트럭이었습니다.",
  "통행증의 마지막 사용일이 지났습니다.",
  "사진과 얼굴이 다른데 진료 기록이 없습니다.",
  "진료 기록이 다른 사람의 것입니다.",
  "진료 기록의 내용이 실제로 달라진 점과 맞지 않습니다.",
  "위험 화물인데 허가증이 없습니다.",
  "허가증이 다른 화물용입니다.",
  "허가증 기한이 지났습니다.",
  "허가증의 주인이 이 운전기사가 아닙니다.",
];
const RULES = `<ul>
<li><b>통행증</b>: 오늘이 마지막 사용일보다 늦으면 보류.</li>
<li><b>얼굴</b>: 사진과 다르면 진료 기록 조회(R). 기록의 이름이 운전기사와 같고, 달라진 점이 기록과 같으면 설명됨.</li>
<li><b>화물</b>: 핵폭탄·괴물 알은 위험 화물. 운전기사를 내리게 하고(Q) 몸수색으로 허가증을 찾는다.</li>
<li><b>허가증</b>: 이름이 운전기사와 같고, 화물 종류가 실물과 같고, 기한이 오늘 이후여야 유효.</li>
</ul>`;
const $ = (id) => document.getElementById(id);
const day = (n) => `${Math.floor(n / 100)}월 ${n % 100}일`;

const canvas = $("c");
const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });

function program(vs, fs, attribs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  attribs.forEach((name, i) => gl.bindAttribLocation(p, i, name));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
const PREC = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n";
const stackProg = program(
  "attribute vec3 p; attribute vec2 t; attribute float s; uniform mat4 m; varying vec2 v; varying float k; void main(){ v=t; k=s; gl_Position=m*vec4(p,1.0); }",
  PREC + "uniform sampler2D x; varying vec2 v; varying float k; void main(){ vec4 c=texture2D(x,v); if(c.a<0.5) discard; gl_FragColor=vec4(c.rgb*k,1.0); }",
  ["p", "t", "s"],
);
const quadProg = program(
  "attribute vec2 a; uniform vec4 r; varying vec2 v; void main(){ v=a; gl_Position=vec4(r.xy+a*r.zw,0.0,1.0); }",
  PREC + "uniform sampler2D x; varying vec2 v; void main(){ gl_FragColor=texture2D(x,v); }",
  ["a"],
);
const uM = gl.getUniformLocation(stackProg, "m");
const uR = gl.getUniformLocation(quadProg, "r");
const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);

function texture(w, h, src) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  if (src instanceof HTMLCanvasElement) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
    gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}

const { instance } = await WebAssembly.instantiateStreaming(fetch("orbit_gate.wasm"), {});
const ex = instance.exports;
const mem = () => ex.memory.buffer;
ex.og_init(0);

const meshes = [];
for (let i = 0; i < ex.og_mesh_count(); i++) {
  const vbo = gl.createBuffer();
  const len = ex.og_mesh_len(i);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mem(), ex.og_mesh_ptr(i), len), gl.STATIC_DRAW);
  const [w, h] = [ex.og_tex_w(i), ex.og_tex_h(i)];
  meshes.push({ vbo, n: len / 6, tex: texture(w, h, new Uint8Array(mem(), ex.og_tex_ptr(i), w * h * 4)) });
}

// Floating labels: rasterised once to textures, drawn in the same GL frame as
// the world, at the position the core computed with that frame's camera.
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
const labelTex = LABELS.map((text) => {
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  const font = '700 15px "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif';
  g.font = font;
  c.width = Math.ceil(g.measureText(text).width) + 18;
  c.height = 26;
  g.fillStyle = "#1b1f3b";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#7df9ff";
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
  g.font = font;
  g.fillStyle = "#ffffff";
  g.textBaseline = "middle";
  g.fillText(text, 9, 14);
  return { w: c.width, h: c.height, tex: texture(0, 0, c) };
});
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

let lw = 0, lh = 0, fbo = null, fboTex = null, fboDepth = null;
function resize() {
  const w = Math.max(160, Math.floor(innerWidth / S)), h = Math.max(90, Math.floor(innerHeight / S));
  if (w === lw && h === lh) return;
  [lw, lh] = [w, h];
  canvas.width = lw * S;
  canvas.height = lh * S;
  canvas.style.width = lw * S + "px";
  canvas.style.height = lh * S + "px";
  if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteTexture(fboTex); gl.deleteRenderbuffer(fboDepth); }
  fboTex = texture(lw, lh, null);
  fboDepth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, fboDepth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, lw, lh);
  fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, fboDepth);
}

const rgb = (hex) => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
const bgTop = rgb(ex.og_bg(1)), bgBot = rgb(ex.og_bg(0));

function render() {
  // 1. world -> low-res target
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, lw, lh);
  gl.disable(gl.BLEND);
  gl.enable(gl.SCISSOR_TEST);
  for (let i = 0; i < 6; i++) {
    const t = i / 5, y0 = Math.round(lh * (1 - (i + 1) / 6)), y1 = Math.round(lh * (1 - i / 6));
    gl.scissor(0, y0, lw, y1 - y0);
    gl.clearColor(bgTop[0] + (bgBot[0] - bgTop[0]) * t, bgTop[1] + (bgBot[1] - bgTop[1]) * t, bgTop[2] + (bgBot[2] - bgTop[2]) * t, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  gl.disable(gl.SCISSOR_TEST);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.useProgram(stackProg);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.enableVertexAttribArray(2);
  const d = new Float32Array(mem(), ex.og_draws_ptr(), ex.og_draws_len());
  for (let i = 0; i < d.length; i += 17) {
    const m = meshes[d[i]];
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
    gl.bindTexture(gl.TEXTURE_2D, m.tex);
    gl.uniformMatrix4fv(uM, false, d.subarray(i + 1, i + 17));
    gl.drawArrays(gl.TRIANGLES, 0, m.n);
  }
  // 2. low-res target -> screen, nearest neighbour
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.DEPTH_TEST);
  gl.disableVertexAttribArray(1);
  gl.disableVertexAttribArray(2);
  gl.useProgram(quadProg);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindTexture(gl.TEXTURE_2D, fboTex);
  gl.uniform4f(uR, -1, -1, 2, 2);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  // 3. labels, same frame, same camera
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const L = new Float32Array(mem(), ex.og_labels_ptr(), ex.og_labels_len());
  for (let i = 0; i < L.length; i += 6) {
    if (!L[i + 5]) continue;
    const t = labelTex[L[i]];
    const left = L[i + 1] * S - (t.w >> 1), top = L[i + 2] * S - t.h - 4;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.uniform4f(uR, (left / canvas.width) * 2 - 1, 1 - ((top + t.h) / canvas.height) * 2, (t.w / canvas.width) * 2, (t.h / canvas.height) * 2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

// ---- input: physical key codes only, so Han/Eng never matters ----
const enc = new TextEncoder();
let started = false;
function send(code, down) {
  const bytes = enc.encode(code).subarray(0, 64);
  new Uint8Array(mem(), ex.og_code_buf(), 64).set(bytes);
  return ex.og_key(bytes.length, down ? 1 : 0);
}
const press = (code) => { send(code, true); send(code, false); };
function key(e, down) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLInputElement) return; // typing a nickname is not playing
  if (!started) {
    if (down && ["Enter", "KeyE", "Space"].includes(e.code)) start();
    return;
  }
  if (send(e.code, down)) e.preventDefault();
}
addEventListener("keydown", (e) => { if (e.repeat) e.preventDefault(); else key(e, true); });
addEventListener("keyup", (e) => key(e, false));
addEventListener("blur", () => ex.og_blur());
canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); ex.og_pointer(0, e.clientX, e.clientY); });
canvas.addEventListener("pointermove", (e) => ex.og_pointer(1, e.clientX, e.clientY));
canvas.addEventListener("pointerup", (e) => ex.og_pointer(2, e.clientX, e.clientY));
canvas.addEventListener("pointercancel", () => ex.og_blur());
canvas.addEventListener("wheel", (e) => { e.preventDefault(); ex.og_wheel(e.deltaY); }, { passive: false });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ---- panels (DOM, rebuilt only when the state they show changes) ----
let uiKey = "";
function faceCanvas(which) {
  const c = document.createElement("canvas");
  c.width = c.height = 24;
  const img = new ImageData(new Uint8ClampedArray(mem().slice(ex.og_face_ptr(which), ex.og_face_ptr(which) + 24 * 24 * 4)), 24, 24);
  c.getContext("2d").putImageData(img, 0, 0);
  return c;
}
function ui(st) {
  const key = [1, 2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 24, 31, 34, 35, 36, 37, 38, 39, 40, 41].map((i) => st[i]).join(",");
  if (key === uiKey) return;
  uiKey = key;
  $("hud").innerHTML = `보호막 ${"♥".repeat(Math.max(0, st[15]))}${"♡".repeat(Math.max(0, 3 - st[15]))} · 크레딧 <b>${st[16]}</b> · 오늘 <b>${day(st[3])}</b> · 트럭 ${st[24] + 1}`;
  const prompts = [
    "",
    st[18] === 0 ? "E 통행증 확인 · Q 하차 요청" : "E 통행증 확인",
    st[8] < 0 ? "E 운전기사 몸수색" : "E 허가증 다시 보기",
    "E 화물칸 열기",
    "E 덮개 걷기",
    "E 화물 살펴보기",
    "E 판정 레버",
    "드래그 또는 A/D·W/S로 돌려 보기 · E 그만 보기",
    "몸수색 중…",
    "E AI 감식대",
  ];
  $("prompt").textContent = prompts[st[1]];
  $("prompt").hidden = !st[1];
  const p = $("panel");
  p.hidden = !st[2];
  if (st[2] === 1) {
    p.innerHTML = `<h2>성간 통행증 · ${NAMES[st[5]]}</h2>검사일(오늘) <b>${day(st[3])}</b> · 마지막 사용일 <b>${day(st[4])}</b>
      <div class="faces"><div id="f0">통행증 사진</div><div id="f1">지금 운전석의 얼굴</div></div>
      <div class="keys">R 진료 기록 조회 · Q 하차 요청 · E 닫기</div>`;
    $("f0").prepend(faceCanvas(0));
    $("f1").prepend(faceCanvas(1));
  } else if (st[2] === 2) {
    p.innerHTML = `<h2>진료 기록 조회</h2>${st[6] < 0 ? "조회된 진료 기록이 없습니다." : `이름 <b>${NAMES[st[6]]}</b> · 내용 <b>${CHANGE[st[7]]}</b>`}
      <p>기록의 이름이 이 운전기사(${NAMES[st[5]]})와 같고, 내용이 사진과 달라진 점과 같아야 설명이 됩니다.</p><div class="keys">E 통행증으로 돌아가기</div>`;
  } else if (st[2] === 3) {
    p.innerHTML = `<h2>몸수색 결과</h2>${st[8] === 1 ? `위험 화물 허가증 발견 · 이름 <b>${NAMES[st[11]]}</b> · 허가 화물 <b>${CARGO[st[9]]}</b> · 기한 <b>${day(st[10])}</b>` : "허가증이 없습니다."}
      <p>유효한 허가증: 이름이 운전기사(${NAMES[st[5]]})와 같고, 화물이 실물과 같고, 기한이 오늘(${day(st[3])}) 이후.</p><div class="keys">E 닫기</div>`;
  } else if (st[2] === 4) {
    const ai = st[39] ? `<p>AI 스캐너의 예측: <b>${st[39] === 1 ? "통과" : "보류"}</b> (내가 가르친 대로 말합니다. 틀릴 수 있어요.)</p>` : `<p>AI 스캐너는 아직 배우지 않았습니다. 판정을 2건 한 뒤 AI 감식대에서 가르칠 수 있어요.</p>`;
    p.innerHTML = `<h2>판정</h2>통행증·얼굴·실제 화물·허가증으로 판정합니다.${RULES}${ai}
      <div class="btns"><button data-code="Digit1">1 통과</button><button data-code="Digit2">2 보류</button><button data-code="KeyE">E 취소</button></div>`;
  } else if (st[2] === 5) {
    p.innerHTML = `<h2>검문 규칙</h2>${RULES}<div class="keys">H 닫기</div>`;
  }
  else if (st[2] === 6) {
    const n = st[34], sc = { n: st[37], ok: st[38] & 255, wp: (st[38] >> 8) & 255, wh: (st[38] >> 16) & 255 };
    const rule = st[36] ? new TextDecoder().decode(new Uint8Array(mem(), ex.og_text_ptr(), ex.og_text_len())) : "";
    p.innerHTML = `<h2>AI 감식대</h2>내가 판정한 사례 <b>${n}건</b>이 AI의 예시가 됩니다. 어떤 단서로 배우게 할지 고르세요.
      <div class="btns">${CUES.map((c, i) => `<button data-cue="${i}" class="${(st[35] >> i) & 1 ? "on" : ""}">${i + 1} ${c}</button>`).join("")}</div>
      <div class="btns"><button data-do="train" ${n < 2 || !st[35] ? "disabled" : ""}>T 학습하고 새 수송대로 시험</button><button data-code="KeyE">E 닫기</button></div>
      ${n < 2 ? "<p>사례가 2건 이상 있어야 학습할 수 있어요. 트럭을 더 판정하고 오세요.</p>" : ""}
      ${sc.n ? `<p>처음 보는 수송대 ${sc.n}대 시험: 맞음 <b>${sc.ok}</b> · 잘못 통과 <b>${sc.wp}</b> · 잘못 보류 <b>${sc.wh}</b><br>새 수송대에는 처음 보는 색의 화물이 섞여 있습니다. 단서를 바꿔 다시 학습해 비교해 보세요.</p><pre>${rule}</pre>` : ""}`;
  } else if (st[2] === 7) {
    lastShift = { total: st[40], correct: st[41] };
    p.innerHTML = `<h2>근무 종료</h2>판정 <b>${st[40]}건</b> 중 <b>${st[41]}건</b> 정확 · 보호막 ${Math.max(0, st[15])}개 남음
      <p>결과표를 저장해 선생님께 내세요. 이름(별명)은 이 기기 안에서만 쓰이고 어디에도 보내지지 않습니다.</p>
      <input id="nick" maxlength="12" placeholder="이름 또는 별명" />
      <div class="btns"><button data-do="png">결과표 PNG 저장</button><button data-do="pdf">PDF로 저장(인쇄)</button><button data-code="KeyE">E 다음 근무</button></div>`;
  }
  const t = $("toast");
  t.hidden = !st[12];
  if (st[12]) {
    t.className = "box " + (st[12] === 1 ? "ok" : "bad");
    t.innerHTML = `${st[12] === 1 ? "정확한 판정! 크레딧 +10" : "잘못된 판정 · 보호막 −1"}<br>내 판정: <b>${st[14] === 1 ? "통과" : "보류"}</b> · ${REASON[st[13]]}`;
  }
}

// ---- result sheet: drawn on a canvas in this browser, never uploaded ----
let lastShift = { total: 0, correct: 0 };
function sheet() {
  const st = window.__og.state();
  const shift = st[40] ? { total: st[40], correct: st[41] } : lastShift;
  const model = { n: st[37], ok: st[38] & 255, wp: (st[38] >> 8) & 255, wh: (st[38] >> 16) & 255 };
  const points = Math.round((shift.total ? shift.correct / shift.total : 0) * 60 + (model.n ? model.ok / model.n : 0) * 40);
  const grade = points >= 90 ? "은하 수호 레인저 ★★★★★" : points >= 75 ? "베테랑 레인저 ★★★★" : points >= 55 ? "정식 레인저 ★★★" : points >= 35 ? "수습 레인저 ★★" : "신입 레인저 ★";
  const nick = ($("nick")?.value || "").trim() || "이름 없는 레인저";
  const cues = CUES.filter((_, i) => (st[35] >> i) & 1).join(", ") || "고르지 않음";
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 800;
  const g = c.getContext("2d");
  const font = (px, w = 700) => (g.font = `${w} ${px}px "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif`);
  g.fillStyle = "#23254d"; g.fillRect(0, 0, 1200, 800);
  for (let i = 0; i < 140; i++) { g.fillStyle = i % 3 ? "#ffffff55" : "#ffffffcc"; g.fillRect((i * 733) % 1200, (i * 397) % 800, 4, 4); }
  g.fillStyle = "#1b1f3b"; g.fillRect(60, 60, 1080, 680);
  g.strokeStyle = "#7df9ff"; g.lineWidth = 8; g.strokeRect(60, 60, 1080, 680);
  g.strokeStyle = "#ffc93c"; g.lineWidth = 4; g.strokeRect(80, 80, 1040, 640);
  g.fillStyle = "#ffc93c"; font(34); g.fillText("오르빗 게이트 · 제7 우주항", 120, 150);
  g.fillStyle = "#ffffff"; font(64); g.fillText("우주 레인저 등급", 120, 235);
  g.fillStyle = "#7df9ff"; font(52); g.fillText(grade, 120, 325);
  g.fillStyle = "#ffffff"; font(40); g.fillText(nick, 120, 400);
  font(30, 600);
  const lines = [
    `검문 판정: ${shift.total}건 중 ${shift.correct}건 정확`,
    model.n ? `내가 가르친 AI 스캐너: 새 수송대 ${model.n}대 중 ${model.ok}대 맞음 (잘못 통과 ${model.wp}, 잘못 보류 ${model.wh})` : "AI 스캐너: 아직 가르치지 않음",
    `AI에게 준 단서: ${cues}`,
    `점수 ${points}점 · ${new Date().toLocaleDateString("ko-KR")}`,
  ];
  lines.forEach((t, i) => g.fillText(t, 120, 475 + i * 52));
  g.fillStyle = "#c9d2ff"; font(22, 500); g.fillText("6학년 실과 「인공지능이 만들어지는 과정」 · 이 결과표는 이 기기에서만 만들어졌습니다.", 120, 695);
  return c;
}
function savePng() {
  sheet().toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "orbit-gate-ranger.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}
function savePdf() {
  $("sheet").src = sheet().toDataURL("image/png");
  $("sheet").onload = () => print(); // the browser's print dialog saves as PDF
}
window.__og_sheet = () => sheet().toDataURL("image/png").length;
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.code) press(b.dataset.code);
  else if (b.dataset.cue) ex.og_ml(0, Number(b.dataset.cue));
  else if (b.dataset.do === "train") ex.og_ml(1, 0);
  else if (b.dataset.do === "png") savePng();
  else if (b.dataset.do === "pdf") savePdf();
  else if (b.dataset.do === "start") start();
  else if (b.dataset.do === "qrclose") { $("qr").hidden = true; history.replaceState(null, "", location.pathname + location.search); }
  b.blur();
});

// ---- start screen: how to play and the hazard picture guide ----
function start() {
  started = true;
  $("start").hidden = true;
  canvas.focus();
}
["급식 도시락 (안전)", "핵폭탄 (위험)", "괴물 알 (위험)"].forEach((name, kind) => {
  const c = document.createElement("canvas");
  c.width = c.height = 72;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(mem().slice(ex.og_guide_ptr(kind), ex.og_guide_ptr(kind) + 72 * 72 * 4)), 72, 72), 0, 0);
  const f = document.createElement("figure");
  f.append(c, Object.assign(document.createElement("figcaption"), { textContent: name }));
  $("guide").append(f);
});
$("notyet").textContent = NOT_YET;
// "#teacher" on the student address shows the big entry QR (the link teachers already have)
function qr() {
  $("qr").hidden = location.hash !== "#teacher";
  $("qrurl").textContent = new URL("./", location.href).href;
}
addEventListener("hashchange", qr);
qr();
if (qs.has("bench") || qs.has("skip")) start();

// ---- frame loop and measurement ----
const benchFrames = qs.has("bench") ? Number(qs.get("frames") || 600) : 0;
let last = 0, frame = 0, benchDone = false;
const dbg = gl.getExtension("WEBGL_debug_renderer_info");
window.__og = { ready: false, bench: null, state: () => Array.from(new Int32Array(mem(), ex.og_state_ptr(), 48)) };

function tick(now) {
  const dt = last ? (now - last) / 1000 : 1 / 60;
  last = now;
  resize();
  const c0 = performance.now();
  ex.og_frame(dt, lw, lh);
  render();
  if (benchFrames) gl.finish();
  const cpu = performance.now() - c0;
  frame++;
  if (benchFrames && !benchDone) {
    if (frame === 60) ex.og_bench();
    else if (frame > 60) ex.og_sample(dt * 1000, cpu);
    if (frame === 60 + benchFrames) {
      benchDone = true;
      const r = new Float32Array(mem(), ex.og_report(), 14);
      const st = window.__og.state();
      const f = (x) => Math.round(x * 100) / 100;
      window.__og.bench = {
        frames: r[0], frame_ms: { p50: f(r[1]), p95: f(r[2]), p99: f(r[3]), max: f(r[4]) },
        over_16_9ms_pct: f(r[5]), over_33_4ms_pct: f(r[6]),
        work_ms: { p50: f(r[7]), p95: f(r[8]), max: f(r[9]) },
        label_px: { smooth_max: Math.round(r[10] * 1000) / 1000, grid_max: f(r[11]), lock_max: Math.round(r[12] * 100000) / 100000, frames: r[13] },
        scene: { draw_calls: st[29], triangles: st[30], lowres: [lw, lh], canvas: [canvas.width, canvas.height], css_px_per_pixel: S },
        env: { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?", cores: navigator.hardwareConcurrency, dpr: devicePixelRatio, ua: navigator.userAgent },
      };
      $("bench").hidden = false;
      $("bench").textContent = JSON.stringify(window.__og.bench, null, 1);
    }
  }
  ui(window.__og.state());
  window.__og.ready = true;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
