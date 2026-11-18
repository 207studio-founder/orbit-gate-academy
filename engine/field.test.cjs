const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const mod = new WebAssembly.Module(
  readFileSync(path.join(__dirname, "../assets/port.wasm")),
);
function gate(cash = 20, lives = 3, fence = 0, turret = 0) {
  const g = new WebAssembly.Instance(mod).exports;
  g.restore(cash, lives, 1, 0, fence, turret, 0, 0, 100, 0);
  const snap = () => new Float32Array(g.memory.buffer, g.state(), 32);
  const bank = () => Array.from(new Int32Array(g.memory.buffer, g.bank(), 12));
  function advance(n) {
    for (let i = 0; i < n; ++i) g.tick(0.05, 0, 0, 0);
  }
  function walk(x, z) {
    for (let i = 0; i < 220; i++) {
      let [px, , pz, yaw] = snap();
      let dx = x - px,
        dz = z - pz;
      let d = Math.hypot(dx, dz);
      if (d < 0.12) return;
      g.tick(
        Math.min(0.035, d / 8.8),
        (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d,
        (-dx * Math.sin(yaw) - dz * Math.cos(yaw)) / d,
        1,
      );
    }
    throw Error("Obstructed route to " + [x, z]);
  }
  function use(a = 0) {
    g.action(a);
    return g.take_event();
  }
  return { g, snap, bank, advance, walk, use };
}
test("inspect both sides, uncover cargo, and pay a correct decision once", () => {
  const { g, snap, bank, advance, walk, use } = gate();
  g.arrival(2, 0, 2, 4, 2, 0, 0, 0);
  advance(65);
  walk(6.4, 1.95);
  assert.equal(use(), 26);
  walk(2, 2.15);
  assert.equal(use(), 1);
  assert.equal(use(11), 10);
  advance(15);
  assert.ok(snap()[18] > 0.85);
  walk(-1.5, 2.16);
  assert.equal(use(), 9);
  assert.equal(use(), 2);
  walk(-4.3, 2.2);
  walk(-4.3, -2.05);
  walk(-2.75, -2.05);
  assert.equal(use(), 9);
  assert.equal(use(), 3);
  walk(4.4, -2.05);
  walk(4.4, 3.3);
  walk(6.4, 5.85);
  assert.equal(use(), 5);
  assert.equal(g.reward(1), 16);
  assert.equal(g.reward(1), 0);
  assert.equal(bank()[0], 36);
});
test("manual capture, hidden monster, electrical fence and turret resolve only once", () => {
  for (const [incident, flags, fence, turret, manual] of [
    [1, 1, 0, 0, true],
    [2, 2, 0, 0, true],
    [3, 2, 1, 0, false],
    [1, 1, 0, 2, false],
  ]) {
    const { g, snap, bank, advance, walk, use } = gate(20, 3, fence, turret);
    walk(-0.8, 2.3);
    g.arrival(0, 0, 1, 2, 1, incident, flags, 0);
    assert.equal(g.take_event(), 11 + incident);
    advance(40);
    if (manual) assert.equal(use(10), 20);
    advance(manual ? 25 : 160);
    assert.equal(bank()[1], 3);
    assert.equal(bank()[9], 1);
    assert.equal(bank()[0], manual ? 29 : 24);
    if (!manual) assert.equal(g.take_event(), 21);
    assert.equal(snap()[21], 1);
    use(10);
    advance(60);
    assert.equal(bank()[9], 1);
  }
});
test("loss spends exactly one life per escape, and new shift restores three", () => {
  const { g, snap, bank, advance } = gate();
  for (let i = 2; i >= 0; --i) {
    g.arrival(1, 0, 0, 0, 1, 1, 1, 0);
    advance(195);
    assert.equal(bank()[1], i);
    advance(160);
    assert.equal(bank()[1], i);
  }
  assert.equal(snap()[7], 9);
  g.rebirth();
  assert.equal(bank()[1], 3);
  assert.equal(bank()[0], 20);
});
test("bribe is recorded and audited once; rejecting preserves trust", () => {
  for (const take of [0, 1]) {
    const { g, bank, walk, use } = gate();
    g.arrival(0, 0, 1, 2, 0, 4, 3, 0);
    assert.equal(g.take_event(), 15);
    g.gift(take);
    g.gift(take);
    assert.equal(bank()[0], 20 + 6 * take);
    assert.equal(bank()[8], 100 - 8 * take);
    walk(6.4, 1.95);
    assert.equal(use(), 4);
    g.reward(1);
    g.reward(1);
    assert.equal(bank()[0], 36 - 3 * take);
  }
});
test("lane income needs a model; gear has capped levels; condo needs a lane and successful defense", () => {
  const { g, bank, advance } = gate(900);
  assert.equal(g.buy(5, 1), 3);
  assert.equal(g.buy(0, 0), 0);
  assert.equal(g.buy(5, 0), 3);
  advance(245);
  assert.equal(g.auto_due(), 0);
  g.set_model(1);
  advance(245);
  assert.equal(g.auto_due(), 1);
  assert.equal(g.auto_due(), 0);
  g.auto_pay(6);
  assert.equal(bank()[0], 866);
  for (const id of [1, 2, 3, 4]) {
    assert.equal(g.buy(id, 1), 0);
    assert.equal(g.buy(id, 1), 0);
    assert.equal(g.buy(id, 1), 1);
  }
  assert.equal(g.buy(5, 1), 0);
  assert.equal(g.buy(5, 1), 1);
  assert.equal(bank()[7], 1);
  assert.equal(g.buy(0, 1), 0);
  assert.equal(g.buy(0, 1), 0);
  assert.equal(g.buy(0, 1), 1);
  assert.equal(bank()[2], 4);
  const poor = gate(1);
  assert.equal(poor.g.buy(1, 0), 2);
  assert.equal(poor.bank()[0], 1);
});
