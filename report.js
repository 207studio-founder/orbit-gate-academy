"use strict";
function seizedTotal() {
  return Object.values(s.seizures || {}).reduce(
    (sum, mask) => sum + (mask & 1) + ((mask >> 1) & 1),
    0,
  );
}
function rankData() {
  const b = s.station || [20, 3, 1, 0, 0, 0, 0, 0, 100, 0],
    win = s.wins.length,
    r = s.report;
  const lane = r?.lanes.reduce((a, b) => (a.correct >= b.correct ? a : b));
  const rank = b[7]
    ? "콘도 명예 레인저"
    : win >= 3
      ? "마스터 레인저"
      : win >= 2
        ? "골드 레인저"
        : win >= 1
          ? "실버 레인저"
          : s.models.length
            ? "브론즈 레인저"
            : "수습 레인저";
  return {
    b,
    r,
    lane,
    rank,
    correct: s.rows.filter((a) => a.pass === Orbit.allowed(a.p)).length,
  };
}
function rangerReport() {
  SpacePort.resetInput();
  const { b, rank, r, lane, correct } = rankData();
  const t = Traffic.state();
  modal(
    `${chip("제7 우주항 · 개인 근무 기록")}${title(t.issued ? "스페이스 레인저 허가증" : "스페이스 레인저 근무 기록")}<div class="rankBand"><span>✦</span><div><small>현재 등급</small><b>${rank}</b></div></div><p>직접 검사 ${s.rows.length}건 중 ${correct}건 정확　·　학습 모델 ${s.version}개<br>${r ? `최근 자동 방어 ${lane.correct}/${r.total} · 잘못 통과 ${lane.miss} · 잘못 보류 ${lane.delay}` : "자동 방어 평가 전"}<br>담당 레일 ${b[2]}개　·　크레딧 ${b[0]}　·　그물 포획 ${b[9]}회　·　신뢰도 ${b[8]}/100</p><div class="documentSheet">근무 ${t.cycle}주기 · AI 타워 ${t.towers}/16 · 누적 벌금 ${t.fines} CR · 저위험 압수 ${seizedTotal()}개 · 고위험 포획 ${Object.keys(s.detained || {}).length}명 · 괴물 차량 자동 보류 ${s.quarantines?.length || 0}건 · 상위 운영 ${t.successful}/4주기</div><details><summary>등급 기준</summary><p>수습 → 모델을 학습하면 브론즈 → 항로 1·2·3개를 열면 실버·골드·마스터 → 콘도 회원권을 사면 콘도 명예 레인저</p></details><label class="reportLabel">제출자 이름 또는 닉네임 <input id="rangerName" maxlength="18" placeholder="예: 6학년 3번 별이"></label><label class="reportLabel">오늘 내 AI에 더 가르치고 싶은 사례 <input id="rangerThought" maxlength="60" placeholder="예: 오늘까지 쓸 수 있는 통행증"></label><div class="actions">${btn("exportPNG", "PNG 저장", "primary")}${btn("exportPDF", "PDF 저장", "secondary")}${b[1] === 0 ? btn("restoreShift", "새 근무", "secondary") : ""}</div><p class="smallNote">${t.issued ? "허가증 번호 " + t.issued + " · 파일을 선생님 과제함에 제출한 뒤, 선생님이 알려 준 확인 번호를 입력하세요." : "5주기를 마치면 정식 허가증을 발급해요. 지금은 중간 기록을 저장할 수 있어요."}</p>${t.issued && !t.submitted ? `<label class="reportLabel">교사 제출 확인 번호 <input id="receiptCode" maxlength="5" inputmode="numeric" autocomplete="off"></label>${btn("confirmSubmission", "제출 확인 후 무한 모드 입장", "primary")}` : t.submitted ? "<b>교사 제출 확인 · 무한 모드</b>" : ""}`,
  );
}
function certificate(name, thought) {
  const { b, r, lane, rank, correct } = rankData();
  const cv = document.createElement("canvas");
  cv.width = 1320;
  cv.height = 940;
  const c = cv.getContext("2d");
  const rect = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  function txt(str, x, y, size, col = "#203044", weight = 650, max = 1170) {
    c.fillStyle = col;
    c.font = `${weight} ${size}px "Malgun Gothic","Noto Sans CJK KR",sans-serif`;
    c.fillText(String(str), x, y, max);
  }
  rect(0, 0, 1320, 940, "#f4eeda");
  rect(0, 0, 1320, 250, "#182840");
  rect(0, 245, 1320, 5, "#e6b458");
  txt("ORBIT GATE     /     제7 우주항", 65, 68, 25, "#ffcf72", 750);
  txt(
    Traffic.state().issued
      ? "스페이스 레인저 허가증"
      : "스페이스 레인저 근무 증명서",
    62,
    147,
    61,
    "#fff2d4",
    850,
  );
  txt(
    "초등 실과  ·  인공지능이 만들어지는 과정" +
      (Traffic.state().issued ? "　|　허가증 " + Traffic.state().issued : ""),
    66,
    204,
    25,
    "#c6d9db",
  );
  c.save();
  c.translate(1190, 114);
  c.strokeStyle = "#ffcf72";
  c.lineWidth = 5;
  c.beginPath();
  c.arc(0, 0, 53, 0, Math.PI * 2);
  c.stroke();
  c.rotate(-0.4);
  c.beginPath();
  c.ellipse(0, 0, 76, 19, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
  txt(name || "별마을 레인저", 65, 326, 37);
  txt(rank, 65, 396, 53, "#23685d", 850);
  txt("검문 및 AI 학습 기록", 67, 465, 26);
  const rows = [
    [
      "직접 검사",
      `${correct} / ${s.rows.length}건 정확`,
      "모델 학습",
      `${s.version}개`,
    ],
    [
      "최근 자동 방어",
      r ? `${lane.correct} / ${r.total}건 정확` : "아직 평가 전",
      "최근 오판",
      r ? `잘못 통과 ${lane.miss} · 잘못 보류 ${lane.delay}` : "아직 평가 전",
    ],
    [
      "검문소 운영",
      `레일 ${b[2]}개 · ${b[0]} CR`,
      "현장 방어",
      `포획 ${b[9]}회 · 목숨 ${b[1]}/3`,
    ],
    [
      "열린 항로",
      `${s.wins.length} / 3개`,
      "콘도 회원권",
      b[7] ? "취득" : "도전 중",
    ],
  ];
  rows.forEach((a, i) => {
    const y = 480 + i * 57;
    rect(65, y, 1190, 1, "#b5b4a4");
    txt(a[0], 70, y + 38, 20, "#596267");
    txt(a[1], 257, y + 38, 24);
    txt(a[2], 666, y + 38, 20, "#596267");
    txt(a[3], 846, y + 38, 23);
  });
  rect(65, 725, 1190, 122, "#dce5d9");
  txt("다시 가르치고 싶은 사례", 87, 760, 21, "#326559");
  const chars = Array.from(thought || "기록하지 않음");
  txt(chars.slice(0, 35).join(""), 87, 798, 24, "#25394b", 650, 1110);
  if (chars.length > 35)
    txt(chars.slice(35).join(""), 87, 829, 24, "#25394b", 650, 1110);
  const d = new Date();
  txt(
    `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.　|　이 기기의 게임 기록`,
    66,
    894,
    18,
    "#5c686d",
  );
  txt(
    "저위험 물품 압수 " +
      seizedTotal() +
      "개　·　고위험 운전자 포획 " +
      Object.keys(s.detained || {}).length +
      "명",
    755,
    894,
    18,
    "#5c686d",
    650,
    480,
  );
  return cv;
}
function pdfImage(canvas) {
  const jpg = Uint8Array.from(
    atob(canvas.toDataURL("image/jpeg", 0.94).split(",")[1]),
    (c) => c.charCodeAt(0),
  );
  const enc = new TextEncoder(),
    parts = [],
    pos = [0];
  let offset = 0;
  const put = (x) => {
    const b = typeof x === "string" ? enc.encode(x) : x;
    parts.push(b);
    offset += b.length;
  };
  const obj = (id, body) => {
    pos[id] = offset;
    put(`${id} 0 obj\n`);
    put(body);
    put("\nendobj\n");
  };
  put("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Img 4 0 R >> >> /Contents 5 0 R >>",
  );
  pos[4] = offset;
  put(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
  );
  put(jpg);
  put("\nendstream\nendobj\n");
  const commands = "q\n835.53 0 0 595 3.23 0 cm\n/Img Do\nQ\n";
  obj(5, `<< /Length ${commands.length} >>\nstream\n${commands}endstream`);
  const xref = offset;
  put("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++)
    put(String(pos[i]).padStart(10, "0") + " 00000 n \n");
  put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}
async function exportRanger(ext) {
  const name = $("#rangerName").value.trim(),
    thought = $("#rangerThought").value.trim(),
    cv = certificate(name, thought);
  const blob =
    ext === "pdf"
      ? pdfImage(cv)
      : await new Promise((resolve) => cv.toBlob(resolve, "image/png"));
  if (!blob) {
    toast("파일을 만들지 못했어요. 다시 시도해 주세요.");
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `스페이스레인저-${(name || "근무기록").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")}.${ext}`;
  document.body.append(a);
  a.click();
  if (Traffic.state().issued) {
    Traffic.state().exported = true;
    save();
  }
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 45000);
  toast("결과표를 만들었어요. 다운로드 폴더에서 확인하세요.");
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("button")?.dataset.act;
  if (a === "exportPNG" || a === "exportPDF")
    exportRanger(a === "exportPDF" ? "pdf" : "png");
});
