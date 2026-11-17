"use strict";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  dlg = $("#dialog"),
  PUBLIC = "https://207studio-founder.github.io/orbit-gate-academy/";
const media = matchMedia("(prefers-reduced-motion:reduce)"),
  key = "orbit-gate-class-v1";
const newGame = () => ({
  v: 1,
  salt: Math.floor(Math.random() * 1e8),
  serial: 0,
  stage: 0,
  wins: [],
  round: 0,
  score: 0,
  combo: 0,
  rows: [],
  models: [],
  version: 0,
  rev: 0,
  report: null,
  reflection: null,
  sound: false,
});
let s = newGame(),
  storageOK = true;
try {
  const raw = JSON.parse(localStorage.getItem(key));
  if (raw?.v === 1 && Array.isArray(raw.rows) && Array.isArray(raw.models))
    s = { ...s, ...raw };
} catch {}
let screen = "home",
  p = null,
  opened = false,
  feedback = false,
  revisit = false,
  tab = "passport",
  features = [0, 1, 2, 3],
  wire = ["open", "hold"],
  slots = [],
  live = null,
  bookTab = true,
  toastTimer,
  ac,
  prevFocus = null;
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    if (storageOK)
      toast("이 창에서는 저장이 어려워요. 창을 열어 두고 플레이하세요.");
    storageOK = false;
  }
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("on"), 2900);
}
function sound(freq = 550) {
  if (!s.sound) return;
  try {
    ac ??= new AudioContext();
    ac.resume();
    const t = ac.currentTime,
      o = ac.createOscillator(),
      g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.28, t + 0.09);
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(t + 0.18);
  } catch {}
}
function btn(act, txt, cls = "", extra = "") {
  return `<button class="${cls}" data-act="${act}" ${extra}>${txt}</button>`;
}
function pic(kind, id, alt = "", cls = "") {
  return `<img class="${cls}" src="assets/${kind}-${id}.webp" alt="${alt}" draggable="false">`;
}
function face(id) {
  return pic("face", id, `얼굴 ${id + 1}, ${Orbit.species[id % 4]}`);
}
function chip(s) {
  return `<span class="chip">${s}</span>`;
}
function title(s) {
  return `<h2>${s}</h2>`;
}
function date(s) {
  return s.replaceAll("-", ". ");
}
function modal(html) {
  dlg.classList.remove("projector");
  if (!dlg.open) {
    prevFocus = document.activeElement;
    dlg.showModal();
  }
  $("#dialogBody").innerHTML = html;
  dlg.scrollTop = 0;
  dlg.querySelector(".close").focus({ preventScroll: true });
}
function close() {
  if (dlg.open) dlg.close();
}
dlg.addEventListener("close", () => {
  if (prevFocus?.isConnected) prevFocus.focus({ preventScroll: true });
});
dlg.addEventListener("click", (e) => {
  if (e.target === dlg) {
    const r = dlg.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      close();
  }
});
function soundLabel() {
  const b = $("[data-act=sound]");
  b.innerHTML = `♬ <span>${s.sound ? "켜짐" : "꺼짐"}</span>`;
  b.setAttribute("aria-pressed", s.sound);
  b.setAttribute("aria-label", "효과음 " + (s.sound ? "끄기" : "켜기"));
}
function go(name) {
  if (live && !live.done && name !== "lab") {
    toast("수송대가 이동 중이에요. 잠시 뒤 결과가 나와요.");
    return false;
  }
  if (typeof DockRun !== "undefined") DockRun.stop();
  SpacePort.stop();
  close();
  screen = name;
  window.scrollTo(0, 0);
  return true;
}
function home() {
  if (!go("home")) return;
  app.innerHTML = `<section class="cover"><div class="hero"><div class="heroCopy"><span class="portTag"><i></i> 제7 우주항 방어대</span><h1>오르빗<br>게이트</h1><p>마지막 셔틀이 떠나기 전,<br>나만의 AI로 우주항을 지켜라!</p>${btn("start", `<span class="playTri">▶</span> ${s.serial || s.rows.length ? "이어서 근무하기" : "첫 근무 시작"}`, "primary heroBtn")}</div><span class="coverSerial">OG – 07 &nbsp;/&nbsp; LUNAR PORT</span></div><div class="boarding"><div class="ticketIcon"><span>✦</span></div><div><small>오늘의 운항 임무</small><h2>${Orbit.missions[s.stage].name}</h2></div><div class="boardingLine"></div><div class="ticketEnd"><small>도착지</small><b>${Orbit.missions[s.stage].place}</b></div><div class="barcode" aria-hidden="true"></div></div></section>
 <div class="homefoot"><span>초등 6학년 실과 · 인공지능이 만들어지는 과정</span><span>개인 플레이 &nbsp; / &nbsp; 최대 4개 게이트</span></div>`;
}
function guide() {
  modal(
    `${chip("신입 대원 안내서")}${title("첫 근무, 이렇게 해요")}<ol class="steps"><li><b>방문객을 살펴요.</b> 오늘 날짜와 통행증의 마지막 날, 실제 얼굴과 사진을 비교해요. 마지막 날 당일까지 쓸 수 있어요.</li><li><b>화물칸을 열어요.</b> 두 칸의 물건을 위험 화물 도감과 비교해요. 날짜·얼굴·짐이 모두 맞으면 통과, 다시 살펴야 하면 보류예요.</li><li><b>내 판정으로 AI를 가르쳐요.</b> 사례 2개부터 모델을 만들 수 있어요. 어떤 단서를 줄지 고른 뒤, 예측마다 게이트 동작을 연결해요.</li><li><b>새 수송대를 맞이해요.</b> 1~4개 게이트가 같은 방문객을 어떻게 처리하는지 지켜보세요. 실수한 사례를 다시 검사해 모델을 개선해요.</li></ol>${btn("close", "알겠어요", "primary")}`,
  );
}
function teacher() {
  modal(
    `${chip("교실용 탑승권")}${title("QR로 우주항 입장")}<div class="qrpair"><img src="assets/join.png" alt="학생 게임 접속 QR코드"><div><b>크롬북 카메라로 스캔하세요.</b><p>학생은 각자 자기 기기에서 시작을 눌러요. 이 브라우저에 진행 상황이 저장됩니다.</p><a href="${PUBLIC}" target="_blank" rel="noopener">${PUBLIC}</a></div></div><h3>40분 수업 예시</h3><p>입장·첫 안내 5분 → 통행증과 화물 검사 12분 → 모델 학습·게이트 연결·비교 15분 → 생활 속 사례로 돌아보기 8분</p><div class="note">마무리 질문　“내가 탈 수 있는 셔틀을 AI가 잘못 막았다면, 누가 무엇을 다시 살펴야 할까?”</div><a class="button primary" href="assets/join.png" download="오르빗게이트-학생QR.png">QR코드 저장</a>`,
  );
  dlg.classList.add("projector");
}
function hazard() {
  modal(
    `${chip("검사대 비치용")}${title("위험 화물 도감")}<p>이 두 물건이 하나라도 있으면 화물을 보류해요.</p><div class="guideItems">${[4, 5].map((i) => `<figure>${pic("item", i, Orbit.items[i])}<figcaption>${Orbit.items[i]}</figcaption><small>${i === 4 ? "노란 띠와 짧은 심지" : "초록 반점이 있는 보라색 알"}</small></figure>`).join("")}</div><h3>이 물건들은 실어도 좋아요</h3><div class="safeItems">${[0, 1, 2, 3].map((i) => `<div>${pic("item", i, Orbit.items[i])}<small>${Orbit.items[i]}</small></div>`).join("")}</div>${btn("close", "검사 계속하기", "primary")}`,
  );
}
function missionStrip(active) {
  const m = Orbit.missions[s.stage];
  return `<div class="consoleTop"><div><span class="micro">제7 우주항　/　항로 ${String(s.stage + 1).padStart(2, "0")}</span><h1>${m.name}</h1></div><div class="xp">✦ <b>${s.score}</b> XP</div></div><div class="tabs">${[
    ["desk", "검사대"],
    ["book", "판정 목록"],
    ["lab", "자동 방어실"],
    ["run", "급행 레일"],
  ]
    .map(([a, label]) =>
      btn(
        a,
        `${label}${a === "book" ? ` <small>${s.rows.length}</small>` : ""}`,
        active === a ? "selected" : "",
        active === a ? 'aria-current="page"' : "",
      ),
    )
    .join("")}</div>`;
}
function start() {
  if (!p || feedback) {
    nextVisitor(false);
  } else desk();
  if (s.rows.length === 0)
    modal(
      `${chip("관제 로봇 피코의 첫 무전")}${title("학교행 셔틀이 도착했어요")}<p>${Orbit.missions[0].story}</p><div class="radioHint">“통행증의 날짜와 얼굴을 확인하고, 화물칸을 열어 봐. 네가 내린 판정이 내 첫 교과서야!”</div>${btn("close", "첫 방문객 만나기", "primary")}`,
    );
}
function nextVisitor(fromButton = true) {
  if (fromButton && live && !live.done) return;
  p = Orbit.visitor(s.serial, s.salt);
  opened = false;
  feedback = false;
  revisit = false;
  tab = "passport";
  desk();
}
function docPanel() {
  if (tab === "cargo")
    return `<div class="cargoPanel"><div class="paperTitle"><span>화물 검사 트레이</span><b>02</b></div><h3>${p.name}의 화물칸</h3><div class="tray">${p.bag.map((id, i) => `<div><small>${i + 1}번 칸</small>${pic("item", id, Orbit.items[id])}</div>`).join("")}</div>${btn("hazard", "▤　위험 화물 도감", "catalog")}</div>`;
  return `<div class="passport"><div class="paperTitle"><span>행성 간 통행증</span><b>✦</b></div><div class="identity"><div class="idPhoto">${face(p.photo)}</div><div><small>이름</small><strong>${p.name}</strong><small>탑승 항구</small><b>제7 우주항</b></div></div><div class="until"><small>사용할 수 있는 마지막 날</small><b>${date(p.until)}</b></div><div class="paperFoot"><i></i><span>ORBIT TRANSIT　✦　07</span></div></div>`;
}
function reportLine() {
  const ok = Orbit.allowed(p),
    row = s.rows.find((x) => x.p.id === p.id);
  return `<div class="verdict ${row?.pass === ok ? "good" : "oops"}" role="status"><b>${row?.pass === ok ? (s.combo >= 3 ? `${s.combo}연속 정확한 판정!` : "정확한 판정!") : "다시 볼 단서를 찾았어요"}</b><span>${Orbit.explain(p)}</span></div><div class="actions">${row && row.pass !== ok ? btn("repair", "판정 고치기", "secondary") : ""}${btn("next", "다음 방문객　→", "primary")}${s.rows.length >= 2 ? btn("lab", "AI 학습하기", "secondary") : ""}</div>`;
}
function desk() {
  if (!go("desk")) return;
  if (!p) p = Orbit.visitor(s.serial, s.salt);
  app.innerHTML = `<section class="console">${missionStrip("desk")}<div class="workbench"><div class="visual"><div class="sceneHUD"><span><i></i> 방문객 검사</span><b>오늘 ${date(p.today)}</b></div><div id="world" role="img" aria-label="실제 방문객 ${p.name}, 얼굴 ${p.face + 1}, ${Orbit.species[p.face % 4]}"></div><div class="sceneControls"><span>제7 탑승구</span><div>${btn("compare", "얼굴 대조", "compare")}${btn("left", "↶", "", 'aria-label="왼쪽에서 보기"')}${btn("right", "↷", "", 'aria-label="오른쪽에서 보기"')}</div></div><div class="speech"><span>${p.name}</span> “${p.line}”</div></div><div class="evidence"><div class="documentTabs">${btn("passport", "통행증", tab === "passport" ? "chosen" : "")}${btn("cargo", opened ? "화물칸 보기" : "▣　화물칸 열기", tab === "cargo" ? "chosen" : "")}</div><div id="doc">${docPanel()}</div></div></div><div class="decision" id="decision">${feedback ? reportLine() : decisionBar()}</div></section>`;
  SpacePort.mount($("#world"), p, tab === "cargo");
  if (feedback) SpacePort.leave(s.rows.find((x) => x.p.id === p.id)?.pass);
}
function decisionBar() {
  return `<div class="prompt"><b>${opened ? "이 방문객의 판정은?" : "통행증과 짐을 확인하세요"}</b><small>${opened ? "오늘 날짜·사진·두 칸의 짐을 함께 살펴요." : "통행증을 살핀 뒤 오른쪽 화물칸을 여세요."}</small></div><div class="actions">${btn("hazard", "위험 화물 도감", "ghost")}${btn("hold", "Ⅱ　보류", "hold", opened ? "" : "disabled")}${btn("pass", "✓　통과", "pass", opened ? "" : "disabled")}</div>`;
}
function compareFaces() {
  modal(
    `${chip("통행증 대조")}${title("같은 방문객일까요?")}<div class="guideItems facePair"><figure>${face(p.face)}<figcaption>지금 내 앞의 얼굴</figcaption></figure><figure>${face(p.photo)}<figcaption>통행증에 있는 사진</figcaption></figure></div><p>두 얼굴의 생김새와 색을 비교해요.</p>${btn("close", "검사 계속하기", "primary")}`,
  );
}
function changeDoc(which) {
  tab = which;
  if (which === "cargo") opened = true;
  SpacePort.setOpen(which === "cargo");
  $("#doc").innerHTML = docPanel();
  document
    .querySelectorAll(".documentTabs button")
    .forEach((b) => b.classList.toggle("chosen", b.dataset.act === which));
  if (opened) $("[data-act=cargo]").textContent = "화물칸 보기";
  if (!feedback) $("#decision").innerHTML = decisionBar();
  sound(390);
}
function label(pass) {
  if (!opened || feedback || !p) return;
  let row = s.rows.find((x) => x.p.id === p.id);
  if (row) {
    row.pass = pass;
  } else {
    s.rows.push({ p, pass });
    if (!revisit) s.serial++;
  }
  s.rev++;
  feedback = true;
  const ok = pass === Orbit.allowed(p);
  s.combo = ok ? s.combo + 1 : 0;
  s.score += ok ? 10 + Math.min(s.combo - 1, 5) * 2 : 1;
  save();
  sound(ok ? 680 : 280);
  SpacePort.leave(pass);
  $("#decision").innerHTML = reportLine();
}
function repair() {
  const row = s.rows.find((x) => x.p.id === p.id);
  if (row && row.pass !== Orbit.allowed(p)) {
    row.pass = !row.pass;
    s.rev++;
    save();
    $("#decision").innerHTML = reportLine().replace(
      "정확한 판정!",
      "판정을 고쳤어요",
    );
    toast("학습 목록에 수정한 판정을 저장했어요.");
  }
}
function notebook(filter = bookTab) {
  if (!go("book")) return;
  bookTab = filter;
  const rows = s.rows.filter((r) => r.pass === filter);
  app.innerHTML = `<section class="console">${missionStrip("book")}<div class="pagePaper"><div class="split"><div><span class="micro">학습 데이터</span><h2>내가 붙인 판정</h2></div>${btn("desk", "검사대로", "secondary")}</div><p>이 목록이 모델의 교과서예요. 단서를 다시 보고 판정을 고칠 수 있어요.</p><div class="bookFilter">${btn("showPass", `통과　${s.rows.filter((r) => r.pass).length}`, filter ? "chosen" : "")}${btn("showHold", `보류　${s.rows.filter((r) => !r.pass).length}`, filter ? "" : "chosen")}</div><div class="records">${
    rows.length
      ? rows
          .slice()
          .reverse()
          .map(
            (row) =>
              `<button data-act="record" data-id="${row.p.id}">${face(row.p.face)}<span><b>${row.p.name}</b><small>${date(row.p.today)} 검사</small></span><i>다시 보기 ›</i></button>`,
          )
          .join("")
      : "<p>아직 이 목록에 방문객이 없어요.</p>"
  }</div></div></section>`;
}
function record(id) {
  const r = s.rows.find((x) => x.p.id === id);
  if (!r) return;
  modal(
    `${chip("학습 사례 다시 보기")}${title(r.p.name + "의 기록")}<div class="reviewFaces"><figure>${face(r.p.face)}<figcaption>실제 얼굴</figcaption></figure><figure>${face(r.p.photo)}<figcaption>통행증 사진</figcaption></figure>${r.p.bag.map((n, i) => `<figure>${pic("item", n, Orbit.items[n])}<figcaption>짐 ${i + 1}</figcaption></figure>`).join("")}</div><p>검사일 <b>${date(r.p.today)}</b><br>통행증 마지막 날 <b>${date(r.p.until)}</b></p><p>${Orbit.explain(r.p)}</p><p>내 판정　<b>${r.pass ? "통과" : "보류"}</b></p>${btn("flip", `${r.pass ? "보류" : "통과"} 목록으로 옮기기`, "secondary", `data-id="${id}"`)}`,
  );
}

