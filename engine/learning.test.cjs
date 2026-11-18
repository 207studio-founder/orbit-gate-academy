const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
function classroom() {
  const context = vm.createContext({
    HTMLElement: class {},
    customElements: { define() {} },
    actions: {},
    s: {},
    save() {},
    SpacePort: { fieldBroadcast() {} },
    crypto: require("node:crypto").webcrypto,
    rangerReport() {},
  });
  for (const name of [
    "cargo-profiles.js",
    "cargo.js",
    "model.js",
    "traffic.js",
  ])
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", name), "utf8"),
      context,
    );
  return vm.runInContext("({Cargo,Orbit,Traffic})", context);
}
test("new labelled shapes improve generalization on twelve unseen meshes", () => {
  const { Cargo } = classroom(),
    st = Cargo.starter();
  const score = () =>
    Cargo.evaluate(st).filter((row) => row.guess === row.code % 6).length;
  st.mode = "color";
  assert.ok(score() < 6);
  st.mode = "shape";
  const before = score();
  for (let code = 6; code < 24; code++)
    st.examples.push({ code, label: code % 6 });
  assert.ok(before < score());
  assert.equal(score(), 12);
  assert.ok(Cargo.evaluate(st).every((x) => x.code >= 24));
});
test("permit, medical exception, declaration and seizure change decisions independently", () => {
  const { Orbit } = classroom();
  const p = {
    id: "F",
    face: 1,
    photo: 2,
    today: "2186-04-24",
    until: "2186-04-24",
    bag: [5, 3],
    manifest: [5, 0],
  };
  assert.ok(Orbit.highRisk(p));
  p.permit = { kind: 5, owner: "F", until: p.today };
  assert.ok(!Orbit.highRisk(p));
  p.medical = { owner: "F", face: 1, mark: 0, date: p.today };
  assert.equal(Orbit.lowMask(p), 2);
  assert.ok(!Orbit.allowed(p));
  p.seized = 2;
  assert.ok(Orbit.allowed(p));
  p.permit.kind = 4;
  assert.ok(!Orbit.allowed(p));
  p.permit.kind = 5;
  p.medical.owner = "G";
  assert.ok(!Orbit.allowed(p));
});
test("endless fleet mastery requires four entire correctly filtered shifts", () => {
  const { Traffic } = classroom(),
    t = Traffic.state();
  for (let i = 0; i < 20; i++) Traffic.counted();
  assert.equal(t.issued.length, 6);
  assert.equal(t.cycle, 5);
  Object.assign(t, {
    submitted: true,
    cycle: 6,
    tier: 3,
    towers: 16,
    auto: true,
    presets: { 0: ["face"], 1: ["cargo"], 2: ["face", "cargo"] },
  });
  for (let i = 0; i < 16; i++) Traffic.counted();
  assert.equal(t.successful, 0);
  assert.equal(t.trips, 0);
  for (let i = 0; i < 4; i++)
    Traffic.counted({
      seen: 16,
      correct: 15,
      miss: i === 0 ? 1 : 0,
      towerRun: true,
    });
  assert.equal(t.successful, 0);
  for (let i = 0; i < 15; i++)
    Traffic.counted({ seen: 16, correct: 16, towerRun: true });
  assert.ok(!Traffic.canCondo());
  Traffic.counted({ seen: 16, correct: 16, towerRun: true });
  assert.ok(Traffic.canCondo());
  t.auto = false;
  assert.ok(!Traffic.canCondo());
});
