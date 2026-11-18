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
    "근무 결과",
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
      loading = (async () => {
        const r = await fetch("assets/port.wasm?r=12");
        if (!r.ok) throw Error("게임 엔진 다운로드 실패");
        return (await WebAssembly.instantiate(await r.arrayBuffer(), {}))
          .instance.exports;
      })()
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
    gl.disable(gl.CULL_FACE);
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
  function resize() {
    if (!host?.isConnected || !canvas) return;
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
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
  function rebuild() {
    wasm.build_world();
    if (gl) upload(0);
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
        gl.drawArrays(gl.TRIANGLES, 0, wasm.count(d));
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
      s.fieldCase = { id: subject, flags: b[10], resolved: b[11] };
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
    const incident = revisit
      ? 0
      : serial < early.length
        ? early[serial]
        : [3, 2, 4, 1, 2, 3, 1, 4][(serial + (s.salt % 8)) % 8];
    wasm.arrival(
      person.face,
      person.mark || 0,
      ...person.bag,
      tier,
      incident,
      old?.flags || 0,
      old?.resolved || 0,
    );
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
    on(window, "keydown", (e) => {
      if (
        !host ||
        dlg.open ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        !keys.includes(e.code)
      )
        return;
      e.preventDefault();
      keyset.add(e.code);
      if (e.repeat) return;
      const a = { Space: 9, KeyE: 0, KeyQ: 11, KeyF: 10 }[e.code];
      if (a !== undefined) perform(a);
    });
    on(window, "keyup", (e) => keyset.delete(e.code));
    on(window, "blur", resetInput);
    on(document, "visibilitychange", resetInput);
    on(dlg, "close", () => {
      resetInput();
      if (!frame && host?.isConnected) frame = requestAnimationFrame(loop);
    });
    on(canvas, "contextmenu", (e) => e.preventDefault());
    on(canvas, "pointerdown", (e) => {
      canvas.focus({ preventScroll: true });
      viewDrag = [e.pointerId, e.clientX, e.clientY];
      canvas.setPointerCapture(e.pointerId);
    });
    on(canvas, "pointermove", (e) => {
      if (viewDrag?.[0] !== e.pointerId) return;
      wasm.look(
        -(e.clientX - viewDrag[1]) * 0.009,
        (e.clientY - viewDrag[2]) * 0.007,
        0,
      );
      viewDrag = [e.pointerId, e.clientX, e.clientY];
    });
    on(canvas, "pointerup", () => (viewDrag = null));
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
    const full = state()[17] < 2;
    const goods = full ? p.bag : [p.bag[n]];
    inspect(
      n === 0 ? 2 : 3,
      `${chip("트럭 화물 검사")}${title(full ? "화물칸 안쪽" : `${n + 1}번 화물칸`)}<div class="guideItems">${goods.map((id, i) => `<figure>${pic("item", id, Orbit.items[id])}<figcaption>${full ? i + 1 : n + 1}번 짐</figcaption></figure>`).join("")}</div><div class="note">위험 화물　${pic("item", 4, "핵폭탄", "tinyItem")} 핵폭탄　${pic("item", 5, "우주 괴물의 알", "tinyItem")} 괴물 알</div>${btn("close", "검사 기록하고 돌아가기", "primary")}`,
    );
  }
  function pump() {
    const e = wasm.take_event();
    if (!e) return;
    statusKey = "";
    if (e === 1) {
      inspect(
        1,
        `${chip("운전석 · " + p.name)}${title("성간 운송 허가증")}<p>오늘 <b>${date(p.today)}</b>　/　마지막 사용일 <b>${date(p.until)}</b></p>${matchPanel(p)}<div class="actions">${btn("close", "서류 확인 완료", "primary")}${btn("askOut", "운전자 하차 요청", "secondary")}</div>`,
      );
    }
    if (e === 2 || e === 3) reportCargo(e - 2);
    if (e === 4 || e === 5) {
      opened = true;
      label(e === 4);
      const pay = wasm.reward(+(Orbit.allowed(p) === (e === 4)));
      toast(`${Orbit.explain(p)}　·　정산 ${pay >= 0 ? "+" : ""}${pay} CR`);
      if (s.rows.length === 2)
        fieldBroadcast(
          "AI 관제실에서 처음 모은 두 사례로 모델을 학습할 수 있어요.",
          5500,
        );
    }
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
          "도주 경보! 트럭을 따라가 F로 그물을 펼치세요.",
          "화물칸에서 괴물이 나왔어요! 거리를 벌리고 F로 포획하세요.",
          "펜스 쪽으로 달려갑니다! 따라가 F로 포획하세요.",
        ][e - 12],
        5500,
      );
      sound(265);
    }
    if (e === 15) {
      modal(
        `${chip("운전자의 제안")}${title("“6크레딧이면 빨리 갈 수 있지?”")}<p>운전자가 슬쩍 동전을 내밉니다. 뒤에는 차례를 기다리는 친구들이 있어요.</p><div class="actions">${btn("decline", "거절하고 기록하기", "primary")}${btn("accept", "6 CR 받기", "secondary")}</div>`,
      );
    }
    if (e === 20 || e === 21) {
      toast(e === 20 ? "그물 포획 성공! +9 CR" : "자동 방어 성공! +4 CR");
      sound(820);
    }
    if (e === 22) {
      const life = bank()[1];
      toast(`보호막 1개 소모 · 남은 목숨 ${life}개`);
      if (!life) endShift();
    }
    if (e === 23) toast("그물이 닿지 않았어요. 가까이 이동하세요.");
    if (e === 24 || e === 25) {
      if (e === 25 && !revisit) s.serial++;
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
      "AI가 추가 차로를 맡아요. 현장 근무 중 자동 운송 수입이 생겨요.",
    ],
    ["그물총", "사거리가 2.7m 늘고 재충전이 0.3초 빨라져요."],
    ["펄스 펜스", "1단계는 월담을 막고, 2단계는 출구의 도주 트럭도 멈춰요."],
    [
      "자동 그물 포탑",
      "반경 안의 위협을 자동 포획해요. 2단계는 더 멀리, 더 빨리 반응해요.",
    ],
    ["레인저 부츠", "걷기와 달리기 속도가 빨라져요."],
    ["우주 콘도 회원권", "담당 레일 2개와 항로 방어 성공 1회가 필요해요."],
  ];
  function shop() {
    const b = bank();
    modal(
      `${chip("제7 우주항 정비소")}${title("장비와 운송권")}<p>잔액 <b>${b[0]} CR</b>　·　정확한 직접 검사 +16 CR　·　자동 레일은 학습한 모델을 사용해요.</p><div class="storeList">${upgrades
        .map(([n, txt], i) => {
          const level = b[[2, 3, 4, 5, 6, 7][i]],
            price = wasm.price(i),
            locked = i === 5 && (!s.wins.length || b[2] < 2);
          return `<div><section><b>${n} <small>${i === 5 ? (level ? "보유" : "최종 목표") : "Lv." + level}</small></b><small>${txt}</small></section>${btn("upgrade", price ? price + " CR" : "완료", "secondary", `data-i="${i}" ${!price || price > b[0] || locked ? "disabled" : ""}`)}</div>`;
        })
        .join("")}</div>${btn("close", "현장으로", "primary")}`,
    );
  }
  function purchase(i) {
    const res = wasm.buy(i, +!!s.wins.length);
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
    if (!turns || !s.models.length) return;
    const b = bank(),
      m = s.models.at(-1);
    s.autoTrips ??= 0;
    const test = Orbit.wave(100000 + ++s.autoTrips, 0, s.salt);
    let paid = 0;
    for (let i = 0; i < b[2] - 1; i++) {
      const x = Orbit.run(m.tree, m.wire, test[i]);
      paid += x.ok ? 6 : 1;
    }
    wasm.auto_pay(paid);
    persist();
    fieldBroadcast(
      `자동 레일 ${b[2] - 1}개 정산 +${paid} CR · 모델 ${m.v}`,
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
                ? "도주 트럭 추격"
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
    const key = [
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
      host.querySelector(".taskText").textContent = message;
      host.querySelector(".fieldBank").textContent = `${st[20]} CR`;
      host.querySelector(".fieldLife").textContent =
        "♥".repeat(st[14]) + "♡".repeat(3 - st[14]);
      const e = host.querySelector(".interact");
      const valid = phase === 1 && near > 0;
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
        `${p.name}의 트럭　·　학습 사례 ${s.rows.length}개`;
    }
    const dest = isChase ? 10 : goal,
      el = host.querySelector(".waypoint");
    let off = wasm.project(dest, canvas.width / canvas.height),
      v = new Float32Array(wasm.memory.buffer, off, 3);
    el.hidden = !(phase === 1 || isChase) || v[2] < 0.3;
    if (!el.hidden) {
      const x = Math.max(8, Math.min(92, 50 + v[0] * 50)),
        y = Math.max(12, Math.min(79, 50 - v[1] * 50));
      el.style.left = x + "%";
      el.style.top = y + "%";
      el.textContent = isChase
        ? "◇　포획 대상"
        : goal === 4
          ? "▼　통과"
          : `▼　${labels[goal]}`;
    }
    for (const marker of host.querySelectorAll("[data-site]")) {
      const id = Number(marker.dataset.site);
      marker.hidden = phase !== 1 || (id === 5 && goal !== 4);
      if (marker.hidden) continue;
      const ptr = wasm.project(id, canvas.width / canvas.height),
        m = new Float32Array(wasm.memory.buffer, ptr, 3);
      const nx = m[0],
        ny = m[1];
      marker.hidden =
        m[2] < 1 || Math.abs(nx) > 0.92 || ny < -0.74 || ny > 0.73;
      if (!marker.hidden) {
        marker.style.left = 50 + 50 * nx + "%";
        marker.style.top = 50 - 50 * ny + "%";
      }
    }
    if (t > bannerTime) host.querySelector(".fieldRadio").hidden = true;
  }
  function loop(t) {
    frame = 0;
    if (!host?.isConnected || !wasm) return;
    if (document.hidden || dlg.open) {
      resetInput();
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
      slow = Math.max(0, slow - 1);
    }
    if (slow >= 10 && scale > 0.38) {
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
    return `<section class="fieldShell"><div class="fieldHead"><div><small>제7 우주항　/　검문 근무</small><strong>${Orbit.missions[s.stage].name}</strong></div><div>${btn("book", "판정 목록")}${btn("lab", "AI 관제실")}${btn("ranger", "결과표")}</div></div><div class="portWorld" id="world"><div class="loadingPort">우주항 진입 중…</div><div class="taskBox"><small class="fieldCaseNo"></small><b class="taskText">트럭을 기다리세요</b></div><div class="moneyHUD"><b class="fieldLife"></b><b class="fieldBank"></b></div><span class="waypoint" hidden></span><span class="mapPin stopPin" data-site="5" hidden>▼ 보류</span><span class="mapPin" data-site="6" hidden>정비소</span><span class="mapPin" data-site="7" hidden>AI 관제실</span><div class="fieldRadio" role="status" hidden></div><div class="stick"><i class="stickDot"></i></div><div class="fieldActions">${btn("fieldOut", "Q　하차", "outKey", "hidden")}${btn("fieldJump", "점프", "touchJump")}${btn("fieldUse", "E　상호작용", "interact")}</div></div><div class="fieldFoot"><span><kbd>WASD</kbd> 이동　<kbd>Shift</kbd> 달리기　<kbd>Space</kbd> 점프　<kbd>E</kbd> 조사　<kbd>F</kbd> 그물</span><span>드래그 / Z·C 시점　·　휠 확대　${btn("hazard", "화물 도감")}</span></div></section>`;
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
    passengerOut,
    finishRead,
    endShift,
    resetInput,
    fieldBroadcast,
    sky: () => "assets/sky.webp",
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
