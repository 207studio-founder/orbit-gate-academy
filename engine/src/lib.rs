mod scene;
use scene::{World, V};
use std::cell::RefCell;
pub const TRUCK_SCALE: f32 = 1.34;
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
const LOCKER: i32 = 17;
const LOCKER_X: f32 = 0.45;
const LOCKER_Z: f32 = 5.70;
const SEIZED_SHIFT: u32 = 13;
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
    pub held: i32,
    pub placed: [bool; 2],
    pub goods_pos: [[f32; 3]; 2],
    pub twist: [[f32; 2]; 2],
    pub tower: i32,
    pub filter: i32,
    pub look_code: i32,
    pub low_mask: i32,
    pub needs_capture: bool,
    pub needs_permit: bool,
    pub needs_medical: bool,
    pub shot: [f32; 5],
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
            held: -1,
            placed: [false; 2],
            goods_pos: [[0.; 3]; 2],
            twist: [[0.; 2]; 2],
            tower: 0,
            filter: 1,
            look_code: 0,
            low_mask: 0,
            needs_capture: false,
            needs_permit: false,
            needs_medical: false,
            shot: [0.; 5],
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
    pub fn spots(&self) -> [(i32, f32, f32); 12] {
        [
            (CAB, self.truck + 2.55, 2.65),
            (BAY, self.truck - 1.7, 2.65),
            (FAR, self.truck - 3.4, -2.62),
            (GREEN, 6.4, 1.95),
            (RED, 6.4, 5.85),
            (SHOP, -5.6, 5.75),
            (LAB, -8.8, 2.45),
            (BADGE, 10.8, 5.5),
            (11, -1.65, 8.45),
            (12, 3.7, 9.5),
            (13, 8.2, 9.8),
            (LOCKER, LOCKER_X, LOCKER_Z),
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
    pub fn goods(&self, i: usize) -> [f32; 3] {
        if self.seized(i) {
            return [LOCKER_X + (i as f32 - 0.5) * 0.65, 0.92, LOCKER_Z];
        }
        if self.held == i as i32 {
            let (sy, cy) = self.yaw.sin_cos();
            return [
                self.x + 1.03 * cy + 0.25 * sy,
                1.12 + self.y,
                self.z - 1.03 * sy + 0.25 * cy,
            ];
        }
        if self.placed[i] && self.phase == PARK {
            return self.goods_pos[i];
        }
        let divert = if self.phase == EXIT && self.decision == 0 {
            (self.truck * 0.38).min(4.8)
        } else {
            0.
        };
        let angle = if divert > 0. && divert < 4.8 {
            0.34_f32
        } else {
            0.
        };
        let (sy, cy) = angle.sin_cos();
        let x = -1.15 * TRUCK_SCALE;
        let z = if i == 0 {
            0.65 * TRUCK_SCALE
        } else {
            -0.65 * TRUCK_SCALE
        };
        [
            self.truck + x * cy + z * sy,
            1.80 * TRUCK_SCALE,
            -divert - x * sy + z * cy,
        ]
    }
    fn plane_hit(&self, nx: f32, ny: f32, aspect: f32, height: f32) -> (f32, f32) {
        let (sy, cy) = self.yaw.sin_cos();
        let (sp, cp) = self.pitch.sin_cos();
        let camera_y = 1.28 + self.y * 0.58 + self.zoom * sp;
        let vertical = ny * cp / 1.93 - sp;
        let distance = if vertical < -0.015 {
            (height - camera_y) / vertical
        } else {
            110.
        };
        let side = distance * nx * aspect / 1.93;
        let radial = self.zoom * cp - distance * (cp + ny * sp / 1.93);
        (
            self.x + side * cy + radial * sy,
            self.z - side * sy + radial * cy,
        )
    }
    pub fn seized(&self, i: usize) -> bool {
        (self.flags >> SEIZED_SHIFT) & (1 << i) != 0
    }
    fn locker(&mut self) {
        let i = self.held;
        if i < 0 {
            self.event = 37;
            return;
        }
        if self.flags & 1 == 0 {
            self.event = 42;
            return;
        }
        if self.low_mask & (1 << i) == 0 {
            self.event = 38;
            return;
        }
        self.flags |= 1 << (SEIZED_SHIFT + i as u32);
        self.placed[i as usize] = false;
        self.twist[i as usize] = [0.; 2];
        self.held = -1;
        self.event = 35 + i;
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
    fn confirmed_high_visible(&self) -> bool {
        self.bag.iter().enumerate().any(|(i, k)| {
            k % 6 >= 4 && (self.flags & (2 << i) != 0 || (self.tier < 2 && self.flags & 2 != 0))
        })
    }
    fn trigger(&mut self, hook: i32) {
        if self.resolved || self.incident != hook {
            return;
        }
        self.held = -1;
        self.placed = [false; 2];
        self.phase = ALERT;
        self.timer = 1.9;
        self.event = 11 + hook;
        if hook == 2 {
            self.flags |= 512;
        }
        self.tx = if hook == 2 {
            self.truck - 1.6
        } else {
            self.truck + 2.5
        };
        self.tz = 2.44;
        if hook != 2 {
            self.flags |= 8;
        }
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
        if self.incident != 2 {
            self.flags |= 4096;
        }
        self.caught += 1;
        self.cash += if auto { 4 } else { 9 };
        self.pulse = 1.;
        self.event = if auto { 21 } else { 20 };
    }
    fn netshot(&mut self) {
        if ![CHASE, BEAST, HOP].contains(&self.phase) || self.aim > 0. {
            return;
        }
        self.launch_net(self.tx, self.tz);
    }
    fn launch_net(&mut self, x: f32, z: f32) {
        if ![CHASE, BEAST, HOP].contains(&self.phase) || self.aim > 0. {
            return;
        }
        let dx = x - self.x;
        let dz = z - self.z;
        let d = dx.hypot(dz).max(0.01);
        let range = 5.6 + 2.7 * self.net as f32;
        let reach = d.min(range);
        self.aim = 1.18 - 0.30 * self.net as f32;
        self.facing = dx.atan2(dz);
        self.shot = [self.x, self.z, dx / d, dz / d, reach.max(0.05)];
        self.beam = [self.x, self.z, self.x, self.z, 0.4];
        self.event = 29;
    }
    fn advance_net(&mut self, dt: f32) {
        if self.shot[4] <= 0. {
            return;
        }
        if ![CHASE, BEAST, HOP].contains(&self.phase) {
            self.shot[4] = 0.;
            return;
        }
        let step = (dt * 23.).min(self.shot[4]);
        self.shot[0] += self.shot[2] * step;
        self.shot[1] += self.shot[3] * step;
        self.shot[4] -= step;
        self.beam[2] = self.shot[0];
        self.beam[3] = self.shot[1];
        self.beam[4] = 0.26;
        if dist(self.tx, self.tz, self.shot[0], self.shot[1]) < 0.90 + 0.12 * self.net as f32 {
            self.shot[4] = 0.;
            self.capture(false);
        } else if self.shot[4] <= 0. {
            self.event = 23;
        }
    }
    fn within_truck(&self, x: f32, z: f32) -> bool {
        (x - self.truck).abs() < 3.42 * TRUCK_SCALE && z.abs() < 1.42 * TRUCK_SCALE
    }
    fn solid(&self, x: f32, z: f32) -> bool {
        self.within_truck(x, z)
            || ((x - LOCKER_X).abs() < 0.94 && (z - LOCKER_Z).abs() < 0.71)
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
        let out = if self.flags & 8 != 0 && ![EXIT, RETURN].contains(&self.phase) {
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
                if self.driver > 0.035 {
                    return;
                }
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
                self.tx += dt * (3.05 + 0.28 * self.tier as f32);
                self.tz = 2.55 + 0.32 * (self.elapsed * 2.2).sin();
                if self.tx > 21.0 {
                    self.hit();
                }
            }
            BEAST => {
                let d = dist(self.x, self.z, self.tx, self.tz).max(0.01);
                let mut gx = self.x;
                let mut gz = self.z;
                if self.z * self.tz < 0. && (self.tx - self.truck).abs() < 4.92 {
                    gx = self.truck + if self.tx > self.truck { 5.1 } else { -5.1 };
                    gz = if self.tz > 0. { 2.54 } else { -2.54 };
                }
                let delta = (gx - self.tx).hypot(gz - self.tz).max(0.01);
                let nx = self.tx + (gx - self.tx) / delta * dt * (2. + 0.23 * self.tier as f32);
                let nz = self.tz + (gz - self.tz) / delta * dt * (2. + 0.23 * self.tier as f32);
                if !self.solid(nx, self.tz) {
                    self.tx = nx;
                }
                if !self.solid(self.tx, nz) {
                    self.tz = nz;
                }
                if self.elapsed > 1.35 && d < 1.18 && self.y < 0.82 {
                    self.hit();
                } else if self.elapsed > 13. {
                    self.hit();
                }
            }
            HOP => {
                if self.tx < 5.12 {
                    self.tx += dt * 3.6;
                } else {
                    self.tz -= dt * (2.2 + 0.15 * self.tier as f32);
                }
                if self.tz < -7. {
                    if self.fence > 0 {
                        self.capture(true);
                    } else {
                        self.hit();
                    }
                }
            }
            CAPTURE if self.timer <= 0. => {
                if self.flags & 512 != 0 {
                    self.phase = EXIT;
                    self.decision = 0;
                    self.elapsed = 0.;
                } else {
                    self.phase = RETURN;
                }
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
        if self.phase == CHASE && self.fence >= 2 && self.tx >= 10. {
            self.capture(true);
        }
        if (self.tower > 0 || (self.lanes > 1 && self.guild > 0)) && self.phase != END {
            self.payclock += dt;
            if self.payclock >= 12. {
                self.payclock -= 12.;
                self.auto_due += 1;
            }
        }
        self.advance_net(dt);
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
            if matches!(self.phase, ARRIVE | EXIT | RETURN) && action == 0 {
                self.event = match self.near {
                    SHOP | LAB | BADGE => self.near,
                    11..=13 => self.near + 20,
                    _ => 0,
                };
            }
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
            LOCKER => self.locker(),
            GREEN | RED => {
                if self.destination() != GREEN {
                    self.event = 26;
                    return;
                }
                if self.needs_permit && self.flags & 1024 == 0 {
                    self.event = 27;
                    return;
                }
                if self.needs_medical && self.flags & 2048 == 0 {
                    self.event = 28;
                    return;
                }
                if self.low_mask & !(self.flags >> SEIZED_SHIFT) != 0 {
                    self.event = 39;
                    return;
                }
                if self.needs_capture && self.flags & 4096 == 0 {
                    self.event = 41;
                    return;
                }
                if self.needs_capture && self.near == GREEN {
                    self.event = 40;
                    return;
                }
                self.held = -1;
                self.placed = [false; 2];
                self.decision = if self.near == GREEN { 1 } else { 0 };
                self.event = if self.decision == 1 { 4 } else { 5 };
                self.phase = EXIT;
                self.elapsed = 0.;
            }
            SHOP | LAB | BADGE | 11 | 12 | 13 => {
                self.event = if self.near > 10 {
                    self.near + 20
                } else {
                    self.near
                }
            }
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
        if id == 5 && !qualifies {
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
        p.cash = cash;
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
        p.held = -1;
        p.placed = [false; 2];
        p.twist = [[0.; 2]; 2];
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
        p.shot = [0.; 5];
        p.needs_medical = false;
        p.needs_permit = false;
        p.low_mask = 0;
        p.needs_capture = incident == 5;
        p.decision = 0;
        p.nearest();
        if p.phase == PARK && flags & 512 != 0 && p.resolved {
            p.phase = EXIT;
        }
        if p.phase == PARK && !p.resolved {
            let hook = match incident {
                5 if flags & 1024 != 0 && p.confirmed_high_visible() => {
                    p.incident = 1;
                    1
                }
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
        if p.incident == 5 && !p.resolved && p.flags & 1024 != 0 && p.confirmed_high_visible() {
            p.incident = 1;
            p.trigger(1);
            return;
        }
        if p.incident == 5 {
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
        let pay = if correct != 0 {
            16
        } else if p.decision == 1 {
            -12
        } else {
            0
        };
        let audit = if p.flags & 64 != 0 { 9 } else { 0 };
        p.cash += pay - audit;
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
        let pos = if id == 14 || id == 15 {
            let [x, y, z] = p.goods((id - 14) as usize);
            V::new(x, y + 0.37 * TRUCK_SCALE, z)
        } else if id == LOCKER {
            V::new(LOCKER_X, 0.70, LOCKER_Z)
        } else if id == 16 {
            V::new(p.tx, 1.20, p.tz)
        } else if id == 10 {
            V::new(p.tx, 2.9, p.tz)
        } else {
            let (_, x, z) = p
                .spots()
                .iter()
                .copied()
                .find(|r| r.0 == id)
                .unwrap_or((1, 0., 0.));
            V::new(
                x,
                if id == CAB {
                    4.45
                } else if id == BAY || id == FAR {
                    2.78
                } else {
                    1.85
                },
                z,
            )
        };
        g.marker = scene::project(p, pos, aspect);
        g.marker.as_ptr()
    })
}
#[no_mangle]
pub extern "C" fn raster(w: usize, h: usize) -> *const u32 {
    with(|g| g.w.raster(&g.p, w, h))
}

#[no_mangle]
pub extern "C" fn appearance(code: i32) {
    with(|g| g.p.look_code = code.clamp(0, 255))
}
#[no_mangle]
pub extern "C" fn cargo_law(low: i32, high: i32) {
    with(|g| {
        g.p.low_mask = low & 3;
        g.p.needs_capture = high != 0;
    })
}
#[no_mangle]
pub extern "C" fn custody_location(x: f32, z: f32) {
    with(|g| {
        if g.p.flags & 4096 != 0 && x.is_finite() && z.is_finite() {
            g.p.tx = x.clamp(-23., 38.);
            g.p.tz = z.clamp(-18., 15.);
        }
    })
}
#[no_mangle]
pub extern "C" fn require_docs(danger: i32, medical: i32) {
    with(|g| {
        g.p.needs_permit = danger != 0;
        g.p.needs_medical = medical != 0;
    })
}
#[no_mangle]
pub extern "C" fn read_doc(kind: i32) -> i32 {
    with(|g| {
        let p = &mut g.p;
        if p.phase != PARK || p.near != CAB {
            return 0;
        }
        if kind == 1 && p.flags & 8 != 0 {
            p.flags |= 1024;
            1
        } else if kind == 2 {
            p.flags |= 2048;
            1
        } else {
            0
        }
    })
}
#[no_mangle]
pub extern "C" fn aim_net(nx: f32, ny: f32, aspect: f32) {
    with(|g| {
        let p = &mut g.p;
        let a = scene::project(p, V::new(p.tx, 0.32, p.tz), aspect);
        let b = scene::project(p, V::new(p.tx, 2.05, p.tz), aspect);
        let on_body = a[2] > 0.4
            && (nx - (a[0] + b[0]) * 0.5).abs() * aspect < 0.82 / a[2]
            && ny >= a[1].min(b[1])
            && ny <= a[1].max(b[1]);
        let (x, z) = if on_body {
            (p.tx, p.tz)
        } else {
            p.plane_hit(nx, ny, aspect, 1.20)
        };
        p.launch_net(x, z);
    })
}
#[no_mangle]
pub extern "C" fn preview_mesh(kind: i32, code: i32) -> *const scene::Vertex {
    with(|g| g.w.preview(kind, code))
}
#[no_mangle]
pub extern "C" fn preview_count() -> usize {
    with(|g| g.w.mesh(2).len())
}

#[no_mangle]
pub extern "C" fn tower_state(built: i32, filter: i32) {
    with(|g| {
        g.p.tower = built.clamp(0, 16);
        g.p.filter = filter.clamp(1, 3);
    })
}
#[no_mangle]
pub extern "C" fn spend(cost: i32) -> i32 {
    with(|g| {
        if cost <= 0 || g.p.cash < cost {
            return 0;
        }
        g.p.cash -= cost;
        1
    })
}
#[no_mangle]
pub extern "C" fn settle_trip(amount: i32) {
    with(|g| g.p.cash += amount.clamp(-192, 96))
}

#[no_mangle]
pub extern "C" fn held_item() -> i32 {
    with(|g| g.p.held)
}
#[no_mangle]
pub extern "C" fn turn_item(yaw: f32, pitch: f32) {
    with(|g| {
        let p = &mut g.p;
        if p.held >= 0 {
            let i = p.held as usize;
            p.twist[i][0] = (p.twist[i][0] + yaw) % 6.283185;
            p.twist[i][1] = (p.twist[i][1] + pitch) % 6.283185;
        }
    })
}
#[no_mangle]
pub extern "C" fn touch_cargo(nx: f32, ny: f32, aspect: f32) -> i32 {
    with(|g| {
        let p = &mut g.p;
        if p.phase != PARK {
            return 0;
        }
        if p.held >= 0 {
            let i = p.held as usize;
            let target = scene::project(p, V::new(LOCKER_X, 0.68, LOCKER_Z), aspect);
            if target[2] > 0.4
                && dist(p.x, p.z, LOCKER_X, LOCKER_Z) < 2.65
                && ((nx - target[0]) * aspect).hypot(ny - target[1]) < 1.9 / target[2]
            {
                p.locker();
                return 4;
            }
            let (x, z) = p.plane_hit(nx, ny, aspect, 0.18);
            let dx = x - p.x;
            let dz = z - p.z;
            let reach = 1.8 / dx.hypot(dz).max(1.8);
            let x = (p.x + reach * dx).clamp(-21., 25.);
            let z = (p.z + reach * dz).clamp(-11., 11.8);
            p.placed[i] = !p.within_truck(x, z);
            p.goods_pos[i] = if p.placed[i] && p.solid(x, z) {
                [p.x, 0.075, p.z]
            } else {
                [x, 0.075, z]
            };
            p.twist[i][1] = 0.;
            p.held = -1;
            return 2;
        }
        let mut best = -1;
        let mut closest = f32::INFINITY;
        for i in 0..2 {
            let shown =
                p.flags & (if i == 0 { 2 } else { 4 }) != 0 || (p.tier < 2 && p.flags & 2 != 0);
            if !shown || p.seized(i) {
                continue;
            }
            let [x, y, z] = p.goods(i);
            let v = scene::project(p, V::new(x, y + 0.37 * TRUCK_SCALE, z), aspect);
            if v[2] < 0.4 {
                continue;
            }
            let offset = ((nx - v[0]) * aspect).hypot(ny - v[1]);
            if offset < 1.75 / v[2] && offset < closest {
                closest = offset;
                best = i as i32;
            }
        }
        if best < 0 {
            return 0;
        }
        let [x, _, z] = p.goods(best as usize);
        if dist(p.x, p.z, x, z) > 3.75 {
            return 3;
        }
        p.held = best;
        p.placed[best as usize] = false;
        1
    })
}
