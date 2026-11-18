"use strict";
const DockRun = (() => {
  let run = null,
    ctx = null,
    canvas = null,
    raf = 0,
    last = 0,
    skyImg = null,
    completed;
  const images = new Map();
  function art(kind, id) {
    const k = kind + id;
    if (!images.has(k)) {
      const im = document.createElement("canvas");
      im.width = im.height = 80;
      PortCore.load().then((api) =>
        PortArt.render(im, PortArt.mesh(api, 0, id), 0, 0.54, 0.24, 1),
      );
      images.set(k, im);
    }
    return images.get(k);
  }
  function sprite(im, x, y, w, h) {
    if (im.width) ctx.drawImage(im, x - w / 2, y - h, w, h);
  }
  function path(color, points) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  function project(lane, t) {
    const w = canvas.width,
      h = canvas.height,
      k = 0.05 + 0.95 * t;
    return [w * 0.5 + lane * w * 0.253 * k, h * (0.35 + 0.61 * t * t), k];
  }
  function ground() {
    const w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (skyImg?.complete && skyImg.naturalWidth)
      ctx.drawImage(skyImg, 0, 0, w, h * 0.66);
    path("#827c91", [
      [0, h * 0.39],
      [w, h * 0.39],
      [w, h],
      [0, h],
    ]);
    const poly = (a, b, t, u, col) =>
      path(col, [project(a, t), project(b, t), project(b, u), project(a, u)]);
    poly(-1.65, 1.65, 0, 1.2, "#515971");
    poly(-1.58, 1.58, 0, 1.2, "#676d85");
    for (const x of [-1.55, -0.5, 0.5, 1.55])
      for (let i = 0; i < 12; i++) {
        const t = (i / 12 + run.scroll * 0.25) % 1.07;
        poly(
          x - 0.013,
          x + 0.013,
          t,
          Math.min(1.1, t + 0.037),
          Math.abs(x) > 1 ? "#ffcb75" : "#b4b8c4",
        );
      }
    for (let i = 0; i < 5; i++) {
      const t = (i * 0.205 + run.scroll * 0.25) % 1;
      for (const x of [-1.85, 1.85]) {
        const [cx, cy, k] = project(x, t);
        ctx.fillStyle = "#48516d";
        ctx.fillRect(cx - 3 * k, cy - 36 * k, 6 * k, 36 * k);
        ctx.fillStyle = "#ffe397";
        ctx.fillRect(cx - 5 * k, cy - 38 * k, 10 * k, 6 * k);
      }
    }
    const [ax, ay] = project(-1.52, 0.2),
      [bx] = project(1.52, 0.2);
    ctx.strokeStyle = "#888aa2";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax, ay - h * 0.18);
    ctx.lineTo(bx, ay - h * 0.18);
    ctx.lineTo(bx, ay);
    ctx.stroke();
    ctx.fillStyle = "#ffca6a";
    ctx.fillRect(ax + 3, ay - h * 0.18 - 2, bx - ax - 6, 4);
  }
  function vehicle() {
    const [x, y] = project(run.x, 0.93),
      w = canvas.width,
      h = canvas.height,
      z = Math.min(w / 9, h * 0.29),
      bob = media.matches ? 0 : Math.sin(run.elapsed * 9) * 1.6;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = "#2a334c66";
    ctx.beginPath();
    ctx.ellipse(0, 0, z * 0.64, z * 0.1, 0, 0, 7);
    ctx.fill();
    ctx.translate(0, -z * 0.12);
    for (const side of [-1, 1]) {
      path("#92dded", [
        [side * z * 0.33, -z * 0.03],
        [side * z * 0.53, -z * 0.05],
        [side * z * 0.43, z * (0.15 + 0.04 * Math.sin(run.elapsed * 18))],
      ]);
      path("#695c86", [
        [side * z * 0.29, -z * 0.28],
        [side * z * 0.59, -z * 0.17],
        [side * z * 0.57, -z * 0.05],
        [side * z * 0.25, -z * 0.02],
      ]);
    }
    path("#dd8656", [
      [-z * 0.4, -z * 0.26],
      [-z * 0.22, -z * 0.5],
      [z * 0.22, -z * 0.5],
      [z * 0.4, -z * 0.26],
      [z * 0.29, -z * 0.06],
      [-z * 0.29, -z * 0.06],
    ]);
    path("#ffe0a4", [
      [-z * 0.4, -z * 0.26],
      [-z * 0.24, -z * 0.38],
      [z * 0.24, -z * 0.38],
      [z * 0.4, -z * 0.26],
      [z * 0.24, -z * 0.2],
      [-z * 0.24, -z * 0.2],
    ]);
    path("#3e526f", [
      [-z * 0.24, -z * 0.35],
      [-z * 0.15, -z * 0.48],
      [z * 0.15, -z * 0.48],
      [z * 0.24, -z * 0.35],
    ]);
    ctx.fillStyle = "#8ff3ed";
    ctx.fillRect(-z * 0.15, -z * 0.145, z * 0.3, z * 0.035);
    ctx.restore();
  }
  function paint() {
    ground();
    const h = canvas.height,
      w = canvas.width;
    const t = Math.max(0.035, run.t),
      scale = project(0, t)[2] * Math.min(w * 0.16, h * 0.43);
    run.items.forEach((id, i) => {
      const [x, y, k] = project(i - 1, t);
      ctx.fillStyle = "#373d5477";
      ctx.beginPath();
      ctx.ellipse(x, y, scale * 0.3, scale * 0.07, 0, 0, 7);
      ctx.fill();
      sprite(art("item", id), x, y + scale * 0.08, scale, scale);
    });
    vehicle();
    if (run.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.78, run.flash);
      ctx.fillStyle = run.lastSafe ? "#9bf7d6" : "#ffb699";
      ctx.textAlign = "center";
      ctx.font = `bold ${Math.max(16, Math.round(h * 0.067))}px system-ui`;
      ctx.shadowColor = "#25304c";
      ctx.shadowBlur = 7;
      ctx.fillText(run.bubble, w * 0.5, h * 0.22);
      ctx.restore();
    }
  }
  function next() {
    let goods = [
      Math.floor(Math.random() * 4),
      4 + Math.floor(Math.random() * 2),
      Math.random() < 0.55
        ? 4 + Math.floor(Math.random() * 2)
        : Math.floor(Math.random() * 4),
    ];
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [goods[i], goods[j]] = [goods[j], goods[i]];
    }
    run.items = goods;
    run.t = 0.04;
    updateControls();
  }
  function updateControls() {
    const d = document.querySelector("#runStatus");
    if (!d) return;
    d.textContent = `화물 ${Math.min(12, run.row + 1)} / 12　·　보호막 ${"♥".repeat(run.hp) || "0"}　·　회수 ${run.collected}개`;
    document.querySelectorAll("[data-rail]").forEach((b) => {
      const n = Number(b.dataset.rail);
      b.classList.toggle("chosen", n === run.lane);
      b.setAttribute("aria-pressed", n === run.lane);
      b.setAttribute(
        "aria-label",
        `${["왼쪽", "가운데", "오른쪽"][n + 1]} 레일, ${Orbit.items[run.items[n + 1]]}`,
      );
    });
  }
  function finish() {
    const result = {
      collected: run.collected,
      streak: run.best,
      item: run.sample,
      cleared: run.row === 12 && run.hp > 0,
    };
    stop();
    completed(result);
  }
  function step(t) {
    if (!run) return;
    const dt = Math.min(0.065, Math.max(0, (t - last) / 1000));
    last = t;
    if (!run.paused) {
      run.elapsed += dt;
      run.scroll += dt * 0.45;
      run.flash = Math.max(0, run.flash - dt);
      run.x += (run.lane - run.x) * Math.min(1, dt * 18);
      run.t += dt * (0.29 + run.row * 0.009);
      if (run.t >= 0.94) {
        const id = run.items[run.lane + 1],
          safe = id < 4;
        run.lastSafe = safe;
        run.flash = 0.96;
        run.sample = id;
        if (safe) {
          run.collected++;
          run.streak++;
          run.best = Math.max(run.best, run.streak);
          run.bubble =
            run.streak >= 3 ? `${run.streak}연속 회수!` : "급행편에 실었어요!";
          sound(590 + run.streak * 36);
        } else {
          run.hp--;
          run.streak = 0;
          run.bubble = "위험 화물! 보호막 작동";
          sound(225);
        }
        run.row++;
        if (run.row >= 12 || !run.hp) {
          finish();
          return;
        }
        next();
      }
    }
    paint();
    raf = requestAnimationFrame(step);
  }
  function mount(el, done) {
    stop();
    canvas = el;
    ctx = canvas.getContext("2d");
    const w = Math.max(320, Math.min(850, el.clientWidth));
    canvas.width = w;
    canvas.height = Math.round(w / 2.2);
    if (!skyImg) {
      skyImg = new Image();
      skyImg.src = SpacePort.sky();
    }
    completed = done;
    run = {
      lane: 0,
      x: 0,
      hp: 3,
      row: 0,
      t: 0,
      collected: 0,
      streak: 0,
      best: 0,
      elapsed: 0,
      scroll: 0,
      items: [],
      flash: 0,
      paused: false,
      sample: 0,
    };
    for (let i = 0; i < 6; i++) art("item", i);
    next();
    last = performance.now();
    raf = requestAnimationFrame(step);
  }
  function move(n) {
    if (run && !run.paused) {
      run.lane = Math.max(-1, Math.min(1, n));
      updateControls();
    }
  }
  function pause(force = false) {
    if (!run) return;
    run.paused = force || !run.paused;
    const b = document.querySelector('[data-act="runPause"]');
    if (b) b.textContent = run.paused ? "▶ 계속 달리기" : "Ⅱ 잠시 멈춤";
  }
  function stop() {
    cancelAnimationFrame(raf);
    run = null;
  }
  document.addEventListener("keydown", (e) => {
    if (!run || dlg.open || e.repeat) return;
    const k = { KeyA: "a", KeyD: "d" }[e.code] || e.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d"].includes(k)) {
      e.preventDefault();
      move(run.lane + (["arrowleft", "a"].includes(k) ? -1 : 1));
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause(true);
  });
  return {
    mount,
    move,
    pause,
    stop,
    get active() {
      return !!run;
    },
  };
})();
let recovered = 0;
function runIntro() {
  if (dlg.open) close();
  if (!go("run")) return;
  app.innerHTML = `<section class="console">${missionStrip("run")}<div class="runIntro"><div><span class="micro">화물 회수반 · 보너스 임무</span><h2>급행 레일 출동</h2><p>급식과 축제 물품이 레일에 쏟아졌어요. 회수선을 좌우로 옮겨 안전한 짐을 실으세요. 보호막 3개로 화물 12묶음에 도전해요.</p><div class="actions">${btn("runGo", "▶　회수선 출발", "primary")}${btn("hazard", "위험 화물 도감", "secondary")}</div></div><div class="introCargo">${specimen(0)}${specimen(5)}</div></div></section>`;
}
function runGo() {
  if (DockRun.active) return;
  screen = "run";
  app.innerHTML = `<section class="console">${missionStrip("run")}<div class="race"><div class="split"><div><span class="micro">화물 회수반</span><h2>급행 레일 출동</h2></div>${btn("runPause", "Ⅱ 잠시 멈춤", "secondary")}</div><div id="runStatus" aria-live="off"></div><canvas id="runCanvas" aria-label="앞쪽 세 레일에서 화물이 다가와요. 방향키 또는 아래의 레일 버튼으로 이동하세요."></canvas><div class="rails">${["◀　왼쪽", "●　가운데", "오른쪽　▶"].map((v, i) => btn("rail", v, "secondary", `data-rail="${i - 1}"`)).join("")}</div><small>← → 방향키 또는 레일 버튼으로 이동　·　핵폭탄과 괴물 알을 피하세요.</small></div></section>`;
  DockRun.mount($("#runCanvas"), (r) => {
    recovered = r.item;
    s.score += r.collected * 3;
    s.runs = (s.runs || 0) + 1;
    save();
    runIntro();
    modal(
      `${chip("화물 회수반 · 출동 기록")}${title(r.cleared ? "급행편 적재 완료!" : "회수선 귀환")}<div class="runMedal">✦</div><p>안전한 짐 <b>${r.collected}개</b> 회수 · 최고 <b>${r.streak}연속</b> · ${r.collected * 3} XP</p><p>마지막으로 만난 짐이 검사대에 도착했어요. 통행증도 함께 확인하고 AI의 학습 목록에 추가해 보세요.</p><div class="actions">${btn("recovered", "이 화물 검사하기", "primary")}${btn("runAgain", "다시 출동", "secondary")}</div>`,
    );
  });
}
Object.assign(actions, {
  run: runIntro,
  runGo,
  runAgain: () => {
    close();
    runGo();
  },
  runPause: () => DockRun.pause(),
  rail: (b) => DockRun.move(Number(b.dataset.rail)),
  recovered: () => {
    p = {
      ...Orbit.visitor(s.serial, s.salt + (s.runs || 0) * 39),
      id: "R" + s.runs,
      bag: [recovered, (s.runs || 0) % 4],
    };
    opened = false;
    feedback = false;
    revisit = true;
    tab = "passport";
    desk();
  },
});
