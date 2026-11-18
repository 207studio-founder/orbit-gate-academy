"use strict";
const Lesson = (() => {
  let page = 0,
    holder = null,
    teacher = false,
    enter = null,
    handler = null;
  const img = (name, alt) => `<img src="assets/${name}.webp" alt="${alt}">`;
  const pages = [
    [
      "인공지능 기초",
      "AI에게 우주항을 맡긴다면?",
      "학교로 가는 셔틀 앞에 트럭들이 줄을 섰어요. 어떤 짐은 빨리 보내고, 어떤 짐은 다시 살펴야 해요. AI는 무엇을 보고 배울까요?",
      () => `<div class="lessonHeroArt"></div>`,
    ],
    [
      "데이터 수집",
      "내 판정이 AI의 예시가 돼요",
      "방문객의 얼굴, 통행증의 날짜, 화물칸의 물건을 보고 통과 또는 보류를 붙여요. 틀린 판정도 그대로 학습 목록에 들어가요.",
      () =>
        `<div class="lessonCards"><figure>${img("item-0", "도시락")}<figcaption>도시락 · 통과 예시</figcaption></figure><figure>${img("item-5", "괴물 알")}<figcaption>괴물 알 · 보류 예시</figcaption></figure></div><small>여기서는 날짜와 얼굴이 모두 맞다고 가정해요.</small>`,
    ],
    [
      "모델 학습",
      "사례에서 판정 기준을 찾아요",
      "어떤 단서를 볼지 골라 모델을 학습시켜요. 날짜만 본 모델은 날짜가 맞는 트럭의 위험 화물을 놓칠 수 있어요.",
      () =>
        `<div class="flowTokens"><span>통과 · 보류 사례</span><i>↓</i><b>선택한 단서로 모델 학습</b><i>↓</i><span>새 트럭의 판정 예측</span></div>`,
    ],
    [
      "프로그래밍 · 평가",
      "예측을 문에 연결하고 시험해요",
      "“통과로 예측하면 문 열기”처럼 동작을 정해요. 새 수송대를 최대 네 모델에 동시에 보내고, 안전한 승객을 잘못 세운 횟수도 비교해요.",
      () =>
        `<div class="compareRoutes"><b>같은 새 수송대</b><div>게이트 A　·　첫 모델</div><div>게이트 B　·　다시 학습한 모델</div></div>`,
    ],
    [
      "현장 조작",
      "레인저를 직접 움직여요",
      "WASD나 방향키로 걷고 Shift로 달려요. Space는 점프, 마우스 오른쪽 드래그 또는 Z·C는 시점 회전이에요. 터치 화면은 왼쪽 스틱을 써요.",
      () =>
        `<div class="lessonKeys"><div><kbd>W</kbd></div><div><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div><small>이동</small><div><kbd>Space</kbd></div><small>점프</small></div>`,
    ],
    [
      "트럭 검문",
      "걷고, 열고, 결정해요",
      "운전석에서 E로 통행증을 받고 Q로 하차를 요구해요. 화물칸에서 E로 천을 걷고 짐을 확인해요. 통과 또는 보류 레버로 걸어가 E를 눌러요.",
      () =>
        `<div class="lessonCards"><figure>${img("item-4", "핵폭탄")}<figcaption>핵폭탄</figcaption></figure><figure>${img("item-5", "괴물 알")}<figcaption>우주 괴물의 알</figcaption></figure></div><small>둘 중 하나가 짐에 있으면 재검사해요.</small>`,
    ],
    [
      "방어 · 성장",
      "내 검문소를 키워요",
      "도주·괴물·월담 경보가 울리면 가까이 가서 F로 그물을 쏴요. 목숨은 3개예요. 정비소에서 추가 레일, 그물총, 부츠, 펄스 펜스, 자동 포탑을 사고 우주 콘도 회원권에 도전해요.",
      () =>
        `<div class="flowTokens"><span>검사로 크레딧 벌기</span><i>↓</i><b>레일 확장과 장비 강화</b><i>↓</i><span>우주 콘도 회원권</span></div>`,
    ],
    [
      "근무 시작",
      "제7 우주항으로 출발!",
      "학생 기기에서 게임에 입장하세요. 근무를 마치면 결과표에 이름 또는 닉네임을 적고 PNG나 PDF로 저장해 선생님이 안내한 곳에 제출하세요.",
      () =>
        `<div class="lessonQR"><img src="assets/join.png" alt="오르빗 게이트 학생 접속 QR"></div>`,
    ],
  ];
  function stop() {
    if (handler) document.removeEventListener("keydown", handler);
    handler = null;
    holder = null;
  }
  function go(n) {
    page = Math.max(0, Math.min(pages.length - 1, n));
    draw();
  }
  function draw() {
    if (!holder) return;
    const [tag, title, desc, art] = pages[page];
    holder.innerHTML = `<section class="lessonSlide"><div class="lessonBar"><b>ORBIT GATE　/　${teacher ? "교사용 수업" : "신입 대원 브리핑"}</b><span>${String(page + 1).padStart(2, "0")} / 08</span></div><div class="lessonCenter"><div class="lessonWords"><small>${tag}</small><h1>${title}</h1><p>${desc}</p></div><div class="lessonArt">${art()}</div></div><div class="lessonNav"><div class="dots">${pages.map((_, i) => `<button type="button" aria-label="${i + 1}번 슬라이드" data-slide="${i}" class="${i === page ? "on" : ""}"></button>`).join("")}</div><div><button data-lesson="prev" class="secondary" ${page === 0 ? "disabled" : ""}>이전</button> ${page === 7 ? '<button data-lesson="enter" class="primary">우주항 입장　▶</button>' : '<button data-lesson="next" class="primary">다음　→</button>'}</div></div></section>`;
  }
  function open(el, t, done) {
    stop();
    holder = el;
    teacher = t;
    enter = done;
    page = 0;
    handler = (e) => {
      if (
        !holder ||
        document.querySelector("dialog[open]") ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        go(page + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(page - 1);
      }
    };
    document.addEventListener("keydown", handler);
    draw();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lesson],[data-slide]");
    if (!holder || !b || !holder.contains(b)) return;
    if (b.dataset.slide !== undefined) {
      go(+b.dataset.slide);
      return;
    }
    if (b.dataset.lesson === "enter") {
      const fn = enter;
      stop();
      fn();
    } else go(page + (b.dataset.lesson === "next" ? 1 : -1));
  });
  return { open, stop };
})();
if (document.body.dataset.teacher)
  Lesson.open(document.getElementById("slides"), true, () =>
    location.assign("./#enter"),
  );
