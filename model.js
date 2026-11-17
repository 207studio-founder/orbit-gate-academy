"use strict";
const Orbit = (() => {
  const names = [
    "모루",
    "피코",
    "누리",
    "루미",
    "토비",
    "라온",
    "미르",
    "보리",
    "로로",
    "다온",
    "소라",
    "마루",
    "우주",
    "나리",
    "이오",
    "노아",
    "두리",
    "포포",
  ];
  const species = ["더듬이", "긴 귀", "작은 뿔", "세 눈"];
  const items = [
    "급식 도시락",
    "축제 음료",
    "도서관 책",
    "씨앗 화분",
    "핵폭탄",
    "우주 괴물의 알",
  ];
  const missions = [
    {
      name: "첫 등교 셔틀",
      place: "별마을 학교",
      story:
        "전학 온 친구들이 등교하는 날이에요. 서류와 짐을 살펴 첫 수업에 제때 도착하도록 도와주세요.",
      n: 8,
      target: 6,
      need: 2,
    },
    {
      name: "별마을 축제",
      place: "학교 운동장",
      story:
        "운동장으로 도시락과 음료가 몰려와요. 비슷해 보이는 화물을 자세히 살펴 축제를 열어 주세요.",
      n: 12,
      target: 10,
      need: 6,
    },
    {
      name: "마지막 귀가선",
      place: "달빛 정거장",
      story:
        "막차를 놓치면 집에 늦어요. 위험한 짐을 걸러 내면서 안전한 친구들도 무사히 태워 주세요.",
      n: 16,
      target: 15,
      need: 10,
    },
  ];
  const cue = [
    "오늘 급식을 배달하러 왔어요.",
    "축제 공연을 보러 가요!",
    "도서관 책을 돌려주러 왔어요.",
    "친구랑 셔틀을 타기로 했어요.",
    "우리 반 텃밭에 갈 거예요.",
    "오늘 전학 왔어요. 반가워요!",
  ];
  function rng(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function iso(time) {
    return new Date(time).toISOString().slice(0, 10);
  }
  const day = 86400000;
  // Cases have independent, stable identifiers. A reviewed test case is never reused in a later wave.
  function caseOf(seed, id, type, today) {
    const r = rng(seed),
      pick = (n) => Math.floor(r() * n);
    const face = pick(12),
      photo = type === 2 || type === 6 ? (face + 1 + pick(11)) % 12 : face;
    const expiry =
      type === 1 || type === 6
        ? -(1 + pick(12))
        : type === 5
          ? 0
          : 1 + pick(15);
    const bag = [pick(4), pick(4)];
    if (type === 3 || type === 4 || type === 6)
      bag[pick(2)] = type === 3 ? 4 : 5;
    return {
      id,
      face,
      photo,
      bag,
      today,
      until: iso(Date.parse(today + "T00:00:00Z") + day * expiry),
      name: names[pick(names.length)],
      line: cue[pick(cue.length)],
    };
  }
  function dateFor(k) {
    return iso(Date.UTC(2186, 3, 24) + day * (k % 360));
  }
  const lessonTypes = [0, 1, 5, 2, 3, 0, 4, 5, 1, 0, 2, 3, 4, 6, 5, 0];
  function visitor(serial, salt) {
    const r = rng(salt + serial * 3571);
    return caseOf(
      (salt + serial * 9277) >>> 0,
      "T" + serial,
      serial < lessonTypes.length ? lessonTypes[serial] : Math.floor(r() * 7),
      dateFor(Math.floor(serial / 3)),
    );
  }
  function wave(round, stage, salt) {
    const m = missions[stage],
      r = rng(salt + round * 829),
      types = Array.from(
        { length: m.n },
        (_, i) => [0, 1, 5, 2, 0, 3, 5, 4, 0, 6, 0, 2, 3, 0, 5, 4][i],
      );
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    return types.map((type, i) =>
      caseOf(
        Math.floor(r() * 4294967295),
        "W" + round + "-" + i,
        type,
        dateFor(round * 3 + 7),
      ),
    );
  }
  function evidence(p) {
    return [
      +(p.until < p.today),
      +(p.face !== p.photo),
      +p.bag.includes(4),
      +p.bag.includes(5),
    ];
  }
  const reasons = [
    "통행증의 마지막 날이 지났어요.",
    "사진과 방문객의 얼굴이 달라요.",
    "화물칸에 핵폭탄이 있어요.",
    "화물칸에 우주 괴물의 알이 있어요.",
  ];
  const featureNames = [
    "통행증 날짜",
    "얼굴과 사진",
    "핵폭탄 모양",
    "괴물 알 모양",
  ];
  function allowed(p) {
    return !evidence(p).some(Boolean);
  }
  function explain(p) {
    return (
      evidence(p)
        .flatMap((x, i) => (x ? [reasons[i]] : []))
        .join(" ") || "날짜와 얼굴이 맞고, 두 칸 모두 허용된 짐이에요."
    );
  }
  // A binary decision tree learns splits and leaf votes solely from the student's labels.
  function fit(rows, features = [0, 1, 2, 3]) {
    const samples = rows.map((row) => ({ x: evidence(row.p), y: !!row.pass }));
    const impurity = (xs) => {
      if (!xs.length) return 0;
      const p = xs.filter((x) => x.y).length / xs.length;
      return 2 * p * (1 - p);
    };
    function build(xs, fs) {
      const yes = xs.filter((s) => s.y).length,
        leaf = { value: yes > xs.length / 2, count: xs.length };
      if (!fs.length || !yes || yes === xs.length) return leaf;
      let best = null;
      for (const f of fs) {
        const a = xs.filter((x) => !x.x[f]),
          b = xs.filter((x) => x.x[f]);
        if (!a.length || !b.length) continue;
        const cost =
          (a.length * impurity(a) + b.length * impurity(b)) / xs.length;
        if (!best || cost < best.cost - 1e-10) best = { f, a, b, cost };
      }
      if (!best) return leaf;
      const rest = fs.filter((f) => f !== best.f);
      return {
        f: best.f,
        left: build(best.a, rest),
        right: build(best.b, rest),
      };
    }
    return build(samples, [...features]);
  }
  function predict(tree, p) {
    const x = evidence(p);
    while (tree.f !== undefined) tree = x[tree.f] ? tree.right : tree.left;
    return tree.value;
  }
  function run(tree, wire, p) {
    const prediction = predict(tree, p),
      open = wire[prediction ? 0 : 1] === "open",
      safe = allowed(p);
    return { p, prediction, open, safe, ok: open === safe };
  }
  return {
    species,
    items,
    missions,
    featureNames,
    visitor,
    wave,
    evidence,
    allowed,
    explain,
    fit,
    predict,
    run,
  };
})();
