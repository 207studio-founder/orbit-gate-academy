"use strict";
const Radio = (() => {
  let voice = null,
    fx = null;
  const files = new Map();
  function play(key, speech = false) {
    if (!s.sound || document.hidden) return;
    const previous = speech ? voice : fx;
    if (previous) {
      previous.pause();
      previous.currentTime = 0;
    }
    let a = files.get(key);
    if (!a) {
      a = new Audio("assets/audio/" + key + ".mp3");
      files.set(key, a);
    }
    if (speech) voice = a;
    else fx = a;
    a.volume = speech ? 0.68 : 0.45;
    a.currentTime = 0;
    a.play().catch(() => {});
  }
  function mute() {
    for (const a of files.values()) {
      a.pause();
      a.currentTime = 0;
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) mute();
  });
  return { play, mute };
})();
function scanState() {
  return (s.scanner ??= Cargo.starter());
}
const practiceOrder = [
  18, 11, 12, 10, 7, 15, 8, 19, 23, 14, 6, 9, 13, 16, 17, 20, 21, 22,
];
function workshop() {
  const st = scanState(),
    current = practiceOrder[(st.cursor || 0) % practiceOrder.length],
    trained = st.examples.length - 6;
  const latest = st.tests.at(-1),
    earlier = st.tests.at(-2);
  modal(
    `${chip("제7 우주항 · 화물 감식실")}${title("별마을 급식 배송 의뢰")}<p>같은 색 도시락과 괴물 알이 섞였어요. 표본을 돌려 보고 우리 반 감식기에 물건 이름을 가르쳐 주세요.</p><div class="scanBench"><section class="sampleWell">${specimen(current, true)}<small>훈련 표본　${String((st.cursor || 0) + 1).padStart(2, "0")}</small></section><section><h3>이 화물의 이름은?</h3><div class="classKeys">${Cargo.names.map((name, i) => btn("teachSample", name, "secondary", 'data-i="' + i + '"')).join("")}</div><small class="sampleFeedback" role="status">${st.feedback || "모양을 돌려서 손잡이, 마개, 껍질을 살펴보세요."}</small>${btn("benchAtlas", "도감 펼치기", "ghost")}</section></div><div class="experiment"><h3>감식 기준 선택</h3><div class="actions">${["color", "shape"].map((m, i) => btn("scanMode", ["색만 비교", "형태와 세부 구조 비교"][i], st.mode === m ? "primary" : "secondary", 'data-mode="' + m + '" aria-pressed="' + (st.mode === m) + '"')).join("")}</div><p>손잡이 높이, 몸통 너비와 층별 윤곽을 비교할 수 있어요. 기본 도감 6개 + 내가 붙인 표본 ${trained}개. AI는 선택한 단서가 가장 비슷한 표본의 이름을 예측해요.</p>${btn("testScanner", "새 화물 12개로 시험", "primary")} ${btn("close", "현장으로 돌아가기", "secondary")}</div>${
      latest
        ? `<div class="scanResult"><b>시험 결과　${latest.correct} / 12</b>　${latest.mode === "color" ? "색만 비교" : "형태와 구조"}${earlier ? " · 직전 " + earlier.correct + "/12" : ""}<p>${latest.message}</p><div class="scanErrors">${latest.items
            .filter((t) => t.code % 6 !== t.guess)
            .slice(0, 3)
            .map(
              (t) =>
                `<figure>${specimen(t.code)}<figcaption>AI　${Cargo.names[t.guess]}<br>실제　${Cargo.names[t.code % 6]}</figcaption></figure>`,
            )
            .join("")}</div></div>`
        : ""
    }`,
  );
}
function teachSample(label) {
  const st = scanState(),
    n = practiceOrder[(st.cursor || 0) % practiceOrder.length];
  const existing = st.examples.find((r) => r.code === n);
  if (existing) existing.label = label;
  else st.examples.push({ code: n, label });
  st.cursor = ((st.cursor || 0) + 1) % practiceOrder.length;
  st.feedback =
    "방금 ‘" +
    Cargo.names[label] +
    "’로 저장했어요. " +
    (label === n % 6
      ? "도감과 같아요."
      : "도감 기록은 ‘" +
        Cargo.names[n % 6] +
        "’예요. 잘못 붙인 이름도 AI가 배워요.");
  s.rev++;
  save();
  Radio.play("stamp");
  workshop();
}
function testScanner() {
  const st = scanState(),
    items = Cargo.evaluate(st),
    correct = items.filter((t) => t.code % 6 === t.guess).length;
  let message =
    correct === 12
      ? "색이 바뀐 화물도 모두 도착했어요. 이 설정은 다음에 학습하는 게이트에 장착돼요."
      : "틀린 표본을 살피고 감식 기준이나 표본 이름을 바꿔 보세요.";
  if (
    !st.award &&
    st.examples.length > 6 &&
    correct === 12 &&
    st.tests.some((t) => t.mode === "color")
  ) {
    st.award = true;
    s.score += 35;
    message += " 급식 배송 연구 배지 획득 · 35 XP!";
  }
  st.tests.push({ mode: st.mode, correct, items, message });
  st.tests = st.tests.slice(-8);
  save();
  workshop();
  dlg.querySelector(".scanResult")?.scrollIntoView({ block: "nearest" });
  Radio.play("stamp");
}
function atlas(back = "close", variant = 0) {
  modal(
    `${chip("우주항 표본 도감")}${title("같은 화물의 다른 모습")}<div class="atlasForms">${[0, 1, 2, 3].map((v) => btn("atlasForm", "표본 " + (v + 1), v === variant ? "primary" : "secondary", 'data-v="' + v + '" data-back="' + back + '"')).join("")}</div><div class="atlasShelf">${Cargo.names.map((n, i) => `<figure>${specimen(Cargo.code(i, variant))}<figcaption><b>${n}</b><small>${Cargo.parts[i]}</small></figcaption></figure>`).join("")}</div><p>신고서에 없는 축제 음료·씨앗 화분은 노란 압수함에 보관해요. 나머지가 정상이면 운전자는 통과해요. 핵폭탄과 괴물 알은 하차 요구 후 운송 허가증을 확인해요. 살아 있는 괴물이 나오면 즉시 차량을 보류해요.</p>${btn(back, "돌아가기", "primary")}`,
  );
}
const styleLists = [
  ["머리 모양", ["구름 단발", "양갈래", "달빛 올림", "별빛 베레"]],
  ["머리색", ["흑자두", "밤갈색", "남보라", "벚꽃"]],
  ["피부색", ["복숭아", "꿀빛", "구릿빛", "밤빛"]],
  ["근무복", ["살구", "바다", "라일락", "산딸기"]],
];
function wardrobe() {
  const style = s.rangerStyle || 0;
  modal(
    `${chip("레인저 탈의실")}${title("나의 레인저")}<div class="dressRoom"><div class="dressMirror">${specimen(style, true, true)}</div><div class="dressOptions">${styleLists.map(([group, items], j) => `<fieldset><legend>${group}</legend>${items.map((name, i) => btn("wear", name, ((style >> (j * 2)) & 3) === i ? "primary" : "secondary", 'data-group="' + j + '" data-i="' + i + '" aria-pressed="' + (((style >> (j * 2)) & 3) === i) + '"')).join("")}</fieldset>`).join("")}</div></div>${btn("close", "이 모습으로 출근", "primary")}`,
  );
}
function wear(button) {
  const g = Number(button.dataset.group),
    i = Number(button.dataset.i),
    style = ((s.rangerStyle || 0) & ~(3 << (g * 2))) | (i << (g * 2));
  s.rangerStyle = style;
  SpacePort.api?.appearance(style);
  save();
  dlg.querySelector("orbit-specimen[avatar]").setAttribute("code", style);
  for (const b of dlg.querySelectorAll(
    '[data-act=wear][data-group="' + g + '"]',
  )) {
    const on = Number(b.dataset.i) === i;
    b.className = on ? "primary" : "secondary";
    b.setAttribute("aria-pressed", on);
  }
}
Object.assign(actions, {
  wardrobe,
  wear,
  workshop: () => {
    Radio.play("scanner", true);
    workshop();
  },
  benchAtlas: () => atlas("benchBack"),
  benchBack: () => workshop(),
  atlasForm: (b) => atlas(b.dataset.back, Number(b.dataset.v)),
  teachSample: (b) => teachSample(Number(b.dataset.i)),
  scanMode: (b) => {
    const st = scanState();
    if (st.mode !== b.dataset.mode) {
      st.mode = b.dataset.mode;
      s.rev++;
      save();
    }
    workshop();
  },
  testScanner,
  permitSearch: () => SpacePort.checkDoc(1),
  medSearch: () => SpacePort.checkDoc(2),
});

