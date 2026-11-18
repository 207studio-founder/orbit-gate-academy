// Browser glue for Orbit Gate. All game logic lives in orbit_gate.wasm (Rust);
// this file forwards input, issues the WebGL calls for the draw list the core
// returns, and shows the panels. It keeps no game state of its own.
const qs = new URLSearchParams(location.search);
const S = 3; // CSS pixels per low-res pixel: one pixel scale for the whole world
const NAMES = ["모루", "핀토", "라케", "수벨", "도라미", "키오"];
const CARGO = ["학교 급식", "핵폭탄", "괴물 알", "축제 음료", "도서관 책", "씨앗 화분"];
const CHANGE = { 1: "머리 염색", 2: "안경 착용", 3: "흉터 치료" };
const LABELS = ["운전석", "화물칸 1", "판정 레버", "운전기사", "AI 감식대", "포획 대상", "표본 관찰대", "비교 시험대", "우주항 사무소", "관제탑"];
const CUES = ["날짜", "얼굴", "화물 모양", "화물 색", "무늬 색", "비율", "허가증", "트럭 번호(통째로 외우기)"];
const NOT_YET = "알아 둘 것: 진행 상황(주기·크레딧·우주항·AI 예시)은 이 브라우저에만 저장됩니다. 하던 근무는 저장되지 않고 그 주기의 첫 트럭부터 다시 합니다. 소리는 간단한 효과음만 있습니다(왼쪽 아래에서 끌 수 있어요).";
// Ranger look: part names and choice names, in the order the core numbers them.
const LOOK = [
  ["체형", ["기본", "큰 머리", "긴 다리"]],
  ["머리 모양", ["삐죽 머리", "양갈래", "포니테일", "뾰족 머리", "단발", "동글 번"]],
  ["표정", ["차분", "방긋", "윙크", "씩씩", "졸림"]],
  ["머리 색", ["밤색", "밀색", "노랑", "분홍", "보라", "먹색"]],
  ["제복 색", ["파랑", "분홍", "주황", "보라"]],
];
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
  "화물칸에 살아 있는 괴물이 있었습니다. 살아 있는 괴물은 무조건 보류입니다.",
  "닮았지만 사진 속 사람이 아닙니다. 눈 모양·점·피부색은 치료로 바뀌지 않습니다.",
  "운전기사가 몸수색 뒤 도망쳤습니다.",
];
const EVENT = [
  "",
  "포획 성공! 운전기사를 그물로 잡았습니다 · 크레딧 +15",
  "빗나감! 그물이 빈 바닥에 떨어졌습니다",
  "운전기사를 놓쳤습니다 · 보호막 −1",
  "괴물이 화물칸에서 튀어나왔습니다! 마우스로 겨누고 클릭(또는 F)해 그물을 쏘세요",
  "괴물에게 물렸습니다 · 보호막 −1",
  "포획 성공! 괴물을 그물로 잡았습니다 · 크레딧 +15",
  "순찰대가 괴물을 데려갔습니다",
  "뇌물을 거절했습니다 · 청렴 보너스 +5",
  "뇌물을 받고 통과시켰습니다 · 받은 돈은 몰수",
  "전기 울타리가 도주자를 붙잡아 두고 있습니다! 지금 겨누세요",
  "자동 방어 장치가 그물을 쏘았습니다",
  "급식 배달 성공! 필터가 그 급식 차를 통과시킵니다 · 크레딧 +40",
  "구입 완료! 우주항이 바로 바뀌었습니다",
  "살 수 없습니다 (크레딧이 모자라거나 조건이 안 됨)",
  "자동 차선에서 잘못 통과시킨 차가 있어 자동 차선 수입에서 벌금이 나갔습니다. 관제탑에서 놓친 단서를 확인하세요",
  "급식 배달 의뢰: 문제 없는 급식 차가 보류됐습니다. 관제탑에서 원인을 확인하세요",
  "체제 전환: 이번 여행자 무리에 맞춰 둔 모델로 필터가 바뀌었습니다",
  "우주 레인저 정식 허가증이 발급되었습니다!",
  "접수 확인 완료! 무한 모드가 열렸습니다",
  "접수 코드가 맞지 않습니다. 선생님께 다시 확인하세요",
  "우주 콘도 회원이 되었습니다! 축하합니다!",
];
const GROUP = ["일반 화물단", "급식 배송단", "의료 귀환단", "연구 표본 수송단"];
const RULES = `<ul>
<li><b>통행증</b>: 오늘이 마지막 사용일보다 늦으면 보류.</li>
<li><b>얼굴</b>: 사진과 다르면 진료 기록 조회(R). 기록의 이름이 운전기사와 같고, 달라진 점이 기록과 같으면 설명됨.</li>
<li><b>닮은 얼굴</b>: 머리 색·안경·흉터는 치료로 바뀔 수 있지만 <b>눈 모양·점의 위치·피부색</b>은 바뀌지 않는다. 이것이 다르면 다른 사람이므로 기록이 있어도 보류.</li>
<li><b>화물</b>: 핵폭탄·괴물 알은 위험 화물. 운전기사를 내리게 하고(Q) 몸수색으로 허가증을 찾는다.</li>
<li><b>허가증</b>: 이름이 운전기사와 같고, 화물 종류가 실물과 같고, 기한이 오늘 이후여야 유효.</li>
<li><b>살아 있는 괴물</b>: 화물칸에서 살아 움직이는 괴물이 나오면 그 자리에서 <b>자동 보류</b>. 괴물 알(위험 화물, 허가증이 있으면 통과)과는 다른 일이다.</li>
<li><b>도주</b>: 몸수색에서 허가증이 안 나온 운전기사가 달아나면 트럭은 자동 보류. 달아나는 운전기사와 튀어나온 괴물은 <b>마우스로 겨누고 클릭</b>(또는 F)해 그물로 잡는다. 놓치거나 물리면 보호막 −1.</li>
<li><b>뇌물</b>: 받으면 그 트럭을 통과시킨 것으로 채점되고 돈은 몰수된다. 거절하고 바르게 판정하면 보너스 +5.</li>
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
  PREC + "uniform sampler2D x; uniform float o; varying vec2 v; varying float k; void main(){ vec4 c=texture2D(x,v); if(c.a<0.5) discard; gl_FragColor=vec4(c.rgb*k,o); }",
  ["p", "t", "s"],
);
const quadProg = program(
  "attribute vec2 a; uniform vec4 r; varying vec2 v; void main(){ v=a; gl_Position=vec4(r.xy+a*r.zw,0.0,1.0); }",
  PREC + "uniform sampler2D x; varying vec2 v; void main(){ gl_FragColor=texture2D(x,v); }",
  ["a"],
);
// Inked silhouettes (art direction A): the world pass writes an object id into
// alpha; this low-res pass inks every pixel whose neighbour belongs to something else.
const inkProg = program(
  "attribute vec2 a; varying vec2 v; void main(){ v=a; gl_Position=vec4(a*2.0-1.0,0.0,1.0); }",
  PREC + "uniform sampler2D x; uniform vec2 d; uniform vec3 ink; varying vec2 v; void main(){ vec4 c=texture2D(x,v); float e=0.0;" +
    " if(c.a>0.004){ e=step(0.004,abs(texture2D(x,v+vec2(d.x,0.0)).a-c.a))+step(0.004,abs(texture2D(x,v-vec2(d.x,0.0)).a-c.a))+step(0.004,abs(texture2D(x,v+vec2(0.0,d.y)).a-c.a))+step(0.004,abs(texture2D(x,v-vec2(0.0,d.y)).a-c.a)); }" +
    " gl_FragColor=vec4(e>0.0?ink:c.rgb,1.0); }",
  ["a"],
);
const uInkD = gl.getUniformLocation(inkProg, "d"), uInkC = gl.getUniformLocation(inkProg, "ink");
const uO = gl.getUniformLocation(stackProg, "o");
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
ex.og_seed(crypto.getRandomValues(new Uint32Array(1))[0]); // only for the permit number

const meshes = [];
// (Re)upload mesh i from the core; called again for the ranger when the look changes.
function upload(i) {
  const old = meshes[i];
  if (old) gl.deleteTexture(old.tex);
  const vbo = old ? old.vbo : gl.createBuffer();
  const len = ex.og_mesh_len(i);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mem(), ex.og_mesh_ptr(i), len), gl.STATIC_DRAW);
  const [w, h] = [ex.og_tex_w(i), ex.og_tex_h(i)];
  meshes[i] = { vbo, n: len / 6, ink: ex.og_mesh_ink(i), tex: texture(w, h, new Uint8Array(mem(), ex.og_tex_ptr(i), w * h * 4)) };
}
for (let i = 0; i < ex.og_mesh_count(); i++) upload(i);

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

let lw = 0, lh = 0, fbo = null, fboTex = null, fboDepth = null, fbo2 = null, fbo2Tex = null;
function resize() {
  const w = Math.max(160, Math.floor(innerWidth / S)), h = Math.max(90, Math.floor(innerHeight / S));
  if (w === lw && h === lh) return;
  [lw, lh] = [w, h];
  canvas.width = lw * S;
  canvas.height = lh * S;
  canvas.style.width = lw * S + "px";
  canvas.style.height = lh * S + "px";
  if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteTexture(fboTex); gl.deleteRenderbuffer(fboDepth); gl.deleteFramebuffer(fbo2); gl.deleteTexture(fbo2Tex); }
  fbo2Tex = texture(lw, lh, null);
  fbo2 = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo2);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbo2Tex, 0);
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
const ink = ex.og_ink() >= 0 && !qs.has("noink") ? rgb(ex.og_ink()) : null;

function render() {
  // 1. world -> low-res target
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, lw, lh);
  gl.disable(gl.BLEND);
  gl.enable(gl.SCISSOR_TEST);
  for (let i = 0; i < 6; i++) {
    const t = i / 5, y0 = Math.round(lh * (1 - (i + 1) / 6)), y1 = Math.round(lh * (1 - i / 6));
    gl.scissor(0, y0, lw, y1 - y0);
    gl.clearColor(bgTop[0] + (bgBot[0] - bgTop[0]) * t, bgTop[1] + (bgBot[1] - bgTop[1]) * t, bgTop[2] + (bgBot[2] - bgTop[2]) * t, 0);
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
    gl.uniform1f(uO, m.ink ? (i / 17 + 1) / 32 : 0); // the deck and the blob shadows are never inked
    gl.drawArrays(gl.TRIANGLES, 0, m.n);
  }
  // 2. ink pass at low resolution, then low-res -> screen, nearest neighbour
  gl.disable(gl.DEPTH_TEST);
  gl.disableVertexAttribArray(1);
  gl.disableVertexAttribArray(2);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  if (ink) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo2);
    gl.useProgram(inkProg);
    gl.uniform2f(uInkD, 1 / lw, 1 / lh);
    gl.uniform3f(uInkC, ink[0], ink[1], ink[2]);
    gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(quadProg);
  gl.bindTexture(gl.TEXTURE_2D, ink ? fbo2Tex : fboTex);
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
// the pointer's place (in low-res pixels) is where the net is aimed
canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); ex.og_aim(e.clientX / S, e.clientY / S); ex.og_pointer(0, e.clientX, e.clientY); });
canvas.addEventListener("pointermove", (e) => { ex.og_aim(e.clientX / S, e.clientY / S); ex.og_pointer(1, e.clientX, e.clientY); });
canvas.addEventListener("pointerup", (e) => ex.og_pointer(2, e.clientX, e.clientY));
canvas.addEventListener("pointercancel", () => ex.og_blur());
canvas.addEventListener("wheel", (e) => { e.preventDefault(); ex.og_wheel(e.deltaY); }, { passive: false });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ---- panels (DOM, rebuilt only when the state they show changes) ----
let uiKey = "", portBuilt = 0, nick = "";
function faceCanvas(which) {
  const c = document.createElement("canvas");
  c.width = c.height = 24;
  const img = new ImageData(new Uint8ClampedArray(mem().slice(ex.og_face_ptr(which), ex.og_face_ptr(which) + 24 * 24 * 4)), 24, 24);
  c.getContext("2d").putImageData(img, 0, 0);
  return c;
}
function ui(st) {
  const key = [1, 2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 24, 31, 34, 35, 36, 37, 38, 39, 40, 41, 46, 52, 53, 60, 65, 67, 72, 76, 82, 85].map((i) => st[i]).join(",");
  if (st[82] !== portBuilt) { portBuilt = st[82]; upload(ex.og_port_mesh()); }
  if (key === uiKey) return false;
  uiKey = key;
  $("hud").innerHTML = `보호막 ${"♥".repeat(Math.max(0, st[15]))}${"♡".repeat(Math.max(0, 3 - st[15]))} · 크레딧 <b>${st[16]}</b> · 오늘 <b>${day(st[3])}</b> · ${st[46]}주기 트럭 ${st[17] + 1}/${st[48]}${st[47] ? " · 연습" : ""}${st[85] ? " · 무한 모드" : ""}<button data-do="look">꾸미기</button><br>지금 <b>${GROUP[st[76]]}</b> · 다음 ${GROUP[st[77]]} · 차선 ${st[67]} · 감시탑 ${st[72]}${st[81] ? " · <b>급식 배달 의뢰</b>" : ""}`;
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
    "E AI 감식대 (모델 학습)",
    "E 표본 관찰대 (표본에 라벨 붙이기)",
    "E 비교 시험대 (모델 여럿을 같은 수송대로 시험)",
    "E 우주항 사무소 (차선·감시탑·장비)",
    "E 관제탑 (다음 여행자 무리와 필터)",
  ];
  $("prompt").textContent = prompts[st[1]];
  $("prompt").hidden = !st[1];
  const p = $("panel");
  p.hidden = !st[2];
  p.className = "box";
  if (st[2] === 1) {
    p.innerHTML = `<h2>성간 통행증 · ${NAMES[st[5]]}</h2>검사일(오늘) <b>${day(st[3])}</b> · 마지막 사용일 <b>${day(st[4])}</b>
      <div class="faces"><div id="f0">통행증 사진</div><div id="f1">지금 운전석의 얼굴</div></div>
      ${st[53] ? `<p class="bribe">${NAMES[st[5]]}: “${st[53]}크레딧 드릴게요. 그냥 보내 주시면 안 될까요…”</p>` : ""}
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
    const bribe = st[53] ? `<p class="bribe">${NAMES[st[5]]}: “${st[53]}크레딧 드릴게요. 그냥 보내 주세요…” (받으면 통과로 채점되고 돈은 몰수됩니다.)</p>` : "";
    p.innerHTML = `<h2>판정</h2>통행증·얼굴·실제 화물·허가증으로 판정합니다.${RULES}${ai}${bribe}
      <div class="btns"><button data-code="Digit1">1 통과</button><button data-code="Digit2">2 보류</button>${st[53] ? `<button data-code="Digit3">3 뇌물 받고 통과</button>` : ""}<button data-code="KeyE">E 취소</button></div>`;
  } else if (st[2] === 5) {
    p.innerHTML = `<h2>검문 규칙</h2>${RULES}<div class="keys">H 닫기</div>`;
  }
  else if (st[2] >= 6) {
    renderDoc(p);
  }
  const ev = $("event");
  ev.hidden = !st[52];
  if (st[52]) {
    ev.className = "box " + ([3, 5, 9, 15, 20].includes(st[52]) ? "bad" : [2, 4, 10, 14, 16].includes(st[52]) ? "warn" : "ok");
    ev.textContent = EVENT[st[52]];
  }
  const t = $("toast");
  t.hidden = !st[12];
  if (st[12]) {
    t.className = "box " + (st[12] === 2 ? "bad" : "ok");
    t.innerHTML = st[12] === 3
      ? `자동 보류! 크레딧 +10<br>${REASON[st[13]]}${st[13] === 11 ? " 마우스로 겨누고 클릭해 그물로 잡으세요!" : ""}`
      : `${st[12] === 1 ? "정확한 판정! 크레딧 +10" : "잘못된 판정 · 보호막 −1"}<br>내 판정: <b>${st[14] === 1 ? "통과" : "보류"}</b> · ${REASON[st[13]]}`;
  }
}

