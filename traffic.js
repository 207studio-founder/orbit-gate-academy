"use strict";
const Traffic = (() => {
  const groups = [
    {
      name: "급식 배송단",
      hint: "도시락·음료가 많고 납품 기한이 지난 서류도 섞여요.",
      types: [0, 5, 1, 0, 3, 0, 1, 5],
    },
    {
      name: "의료 귀환단",
      hint: "탈피 치료 뒤 사진이 달라진 승객이 많아요. 메디컬 기록과 신원을 대조하세요.",
      types: [2, 2, 5, 2, 6, 0, 2, 1],
    },
    {
      name: "연구 표본단",
      hint: "알과 밀봉 코어, 운송 허가증을 가진 연구원이 많아요. 실제 화물과 허가 물품을 비교하세요.",
      types: [4, 3, 5, 4, 6, 3, 0, 4],
    },
  ];
  const filterLabels = {
    face: "얼굴·의료 기록",
    cargo: "3D 화물·허가증",
    model: "내가 학습한 모델",
  };
  const shiftSize = 4;
  function state() {
    return (s.traffic ??= {
      cycle: 1,
      trips: 0,
      towers: 0,
      tier: 1,
      selected: ["cargo"],
      presets: {},
      auto: false,
      fines: 0,
      history: [],
      dispatch: 0,
      successful: 0,
      perfect: true,
      seen: 0,
      correct: 0,
      allMax: true,
      issued: "",
      submitted: false,
      exported: false,
    });
  }
  function group(cycle = state().cycle) {
    return (((cycle - 1) % 3) + 3) % 3;
  }
  function fullFleet(t) {
    return (
      t.towers === 16 &&
      t.tier === 3 &&
      t.auto &&
      Object.keys(t.presets).length === groups.length
    );
  }
  function canCondo() {
    const t = state();
    return t.submitted && fullFleet(t) && t.successful >= 4;
  }
  function settings(t = state()) {
    return t.tier === 3 && t.auto
      ? t.presets[group()] || t.selected
      : t.selected;
  }
  function decide(p, filters, sensor, model) {
    if (p.until < p.today) return false;
    if (filters.includes("face") && Orbit.mismatch(p) && !Orbit.medicalMatch(p))
      return false;
    if (filters.includes("cargo")) {
      const unsafe = p.bag.some((_, i) => {
        const k = Cargo.nearest(sensor, Cargo.formOf(p, i)).label;
        return k >= 4 && !Orbit.certified(p, k);
      });
      if (unsafe) return false;
    }
    if (filters.includes("model") && model)
      return Orbit.predict(model.tree, p)
        ? model.wire[0] === "open"
        : model.wire[1] === "open";
    return true;
  }
  function counted({ seen = 1, correct = 1, miss = 0, towerRun = false } = {}) {
    const t = state();
    if (t.issued && !t.submitted) return;
    if (t.submitted && fullFleet(t) && !towerRun) return;
    t.seen += seen;
    t.correct += correct;
    t.perfect &&= miss === 0;
    t.allMax &&= towerRun && fullFleet(t);
    t.fleetRounds = (t.fleetRounds || 0) + Number(towerRun);
    if (++t.trips < shiftSize) {
      save();
      return;
    }
    const success =
      t.submitted &&
      t.allMax &&
      t.fleetRounds === shiftSize &&
      t.perfect &&
      t.correct / t.seen >= 0.85;
    if (success) t.successful++;
    t.history.unshift({
      cycle: t.cycle,
      group: group(),
      correct: t.correct,
      seen: t.seen,
      success,
    });
    t.history = t.history.slice(0, 12);
    if (t.cycle === 5 && !t.issued)
      t.issued = String(
        100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000),
      );
    if (!t.issued || t.submitted) t.cycle++;
    t.trips = 0;
    t.seen = 0;
    t.correct = 0;
    t.perfect = true;
    t.allMax = true;
    t.fleetRounds = 0;
    save();
    if (t.issued && !t.submitted) {
      rangerReport();
      return;
    }
    SpacePort.fieldBroadcast(
      "다음 주기 · " + groups[group()].name + "　" + groups[group()].hint,
      6200,
    );
  }
  function fine(amount) {
    if (amount > 0) state().fines += amount;
  }
  function receipt(serial) {
    return String((Number(serial) * 137 + 91873) % 100000).padStart(5, "0");
  }
  function submit() {
    const t = state(),
      v = document.querySelector("#receiptCode")?.value.trim();
    if (!t.issued || !t.exported || t.submitted || v !== receipt(t.issued)) {
      toast("허가증을 저장·제출하고 교사가 발급한 확인 번호를 입력하세요.");
      return;
    }
    t.submitted = true;
    t.cycle = 6;
    save();
    close();
    Radio.play("stamp");
    toast("허가증 제출 확인 · 무한 모드가 열렸어요.");
  }
  function process() {
    const t = state();
    if (!t.towers || (t.issued && !t.submitted)) return;
    const g = group(),
      filters = settings(),
      model = s.models.at(-1),
      sensor = model?.tree.sensor || Cargo.snapshot(scanState());
    let seen = t.towers,
      correct = 0,
      miss = 0,
      amount = 0,
      first = "",
      seized = 0,
      highHolds = 0;
    for (let i = 0; i < t.towers; i++) {
      const p = Orbit.groupCase(t.dispatch++, g, s.salt);
      const expectedMask = Orbit.lowMask(p);
      const scanMask = filters.includes("cargo")
        ? p.bag.reduce(
            (mask, _, i) =>
              mask |
              (Orbit.unreported(
                p,
                i,
                Cargo.nearest(sensor, Cargo.formOf(p, i)).label,
              )
                ? 1 << i
                : 0),
            0,
          )
        : 0;
      const inspected = { ...p, seized: scanMask },
        pass = decide(inspected, filters, sensor, model);
      const safe = Orbit.allowed({ ...p, seized: expectedMask });
      const unsafePass = pass && (!safe || (expectedMask & ~scanMask) !== 0);
      seized += (scanMask & 1) + ((scanMask >> 1) & 1);
      if (!pass && Orbit.highRisk(p)) highHolds++;
      if (pass === safe && scanMask === expectedMask) {
        correct++;
        amount += 6;
      } else if (unsafePass) {
        miss++;
        amount -= 12;
        if (!first) first = p.id + " · " + Orbit.explain(p);
      }
    }
    SpacePort.api.settle_trip(amount);
    fine(12 * miss);
    t.last = {
      group: g,
      seen,
      correct,
      miss,
      amount,
      seized,
      highHolds,
      detail: first,
    };
    SpacePort.persist();
    SpacePort.fieldBroadcast(
      groups[g].name +
        " · " +
        correct +
        "/" +
        seen +
        " 정확 · 순정산 " +
        (amount >= 0 ? "+" : "") +
        amount +
        " CR" +
        (miss ? " · 잘못 통과 벌금 " + 12 * miss + " CR" : ""),
      3800,
    );
    counted({ seen, correct, miss, towerRun: true });
  }
  function draw() {
    const t = state(),
      g = group(),
      b = SpacePort.bank(),
      selected = t.selected,
      cost = t.towers === 16 ? 0 : 40 + 5 * t.towers,
      filterCost = t.tier === 1 ? 45 : 75;
    const next = groups[(g + 1) % 3],
      active =
        settings()
          .map((k) => filterLabels[k])
          .join(" · ") || "기한만";
    modal(
      `${chip("AI 감시 타워 · 현장 제어반")}${title(t.towers ? "감시 타워 운영" : "감시 타워 건설 부지")}<div class="briefGroup"><small>${t.cycle}주기　·　운행 ${t.trips}/4</small><h3>${groups[g].name}</h3><p>${groups[g].hint}</p><small>다음 교대　${next.name} · ${next.hint}</small></div><p>잔액 <b>${b[0]} CR</b>　·　타워 <b>${t.towers}/16</b>　·　필터 <b>${t.tier}단계</b></p><div class="actions">${btn("buildTower", t.towers === 16 ? "16기 설치 완료" : "타워 1기 설치　" + cost + " CR", "primary", !cost || b[0] < cost ? "disabled" : "")}${btn("boostFilter", t.tier === 3 ? "최상위 필터" : "필터 강화　" + filterCost + " CR", "secondary", !t.towers || t.tier === 3 || b[0] < filterCost ? "disabled" : "")}</div><h3>통행 그룹별 필터</h3><p>기본 필터는 날짜를 확인해요. 1단계는 추가 단서 1개, 2단계부터 2개를 선택할 수 있어요. 학습한 모델을 선택하면 최근 학습본을 사용해요.</p><div class="actions">${Object.entries(
        filterLabels,
      )
        .map(([k, l]) =>
          btn(
            "toggleFilter",
            l,
            selected.includes(k) ? "primary" : "secondary",
            'data-k="' +
              k +
              '" aria-pressed="' +
              selected.includes(k) +
              '" ' +
              (k === "model" && !s.models.length ? "disabled" : ""),
          ),
        )
        .join(
          "",
        )}</div><p>현재 적용　${active}</p>${t.tier === 3 ? `<h3>그룹별 자동 전환</h3><p>각 그룹에 현재 선택을 저장해요. 세 그룹을 모두 등록한 뒤 레짐 체인징을 켜세요.</p><div class="actions">${groups.map((gg, j) => btn("preset", gg.name + (t.presets[j] ? " ✓" : ""), "secondary", 'data-i="' + j + '"')).join("")}${btn("autoRegime", t.auto ? "자동 전환 켜짐" : "자동 전환 켜기", "primary", Object.keys(t.presets).length !== 3 ? "disabled" : "")}</div>` : "<small>3단계에서 그룹별 필터 자동 전환이 열려요.</small>"}${t.last ? `<div class="documentSheet">직전 운행　${groups[t.last.group].name} · 정확 ${t.last.correct}/${t.last.seen} · 벌금 ${12 * t.last.miss} CR · 압수 ${t.last.seized || 0}개 · 고위험 인계 ${t.last.highHolds || 0}건<br>${t.last.detail || "위험 차량 누락 없음"}</div>` : ""}<p>무한 모드에서는 타워 16기와 세 그룹의 자동 전환을 켜고 타워 운행을 네 번 마치면 상위 운영 한 주기예요. 정확도 85% 이상, 위험 차량 오통과 0건을 달성한 주기를 네 번 모으세요. 현재 ${t.successful}/4주기예요.</p><p>자동 운행은 현장 시간이 흐를 때 정산해요. 잘못 통과하면 차량당 12 CR의 벌금이 붙어요.</p>${btn("close", "현장으로", "secondary")}`,
    );
  }
  function buy(filter) {
    const t = state(),
      n = filter ? t.tier : t.towers;
    if (filter ? !t.towers || n >= 3 : n >= 16) return;
    const price = filter ? (n === 1 ? 45 : 75) : 40 + 5 * n;
    if (!SpacePort.api.spend(price)) {
      toast("잔액이 부족해요.");
      return;
    }
    if (filter) t.tier++;
    else t.towers++;
    SpacePort.api.tower_state(t.towers, t.tier);
    SpacePort.refreshWorld();
    SpacePort.persist();
    Radio.play("stamp");
    draw();
  }
  return {
    groups,
    state,
    group,
    settings,
    decide,
    process,
    counted,
    fine,
    canCondo,
    receipt,
    submit,
    draw,
    buy,
    filterLabels,
  };
})();
Object.assign(actions, {
  buildTower: () => Traffic.buy(false),
  boostFilter: () => Traffic.buy(true),
  toggleFilter: (b) => {
    const t = Traffic.state(),
      k = b.dataset.k;
    if (!Object.hasOwn(Traffic.filterLabels, k)) return;
    if (t.selected.includes(k)) t.selected = t.selected.filter((v) => v !== k);
    else if (t.tier === 1) t.selected = [k];
    else if (t.selected.length < 2) t.selected.push(k);
    else {
      toast("단서 하나를 먼저 해제하세요.");
      return;
    }
    save();
    Traffic.draw();
  },
  preset: (b) => {
    const t = Traffic.state();
    if (t.tier !== 3) return;
    t.presets[Number(b.dataset.i)] = [...t.selected];
    save();
    Traffic.draw();
  },
  autoRegime: () => {
    const t = Traffic.state();
    if (t.tier === 3 && Object.keys(t.presets).length === 3) {
      t.auto = !t.auto;
      save();
    }
    Traffic.draw();
  },
  confirmSubmission: () => Traffic.submit(),
});