function fieldMap() {
  const st = SpacePort.state(),
    t = Traffic.state(),
    g = Traffic.group();
  const sites = [
    ["운전석", 2.55, 2.65],
    ["압수함", 0.45, 5.7],
    ["감식대 · AI 학습", -8.8, 2.45],
    ["정비소", -5.6, 5.75],
    ["타워", -1.65, 8.45],
    ["탈의실", 3.7, 9.5],
    ["일지", 8.2, 9.8],
    ["허가증", 10.8, 5.5],
  ];
  const x = (v) => (((v + 13) / 27) * 100).toFixed(1),
    y = (v) => (((v + 4) / 17) * 100).toFixed(1);
  modal(
    `${chip("레인저의 손목 단말기")}${title("제7 우주항 시설 지도")}<div class="yardMap"><div class="mapRoad">트럭 진입로　→</div>${sites.map(([name, a, b]) => `<span style="left:${x(a)}%;top:${y(b)}%">${name}</span>`).join("")}<i style="left:${Math.max(1, Math.min(99, x(st[0])))}%;top:${Math.max(1, Math.min(95, y(st[2])))}%">● 나</i></div><h3>이번 근무　${t.cycle}주기 · ${Traffic.groups[g].name}</h3><p>${Traffic.groups[g].hint} 다음 교대는 ${Traffic.groups[(g + 1) % 3].name}이에요. 한 주기는 실제 검문 또는 감시 타워 운행 네 차례예요.</p><p>감식대에서 훈련 표본과 낯선 짐을 비교하고 AI를 학습해요. 타워 부지에서는 기본 필터를 설정하고 40 CR로 첫 타워를 설치해요.</p>${btn("hazard", "휴대 화물 도감", "secondary")} ${btn("close", "지도를 접고 걸어가기", "primary")}`,
  );
}

Object.assign(actions, { fieldMap });