// Station panels are written by the core as plain lines (see src/ui.rs); this only lays them out.
// Every button sends a key code, so each panel works the same from the keyboard.
function renderDoc(p) {
  const text = new TextDecoder().decode(new Uint8Array(mem(), ex.og_doc_ptr(), ex.og_doc_len()));
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  let html = "", mode = "";
  const close = () => { if (mode) html += { btn: "</div>", tab: "</table>", pre: "</pre>" }[mode]; mode = ""; };
  const open = (m, tag) => { if (mode !== m) { close(); html += tag; mode = m; } };
  p.className = "box doc";
  for (const line of text.split("\n")) {
    if (!line) continue;
    if (line === "@side") p.classList.add("side");
    else if (line.startsWith("# ")) { close(); html += `<h2>${esc(line.slice(2))}</h2>`; }
    else if (line[0] === "[") {
      const [code, label, flag] = line.slice(1, -1).split("|");
      open("btn", '<div class="btns">');
      html += `<button data-code="${code}" class="${flag === "on" ? "on" : ""}" ${flag === "off" ? "disabled" : ""}>${esc(label)}</button>`;
    } else if (line[0] === "|") {
      open("tab", "<table>");
      html += "<tr>" + line.split("|").slice(1, -1).map((c) => `<td>${esc(c.trim())}</td>`).join("") + "</tr>";
    } else if (line.startsWith("> ")) { open("pre", "<pre>"); html += esc(line.slice(2)) + "\n"; }
    else if (line === "<nick>") { close(); html += '<input id="nick" maxlength="12" placeholder="이름 또는 별명" />'; }
    else if (line[0] === "{") { const [act, label] = line.slice(1, -1).split("|"); open("btn", '<div class="btns">'); html += `<button data-do="${act}">${esc(label)}</button>`; }
    else { close(); html += `<p>${esc(line)}</p>`; }
  }
  close();
  p.innerHTML = html;
  // the name box survives the panel being redrawn; the name never leaves this page
  if ($("nick")) { $("nick").value = nick; $("nick").oninput = (e) => (nick = e.target.value); }
}

