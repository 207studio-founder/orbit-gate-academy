mod scene;
use scene::{World, V};
use std::cell::RefCell;
const PARK: i32 = 1;
const ARRIVE: i32 = 0;
const EXIT: i32 = 2;
const ALERT: i32 = 3;
const CHASE: i32 = 4;
const BEAST: i32 = 5;
const HOP: i32 = 6;
const RETURN: i32 = 7;
const LOST: i32 = 8;
const END: i32 = 9;
const CAPTURE: i32 = 10;
const CAB: i32 = 1;
const BAY: i32 = 2;
const FAR: i32 = 3;
const GREEN: i32 = 4;
const RED: i32 = 5;
const SHOP: i32 = 6;
const LAB: i32 = 7;
const BADGE: i32 = 8;
fn clamp(x: f32, lo: f32, hi: f32) -> f32 {
    x.clamp(lo, hi)
}
fn dist(x: f32, z: f32, a: f32, b: f32) -> f32 {
    (x - a).hypot(z - b)
}
#[derive(Clone)]
pub struct Play {
    pub x: f32,
    pub z: f32,
    pub y: f32,
    vy: f32,
    pub yaw: f32,
    pub pitch: f32,
    pub zoom: f32,
    pub facing: f32,
    pub stride: f32,
    pub moving: f32,
    pub truck: f32,
    pub phase: i32,
    pub face: i32,
    pub mark: i32,
    pub bag: [i32; 2],
    pub flags: i32,
    pub incident: i32,
    pub resolved: bool,
    pub tier: i32,
    pub time: f32,
    pub elapsed: f32,
    pub timer: f32,
    pub tx: f32,
    pub tz: f32,
    pub driver: f32,
    pub aim: f32,
    pub beam: [f32; 5],
    pub target: i32,
    pub cash: i32,
    pub lives: i32,
    pub net: i32,
    pub boots: i32,
    pub fence: i32,
    pub turret: i32,
    pub lanes: i32,
    pub condo: i32,
    pub trust: i32,
    pub caught: i32,
    pub event: i32,
    pub near: i32,
    pub desired: i32,
    pub distance: f32,
    pub decision: i32,
    pub pulse: f32,
    pub guild: i32,
    pub payclock: f32,
    pub auto_due: i32,
}
impl Default for Play {
    fn default() -> Self {
        Self {
            x: 3.2,
            z: 4.6,
            y: 0.,
            vy: 0.,
            yaw: 0.30,
            pitch: 0.40,
            zoom: 10.9,
            facing: 3.14,
            stride: 0.,
            moving: 0.,
            truck: -16.,
            phase: ARRIVE,
            face: 0,
            mark: 0,
            bag: [0, 1],
            flags: 0,
            incident: 0,
            resolved: false,
            tier: 0,
            time: 0.,
            elapsed: 0.,
            timer: 0.,
            tx: 0.,
            tz: 0.,
            driver: 0.,
            aim: 0.,
            beam: [0.; 5],
            target: 0,
            cash: 20,
            lives: 3,
            net: 0,
            boots: 0,
            fence: 0,
            turret: 0,
            lanes: 1,
            condo: 0,
            trust: 100,
            caught: 0,
            event: 0,
            near: 0,
            desired: 1,
            distance: 0.,
            decision: 0,
            pulse: 0.,
            guild: 0,
            payclock: 0.,
            auto_due: 0,
        }
    }
}
impl Play {
    pub fn spots(&self) -> [(i32, f32, f32); 8] {
        [
            (CAB, self.truck + 2.0, 2.15),
            (BAY, self.truck - 1.5, 2.16),
            (FAR, self.truck - 2.75, -2.05),
            (GREEN, 6.4, 1.95),
            (RED, 6.4, 5.85),
            (SHOP, -5.6, 5.75),
            (LAB, -8.8, 2.45),
            (BADGE, 10.8, 5.5),
        ]
    }
    fn destination(&self) -> i32 {
        if self.flags & 1 == 0 {
            CAB
        } else if self.flags & 2 == 0 {
            BAY
        } else if self.tier >= 2 && self.flags & 4 == 0 {
            FAR
        } else {
            GREEN
        }
    }
    fn nearest(&mut self) {
        self.desired = self.destination();
        self.near = 0;
        let mut d = 3.05;
        for (id, x, z) in self.spots() {
            if id == FAR && self.tier < 2 {
                continue;
            }
            let n = dist(self.x, self.z, x, z);
            if n < d {
                self.near = id;
                d = n;
            }
        }
        self.distance = d;
    }
    fn trigger(&mut self, hook: i32) {
        if self.resolved || self.incident != hook {
            return;
        }
        self.phase = ALERT;
        self.timer = 1.9;
        self.event = 11 + hook;
        self.tx = self.truck - 1.1;
        self.tz = 1.8;
    }
    fn hit(&mut self) {
        self.lives = (self.lives - 1).max(0);
        self.resolved = true;
        self.phase = if self.lives == 0 { END } else { LOST };
        self.timer = 2.;
        self.event = 22;
    }
    fn capture(&mut self, auto: bool) {
        self.resolved = true;
        self.phase = CAPTURE;
        self.timer = 1.15;
        self.caught += 1;
        self.cash += if auto { 4 } else { 9 };
        self.pulse = 1.;
        self.event = if auto { 21 } else { 20 };
    }
    fn netshot(&mut self) {
        if ![CHASE, BEAST, HOP].contains(&self.phase) || self.aim > 0. {
            return;
        }
        self.aim = 1.18 - 0.30 * self.net as f32;
        let d = dist(self.x, self.z, self.tx, self.tz);
        self.beam = [self.x, self.z, self.tx, self.tz, 0.40];
        if d < 5.6 + 2.7 * self.net as f32 {
            self.capture(false)
        } else {
            self.event = 23;
        }
    }
    fn solid(&self, x: f32, z: f32) -> bool {
        let in_truck = (x - self.truck).abs() < 3.52 && z.abs() < 1.48;
        in_truck
            || ((x + 7.9).abs() < 2.5 && (z - 7.95).abs() < 1.55)
            || ((x - 10.9).abs() < 1.5 && (z - 8.35).abs() < 1.2)
    }
    fn update(&mut self, dt: f32, side: f32, forward: f32, sprint: bool) {
        self.time += dt;
        self.elapsed += dt;
        self.aim = (self.aim - dt).max(0.);
        self.beam[4] = (self.beam[4] - dt).max(0.);
        self.pulse = (self.pulse - dt).max(0.);
        self.timer -= dt;
        let len = side.hypot(forward).max(1.);
        let (sy, cy) = self.yaw.sin_cos();
        let dx = (side * cy - forward * sy) / len;
        let dz = (-side * sy - forward * cy) / len;
        let speed = (if sprint { 8.8 } else { 6.5 }) + 0.95 * self.boots as f32;
        let nx = clamp(self.x + dx * dt * speed, -21., 25.);
        let nz = clamp(self.z + dz * dt * speed, -11., 11.8);
        if !self.solid(nx, self.z) {
            self.x = nx;
        }
        if !self.solid(self.x, nz) {
            self.z = nz;
        }
        self.moving = dx.hypot(dz);
        if self.moving > 0.02 {
            self.facing = dx.atan2(dz);
            self.stride += dt * speed * 1.9;
        }
        self.vy -= 20. * dt;
        self.y = (self.y + self.vy * dt).max(0.);
        if self.y == 0. {
            self.vy = 0.;
        }
        let out = if self.flags & 8 != 0 && ![EXIT, CHASE, RETURN].contains(&self.phase) {
            1.
        } else {
            0.
        };
        self.driver += (out - self.driver) * (dt * 4.).min(1.);
        match self.phase {
            ARRIVE => {
                self.truck = (self.truck + dt * (4.7 + self.truck.abs() * 0.55)).min(0.);
                if self.truck == 0. {
                    self.phase = PARK;
                }
            }
            EXIT => {
                self.truck += dt * (3. + self.elapsed * 2.).min(15.);
                if self.truck > 15. {
                    self.event = 24;
                    self.phase = LOST;
                    self.timer = 1000.;
                }
            }
            ALERT if self.timer <= 0. => {
                self.phase = match self.incident {
                    1 => CHASE,
                    2 => BEAST,
                    _ => HOP,
                };
                self.elapsed = 0.;
            }
            CHASE => {
                self.truck += dt * (3.4 + 0.38 * self.tier as f32);
                self.tx = self.truck + 0.4;
                self.tz = 0.;
                if self.truck > 22. {
                    self.hit();
                }
            }
            BEAST => {
                let d = dist(self.x, self.z, self.tx, self.tz).max(0.01);
                self.tx += (self.x - self.tx) / d * dt * (2. + 0.23 * self.tier as f32);
                self.tz += (self.z - self.tz) / d * dt * (2. + 0.23 * self.tier as f32);
                if self.elapsed > 1.35 && d < 1.18 && self.y < 0.82 {
                    self.hit();
                } else if self.elapsed > 13. {
                    self.hit();
                }
            }
            HOP => {
                self.tx += dt * 2.15;
                self.tz -= dt * (1.55 + 0.15 * self.tier as f32);
                if self.tz < -7. {
                    if self.fence > 0 {
                        self.capture(true);
                    } else {
                        self.hit();
                    }
                }
            }
            CAPTURE if self.timer <= 0. => {
                self.phase = RETURN;
            }
            RETURN => {
                self.truck = (self.truck - dt * 8.).max(0.);
                if self.truck == 0. {
                    self.phase = PARK;
                }
            }
            LOST if self.timer <= 0. => {
                self.event = 25;
                self.timer = 1000.;
            }
            _ => {}
        }
        if [CHASE, BEAST, HOP].contains(&self.phase)
            && self.turret > 0
            && self.elapsed > 3.5 / self.turret as f32
            && dist(self.tx, self.tz, 3.8, -3.5) < 6.0 + 3.0 * self.turret as f32
        {
            self.capture(true);
        }
        if self.phase == CHASE && self.fence >= 2 && self.truck >= 10. {
            self.capture(true);
        }
        if self.lanes > 1 && self.guild > 0 && self.phase != END {
            self.payclock += dt;
            if self.payclock >= 12. {
                self.payclock -= 12.;
                self.auto_due += 1;
            }
        }
        self.nearest();
    }
    fn interact(&mut self, action: i32) {
        self.nearest();
        if action == 9 {
            if self.y <= 0.001 {
                self.vy = 7.7;
            }
            return;
        }
        if action == 10 {
            self.netshot();
            return;
        }
        if self.phase != PARK {
            return;
        }
        if action == 11 && self.near == CAB {
            self.flags |= 8;
            self.event = 10;
            return;
        }
        match self.near {
            CAB => {
                self.flags |= 1;
                self.event = 1;
            }
            BAY | FAR => {
                let far = self.near == FAR;
                let tarp = if far { 32 } else { 16 };
                if self.tier >= 1 && self.flags & tarp == 0 {
                    self.flags |= tarp;
                    self.event = 9;
                } else {
                    self.flags |= if far { 4 } else { 2 };
                    self.event = if far { 3 } else { 2 };
                }
            }
            GREEN | RED => {
                if self.destination() != GREEN {
                    self.event = 26;
                    return;
                }
                self.decision = if self.near == GREEN { 1 } else { 0 };
                self.event = if self.decision == 1 { 4 } else { 5 };
                self.phase = EXIT;
                self.elapsed = 0.;
            }
            SHOP | LAB | BADGE => self.event = self.near,
            _ => {}
        }
    }
    fn cost(&self, id: i32) -> i32 {
        match id {
            0 => match self.lanes {
                1 => 40,
                2 => 70,
                3 => 100,
                _ => 0,
            },
            1 => [25, 50, 0][self.net as usize],
            2 => [34, 60, 0][self.fence as usize],
            3 => [50, 75, 0][self.turret as usize],
            4 => [24, 45, 0][self.boots as usize],
            5 => {
                if self.condo == 0 {
                    210
                } else {
                    0
                }
            }
            _ => 0,
        }
    }
    fn buy(&mut self, id: i32, qualifies: bool) -> i32 {
        let price = self.cost(id);
        if price <= 0 {
            return 1;
        }
        if id == 5 && (!qualifies || self.lanes < 2) {
            return 3;
        }
        if self.cash < price {
            return 2;
        }
        self.cash -= price;
        match id {
            0 => self.lanes += 1,
            1 => self.net += 1,
            2 => self.fence += 1,
            3 => self.turret += 1,
            4 => self.boots += 1,
            5 => self.condo = 1,
            _ => {}
        }
        0
    }
}
#[derive(Default)]
struct Game {
    p: Play,
    w: World,
    snapshot: [f32; 32],
    bank: [i32; 12],
    marker: [f32; 3],
}
thread_local! {static GAME:RefCell<Game>=RefCell::new(Game::default());}
fn with<R>(f: impl FnOnce(&mut Game) -> R) -> R {
    GAME.with(|g| f(&mut g.borrow_mut()))
}
#[no_mangle]
pub extern "C" fn restore(
    cash: i32,
    lives: i32,
    lanes: i32,
    net: i32,
    fence: i32,
    turret: i32,
    boots: i32,
    condo: i32,
    trust: i32,
    caught: i32,
) {
    with(|g| {
        let p = &mut g.p;
        p.cash = cash.max(0);
        p.lives = lives.clamp(0, 3);
        p.lanes = lanes.clamp(1, 4);
        p.net = net.clamp(0, 2);
        p.fence = fence.clamp(0, 2);
        p.turret = turret.clamp(0, 2);
        p.boots = boots.clamp(0, 2);
        p.condo = condo.clamp(0, 1);
        p.trust = trust.clamp(0, 100);
        p.caught = caught.max(0);
    })
}
#[no_mangle]
pub extern "C" fn arrival(
    face: i32,
    mark: i32,
    a: i32,
    b: i32,
    tier: i32,
    incident: i32,
    flags: i32,
    resolved: i32,
) {
    with(|g| {
        let p = &mut g.p;
        p.face = face;
        p.mark = mark;
        p.bag = [a, b];
        p.tier = tier;
        p.incident = incident;
        p.flags = flags;
        p.resolved = resolved != 0;
        p.phase = if p.lives == 0 {
            END
        } else if flags > 0 {
            PARK
        } else {
            ARRIVE
        };
        p.truck = if p.phase == ARRIVE { -14. } else { 0. };
        p.event = 0;
        p.driver = if flags & 8 != 0 { 1. } else { 0. };
        p.elapsed = 0.;
        p.timer = 0.;
        p.beam[4] = 0.;
        p.aim = 0.;
        p.decision = 0;
        p.nearest();
        if p.phase == PARK && !p.resolved {
            let hook = match incident {
                1 if flags & 1 != 0 => 1,
                2 if flags & 2 != 0 => 2,
                3 if (tier < 2 && flags & 2 != 0) || (tier >= 2 && flags & 4 != 0) => 3,
                _ => 0,
            };
            if hook > 0 {
                p.trigger(hook);
            } else if incident == 4 && flags & 1 != 0 {
                p.event = 15;
            }
        }
    });
}
#[no_mangle]
pub extern "C" fn tick(dt: f32, x: f32, f: f32, run: i32) {
    with(|g| {
        let dt = clamp(dt, 0., 0.10);
        let steps = (dt * 90.).ceil().max(1.) as u32;
        for _ in 0..steps {
            g.p.update(dt / steps as f32, x, f, run != 0);
        }
    })
}
#[no_mangle]
pub extern "C" fn look(yaw: f32, pitch: f32, zoom: f32) {
    with(|g| {
        g.p.yaw = (g.p.yaw + yaw) % 6.283185;
        g.p.pitch = clamp(g.p.pitch + pitch, 0.15, 0.98);
        g.p.zoom = clamp(g.p.zoom + zoom, 6.2, 19.5);
    })
}
#[no_mangle]
pub extern "C" fn action(id: i32) {
    with(|g| g.p.interact(id))
}
#[no_mangle]
pub extern "C" fn after_read(hook: i32) {
    with(|g| {
        let p = &mut g.p;
        if p.phase != PARK {
            return;
        }
        if p.incident == 4 && !p.resolved && hook == 1 {
            p.event = 15;
        } else if p.incident == 3 && hook == 2 && p.tier < 2 {
            p.trigger(3);
        } else {
            p.trigger(hook);
        }
    })
}
#[no_mangle]
pub extern "C" fn gift(take: i32) {
    with(|g| {
        let p = &mut g.p;
        if p.incident != 4 || p.resolved {
            return;
        }
        p.resolved = true;
        if take != 0 {
            p.flags |= 64;
            p.cash += 6;
            p.trust = (p.trust - 8).max(0);
        } else {
            p.flags |= 128;
            p.trust = (p.trust + 2).min(100);
        }
    })
}
#[no_mangle]
pub extern "C" fn reward(correct: i32) -> i32 {
    with(|g| {
        let p = &mut g.p;
        if p.phase != EXIT || p.flags & 256 != 0 {
            return 0;
        }
        p.flags |= 256;
        let pay = if correct != 0 { 16 } else { 4 };
        let audit = if p.flags & 64 != 0 { 9 } else { 0 };
        p.cash = (p.cash + pay - audit).max(0);
        pay - audit
    })
}
#[no_mangle]
pub extern "C" fn buy(id: i32, win: i32) -> i32 {
    with(|g| g.p.buy(id, win != 0))
}
#[no_mangle]
pub extern "C" fn price(id: i32) -> i32 {
    with(|g| g.p.cost(id))
}
#[no_mangle]
pub extern "C" fn auto_pay(n: i32) {
    with(|g| g.p.cash += n.clamp(0, 60))
}
#[no_mangle]
pub extern "C" fn set_model(n: i32) {
    with(|g| g.p.guild = n)
}
#[no_mangle]
pub extern "C" fn take_event() -> i32 {
    with(|g| std::mem::take(&mut g.p.event))
}
#[no_mangle]
pub extern "C" fn auto_due() -> i32 {
    with(|g| std::mem::take(&mut g.p.auto_due))
}
#[no_mangle]
pub extern "C" fn rebirth() {
    with(|g| {
        g.p.lives = 3;
        g.p.x = 3.2;
        g.p.z = 4.6;
        g.p.phase = PARK;
        g.p.resolved = true;
    })
}
#[no_mangle]
pub extern "C" fn bank() -> *const i32 {
    with(|g| {
        let p = &g.p;
        g.bank = [
            p.cash,
            p.lives,
            p.lanes,
            p.net,
            p.fence,
            p.turret,
            p.boots,
            p.condo,
            p.trust,
            p.caught,
            p.flags,
            p.resolved as i32,
        ];
        g.bank.as_ptr()
    })
}
#[no_mangle]
pub extern "C" fn state() -> *const f32 {
    with(|g| {
        let p = &g.p;
        g.snapshot = [
            p.x,
            p.y,
            p.z,
            p.yaw,
            p.pitch,
            p.zoom,
            p.truck,
            p.phase as f32,
            p.near as f32,
            p.desired as f32,
            p.flags as f32,
            p.elapsed,
            p.tx,
            p.tz,
            p.lives as f32,
            p.aim,
            p.time,
            p.tier as f32,
            p.driver,
            p.decision as f32,
            p.cash as f32,
            p.resolved as i32 as f32,
            p.lanes as f32,
            p.turret as f32,
            p.fence as f32,
            p.moving,
            p.timer,
            p.incident as f32,
            p.pulse,
            p.guild as f32,
            p.stride,
            p.facing,
        ];
        g.snapshot.as_ptr()
    })
}
#[no_mangle]
pub extern "C" fn build_world() {
    with(|g| g.w.build(&g.p))
}
#[no_mangle]
pub extern "C" fn draw_objects() {
    with(|g| g.w.dynamic(&g.p))
}
#[no_mangle]
pub extern "C" fn vertices(dynamic: i32) -> *const scene::Vertex {
    with(|g| g.w.mesh(dynamic).as_ptr())
}
#[no_mangle]
pub extern "C" fn count(dynamic: i32) -> usize {
    with(|g| g.w.mesh(dynamic).len())
}
#[no_mangle]
pub extern "C" fn project(id: i32, aspect: f32) -> *const f32 {
    with(|g| {
        let p = &g.p;
        let pos = if id == 10 {
            V::new(p.tx, 2.9, p.tz)
        } else {
            let (_, x, z) = p.spots()[(id.clamp(1, 8) - 1) as usize];
            V::new(x, if id == CAB { 3.6 } else { 1.85 }, z)
        };
        g.marker = scene::project(p, pos, aspect);
        g.marker.as_ptr()
    })
}
#[no_mangle]
pub extern "C" fn raster(w: usize, h: usize) -> *const u32 {
    with(|g| g.w.raster(&g.p, w, h))
}
