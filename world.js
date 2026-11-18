"use strict";
const SpacePort = (() => {
  let wasm = null,
    loading = null,
    host = null,
    canvas = null,
    gl = null,
    ctx = null,
    shader = null,
    buffers = [],
    still = true;
  let session = 0,
    frame = 0,
    frames = 0,
    last = 0,
    controls = null,
    subject = null,
    mem,
    mode = "",
    resizeObserver,
    swImage;
  let keyset = new Set(),
    touchX = 0,
    touchY = 0,
    stickId = null,
    viewDrag = null,
    scale = 0.83,
    slow = 0,
    fast = 0,
    instrument = 0;
  const labels = [
    "",
    "운전석",
    "화물 1번 칸",
    "화물 2번 칸",
    "통과 레버",
    "보류 레버",
    "정비 상점",
    "AI 관제실",
    "허가증 창구",
    "",
    "",
    "AI 타워",
    "탈의실",
    "판정 기록대",
    "",
    "",
    "",
    "압수함",
  ];
  const phases = [
    "진입 중",
    "정차",
    "출발",
    "경보",
    "도주 트럭",
    "화물 괴물",
    "펜스 월담",
    "견인 중",
    "구조 중",
    "근무 종료",
    "그물 포획",
  ];
  const read = (fn, n, Type = Float32Array) => {
    let off = wasm[fn]();
    return new Type(wasm.memory.buffer, off, n);
  };
  const state = () => read("state", 32);
  const bank = () => Array.from(read("bank", 12, Int32Array));
  async function load() {
    if (wasm) return wasm;
    if (!loading)
      loading = PortCore.load()
        .then((m) => {
          wasm = m;
          const a = s.station || [20, 3, 1, 0, 0, 0, 0, 0, 100, 0];
          wasm.restore(...a.slice(0, 10));
          return m;
        })
        .catch((e) => {
          loading = null;
          throw e;
        });
    return loading;
  }
  const vert = `attribute vec3 pos; attribute vec4 tint; uniform vec3 focus; uniform vec4 rotation; uniform vec2 lens; varying vec3 col;
 void main(){vec3 q=pos-focus;float radial=dot(q.xz,rotation.xy);float depth=lens.y-radial*rotation.w-q.y*rotation.z;
 gl_Position=vec4(dot(q.xz,vec2(rotation.y,-rotation.x))*1.93/lens.x,(q.y*rotation.w-radial*rotation.z)*1.93,depth*1.002-0.44,depth);
 col=mix(tint.rgb,vec3(.73,.63,.69),clamp((depth-19.)*.015,0.,.72));}`;
  const frag = `precision mediump float; varying vec3 col;void main(){gl_FragColor=vec4(col,1.);}`;
  function gpu(gl) {
    const make = (type, src) => {
      const obj = gl.createShader(type);
      gl.shaderSource(obj, src);
      gl.compileShader(obj);
      if (!gl.getShaderParameter(obj, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(obj));
      return obj;
    };
    const p = gl.createProgram();
    const vs = make(gl.VERTEX_SHADER, vert),
      fs = make(gl.FRAGMENT_SHADER, frag);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error("3D 초기화");
    gl.useProgram(p);
    shader = {
      p,
      focus: gl.getUniformLocation(p, "focus"),
      rotation: gl.getUniformLocation(p, "rotation"),
      lens: gl.getUniformLocation(p, "lens"),
      pos: gl.getAttribLocation(p, "pos"),
      tint: gl.getAttribLocation(p, "tint"),
    };
    buffers = [gl.createBuffer(), gl.createBuffer()];
    gl.enableVertexAttribArray(shader.pos);
    gl.enableVertexAttribArray(shader.tint);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }
  function makeCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "3D 검문소. WASD 이동, 스페이스 점프, E 상호작용, Q 하차 요구, F 그물총.",
    );
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
        premultipliedAlpha: false,
        failIfMajorPerformanceCaveat: true,
      });
      if (gl) gpu(gl);
    } catch {
      gl = null;
    }
    if (gl) {
      mode = "GPU";
      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        switchSoftware();
      });
    } else {
      canvas = canvas.cloneNode(false);
      ctx = canvas.getContext("2d", { alpha: true });
      mode = "Rust";
      scale = 0.6;
    }
  }
  function switchSoftware() {
    if (!gl) return;
    const old = canvas;
    canvas = old.cloneNode(false);
    old.replaceWith(canvas);
    gl = null;
    ctx = canvas.getContext("2d", { alpha: true });
    mode = "Rust";
    scale = 0.56;
    resize();
    bindSurface();
  }
  let worldWidth = 0,
    worldHeight = 0,
    waypoint = null,
    sitePins = [];
  function resize() {
    if (!host?.isConnected || !canvas) return;
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    worldWidth = w;
    worldHeight = h;
    const k = Math.min(scale, (gl ? 1050 : 680) / w, (gl ? 680 : 410) / h);
    const a = Math.max(64, Math.round(w * k)),
      b = Math.max(64, Math.round(h * k));
    if (a === canvas.width && b === canvas.height) return;
    canvas.width = a;
    canvas.height = b;
    if (gl) gl.viewport(0, 0, a, b);
    swImage = null;
  }
  function upload(d) {
    const n = wasm.count(d),
      ptr = wasm.vertices(d);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[d]);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Uint8Array(wasm.memory.buffer, ptr, n * 16),
      d ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW,
    );
  }
  let terrainVersion = "",
    indices = null,
    groundCount = 0,
    indexType = 0;
  function rebuild() {
    const b = bank(),
      t = Traffic.state();
    const version = [b[2], b[4], b[5], b[7], t.towers, t.tier].join("/");
    if (version === terrainVersion) return;
    terrainVersion = version;
    wasm.build_world();
    if (!gl) return;
    const count = wasm.count(0),
      quads = count / 6;
    const wide = quads * 4 > 65535;
    if (
      !Number.isInteger(quads) ||
      (wide && !gl.getExtension("OES_element_index_uint"))
    ) {
      groundCount = 0;
      upload(0);
      return;
    }
    const input = new Uint32Array(
      wasm.memory.buffer,
      wasm.vertices(0),
      count * 4,
    );
    const packed = new Uint32Array(quads * 16),
      order = wide ? new Uint32Array(count) : new Uint16Array(count);
    for (let q = 0; q < quads; q++) {
      const src = q * 24,
        dst = q * 16,
        v = q * 4;
      packed.set(input.subarray(src, src + 12), dst);
      packed.set(input.subarray(src + 20, src + 24), dst + 12);
      order.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6);
    }
    groundCount = count;
    indexType = wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    indices ??= gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[0]);
    gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, order, gl.STATIC_DRAW);
  }
  function render(st) {
    wasm.draw_objects();
    if (gl) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform3f(shader.focus, st[0], 1.28 + st[1] * 0.58, st[2]);
      gl.uniform4f(
        shader.rotation,
        Math.sin(st[3]),
        Math.cos(st[3]),
        Math.sin(st[4]),
        Math.cos(st[4]),
      );
      gl.uniform2f(shader.lens, canvas.width / canvas.height, st[5]);
      upload(1);
      for (let d = 0; d < 2; d++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers[d]);
        gl.vertexAttribPointer(shader.pos, 3, gl.FLOAT, false, 16, 0);
        gl.vertexAttribPointer(shader.tint, 4, gl.UNSIGNED_BYTE, true, 16, 12);
        if (!d && groundCount)
          gl.drawElements(gl.TRIANGLES, groundCount, indexType, 0);
        else gl.drawArrays(gl.TRIANGLES, 0, wasm.count(d));
      }
    } else {
      const ptr = wasm.raster(canvas.width, canvas.height);
      if (
        !swImage ||
        mem !== wasm.memory.buffer ||
        swImage.data.byteOffset !== ptr
      ) {
        mem = wasm.memory.buffer;
        swImage = new ImageData(
          new Uint8ClampedArray(mem, ptr, canvas.width * canvas.height * 4),
          canvas.width,
          canvas.height,
        );
      }
      ctx.putImageData(swImage, 0, 0);
    }
  }
  function economy() {
    if (wasm) s.station = bank().slice(0, 10);
  }
  function persist() {
    economy();
    if (subject && wasm) {
      const b = bank();
      s.fieldCase = {
        id: subject,
        flags: b[10],
        resolved: b[11],
        anchor: b[10] & 4096 ? Array.from(state().subarray(12, 14)) : null,
      };
    }
    save();
  }
  function caseSet(person, again = false) {
    const serial = s.serial,
      old = s.fieldCase?.id === person.id ? s.fieldCase : null;
    if (!again && person.id === subject) return;
    subject = person.id;
    const tier = Math.min(3, Math.max(Math.floor(serial / 3), s.stage));
    const early = [0, 1, 0, 4, 2, 3, 4, 2, 1, 3];
    let incident = revisit
      ? 0
      : serial < early.length
        ? early[serial]
        : [3, 2, 4, 1, 2, 3, 1, 4][(serial + (s.salt % 8)) % 8];
    if (!revisit && Orbit.highRisk(person)) incident = 5;
    else if (Orbit.lowMask(person) || person.bag.some((k) => k >= 4))
      incident = 0;
    person.seized = old ? (old.flags >> 13) & 3 : person.seized || 0;
    wasm.arrival(
      person.face,
      person.mark || 0,
      ...person.bag.map((_, i) => Cargo.formOf(person, i)),
      tier,
      incident,
      (old?.flags || 0) | ((person.seized || 0) << 13),
      incident === 5 && !(old?.flags & 4096) ? 0 : old?.resolved || 0,
    );
    wasm.appearance(s.rangerStyle || 0);
    wasm.tower_state(Traffic.state().towers, Traffic.state().tier);
    wasm.cargo_law(
      Orbit.lowMask(person),
      +(!revisit && Orbit.highRisk(person)),
    );
    if (Array.isArray(old?.anchor)) wasm.custody_location(...old.anchor);
    wasm.require_docs(+person.bag.some((k) => k >= 4), +Orbit.mismatch(person));
    wasm.set_model(s.models.length);
    last = 0;
    statusKey = "";
  }
  async function mount(el, person) {
    stop();
    host = el;
    let epoch = session;
    try {
      await load();
      if (session !== epoch || !el.isConnected) return;
      makeCanvas();
      el.prepend(canvas);
      waypoint = el.querySelector(".waypoint");
      sitePins = Array.from(el.querySelectorAll("[data-site]"));
      caseSet(person);
      if (feedback && state()[7] !== 2) {
        nextVisitor();
        return;
      }
      wasm.set_model(s.models.length);
      rebuild();
      bindSurface();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(el);
      resize();
      el.querySelector(".loadingPort")?.remove();
      if (s.legacyMembership && !s.legacyNotice) {
        s.legacyNotice = true;
        save();
        toast(
          "이전 회원권 210 CR를 돌려드렸어요. 무한 모드에서 새 회원권에 도전하세요.",
        );
      }
      if (!s.welcomedYard) {
        s.welcomedYard = true;
        save();
        fieldBroadcast(
          "입항 예고 · " +
            Traffic.groups[Traffic.group()].name +
            "　" +
            Traffic.groups[Traffic.group()].hint +
            "　왼쪽 청록색 감식대에서 AI 실험 · M 지도",
          8000,
        );
      }
      if (!s.radioWelcomed && s.sound) {
        s.radioWelcomed = true;
        Radio.play("welcome", true);
        save();
      }
      frame = requestAnimationFrame(loop);
      canvas.focus({ preventScroll: true });
    } catch (err) {
      if (session !== epoch) return;
      el.querySelector(".loadingPort").innerHTML =
        '게임 엔진을 불러오지 못했어요. <button data-act="desk">다시 시도</button>';
      console.error(err);
    }
  }
  function stop() {
    session++;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    controls?.abort();
    controls = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    keyset.clear();
    touchX = touchY = 0;
    viewDrag = null;
    stickId = null;
    host = null;
    last = 0;
  }
  function resetInput() {
    keyset.clear();
    touchX = touchY = 0;
    stickId = null;
    viewDrag = null;
    host
      ?.querySelector(".stickDot")
      ?.style.setProperty("transform", "translate(0,0)");
    last = 0;
  }
  function bindSurface() {
    controls?.abort();
    controls = new AbortController();
    const on = (el, type, fn, opts = {}) =>
      el.addEventListener(type, fn, { ...opts, signal: controls.signal });
    const keys = [
      "KeyM",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "ShiftLeft",
      "ShiftRight",
      "Space",
      "KeyE",
      "KeyQ",
      "KeyF",
      "KeyZ",
      "KeyC",
    ];
    const keyFor = (e) => {
      if (keys.includes(e.code)) return e.code;
      const char = String(e.key || "").toLowerCase();
      return (
        {
          m: "KeyM",
          ㅡ: "KeyM",
          w: "KeyW",
          a: "KeyA",
          s: "KeyS",
          d: "KeyD",
          e: "KeyE",
          q: "KeyQ",
          f: "KeyF",
          z: "KeyZ",
          c: "KeyC",
          ㅈ: "KeyW",
          ㅁ: "KeyA",
          ㄴ: "KeyS",
          ㅇ: "KeyD",
          ㄷ: "KeyE",
          ㄸ: "KeyE",
          ㅂ: "KeyQ",
          ㅃ: "KeyQ",
          ㄹ: "KeyF",
          ㅋ: "KeyZ",
          ㅊ: "KeyC",
          ㅉ: "KeyW",
          " ": "Space",
          shift: "ShiftLeft",
        }[char] || e.key
      );
    };
    on(window, "keydown", (e) => {
      const code = keyFor(e);
      if (
        !host ||
        dlg.open ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        !keys.includes(code)
      )
        return;
      e.preventDefault();
      keyset.add(code);
      if (e.repeat) return;
      if (code === "KeyM") {
        fieldMap();
        return;
      }
      const a = { Space: 9, KeyE: 0, KeyQ: 11, KeyF: 10 }[code];
      if (a !== undefined) perform(a);
    });
    on(window, "keyup", (e) => keyset.delete(keyFor(e)));
    on(window, "blur", resetInput);
    on(document, "visibilitychange", resetInput);
    on(dlg, "close", () => {
      resetInput();
      if (!frame && host?.isConnected) frame = requestAnimationFrame(loop);
    });
    on(canvas, "contextmenu", (e) => e.preventDefault());
    on(canvas, "pointerdown", (e) => {
      canvas.focus({ preventScroll: true });
      viewDrag = [
        e.pointerId,
        e.clientX,
        e.clientY,
        e.clientX,
        e.clientY,
        e.button,
        0,
      ];
      canvas.setPointerCapture(e.pointerId);
    });
    on(canvas, "pointermove", (e) => {
      if (viewDrag?.[0] !== e.pointerId) return;
      viewDrag[6] = Math.max(
        viewDrag[6],
        Math.hypot(e.clientX - viewDrag[3], e.clientY - viewDrag[4]),
      );
      if (viewDrag[6] < 4) return;
      if (wasm.held_item() >= 0 && viewDrag[5] === 0) {
        wasm.turn_item(
          (e.clientX - viewDrag[1]) * 0.02,
          (e.clientY - viewDrag[2]) * 0.02,
        );
        viewDrag[1] = e.clientX;
        viewDrag[2] = e.clientY;
        return;
      }
      wasm.look(
        -(e.clientX - viewDrag[1]) * 0.009,
        (e.clientY - viewDrag[2]) * 0.007,
        0,
      );
      viewDrag[1] = e.clientX;
      viewDrag[2] = e.clientY;
    });
    on(canvas, "pointerup", (e) => {
      if (
        viewDrag?.[0] === e.pointerId &&
        viewDrag[5] === 0 &&
        viewDrag[6] < 4 &&
        !dlg.open
      ) {
        const rect = canvas.getBoundingClientRect();
        const nx = (2 * (e.clientX - rect.left)) / rect.width - 1,
          ny = 1 - (2 * (e.clientY - rect.top)) / rect.height,
          aspect = canvas.width / canvas.height;
        const phase = state()[7];
        if (phase === 1) {
          const res = wasm.touch_cargo(nx, ny, aspect);
          if (res === 4) pump();
          else if (res)
            fieldBroadcast(
              [
                "",
                "손에 들었어요 · 왼쪽 드래그로 회전, 클릭으로 내려놓기",
                "내려놓았어요. 다른 각도에서 살펴볼 수 있어요.",
                "더 가까이 다가가서 집으세요.",
              ][res],
              3200,
            );
        } else {
          wasm.aim_net(nx, ny, aspect);
          pump();
        }
      }
      viewDrag = null;
    });
    on(canvas, "pointercancel", () => (viewDrag = null));
    on(
      canvas,
      "wheel",
      (e) => {
        e.preventDefault();
        wasm.look(0, 0, Math.sign(e.deltaY) * 0.72);
      },
      { passive: false },
    );
    const stick = host.querySelector(".stick");
    const drag = (e) => {
      const r = stick.getBoundingClientRect();
      const x = (e.clientX - r.x - r.width / 2) / (r.width * 0.35),
        y = (e.clientY - r.y - r.height / 2) / (r.height * 0.35),
        l = Math.max(1, Math.hypot(x, y));
      touchX = x / l;
      touchY = -y / l;
      stick.firstElementChild.style.transform =
        "translate(" + touchX * 19 + "px," + -touchY * 19 + "px)";
    };
    on(stick, "pointerdown", (e) => {
      e.preventDefault();
      stickId = e.pointerId;
      stick.setPointerCapture(stickId);
      drag(e);
    });
    on(stick, "pointermove", (e) => {
      if (e.pointerId === stickId) drag(e);
    });
    on(stick, "pointerup", resetInput);
    on(stick, "pointercancel", resetInput);
  }
  function perform(a) {
    if (!wasm || !host || dlg.open) return;
    wasm.action(a);
    pump();
    statusKey = "";
  }
  let statusKey = "",
    pendingHook = 0;
  function inspect(hook, html) {
    pendingHook = hook;
    modal(html);
    resetInput();
  }
  function finishRead() {
    if (!pendingHook) return;
    const k = pendingHook;
    pendingHook = 0;
    if (!!host && screen === "desk" && wasm) {
      wasm.after_read(k);
      pump();
    }
  }
  function reportCargo(n) {
    Radio.play("hatch");
    fieldBroadcast(
      "화물칸이 열렸어요. 실제 짐을 클릭해 들고, 드래그해 돌려 보세요. 다시 클릭하면 내려놓아요.",
      5500,
    );
    wasm.after_read(n + 2);
    pump();
  }
  function checkDoc(kind) {
    if (!wasm.read_doc(kind)) {
      toast("운전석 근처에서 먼저 하차를 요구하세요.");
      return;
    }
    persist();
    const d = kind === 1 ? p.permit : p.medical;
    const titleText =
      kind === 1 ? "위험 물품 운송 허가증" : "우주항 메디컬 기록";
    const data = !d
      ? "<p>신원 번호에 해당하는 기록이 없습니다.</p>"
      : `<div class="documentSheet"><b>기록의 신원 번호　${d.owner}</b>${kind === 1 ? `<p>허가 화물　${Cargo.names[d.kind]}<br>마지막 사용일　${date(d.until)}</p>` : `<p>기록일　${date(d.date)}<br>외형 변화　${d.reason}</p>${faceMark(d.face, d.mark)}`}</div>`;
    inspect(
      kind === 1 ? 4 : 1,
      `${chip("제7 우주항 · 기록 대조")}${title(titleText)}<p>운전자 신원 번호　<b>${p.id}</b>　·　오늘 ${date(p.today)}</p>${data}${btn("close", "확인하고 현장으로", "primary")}`,
    );
  }
  function pump() {
    const e = wasm.take_event();
    if (!e) return;
    statusKey = "";
    if (e === 1) {
      inspect(
        1,
        `${chip("운전석 · " + p.name)}${title("성간 운송 허가증")}<p>오늘 <b>${date(p.today)}</b>　/　마지막 사용일 <b>${date(p.until)}</b></p>${matchPanel(p)}<div class="documentSheet"><b>운전자 화물 신고서</b><p>${(p.manifest || p.bag).map((k, i) => i + 1 + "번 칸　" + Cargo.names[k]).join("<br>")}</p><small>축제 음료와 씨앗 화분은 신고 대상이에요. 실제 짐과 신고 내용을 대조하세요.</small></div><div class="actions">${btn("close", "서류 확인 완료", "primary")}${state()[10] & 8 ? btn("permitSearch", "하차한 운전자 · 허가증 수색", "secondary") : btn("askOut", "운전자 하차 요청", "secondary")}${btn("medSearch", "메디컬 기록 조회", "secondary")}</div>`,
      );
    }
    if (e === 2 || e === 3) reportCargo(e - 2);
    if (e === 4 || e === 5) {
      opened = true;
      label(e === 4);
      const pay = wasm.reward(+(Orbit.allowed(p) === (e === 4)));
      if (pay < 0) Traffic.fine(-pay);
      if (!revisit)
        Traffic.counted({
          correct: +(Orbit.allowed(p) === (e === 4)),
          miss: +(e === 4 && !Orbit.allowed(p)),
        });
      toast(`${Orbit.explain(p)}　·　정산 ${pay >= 0 ? "+" : ""}${pay} CR`);
      if (s.rows.length === 2)
        fieldBroadcast(
          "AI 관제실에서 처음 모은 두 사례로 모델을 학습할 수 있어요.",
          5500,
        );
    }
    if (e === 35 || e === 36) {
      const i = e - 35;
      p.seized = (state()[10] >> 13) & 3;
      s.seizures ??= {};
      s.seizures[p.id] = p.seized;
      Radio.play("stamp");
      fieldBroadcast(
        "압수 완료 · " +
          Cargo.names[p.bag[i]] +
          "을 보관했어요. 남은 서류와 화물을 검사하세요.",
        4800,
      );
    }
    if (e === 37) toast("짐을 손에 들고 압수함을 클릭하거나 E를 누르세요.");
    if (e === 38)
      toast(
        "이 짐은 저위험 압수 대상에 해당하지 않아요. 신고서와 도감을 확인하세요.",
      );
    if (e === 39)
      fieldBroadcast(
        "미신고 음료·화분이 남았어요. 해당 짐을 들고 노란 압수함으로 옮기세요.",
        5200,
      );
    if (e === 40)
      fieldBroadcast(
        "미허가 고위험 화물 · 운전자를 포획하고 주황색 보류 레버로 인계하세요.",
        4600,
      );
    if (e === 41)
      fieldBroadcast(
        "고위험 사건 · 허가증과 실물을 확인하고 운전자를 먼저 포획하세요.",
        4600,
      );
    if (e === 42) toast("먼저 운전석에서 화물 신고서를 받으세요.");
    if (e === 31) Traffic.draw();
    if (e === 32) wardrobe();
    if (e === 33) notebook();
    if (e === 6) shop();
    if (e === 7) lab();
    if (e === 8) rangerReport();
    if (e === 9) {
      toast("덮개를 걷었어요. E로 안쪽 짐을 살펴보세요.");
      sound(450);
    }
    if (e === 10) {
      toast("운전자가 내려와 검문을 기다립니다.");
      sound(440);
    }
    if ([12, 13, 14].includes(e)) {
      fieldBroadcast(
        [
          "하차한 운전자가 달아나요! 몸통을 클릭하거나 F로 그물을 펼치세요.",
          "화물칸에서 괴물이 나왔어요! 거리를 벌리고 F로 포획하세요.",
          "펜스 쪽으로 달려갑니다! 따라가 F로 포획하세요.",
        ][e - 12],
        5500,
      );
      if (e === 13) {
        s.quarantines ??= [];
        if (!s.quarantines.includes(p.id)) {
          s.quarantines.push(p.id);
          Traffic.counted();
        }
        fieldBroadcast(
          "차량 자동 보류 · 살아 있는 괴물 발견! 차량은 격리하고 괴물을 포획하세요.",
          6500,
        );
      }
      Radio.play("dispatch", true);
    }
    if (e === 15) {
      modal(
        `${chip("운전자의 제안")}${title("“6크레딧이면 빨리 갈 수 있지?”")}<p>운전자가 슬쩍 동전을 내밉니다. 뒤에는 차례를 기다리는 친구들이 있어요.</p><div class="actions">${btn("decline", "거절하고 기록하기", "primary")}${btn("accept", "6 CR 받기", "secondary")}</div>`,
      );
    }
    if (e === 20 || e === 21) {
      if (Orbit.highRisk(p) && state()[10] & 4096) {
        s.detained ??= {};
        s.detained[p.id] = true;
        fieldBroadcast(
          "고위험 밀수 운전자 포획 · 주황색 보류 레버에서 차량을 인계하세요.",
          5800,
        );
      }
      Radio.play("stamp");
      toast(e === 20 ? "그물 포획 성공! +9 CR" : "자동 방어 성공! +4 CR");
      sound(820);
    }
    if (e === 22) {
      const life = bank()[1];
      toast(`보호막 1개 소모 · 남은 목숨 ${life}개`);
      if (!life) endShift();
    }
    if (e === 23)
      toast("그물이 빗나갔어요. 가까이 가서 대상의 몸통을 가리켜 보세요.");
    if (e === 27)
      toast("위험 화물이에요. 운전석에서 하차를 요구하고 허가증을 수색하세요.");
    if (e === 28) toast("사진이 달라요. 운전석에서 메디컬 기록을 조회하세요.");
    if (e === 29) Radio.play("net");
    if (e === 24 || e === 25) {
      if (
        (e === 25 || (state()[10] & 512) !== 0) &&
        !revisit &&
        p.id === "T" + s.serial
      )
        s.serial++;
      s.fieldCase = null;
      save();
      nextVisitor();
      return;
    }
    if (e === 26) toast("운전석과 표시된 화물칸을 먼저 검사하세요.");
    persist();
  }
  function panelChoice(take) {
    wasm.gift(+take);
    persist();
    close();
    toast(
      take
        ? "임시 입금 +6 CR · 신뢰도 −8 · 판정 후 감사 환수 9 CR"
        : "제안을 기록했어요. 서류와 짐으로 판정하세요.",
    );
  }
  function passengerOut() {
    pendingHook = 0;
    close();
    wasm.action(11);
    pump();
    wasm.after_read(1);
    pump();
  }
  function endShift() {
    modal(
      `${chip("보호막 소진")}${title("이번 근무가 끝났어요")}<p>지금까지 번 돈, 구매한 장비, AI 학습 기록을 보관했어요.</p><div class="actions">${btn("ranger", "레인저 결과표", "primary")}${btn("restoreShift", "목숨 3개로 새 근무", "secondary")}</div>`,
    );
  }
  const upgrades = [
    [
      "운송 레일",
      "AI가 추가 차로를 맡아요. 현장 근무 중 학습한 모델이 운송 수입을 벌어요. 오통과하면 12 CR 벌금이 있어요.",
    ],
    ["그물총", "사거리가 2.7m 늘고 재충전이 0.3초 빨라져요."],
    ["펄스 펜스", "1단계는 월담을 막고, 2단계는 출구의 도주 트럭도 멈춰요."],
    [
      "자동 그물 포탑",
      "반경 안의 위협을 자동 포획해요. 2단계는 더 멀리, 더 빨리 반응해요.",
    ],
    ["레인저 부츠", "걷기와 달리기 속도가 빨라져요."],
    [
      "우주 콘도 회원권",
      "무한 모드 · 타워 16기 · 그룹별 자동 전환 · 정확도 85% 이상과 위험 차량 오통과 0건으로 4주기를 성공하면 구매해요.",
    ],
  ];
  function shop() {
    const b = bank();
    modal(
      `${chip("제7 우주항 정비소")}${title("장비와 운송권")}<p>잔액 <b>${b[0]} CR</b>　·　정확한 직접 검사 +16 CR　·　자동 레일은 학습한 모델을 사용해요.</p><div class="storeList">${upgrades
        .map(([n, txt], i) => {
          const level = b[[2, 3, 4, 5, 6, 7][i]],
            price = wasm.price(i),
            locked = i === 5 && !Traffic.canCondo();
          return `<div><section><b>${n} <small>${i === 5 ? (level ? "보유" : "최종 목표") : "Lv." + level}</small></b><small>${txt}</small></section>${btn("upgrade", price ? price + " CR" : "완료", "secondary", `data-i="${i}" ${!price || price > b[0] || locked ? "disabled" : ""}`)}</div>`;
        })
        .join("")}</div>${btn("close", "현장으로", "primary")}`,
    );
  }
  function purchase(i) {
    const res = wasm.buy(i, +Traffic.canCondo());
    if (res) {
      toast("구매 조건을 확인하세요.");
      return;
    }
    persist();
    rebuild();
    sound(820);
    if (i === 5) {
      modal(
        `${chip("최종 목표 달성")}${title("우주 콘도에 입주했어요!")}<div class="memberCard">✦　ORBIT RESIDENCE<br><b>우주 콘도 평생 회원권</b></div><p>내 AI와 검문소에서 번 돈으로 마련한 회원권이에요.</p>${btn("ranger", "레인저 결과표 받기", "primary")}`,
      );
    } else {
      shop();
      toast("설치 완료 · 다음 현장부터 바로 적용됩니다.");
    }
  }
  function operateLanes() {
    const turns = wasm.auto_due();
    if (!turns) return;
    if (Traffic.state().towers) {
      Traffic.process();
    }
    if (
      !s.models.length ||
      bank()[2] < 2 ||
      (Traffic.state().issued && !Traffic.state().submitted)
    )
      return;
    const b = bank(),
      m = s.models.at(-1);
    s.autoTrips ??= 0;
    const test = Orbit.wave(100000 + ++s.autoTrips, 0, s.salt);
    let paid = 0;
    for (let i = 0; i < b[2] - 1; i++) {
      const x = Orbit.run(m.tree, m.wire, test[i]);
      if (!x.safe && x.open) {
        paid -= 12;
        Traffic.fine(12);
      } else if (x.ok) paid += 6;
    }
    wasm.settle_trip(paid);
    persist();
    fieldBroadcast(
      `자동 레일 ${b[2] - 1}개 정산 ${paid >= 0 ? "+" : ""}${paid} CR · 모델 ${m.v}`,
      2200,
    );
  }
  let bannerTime = 0;
  function fieldBroadcast(text, ms) {
    const el = host?.querySelector(".fieldRadio");
    if (el) {
      el.textContent = text;
      el.hidden = false;
      bannerTime = performance.now() + ms;
    }
  }
  function hud(st, t) {
    const phase = st[7],
      near = st[8],
      goal = st[9],
      isChase = phase >= 3 && phase <= 6;
    let message =
      phase === 0
        ? "진입하는 트럭을 기다리세요"
        : phase === 2
          ? "검문 완료 · 다음 트럭이 들어옵니다"
          : phase === 9
            ? "보호막 소진 · 새 근무 또는 결과표"
            : isChase
              ? st[27] === 1
                ? "도주 운전자 추격"
                : st[27] === 2
                  ? "화물 괴물 포획"
                  : "펜스 월담 저지"
              : phase === 10
                ? "포획 성공 · 현장 복귀"
                : phase === 8
                  ? "구조선 출동"
                  : goal === 1
                    ? "운전석에서 통행증 받기"
                    : goal === 2
                      ? "트럭 옆 화물칸 검사"
                      : goal === 3
                        ? "트럭 반대편 화물칸 검사"
                        : "두 레버 중 하나로 판정하기";
    const docGoal =
      phase === 1 &&
      goal === 4 &&
      ((p.bag.some((k) => k >= 4) && !(st[10] & 1024)) ||
        (Orbit.mismatch(p) && !(st[10] & 2048)));
    const outstanding = Orbit.lowMask(p) & ~((st[10] >> 13) & 3),
      holding = wasm.held_item();
    if (phase === 1 && goal === 4 && outstanding)
      message = "신고서와 비교 · 미신고 짐을 노란 압수함으로";
    if (phase === 1 && Orbit.highRisk(p) && st[10] & 4096)
      message = "운전자 포획 완료 · 주황색 보류 레버로 인계";
    if (holding >= 0)
      message =
        "들고 있는 " + (holding + 1) + "번 짐 · 드래그로 회전, 클릭으로 놓기";
    if (docGoal && holding < 0)
      message =
        !(st[10] & 1024) && p.bag.some((k) => k >= 4)
          ? "운전석에서 하차 요구 · 허가증 수색"
          : "운전석에서 메디컬 기록 조회";
    if (st[10] & 512)
      message = "차량 자동 보류 · 괴물 격리" + (phase === 2 ? " 완료" : "");
    const schedule = Traffic.state();
    const key = [
      schedule.cycle,
      schedule.trips,
      message,
      near,
      st[10],
      phase,
      st[14],
      st[20],
      s.rows.length,
      s.score,
      subject,
      st[21],
    ].join("/");
    if (key !== statusKey) {
      statusKey = key;
      host.classList.toggle("aiming", isChase);
      host.querySelector(".taskText").textContent = message;
      host.querySelector(".fieldBank").textContent = `${st[20]} CR`;
      host.querySelector(".fieldLife").textContent =
        "♥".repeat(st[14]) + "♡".repeat(3 - st[14]);
      const e = host.querySelector(".interact");
      const valid =
        near > 0 && (phase === 1 || ([0, 2, 7].includes(phase) && near >= 6));
      e.textContent = isChase
        ? "F　그물 발사"
        : phase === 9
          ? "새 근무 / 결과"
          : valid
            ? `E　${labels[near]}${near === 2 || near === 3 ? (st[17] >= 1 && !(st[10] & (near === 2 ? 16 : 32)) ? " 덮개 걷기" : " 열기") : near === 1 ? " 확인" : " 사용"}`
            : "대상 가까이 이동";
      e.disabled = !(isChase || valid || phase === 9);
      host.querySelector(".outKey").hidden = !(
        near === 1 &&
        phase === 1 &&
        !(st[10] & 8)
      );
      host.querySelector(".fieldCaseNo").textContent =
        `${schedule.cycle}주기 · ${Traffic.groups[Traffic.group()].name} · 운행 ${schedule.trips}/4`;
    }
    if (t > bannerTime) host.querySelector(".fieldRadio").hidden = true;
  }
  function projectMarkers(st) {
    const phase = st[7],
      goal = st[9],
      chase = phase >= 3 && phase <= 6,
      aspect = canvas.width / canvas.height;
    function place(el, id, active, primary) {
      let visible = active,
        x = 0,
        y = 0;
      if (active) {
        const ptr = wasm.project(id, aspect),
          v = new Float32Array(wasm.memory.buffer, ptr, 3);
        visible =
          v[2] > (primary ? 0.3 : 1) &&
          (primary || (Math.abs(v[0]) < 0.94 && v[1] > -0.76 && v[1] < 0.75));
        x = 0.5 + 0.5 * v[0];
        y = 0.5 - 0.5 * v[1];
        if (primary) {
          x = Math.max(0.08, Math.min(0.92, x));
          y = Math.max(0.12, Math.min(0.79, y));
        }
      }
      if (el.hidden === visible) el.hidden = !visible;
      if (visible) {
        const transform =
          "translate3d(" +
          (x * worldWidth).toFixed(2) +
          "px," +
          (y * worldHeight).toFixed(2) +
          "px,0) translate(-50%,-100%)";
        if (el.style.transform !== transform) el.style.transform = transform;
      }
    }
    const docs =
      phase === 1 &&
      goal === 4 &&
      ((p.bag.some((k) => k >= 4) && !(st[10] & 1024)) ||
        (Orbit.mismatch(p) && !(st[10] & 2048)));
    const seized = (st[10] >> 13) & 3,
      pending = Orbit.lowMask(p) & ~seized;
    const locker = phase === 1 && goal === 4 && !docs && pending;
    const detained = phase === 1 && Orbit.highRisk(p) && st[10] & 4096;
    const label = docs
      ? "▼　운전자 기록 확인"
      : chase
        ? "◇　포획 대상"
        : detained
          ? "▼　보류 · 인계"
          : locker
            ? "▼　압수함"
            : goal === 4
              ? "▼　통과"
              : "▼　" + labels[goal];
    if (waypoint.textContent !== label) waypoint.textContent = label;
    place(
      waypoint,
      docs ? 1 : chase ? 10 : detained ? 5 : locker ? 17 : goal,
      phase === 1 || chase,
      true,
    );
    for (const el of sitePins) {
      const id = Number(el.dataset.site);
      if (id === 14 || id === 15) {
        const shown =
          (st[10] & (id === 14 ? 2 : 4)) !== 0 ||
          (st[17] < 2 && (st[10] & 2) !== 0);
        place(
          el,
          id,
          phase === 1 &&
            shown &&
            !(seized & (1 << (id - 14))) &&
            wasm.held_item() < 0 &&
            (st[8] === 2 || st[8] === 3),
          false,
        );
      } else place(el, id, phase === 1 && (id !== 5 || goal === 4), false);
    }
  }
  function loop(t) {
    frame = 0;
    if (!host?.isConnected || !wasm) return;
    if (document.hidden || dlg.open) {
      resetInput();
      return;
    }
    if (Traffic.state().issued && !Traffic.state().submitted) {
      rangerReport();
      return;
    }
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 1 / 60;
    last = t;
    const has = (...ks) => ks.some((k) => keyset.has(k));
    const X =
      touchX +
      Number(has("KeyD", "ArrowRight")) -
      Number(has("KeyA", "ArrowLeft"));
    const Y =
      touchY +
      Number(has("KeyW", "ArrowUp")) -
      Number(has("KeyS", "ArrowDown"));
    wasm.look((Number(has("KeyC")) - Number(has("KeyZ"))) * dt * 1.9, 0, 0);
    wasm.tick(dt, X, Y, +has("ShiftLeft", "ShiftRight"));
    const epoch = session;
    pump();
    if (epoch !== session || !host?.isConnected) return;
    operateLanes();
    const st = state().slice();
    render(st);
    projectMarkers(st);
    frames++;
    if (t - instrument > 65 || !statusKey) {
      hud(st, t);
      instrument = t;
    }
    if (dt > 0.023) {
      slow++;
      fast = 0;
    } else {
      fast++;
      if (fast % 10 === 0) slow = Math.max(0, slow - 1);
    }
    if (slow >= 5 && scale > 0.38) {
      scale = Math.max(0.38, scale * 0.84);
      slow = 0;
      resize();
    }
    if (fast > 260 && scale < (gl ? 0.9 : 0.64)) {
      scale += 0.04;
      fast = 0;
      resize();
    }
    if (!dlg.open) frame = requestAnimationFrame(loop);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && host && !frame && !dlg.open) {
      last = 0;
      frame = requestAnimationFrame(loop);
    }
  });
  function markup() {
    return `<section class="fieldShell"><div class="fieldHead"><div><small>제7 우주항　/　검문 근무</small><strong>${Orbit.missions[s.stage].name}</strong></div><small>현장 시설　·　가까이 가서 E / ㄷ</small></div><div class="portWorld" id="world"><div class="loadingPort">우주항 진입 중…</div><div class="taskBox"><small class="fieldCaseNo"></small><b class="taskText">트럭을 기다리세요</b></div><div class="moneyHUD"><b class="fieldLife"></b><b class="fieldBank"></b></div><span class="waypoint" hidden></span><span class="mapPin cargoPin" data-site="14" hidden>① 집기</span><span class="mapPin cargoPin" data-site="15" hidden>② 집기</span><span class="mapPin" data-site="17" hidden>압수함</span><span class="mapPin stopPin" data-site="5" hidden>▼ 보류</span><span class="mapPin" data-site="6" hidden>정비소</span><span class="mapPin" data-site="7" hidden>화물 감식대 · AI 학습</span><span class="mapPin" data-site="11" hidden>AI 감시 타워</span><span class="mapPin" data-site="12" hidden>탈의실</span><span class="mapPin" data-site="13" hidden>판정 기록</span><span class="mapPin" data-site="8" hidden>허가증</span><div class="fieldRadio" role="status" hidden></div><div class="stick"><i class="stickDot"></i></div><div class="fieldActions">${btn("fieldOut", "Q　하차", "outKey", "hidden")}${btn("fieldJump", "점프", "touchJump")}${btn("fieldUse", "E　상호작용", "interact")}</div></div><div class="fieldFoot"><span><kbd>WASD / ㅈㅁㄴㅇ</kbd> 이동　<kbd>Shift</kbd> 달리기　<kbd>Space</kbd> 점프　<kbd>E / ㄷ</kbd> 조사　<kbd>클릭 · F / ㄹ</kbd> 그물</span><span>드래그 / Z·C 시점　·　휠 확대　·　${btn("fieldMap", "M / ㅡ 손목지도")}</span></div></section>`;
  }
  return {
    load,
    mount,
    stop,
    markup,
    state,
    bank,
    persist,
    purchase,
    shop,
    panelChoice,
    checkDoc,
    refreshWorld: rebuild,
    passengerOut,
    finishRead,
    endShift,
    resetInput,
    fieldBroadcast,
    sky: () => "assets/pixel-sky.webp",
    get frames() {
      return frames;
    },
    get mode() {
      return mode;
    },
    get api() {
      return wasm;
    },
    get active() {
      return !!host;
    },
    use() {
      let phase = state()[7];
      if (phase === 9) endShift();
      else perform(phase >= 3 && phase <= 6 ? 10 : 0);
    },
    jump: () => perform(9),
    out: () => perform(11),
    restart() {
      wasm.rebirth();
      if (!revisit) s.serial++;
      s.fieldCase = null;
      economy();
      save();
      nextVisitor();
    },
    resetCase() {
      subject = null;
    },
  };
})();