// ---- result sheet: drawn on a canvas in this browser, never uploaded ----
function sheet() {
  const st = window.__og.state();
  const shift = st[40] ? { total: st[40], correct: st[41] } : { total: st[89], correct: st[90] };
  const model = { n: st[37], ok: st[38] & 255, wp: (st[38] >> 8) & 255, wh: (st[38] >> 16) & 255 };
  const points = Math.round((shift.total ? shift.correct / shift.total : 0) * 60 + (model.n ? model.ok / model.n : 0) * 40);
  const grade = points >= 90 ? "은하 수호 레인저 ★★★★★" : points >= 75 ? "베테랑 레인저 ★★★★" : points >= 55 ? "정식 레인저 ★★★" : points >= 35 ? "수습 레인저 ★★" : "신입 레인저 ★";
  const name = nick.trim() || "이름 없는 레인저";
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
  g.fillStyle = "#ffffff"; font(40); g.fillText(name, 120, 400);
  font(30, 600);
  const lines = [
    `검문 판정: ${shift.total}건 중 ${shift.correct}건 정확`,
    model.n ? `내가 가르친 AI 스캐너: 새 수송대 ${model.n}대 중 ${model.ok}대 맞음 (잘못 통과 ${model.wp}, 잘못 보류 ${model.wh})` : "AI 스캐너: 아직 가르치지 않음",
    `AI에게 준 단서: ${cues}`,
    `점수 ${points}점 · ${new Date().toLocaleDateString("ko-KR")}`,
  ];
  lines.forEach((t, i) => g.fillText(t, 120, 475 + i * 52));
  // the student's own ranger, as chosen, in whole pixels
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#23254d"; g.fillRect(868, 118, 232, 232);
  g.drawImage($("lookpic"), 872, 122, 224, 224);
  g.strokeStyle = "#f4f6ff"; g.lineWidth = 4; g.strokeRect(868, 118, 232, 232);
  g.fillStyle = "#c9d2ff"; font(22, 500); g.fillText("6학년 실과 「인공지능이 만들어지는 과정」 · 이 결과표는 이 기기에서만 만들어졌습니다.", 120, 695);
  return c;
}
// The formal permit (cycle five): a different document from the grade sheet, with the number the teacher checks.
function permitSheet() {
  const st = window.__og.state();
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 800;
  const g = c.getContext("2d");
  const font = (px, w = 700) => (g.font = `${w} ${px}px "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif`);
  g.fillStyle = "#fff6dc"; g.fillRect(0, 0, 1200, 800);
  g.strokeStyle = "#b8862b"; g.lineWidth = 14; g.strokeRect(34, 34, 1132, 732);
  g.strokeStyle = "#23254d"; g.lineWidth = 4; g.strokeRect(56, 56, 1088, 688);
  g.fillStyle = "#23254d"; font(30); g.fillText("오르빗 게이트 · 제7 우주항 관리국", 100, 130);
  font(74); g.fillText("우주 레인저 정식 허가증", 100, 225);
  g.fillStyle = "#b8862b"; font(44); g.fillText(`허가증 번호  ${st[84]}`, 100, 305);
  g.fillStyle = "#23254d"; font(46); g.fillText(nick.trim() || "이름 없는 레인저", 100, 390);
  font(28, 600);
  const model = { n: st[37], ok: st[38] & 255 };
  [
    `위 레인저는 검문 근무 5주기를 모두 마쳤음을 증명합니다.`,
    `포획 ${st[58]}건 · 뇌물 거절 ${st[64]}건 · 급식 배달 의뢰 해결 ${st[93]}건`,
    model.n ? `직접 가르친 AI 모델 ${st[68]}개 · 검문소 모델: 새 수송대 ${model.n}대 중 ${model.ok}대 맞음` : `AI 모델: 아직 가르치지 않음`,
    `영업 차선 ${st[67]}개 · AI 감시탑 ${st[72]}기 · 발급일 ${new Date().toLocaleDateString("ko-KR")}`,
  ].forEach((t, i) => g.fillText(t, 100, 460 + i * 50));
  g.fillStyle = "#6b5a2a"; font(22, 500);
  g.fillText("선생님께: 교사용 화면에 허가증 번호를 넣으면 접수 코드 4자리가 나옵니다. 학생이 그 코드를 넣으면 무한 모드가 열립니다.", 100, 690);
  g.fillText("이 허가증은 이 기기에서만 만들어졌고, 번호에는 이름이 들어 있지 않습니다.", 100, 722);
  g.imageSmoothingEnabled = false;
  g.drawImage($("lookpic"), 900, 110, 200, 200);
  g.strokeStyle = "#c0392b"; g.lineWidth = 6; g.beginPath(); g.arc(1000, 470, 70, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#c0392b"; font(30); g.fillText("제7우주항", 932, 462); g.fillText("관리국", 955, 500);
  return c;
}
window.__og_permit = () => permitSheet().toDataURL("image/png").length;
function savePng(make = sheet, file = "orbit-gate-ranger.png") {
  make().toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}
function savePdf(make = sheet) {
  $("sheet").src = make().toDataURL("image/png");
  $("sheet").onload = () => print(); // the browser's print dialog saves as PDF
}
window.__og_sheet = () => sheet().toDataURL("image/png").length;
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.code) press(b.dataset.code);
  else if (b.dataset.do === "png") savePng();
  else if (b.dataset.do === "pdf") savePdf();
  else if (b.dataset.do === "permitpng") savePng(permitSheet, "orbit-gate-permit.png");
  else if (b.dataset.do === "permitpdf") savePdf(permitSheet);
  else if (b.dataset.do === "start") start();
  else if (b.dataset.do === "fresh") { try { localStorage.removeItem("og-save"); } catch {} location.reload(); }
  else if (b.dataset.do === "mute") { muted = !muted; b.textContent = muted ? "소리 켜기" : "소리 끄기"; }
  else if (b.dataset.do === "look") { $("lookbox").hidden = false; $("lookslot2").append($("look")); }
  else if (b.dataset.do === "lookclose") { $("lookbox").hidden = true; $("lookslot").append($("look")); }
  else if (b.dataset.look) { const [part, step] = b.dataset.look.split(",").map(Number); setLook(part, lookParts()[part] + step); }
  else if (b.dataset.do === "qrclose") { $("qr").hidden = true; history.replaceState(null, "", location.pathname + location.search); }
  b.blur();
});