function modelEditor() {
  if (live && !live.done) return;
  if (s.rows.length < 2) {
    modal(
      `${title("첫 교과서를 채워 주세요")}<p>검사대에서 방문객 ${2 - s.rows.length}명을 더 판정하면 모델을 학습할 수 있어요.</p>${btn("desk", "검사하러 가기", "primary")}`,
    );
    return;
  }
  modal(
    `${chip("모델 학습 · 게이트 프로그래밍")}${title("새 방어 모델 만들기")}<p>내가 판정한 ${s.rows.length}개 사례에서 AI가 어떤 단서를 비교할까요?</p><div class="checks">${Orbit.featureNames.map((v, i) => `<label><input type="checkbox" name="feature" value="${i}" ${features.includes(i) ? "checked" : ""}> ${v}</label>`).join("")}</div><h3>예측과 동작 연결</h3><p>AI의 예측을 받으면 게이트가 무엇을 할지 정해요.</p><div class="wires">${["통과", "보류"].map((v, i) => `<label><span>${v}로 예측하면</span><i>→</i><select id="wire${i}"><option value="open" ${wire[i] === "open" ? "selected" : ""}>문 열기</option><option value="hold" ${wire[i] === "hold" ? "selected" : ""}>검사대로 보내기</option></select></label>`).join("")}</div>${btn("train", "이 설정으로 학습하기", "primary")}`,
  );
}
function train() {
  features = [...document.querySelectorAll("input[name=feature]:checked")].map(
    (el) => Number(el.value),
  );
  if (!features.length) {
    toast("학습할 단서를 하나 이상 골라 주세요.");
    return;
  }
  wire = [$("#wire0").value, $("#wire1").value];
  const prev = s.models.at(-1);
  if (
    prev &&
    prev.rev === s.rev &&
    String(prev.features) === String(features) &&
    String(prev.wire) === String(wire)
  ) {
    close();
    toast("같은 설정의 모델이 이미 준비되어 있어요.");
    return;
  }
  const m = {
    v: ++s.version,
    count: s.rows.length,
    rev: s.rev,
    tree: Orbit.fit(s.rows, features),
    features: [...features],
    wire: [...wire],
  };
  s.models.push(m);
  if (s.models.length > 12) s.models.shift();
  slots = slots.filter((v) => s.models.some((m) => m.v === v));
  if (!slots.length) slots = [m.v];
  else if (slots.length < 4) slots.push(m.v);
  else slots[slots.length - 1] = m.v;
  save();
  close();
  sound(800);
  lab();
  toast(`모델 ${m.v} 학습 완료 · 사례 ${m.count}개`);
}
function lab() {
  if (!go("lab")) return;
  if (s.models.length && !slots.length) slots = [s.models.at(-1).v];
  const m = Orbit.missions[s.stage],
    rolling = live && !live.done;
  app.innerHTML = `<section class="console">${missionStrip("lab")}<div class="labMain"><div class="labTitle"><div><span class="micro">수송대 자동 방어</span><h2>${rolling ? "수송대 진입 중" : "게이트 관제실"}</h2><p>${m.name} · ${m.n}명 중 ${m.target}명 이상 정확하게 판정하면 항로가 열려요.</p></div>${btn("model", "＋ 모델 학습", "secondary", rolling ? "disabled" : "")}</div>
 ${slots.length ? `<div class="lanes" id="lanes">${slots.map((v, i) => laneCard(v, i, rolling)).join("")}</div><div class="launchBar"><div>${btn("add", "＋ 비교 게이트", "secondary", slots.length >= 4 || rolling ? "disabled" : "")} <small>${slots.length} / 4</small></div>${btn("launch", rolling ? "수송대 이동 중…" : "▶　수송대 출발", "primary", rolling ? "disabled" : "")}</div>` : `<div class="emptyLab"><div class="robotEye">✦</div><h3>첫 게이트에 AI를 장착해요</h3><p>${s.rows.length < 2 ? `사례가 ${2 - s.rows.length}개 더 필요해요. 검사대에서 방문객을 만나세요.` : `모은 사례 ${s.rows.length}개로 첫 모델을 만들어 보세요.`}</p>${s.rows.length < 2 ? btn("desk", "검사하러 가기", "primary") : btn("model", "첫 모델 만들기", "primary")}</div>`}
 <div id="afterLab">${!rolling && s.report ? summaryBlock() : ""}</div></div></section>`;
  if (rolling) drawTick();
}
function laneCard(version, i, rolling) {
  const m = s.models.find((x) => x.v === version) || s.models.at(-1);
  return `<div class="lane" data-lane="${i}"><div class="laneHead"><b><i></i> 게이트 ${"ABCD"[i]}</b><div><select aria-label="게이트 ${"ABCD"[i]} 모델" data-slot="${i}" ${rolling ? "disabled" : ""}>${s.models.map((a) => `<option value="${a.v}" ${a.v === version ? "selected" : ""}>모델 ${a.v} · ${a.count}개 사례</option>`).join("")}</select>${slots.length > 1 ? btn("remove", "×", "remove", `data-i="${i}" aria-label="게이트 ${"ABCD"[i]} 빼기" ${rolling ? "disabled" : ""}`) : ""}</div></div>
 <div class="laneView"><div class="distant"></div><div class="laneRoad"></div><div class="tracks"></div><div class="gateway"><i></i></div><div class="traveller"></div><span class="laneTag">제7 우주항</span></div><div class="laneData"><span class="laneText">${m.features.map((n) => Orbit.featureNames[n]).join(" · ")}</span><strong class="laneScore">대기</strong></div><div class="charge"><i></i></div></div>`;
}
function launch() {
  if (!slots.length || (live && !live.done)) return;
  const batch = Orbit.wave(++s.round, s.stage, s.salt),
    models = slots.map((v) => s.models.find((m) => m.v === v));
  live = {
    stage: s.stage,
    batch,
    lanes: models.map((m) => ({
      version: m.v,
      count: m.count,
      m,
      results: [],
    })),
    pos: 0,
    done: false,
    at: performance.now(),
    timer: 0,
  };
  save();
  lab();
  sound(450);
  advance();
}
function advance() {
  const l = live;
  if (!l || l.done) return;
  if (l.pos === l.batch.length) {
    finishWave();
    return;
  }
  const visitor = l.batch[l.pos++];
  for (const lane of l.lanes) {
    lane.results.push(Orbit.run(lane.m.tree, lane.m.wire, visitor));
  }
  l.at = performance.now();
  drawTick();
  l.timer = setTimeout(advance, media.matches ? 490 : 980);
}
function drawTick() {
  if (screen !== "lab" || !live) return;
  live.lanes.forEach((lane, i) => {
    const el = document.querySelector(`[data-lane="${i}"]`),
      r = lane.results.at(-1);
    if (!el || !r) return;
    const v = el.querySelector(".laneView"),
      trav = el.querySelector(".traveller"),
      score = lane.results.filter((x) => x.ok).length;
    v.className =
      "laneView " +
      (r.open ? "openGate" : "holdGate") +
      " " +
      (r.ok ? "laneOK" : "laneMiss");
    trav.className = "traveller";
    trav.innerHTML = pic("actor", r.p.face, "");
    void trav.offsetWidth;
    trav.classList.add(r.open ? "passing" : "holding");
    el.querySelector(".laneText").textContent =
      `${r.p.name} · ${r.open ? "문 열림" : "보류 구역"} · ${r.ok ? "정확" : "재검토"}`;
    el.querySelector(".laneScore").textContent = `${score} / ${live.pos}`;
    el.querySelector(".charge i").style.width =
      (100 * live.pos) / live.batch.length + "%";
  });
}
function finishWave() {
  const l = live;
  l.done = true;
  const lanes = l.lanes.map((a) => ({
    v: a.version,
    count: a.count,
    correct: a.results.filter((r) => r.ok).length,
    miss: a.results.filter((r) => !r.safe && r.open).length,
    delay: a.results.filter((r) => r.safe && !r.open).length,
    results: a.results,
  }));
  const mission = Orbit.missions[l.stage],
    best = Math.max(...lanes.map((a) => a.correct));
  const cleared = lanes.some(
    (a) => a.correct >= mission.target && a.count >= mission.need,
  );
  s.report = {
    stage: l.stage,
    round: s.round,
    lanes,
    total: l.batch.length,
    cleared,
    best,
  };
  if (cleared && !s.wins.includes(l.stage)) {
    s.wins.push(l.stage);
    s.score += 50;
  }
  save();
  sound(cleared ? 890 : 470);
  lab();
  $("#afterLab").scrollIntoView({
    behavior: media.matches ? "instant" : "smooth",
    block: "nearest",
  });
}
function summaryBlock() {
  const r = s.report,
    m = Orbit.missions[r.stage],
    top = r.lanes.reduce((a, b) => (a.correct >= b.correct ? a : b));
  return `<section class="result"><div class="resultTop"><div><span class="micro">수송대 ${r.round} · ${m.name}</span><h2>${r.cleared ? "✦　항로 방어 성공" : "방어 결과 도착"}</h2></div><b>${top.correct}<small> / ${r.total}명</small></b></div><div class="scoreTable"><table><thead><tr><th>게이트</th><th>정확</th><th>잘못 통과</th><th>잘못 보류</th></tr></thead><tbody>${r.lanes.map((a, i) => `<tr><td>${"ABCD"[i]} · 모델 ${a.v}</td><td>${a.correct}</td><td>${a.miss}</td><td>${a.delay}</td></tr>`).join("")}</tbody></table></div><p>${r.cleared ? "가장 정확한 게이트에서 보류할 방문객을 잘못 통과시킨 건 " + top.miss + "건, 안전한 승객을 잘못 세운 건 " + top.delay + "건이에요." : `항로 개방 조건은 학습 사례 ${m.need}개 이상인 모델로 ${m.target}명 이상 정확하게 판정하는 거예요. 검사대에서 다른 사례를 모아 보세요.`}</p><div class="actions">${btn("review", "운항 기록 보기", "secondary")}${r.cleared && s.stage === r.stage && r.stage < 2 ? btn("unlock", "다음 항로 열기　→", "primary") : btn("next", "새 사례 수집", "primary")}${btn("reflect", s.wins.includes(2) ? "근무 마치기" : "생활 속으로", "ghost")}</div></section>`;
}
function review() {
  const r = s.report;
  if (!r) return;
  modal(
    `${chip("수송대 " + r.round + " 운항 기록")}${title("같은 방문객, 다른 결과")}<p>게이트별 결과를 비교해요. 방문객을 골라 직접 다시 검사하면 다음 모델의 학습 사례로 쓸 수 있어요.</p><div class="reviewList">${r.lanes[0].results.map((x, i) => `<button data-act="study" data-i="${i}">${face(x.p.face)}<span><b>${x.p.name}</b><small>${r.lanes.map((l, j) => `${"ABCD"[j]} ${l.results[i].open ? "통과" : "보류"}${l.results[i].ok ? " ✓" : " ✕"}`).join("　")}</small></span><i>재검사 ›</i></button>`).join("")}</div>`,
  );
}
function study(i) {
  const x = s.report?.lanes[0]?.results[i];
  if (!x) return;
  const old = s.rows.find((r) => r.p.id === x.p.id);
  if (old) {
    record(old.p.id);
    return;
  }
  p = x.p;
  revisit = true;
  feedback = false;
  opened = false;
  tab = "passport";
  desk();
}
function unlock() {
  if (!s.wins.includes(s.stage) || s.stage >= 2) return;
  s.stage++;
  save();
  nextVisitor();
  const m = Orbit.missions[s.stage];
  modal(
    `${chip("항로 " + (s.stage + 1) + " 개방")}${title(m.name)}<p>${m.story}</p><div class="note">학습 사례 ${m.need}개 이상 · 자동 방어 ${m.target} / ${m.n}명 정확하게 판정하기</div>${btn("close", "새 항로 근무 시작", "primary")}`,
  );
}
const situations = [
  [
    "학교 도서관",
    "대출 AI가 반납한 책을 계속 연체로 표시해요.",
    "반납했는데 기록이 늦게 반영된 사례를 모은다.",
  ],
  [
    "학교 급식실",
    "급식 신청을 했는데 AI가 내 이름을 누락했어요.",
    "신청했는데 빠진 사례와 정상 처리된 사례를 함께 모은다.",
  ],
  [
    "등교 셔틀",
    "탑승권이 있는 친구가 자동문 앞에 멈춰 섰어요.",
    "유효한 탑승권이 잘못 거절된 사례를 다시 살펴본다.",
  ],
];
function reflect(i = 0) {
  const q = situations[i];
  modal(
    `${chip(s.wins.includes(2) ? "제7 우주항 방어대 · 임무 완료" : "근무 돌아보기")}${title("우리 학교에서 이런 일이 생긴다면?")}<div class="reflectTabs">${situations.map((a, j) => btn("situation", a[0], i === j ? "chosen" : "", `data-i="${j}"`)).join("")}</div><p><b>${q[1]}</b></p><p>AI를 다시 가르친다면 어느 쪽을 해 볼까요?</p><div class="choices">${btn("choice", q[2], "secondary", `data-i="${i}" data-good="1"`)}${btn("choice", "잘 맞힌 사례만 여러 번 더 보여 준다.", "secondary", `data-i="${i}" data-good="0"`)}</div><div id="reflectionNote"></div>`,
  );
}
function choice(i, good) {
  const dest = $("#reflectionNote");
  if (!good) {
    dest.innerHTML =
      '<p class="note">잘 맞힌 사례만 보면 같은 실수를 되풀이할 수 있어요. 놓친 사례를 찾을 방법을 골라 보세요.</p>';
    return;
  }
  s.reflection = i;
  save();
  dest.innerHTML = `<div class="note"><b>내 근무 기록</b><p>사례 ${s.rows.length}개 수집 → 모델 ${s.version}개 학습 → 게이트 동작 연결 → 수송대 ${s.round}회 출발</p>억울하게 멈춘 친구가 다시 확인을 요청할 수 있으면 좋겠지요. 내 모델도 새 사례로 다시 시험해 봐요.</div>${btn("home", "근무 마치고 돌아가기", "primary")}`;
  sound(820);
}
const actions = {
  home,
  start,
  compare: compareFaces,
  help: guide,
  teacher,
  hazard,
  close,
  desk,
  book: notebook,
  lab,
  model: modelEditor,
  train,
  launch,
  review,
  reflect: () => reflect(),
  unlock,
  sound: () => {
    s.sound = !s.sound;
    soundLabel();
    save();
    sound();
  },
  left: () => SpacePort.turn(-0.28),
  right: () => SpacePort.turn(0.28),
  passport: () => changeDoc("passport"),
  cargo: () => changeDoc("cargo"),
  hold: () => label(false),
  pass: () => label(true),
  next: nextVisitor,
  repair,
  showPass: () => notebook(true),
  showHold: () => notebook(false),
  record: (b) => record(b.dataset.id),
  flip: (b) => {
    const r = s.rows.find((x) => x.p.id === b.dataset.id);
    if (r) {
      r.pass = !r.pass;
      s.rev++;
      save();
      close();
      notebook(r.pass);
    }
  },
  add: () => {
    if (slots.length < 4 && s.models.length) {
      slots.push(s.models.at(-1).v);
      lab();
    }
  },
  remove: (b) => {
    if (slots.length > 1) {
      slots.splice(Number(b.dataset.i), 1);
      lab();
    }
  },
  study: (b) => study(Number(b.dataset.i)),
  situation: (b) => reflect(Number(b.dataset.i)),
  choice: (b) => choice(Number(b.dataset.i), b.dataset.good === "1"),
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b || b.disabled) return;
  const a = b.dataset.act;
  if (a === "book") {
    notebook();
    return;
  }
  actions[a]?.(b);
});
document.addEventListener("change", (e) => {
  if (e.target.matches("[data-slot]")) {
    slots[Number(e.target.dataset.slot)] = Number(e.target.value);
    lab();
  }
});
soundLabel();
home();
if (location.hash === "#teacher") teacher();