// ---- sounds: made here in code (WebAudio), no files. Nothing plays before the student starts. ----
let audio = null, muted = false;
function tone(freq, dur, type = "square", vol = 0.05, slide = 0) {
  if (!audio || muted) return;
  try {
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {}
}
const snd = { net: 0, ev: 0, res: 0, bay: false };
function sounds(st) {
  if (st[54] === 1 && snd.net !== 1) tone(700, 0.18, "sawtooth", 0.04, -450); // net fired
  snd.net = st[54];
  if (st[60] !== snd.ev) {
    snd.ev = st[60];
    const e = st[52];
    if ([1, 6, 8, 12, 13, 17, 18, 19, 21].includes(e)) { tone(660, 0.1); setTimeout(() => tone(990, 0.16), 90); } // capture, success
    else if (e === 2) tone(180, 0.2, "triangle"); // miss
    else if ([3, 5, 9, 15, 20].includes(e)) tone(140, 0.35, "sawtooth", 0.05, -60); // loss
    else if ([4, 10, 16].includes(e)) { tone(880, 0.12); setTimeout(() => tone(660, 0.12), 140); setTimeout(() => tone(880, 0.12), 280); } // alarm
  }
  if (st[12] !== snd.res) { snd.res = st[12]; if (st[12] === 1 || st[12] === 3) tone(784, 0.15); else if (st[12] === 2) tone(120, 0.4, "sawtooth"); }
  const bay = st[19] > 0 && st[19] < 100; // the bay shutter moving
  if (bay && !snd.bay) tone(90, 0.5, "triangle", 0.06, 60);
  snd.bay = bay;
}

// ---- start screen: how to play and the hazard picture guide ----
function start() {
  started = true;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  $("start").hidden = true;
  canvas.focus();
}
// safe kinds first, then the two hazardous ones; `kind` is the core's cargo number
[["급식 도시락", 0], ["축제 음료", 3], ["도서관 책", 4], ["씨앗 화분", 5], ["핵폭탄 (위험)", 1], ["괴물 알 (위험)", 2]].forEach(([name, kind]) => {
  const c = document.createElement("canvas");
  c.width = c.height = 72;
  c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(mem().slice(ex.og_guide_ptr(kind), ex.og_guide_ptr(kind) + 72 * 72 * 4)), 72, 72), 0, 0);
  const f = document.createElement("figure");
  if (kind === 1 || kind === 2) f.className = "haz";
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

// ---- ranger look: chosen on the start screen, kept only in this browser ----
const lookParts = () => LOOK.map((_, i) => (ex.og_look(-1, 0) >> (4 * i)) & 15);
function setLook(part, value, save = true) {
  ex.og_look(part, value);
  for (let i = 0; i < ex.og_ranger_count(); i++) upload(ex.og_ranger_first() + i);
  const parts = lookParts();
  LOOK.forEach(([, names], i) => ($("lk" + i).textContent = names[parts[i]]));
  const at = ex.og_look_pic();
  $("lookpic").getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(mem().slice(at, at + 96 * 96 * 4)), 96, 96), 0, 0);
  if (save) try { localStorage.setItem("og-look", parts.join(",")); } catch {}
}
$("lookopts").innerHTML = LOOK.map(([name], i) => `<div><span>${name}</span><button data-look="${i},-1" aria-label="${name} 이전">◀</button><b id="lk${i}"></b><button data-look="${i},1" aria-label="${name} 다음">▶</button></div>`).join("");
{
  let saved = [];
  try { saved = (localStorage.getItem("og-look") || "").split(",").map(Number); } catch {}
  LOOK.forEach((_, i) => setLook(i, Number.isInteger(saved[i]) ? saved[i] : 0, false));
}
// ---- progress: one line of numbers kept in this browser only (no name in it, nothing sent) ----
// Not used for practice links, measurement runs or scripted checks (?skip) unless ?keep is given.
const keeps = !qs.has("cycle") && !qs.has("bench") && (!qs.has("skip") || qs.has("keep"));
const ioText = (len) => new Uint8Array(mem(), ex.og_io(len), len);
function saveText() {
  const len = ex.og_save();
  return len ? new TextDecoder().decode(ioText(len).slice()) : "";
}
function loadText(text) {
  const bytes = enc.encode(text);
  ioText(bytes.length).set(bytes);
  return ex.og_load() === 1;
}
let saveKey = "";
function keep(st) {
  if (!keeps || !started) return;
  // whenever a truck is finished, something is bought, or the lists or models change
  const key = [16, 24, 34, 36, 46, 72, 73, 74, 75, 83, 85, 86, 87].map((i) => st[i]).join(",");
  if (key === saveKey) return;
  saveKey = key;
  const text = saveText();
  if (text) try { localStorage.setItem("og-save", text); } catch {}
}
if (keeps) {
  let text = "";
  try { text = localStorage.getItem("og-save") || ""; } catch {}
  if (text && loadText(text)) $("resume").hidden = false;
}
window.__og_save = saveText;
// practice link: ?cycle=2&truck=4 starts at that truck (no permit comes from a practice run)
if (qs.has("cycle")) ex.og_jump(Number(qs.get("cycle")) || 1, Math.max(0, (Number(qs.get("truck")) || 1) - 1));
if (qs.has("bench") || qs.has("skip")) start();

// ---- frame loop and measurement ----
const benchFrames = qs.has("bench") ? Number(qs.get("frames") || 600) : 0;
let last = 0, frame = 0, benchDone = false, benchT0 = 0;
const dbg = gl.getExtension("WEBGL_debug_renderer_info");
window.__og = { ready: false, bench: null, state: () => Array.from(new Int32Array(mem(), ex.og_state_ptr(), ex.og_state_len())) };
// Test hook: draw the world as it stands (no time passes) and read the low-res
// picture back: a checksum of it, and how many pixels have the shadow colour.
window.__og.probe = () => {
  ex.og_frame(0, lw, lh);
  render();
  const px = new Uint8Array(lw * lh * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.readPixels(0, 0, lw, lh, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const sh = ex.og_shadow_rgb();
  let sum = 0, shadow = 0;
  for (let i = 0; i < px.length; i += 4) {
    sum = (Math.imul(sum, 31) + px[i] * 65536 + px[i + 1] * 256 + px[i + 2]) | 0;
    if (px[i] === (sh >> 16 & 255) && px[i + 1] === (sh >> 8 & 255) && px[i + 2] === (sh & 255)) shadow++;
  }
  return { sum, shadow };
};
window.__og.setLook = setLook;
window.__og.look = () => ex.og_look(-1, 0); // the look as the core holds it now, four bits per part
// While measuring: remember the longest gap between frames, and whether the
// page itself was busy during it (long tasks), to tell our stalls from the browser's.
const stall = { frame: -1, ms: 0, at_ms: 0, work_ms: 0, longtasks: [], ui_frames: [] };
if (benchFrames && window.PerformanceObserver && PerformanceObserver.supportedEntryTypes?.includes("longtask"))
  new PerformanceObserver((l) => l.getEntries().forEach((e) => stall.longtasks.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ entryTypes: ["longtask"] });

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
    if (frame === 60) { qs.get("bench") === "2" ? ex.og_bench_full() : ex.og_bench(); benchT0 = now; } // ?bench=2: the heaviest scene
    else if (frame > 60) {
      ex.og_sample(dt * 1000, cpu);
      if (dt * 1000 > stall.ms) Object.assign(stall, { frame: frame - 60, ms: Math.round(dt * 1000), at_ms: Math.round(now), work_ms: Math.round(cpu * 10) / 10 });
    }
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
        longest_gap: { ...stall, bench_started_ms: Math.round(benchT0), longtasks: stall.longtasks.slice(0, 12) },
        env: { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?", cores: navigator.hardwareConcurrency, dpr: devicePixelRatio, ua: navigator.userAgent },
      };
      $("bench").hidden = false;
      $("bench").textContent = JSON.stringify(window.__og.bench, null, 1);
    }
  }
  if (started) { sounds(window.__og.state()); keep(window.__og.state()); }
  // ui() returns false when nothing it shows has changed
  if (ui(window.__og.state()) !== false && benchFrames && !benchDone && frame > 60 && stall.ui_frames.length < 12) stall.ui_frames.push(frame - 60);
  window.__og.ready = true;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
