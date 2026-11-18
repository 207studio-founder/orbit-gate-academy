mod models;
mod stack;
use crate::TRUCK_SCALE;
use crate::{clamp, Play, ALERT, BEAST, CAPTURE, CHASE, EXIT, HOP, PARK};
use std::f32::consts::{PI, TAU};
#[repr(C)]
#[derive(Clone, Copy, Default)]
pub struct V {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}
impl V {
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }
}
#[repr(C)]
#[derive(Clone, Copy)]
pub struct Vertex {
    p: V,
    c: u32,
}
#[derive(Default)]
pub struct World {
    ground: Vec<Vertex>,
    objects: Vec<Vertex>,
    preview_mesh: Vec<Vertex>,
    pixels: Vec<u32>,
    depth: Vec<f32>,
}
const INK: u32 = 0x27384b;
const NAVY: u32 = 0x414c67;
const METAL: u32 = 0x98a9af;
const IVORY: u32 = 0xe5d7b9;
const GOLD: u32 = 0xffbc50;
const AQUA: u32 = 0x65e0d2;
const RED: u32 = 0xe87e67;
const GRASS: u32 = 0x75c3a4;
const SKIN: [u32; 12] = [
    0x88e4b3, 0xad94ef, 0xf7b76a, 0x77cde6, 0xf5a9b9, 0x8bd5b7, 0xb5b1fa, 0xb2d77e, 0x8ec9ff,
    0xdc9be6, 0xf7c56c, 0x7fdaca,
];
fn rgb(c: u32, k: f32) -> u32 {
    let ch = |n: u32| ((((c >> n) & 255) as f32 * k).min(255.)) as u32;
    ch(16) | (ch(8) << 8) | (ch(0) << 16) | 0xff000000
}
struct Model<'a> {
    v: &'a mut Vec<Vertex>,
    x: f32,
    y: f32,
    z: f32,
    s: f32,
    co: f32,
    si: f32,
}
impl<'a> Model<'a> {
    fn at(v: &'a mut Vec<Vertex>, x: f32, y: f32, z: f32, s: f32, yaw: f32) -> Self {
        let (si, co) = yaw.sin_cos();
        Self {
            v,
            x,
            y,
            z,
            s,
            co,
            si,
        }
    }
    fn v(&self, p: [f32; 3]) -> V {
        V::new(
            self.x + (p[0] * self.co + p[2] * self.si) * self.s,
            self.y + p[1] * self.s,
            self.z + (-p[0] * self.si + p[2] * self.co) * self.s,
        )
    }
    fn q(&mut self, c: u32, k: f32, a: [f32; 3], b: [f32; 3], d: [f32; 3], e: [f32; 3]) {
        let c = rgb(c, k);
        let v = [a, b, d, e].map(|p| Vertex { p: self.v(p), c });
        self.v
            .extend_from_slice(&[v[0], v[1], v[2], v[0], v[2], v[3]]);
    }
    fn block(&mut self, x: f32, y: f32, z: f32, w: f32, h: f32, l: f32, c: u32) {
        let (a, b) = (x - w / 2., x + w / 2.);
        let (d, e) = (z - l / 2., z + l / 2.);
        let (t, u) = (y - h / 2., y + h / 2.);
        self.q(c, 1.13, [a, u, d], [a, u, e], [b, u, e], [b, u, d]);
        self.q(c, 0.95, [a, t, e], [b, t, e], [b, u, e], [a, u, e]);
        self.q(c, 0.75, [b, t, d], [a, t, d], [a, u, d], [b, u, d]);
        self.q(c, 0.78, [b, t, e], [b, t, d], [b, u, d], [b, u, e]);
        self.q(c, 1.03, [a, t, d], [a, t, e], [a, u, e], [a, u, d]);
        self.q(c, 0.65, [a, t, d], [b, t, d], [b, t, e], [a, t, e]);
    }
    fn cyl(&mut self, x: f32, y: f32, z: f32, r: f32, t: f32, h: f32, n: usize, c: u32) {
        for i in 0..n {
            let (sa, ca) = (i as f32 * TAU / n as f32).sin_cos();
            let (sb, cb) = ((i + 1) as f32 * TAU / n as f32).sin_cos();
            let a = [x + r * ca, y, z + r * sa];
            let b = [x + r * cb, y, z + r * sb];
            let d = [x + t * cb, y + h, z + t * sb];
            let e = [x + t * ca, y + h, z + t * sa];
            self.q(c, 0.86 + (sa - ca) * 0.10, a, e, d, b);
            self.q(c, 1.10, [x, y + h, z], d, e, [x, y + h, z]);
        }
    }
    fn sign(&mut self, x: f32, z: f32, c: u32) {
        self.block(x, 0.7, z, 0.22, 1.4, 0.24, NAVY);
        self.block(x, 1.4, z, 1.05, 0.55, 0.30, c);
        self.block(x, 1.42, z + 0.16, 0.62, 0.12, 0.03, IVORY);
    }
}
fn truck(
    v: &mut Vec<Vertex>,
    x: f32,
    z: f32,
    color: u32,
    flags: i32,
    tier: i32,
    scale: f32,
    time: f32,
    rotation: f32,
) {
    let k = (1u64 << 60)
        | ((color as u64) << 21)
        | (((flags & 54) as u64) << 4)
        | ((tier.min(2) as u64) << 2);
    let mut at = Model::at(v, x, 0., z, scale, rotation);
    stack::draw(k, 0.105, &mut at, |v| {
        truck_raw(v, 0., 0., color, flags, tier, 1., 0., 0.)
    });
    let _ = time;
}
fn truck_raw(
    v: &mut Vec<Vertex>,
    x: f32,
    z: f32,
    color: u32,
    flags: i32,
    tier: i32,
    scale: f32,
    time: f32,
    rotation: f32,
) {
    let mut m = Model::at(v, x, 0., z, scale, rotation);
    m.block(-0.08, 0.057, -0.15, 6.86, 0.026, 3.0, 0x536272);
    m.block(0., 0.46, 0., 6.45, 0.45, 2.56, INK);
    m.block(-0.1, 0.81, 0., 6.5, 0.29, 2.7, METAL);
    for a in [-2.1, -1.16, 2.12] {
        for side in [-1., 1.] {
            m.block(a, 0.48, side * 1.28, 0.80, 0.52, 0.25, INK);
            m.block(a, 0.48, side * 1.28, 0.55, 0.76, 0.25, INK);
            m.block(a, 0.46, side * 1.425, 0.47, 0.41, 0.075, 0x82a7ad);
            m.block(a, 0.45, side * 1.475, 0.23, 0.12, 0.035, AQUA);
        }
    }
    m.block(2.05, 1.38, 0., 2.23, 0.97, 2.68, color);
    // Open front and side windows expose the dashboard, chair and seated pilot.
    m.block(1.16, 2.24, 0., 0.12, 1.38, 2.24, color);
    m.block(1.70, 1.73, 0.44, 0.82, 0.22, 0.88, NAVY);
    m.block(1.33, 2.03, 0.44, 0.16, 0.64, 0.84, INK);
    m.block(2.74, 1.79, 0., 0.32, 0.27, 2.13, 0x465b67);
    m.block(2.54, 1.91, 0.53, 0.12, 0.33, 0.13, INK);
    for (dy, dz, w, h) in [
        (0., 0., 0.48, 0.075),
        (0.26, 0., 0.48, 0.075),
        (0.13, -0.21, 0.065, 0.29),
        (0.13, 0.21, 0.065, 0.29),
    ] {
        m.block(2.48, 1.96 + dy, 0.55 + dz, 0.08, h, w, INK);
    }
    m.block(1.97, 3.08, 0., 2.27, 0.14, 2.52, IVORY);
    for side in [-1., 1.] {
        for x in [0.99, 2.92] {
            m.block(x, 2.35, side * 1.13, 0.10, 1.45, 0.10, color);
        }
        m.block(1.95, 1.71, side * 1.16, 2.13, 0.18, 0.12, color);
        m.block(1.85, 2.96, side * 1.16, 2.12, 0.07, 0.12, NAVY);
        m.block(1.38, 1.50, side * 1.36, 0.28, 0.075, 0.04, INK);
        m.block(2.53, 2.13, side * 1.46, 0.22, 0.3, 0.16, IVORY);
        m.block(2.93, 1.3, side * 0.95, 0.55, 0.24, 0.40, 0xffe7a3);
    }
    m.block(3.24, 0.91, 0., 0.21, 0.27, 2.86, IVORY);
    m.block(3.19, 1.35, 0., 0.09, 0.40, 1.26, INK);
    for z in [-0.41, 0., 0.41] {
        m.block(3.25, 1.35, z, 0.05, 0.23, 0.07, METAL);
    }
    for s in [-1., 1.] {
        m.block(1.8, 1.67, s * 1.35, 1.74, 0.075, 0.05, IVORY);
        m.block(0.95, 0.74, s * 1.43, 0.55, 0.12, 0.32, INK);
        m.block(-2.84, 1.34, s * 1.36, 0.49, 0.23, 0.045, IVORY);
        m.block(-2.84, 1.34, s * 1.40, 0.31, 0.07, 0.03, RED);
    }
    m.block(-1.12, 1.31, 0., 4.12, 0.7, 2.58, 0x647f85);
    m.block(-1.12, 1.70, 0., 4.19, 0.15, 2.64, IVORY);
    for side in [-1., 1.] {
        for a in [-2.7, -1.28, 0.35] {
            m.block(a, 1.40, side * 1.3, 0.10, 0.69, 0.09, GOLD);
        }
    }
    for i in 0..2 {
        let zz = if i == 0 { 0.65 } else { -0.65 };
        let shown = flags & (if i == 0 { 2 } else { 4 }) != 0 || (tier < 2 && flags & 2 != 0);
        let no_tarp = flags & (if i == 0 { 16 } else { 32 }) != 0;
        if !shown {
            if tier > 0 && !no_tarp {
                m.block(-1.1, 2.06, zz, 4.07, 0.60, 1.34, 0x557773);
                m.block(-1.1, 2.43, zz, 3.83, 0.17, 1.15, 0x789795);
                for a in [-2.35, 0.1] {
                    m.block(a, 2.49, zz, 0.12, 0.10, 1.20, IVORY);
                }
            } else {
                m.block(-1.1, 1.94, zz, 3.93, 0.37, 1.18, 0xae815e);
                m.block(-1.12, 2.15, zz, 3.96, 0.07, 1.20, 0xd8b48c);
            }
        }
    }
    if time > 0. {
        m.block(-3.46, 0.77, 0., 0.26 + time * 0.3, 0.17, 0.96, AQUA);
    }
}
fn person(
    v: &mut Vec<Vertex>,
    x: f32,
    y: f32,
    z: f32,
    yaw: f32,
    walk: f32,
    player: bool,
    face: i32,
    mark: i32,
    seat: f32,
) {
    let phase = (walk * 3.).round() as i32;
    let pos = (seat * 4.).round() as i32;
    let k = (2u64 << 60)
        | ((face as u64) << 12)
        | ((mark as u64) << 8)
        | (((phase + 3) as u64) << 4)
        | (pos as u64);
    let mut at = Model::at(v, x, y, z, 1., yaw);
    stack::draw(k, 0.049, &mut at, |v| {
        person_raw(
            v,
            0.,
            0.,
            0.,
            0.,
            phase as f32 / 3.,
            player,
            face,
            mark,
            pos as f32 / 4.,
        )
    });
}
fn person_raw(
    v: &mut Vec<Vertex>,
    x: f32,
    y: f32,
    z: f32,
    yaw: f32,
    walk: f32,
    player: bool,
    face: i32,
    mark: i32,
    seat: f32,
) {
    let mut m = Model::at(v, x, y, z, if player { 0.98 } else { 0.82 }, yaw);
    let skin = SKIN[(face as usize) % 12];
    let suit = if player {
        0xe39a46
    } else {
        [0xf18b55, 0x619bc9, 0xae81c5, 0xe2ae53][face as usize % 4]
    };
    for side in [-1., 1.] {
        let a = side * walk;
        m.block(
            side * 0.23,
            0.43 + 0.07 * a.abs() + seat * 0.29,
            a * 0.25 + seat * 0.21,
            0.36,
            0.63,
            0.4,
            NAVY,
        );
        m.block(
            side * 0.23,
            0.16 + 0.1 * a.abs() + seat * 0.36,
            a * 0.29 + 0.08 + seat * 0.42,
            0.4,
            0.25,
            0.54,
            INK,
        );
        m.block(
            side * 0.54,
            1.12,
            -a * 0.25 + seat * 0.21,
            0.26,
            0.53,
            0.34,
            suit,
        );
        m.block(
            side * 0.54,
            0.83 + seat * 0.29,
            -a * 0.27 + seat * 0.57,
            0.25,
            0.22,
            0.32,
            if player { INK } else { skin },
        );
    }
    m.block(0., 1.05, 0., 0.82, 0.76, 0.56, suit);
    m.block(0., 0.76, 0., 0.81, 0.12, 0.57, INK);
    m.block(0., 1.22, 0.29, 0.58, 0.14, 0.035, IVORY);
    m.block(-0.24, 1.27, 0.32, 0.12, 0.10, 0.03, AQUA);
    if player {
        m.block(0., 1.15, -0.38, 0.58, 0.70, 0.31, NAVY);
        m.block(0., 1.17, -0.56, 0.38, 0.38, 0.08, IVORY);
        m.block(0., 1.17, -0.61, 0.20, 0.12, 0.03, AQUA);
        m.block(0., 1.83, 0., 0.83, 0.76, 0.75, IVORY);
        m.block(0., 1.87, 0.385, 0.75, 0.37, 0.08, 0x264964);
        m.block(-0.13, 1.96, 0.433, 0.35, 0.06, 0.04, AQUA);
        m.block(0., 2.18, 0., 0.2, 0.1, 0.77, GOLD);
        m.block(0.61, 0.90, 0.19, 0.28, 0.27, 0.58, 0x476b7b);
        m.block(0.61, 0.90, 0.50, 0.29, 0.27, 0.10, AQUA);
    } else {
        m.block(0., 1.83, 0., 0.98, 0.8, 0.76, skin);
        for side in [-1., 1.] {
            m.block(side * 0.25, 1.89, 0.39, 0.18, 0.25, 0.045, INK);
            m.block(side * 0.25 - 0.035, 1.96, 0.42, 0.055, 0.055, 0.02, IVORY);
            let k = face % 4;
            match k {
                0 => {
                    m.block(side * 0.29, 2.36, 0., 0.075, 0.35, 0.08, skin);
                    m.block(side * 0.29, 2.56, 0., 0.15, 0.14, 0.15, GRASS);
                }
                1 => m.block(side * 0.53, 2.11, 0., 0.25, 0.42, 0.23, skin),
                2 => m.cyl(side * 0.3, 2.20, 0., 0.13, 0., 0.33, 4, GOLD),
                _ => {}
            }
        }
        if face % 4 == 3 {
            m.block(0., 2.08, 0.39, 0.15, 0.12, 0.04, INK);
        }
        for i in 0..mark {
            m.block(
                -0.32 + i as f32 * 0.10,
                1.68,
                0.389,
                0.06,
                0.09,
                0.025,
                0x66405e,
            );
        }
    }
}
fn creature(m: &mut Model, t: f32) {
    let ff = (t * 3.).floor() as i32 % 5;
    stack::draw((3u64 << 60) + ff as u64, 0.074, m, |v| {
        creature_raw(&mut Model::at(v, 0., 0., 0., 1., 0.), ff as f32 / 3.)
    });
}
fn creature_raw(m: &mut Model, t: f32) {
    let h = (t * 6.).sin().abs() * 0.48;
    m.block(0., 0.75 + h, 0., 1.03, 0.97, 0.9, 0xa46fba);
    m.block(0., 0.53 + h, 0.445, 0.72, 0.34, 0.07, 0xcf9dbe);
    for k in [-1., 1.] {
        m.block(k * 0.5, 0.55 + h, -0.04, 0.24, 0.4, 0.5, 0x825b92);
        m.cyl(k * 0.31, 1.20 + h, 0., 0.18, 0.02, 0.43, 5, GOLD);
        m.block(k * 0.23, 0.92 + h, 0.46, 0.16, 0.18, 0.06, IVORY);
        m.block(k * 0.24, 0.93 + h, 0.51, 0.08, 0.12, 0.035, INK);
        m.block(k * 0.32, 0.16 + h, 0.08, 0.27, 0.24, 0.46, NAVY);
    }
}
impl World {
    pub fn mesh(&self, d: i32) -> &[Vertex] {
        match d {
            0 => &self.ground,
            2 => &self.preview_mesh,
            _ => &self.objects,
        }
    }
    pub fn preview(&mut self, kind: i32, code: i32) -> *const Vertex {
        self.preview_mesh.clear();
        if kind == 1 {
            models::ranger(
                &mut self.preview_mesh,
                0.,
                0.,
                0.,
                0.,
                0.,
                code.clamp(0, 255),
                0.,
            );
        } else if kind == 2 {
            person(
                &mut self.preview_mesh,
                0.,
                0.,
                0.,
                0.,
                0.,
                false,
                code % 12,
                code / 12,
                0.,
            );
        } else if kind == 3 {
            truck(&mut self.preview_mesh, 0., 0., 0xcf8f8d, 0, 0, 1., 0., 0.);
        } else {
            models::cargo(
                &mut Model::at(&mut self.preview_mesh, 0., 0., 0., 1., 0.),
                code,
                0.,
                0.,
                0.,
            );
        }
        self.preview_mesh.as_ptr()
    }
    pub fn build(&mut self, p: &Play) {
        self.ground.clear();
        let mut m = Model::at(&mut self.ground, 0., 0., 0., 1., 0.);
        m.block(0., -1.4, 0., 200., 2., 160., 0xd8a9b3);
        m.block(0., -0.24, 1., 58., 0.46, 28., 0x94b9ae);
        m.block(0., 0.00, 0., 55., 0.04, 5.4, 0x737695);
        for x in -14..15 {
            let a = x as f32 * 2.;
            for z in [-2.58, 2.58] {
                m.block(a, 0.041, z, 1.12, 0.02, 0.08, IVORY);
            }
        }
        for x in -5..6 {
            let a = x as f32 * 4.;
            m.block(a, 0.025, 7.4, 0.045, 0.02, 10., 0x799a97);
        }
        for (x, z, c) in [
            (6.4, 1.95, GRASS),
            (6.4, 5.85, RED),
            (-8.8, 2.45, AQUA),
            (-5.6, 5.75, GOLD),
            (10.8, 5.5, 0xafa2df),
        ] {
            m.cyl(x, 0.035, z, 0.92, 0.92, 0.085, 8, c);
            m.cyl(x, 0.122, z, 0.69, 0.69, 0.02, 8, NAVY);
            m.sign(x + 0.8, z - 0.33, c);
        }
        // The arrival arch, control booth and two lit approach strips.
        for z in [-3.1, 3.1] {
            m.block(8., 1.9, z, 0.65, 3.8, 0.57, IVORY);
            m.block(8., 0.64, z, 0.85, 1.28, 0.8, NAVY);
            m.block(7.65, 2.44, z, 0.08, 1.35, 0.2, GOLD);
        }
        m.block(8., 4.02, 0., 0.87, 0.55, 6.8, IVORY);
        m.block(7.53, 4.02, 0., 0.08, 0.39, 4.8, INK);
        for i in -3..4 {
            m.block(7.46, 4.04, i as f32 * 0.62, 0.065, 0.12, 0.38, GOLD);
        }
        m.block(-7.9, 1.1, 7.95, 5.1, 2.2, 3.1, 0x748a91);
        m.block(-7.9, 2.32, 7.95, 5.55, 0.34, 3.48, IVORY);
        m.block(-7.9, 1.58, 6.36, 4.35, 0.82, 0.10, 0x385466);
        for x in [-9.42, -7.92, -6.38] {
            m.block(x, 1.59, 6.28, 0.1, 0.86, 0.11, METAL);
        }
        m.block(-5.35, 1.12, 7.95, 0.09, 1.65, 1.12, INK);
        for x in [-13., -3., 13., 21.] {
            m.block(x, 2.13, -6.2, 0.25, 4.25, 0.26, NAVY);
            m.block(x, 4.27, -5.75, 0.49, 0.24, 1.34, IVORY);
            m.block(x, 4.12, -5.45, 0.34, 0.07, 0.61, GOLD);
        }
        for i in -7..9 {
            let x = i as f32 * 3.;
            m.block(x, 0.65, -7., 0.20, 1.3, 0.24, NAVY);
            m.block(x + 1.5, 0.48, -7., 2.82, 0.12, 0.12, METAL);
            m.block(
                x + 1.5,
                0.94,
                -7.,
                2.82,
                0.12,
                0.12,
                if p.fence > 0 { AQUA } else { METAL },
            );
            if p.fence > 0 {
                m.block(x, 1.35, -7., 0.4, 0.22, 0.4, AQUA);
            }
        }
        for n in 1..p.lanes {
            let z = -10. - (n - 1) as f32 * 3.4;
            m.block(0., -0.02, z, 49., 0.15, 3.1, 0x55677e);
            for x in [-10., 0., 10.] {
                m.block(x, 0.09, z + 1.45, 1.3, 0.035, 0.095, GOLD);
            }
        }
        if p.turret > 0 {
            m.cyl(3.8, 0., -3.5, 0.72, 0.62, 0.35, 8, NAVY);
            m.cyl(3.8, 0.35, -3.5, 0.26, 0.23, 1.18, 6, METAL);
            m.block(3.8, 1.68, -3.5, 0.97, 0.69, 0.75, IVORY);
            m.block(3.8, 1.7, -3.1, 0.67, 0.34, 0.1, AQUA);
        }
        // Voxel crescent hills, mineral spires, service hangars and the distant condominium.
        for i in 0..34 {
            let a = i as f32 * 6.3 - 95.;
            let h = 2. + ((i * 37 + 11) % 13) as f32 * 0.56;
            let z = -31. - ((i * 13) % 5) as f32 * 3.;
            m.block(a, h * 0.32 - 0.6, z, 8., h * 0.75, 8., 0xad8594);
            m.block(
                a + 0.8,
                h * 0.72 - 0.5,
                z - 1.,
                5.0,
                h * 0.33,
                6.4,
                0xc0929a,
            );
            m.block(
                a + 0.5,
                h * 0.92 - 0.5,
                z - 1.,
                3.2,
                h * 0.17,
                4.1,
                0xd6a795,
            );
        }
        for i in 0..21 {
            let x = (i * 19 % 61) as f32 - 28.;
            let z = if i % 2 == 0 {
                14. + (i % 4) as f32
            } else {
                -17. - (i % 7) as f32
            };
            let h = 1.05 + (i % 4) as f32 * 0.43;
            m.cyl(x, -0.33, z, 0.64, 0.33, h, 5, 0x9282ae);
            m.cyl(x, h - 0.33, z, 0.34, 0., 0.65, 5, 0xc4a2d1);
            m.cyl(x + 0.58, -0.25, z + 0.19, 0.3, 0.08, h * 0.55, 5, 0x88b7b7);
        }
        for i in 0..4 {
            let x = -21. + i as f32 * 4.1;
            m.block(x, 1.4, -13.5, 3.6, 2.8, 3.7, 0x8e9ba6);
            m.block(x, 2.88, -13.5, 3.95, 0.32, 4.05, IVORY);
            m.block(x, 1.48, -11.6, 2.76, 1.84, 0.09, 0x51657c);
        }
        // Fixed facilities are part of the walkable world; buying a tower rebuilds this mesh.
        for (x, z, col) in [(-1.65, 8.45, AQUA), (3.7, 9.5, 0xc48fae), (8.2, 9.8, GOLD)] {
            m.cyl(x, 0.02, z, 0.96, 0.96, 0.13, 8, NAVY);
            m.cyl(x, 0.15, z, 0.83, 0.83, 0.045, 8, col);
            m.block(x, 0.93, z + 1., 1.42, 1.75, 0.52, NAVY);
            m.block(x, 1.24, z + 0.716, 1.1, 0.63, 0.06, col);
        }
        let (bx, bz) = (crate::LOCKER_X, crate::LOCKER_Z);
        m.block(bx, 0.40, bz, 1.50, 0.80, 1.10, 0xb87940);
        m.block(bx, 0.85, bz, 1.62, 0.11, 1.18, 0xffc76c);
        m.block(bx, 0.92, bz, 1.40, 0.05, 0.97, 0x4d6265);
        m.block(bx, 0.49, bz + 0.56, 0.54, 0.27, 0.04, IVORY);
        m.block(bx, 0.49, bz + 0.59, 0.12, 0.19, 0.03, 0x92662d);
        m.block(3.7, 1.08, 10.78, 2.54, 2.17, 0.74, 0x9b7998);
        m.block(3.7, 1.32, 10.34, 1.14, 1.39, 0.10, 0xcce8dc);
        m.block(-8.8, 0.63, 1.41, 2.18, 1.17, 0.80, NAVY);
        m.block(-8.8, 1.26, 1.41, 2.28, 0.09, 0.91, AQUA);
        models::cargo(&mut m, 18, -9.32, 1.31, 1.36);
        models::cargo(&mut m, 5, -8.35, 1.31, 1.36);
        if p.tower > 0 {
            let x = -1.65;
            let z = 10.15;
            m.cyl(x, 0., z, 1.00, 0.67, 0.7, 8, METAL);
            m.cyl(x, 0.7, z, 0.42, 0.30, 2.5, 8, NAVY);
            m.cyl(x, 3.2, z, 0.94, 0.68, 0.58, 8, AQUA);
            m.cyl(x, 3.78, z, 0.44, 0.07, 0.63, 8, GOLD);
            for i in 0..p.filter {
                m.cyl(x, 1.15 + i as f32 * 0.56, z, 0.50, 0.50, 0.13, 8, GOLD);
            }
        }
        for i in 1..p.tower {
            let xx = -12.5 + (i % 5) as f32 * 5.2;
            let zz = -8.1 - (i / 5) as f32 * 3.9;
            m.cyl(xx, 0., zz, 0.50, 0.39, 0.40, 6, METAL);
            m.cyl(xx, 0.4, zz, 0.29, 0.19, 2.40, 6, NAVY);
            m.cyl(xx, 2.8, zz, 0.57, 0.34, 0.34, 6, AQUA);
            m.cyl(xx, 3.14, zz, 0.19, 0.04, 0.27, 6, GOLD);
        }
        // Pixel-cut canopies in stacked slices; all share one cached sprite per palette.
        for (i, (xx, zz)) in [
            (-13., -4.7),
            (-9.1, -5.5),
            (12.4, -5.8),
            (17., -4.8),
            (-13., 8.),
            (16., 9.),
            (-17., -9.),
            (21., -9.),
            (19., 10.5),
        ]
        .into_iter()
        .enumerate()
        {
            let col = if i % 3 == 0 {
                0xe7a1b4
            } else if i % 3 == 1 {
                0x9fabc9
            } else {
                0x87bfaa
            };
            let pos = m.v([xx, 0., zz]);
            let mut place = Model::at(m.v, pos.x, pos.y, pos.z, 1. + (i % 2) as f32 * 0.18, 0.);
            stack::draw((6u64 << 60) + col as u64, 0.18, &mut place, |v| {
                let mut a = Model::at(v, 0., 0., 0., 1., 0.);
                a.block(0., 1.05, 0., 0.37, 2.1, 0.44, 0x9b7773);
                for (x, y, z, r) in [
                    (-0.66, 1.93, 0.12, 0.82),
                    (0.61, 2.04, -0.22, 0.85),
                    (0., 2.62, 0., 1.08),
                    (0.14, 3.08, -0.12, 0.66),
                ] {
                    a.cyl(x, y, z, r * 0.61, r, 0.29, 8, col);
                    a.cyl(x, y + 0.29, z, r, r * 0.57, 0.42, 8, col);
                }
                for (x, y, z) in [
                    (-0.53, 2.49, 0.76),
                    (0.23, 3.19, 0.71),
                    (0.76, 2.45, 0.46),
                    (-0.68, 2.22, 0.81),
                ] {
                    a.block(x, y, z, 0.20, 0.14, 0.15, 0xffdbbc);
                }
            });
        }
        for i in 0..38 {
            let x = -19. + (i * 13 % 42) as f32;
            let z = if i % 2 == 0 {
                -4.9 - (i % 3) as f32 * 0.56
            } else {
                10.3 + (i % 3) as f32 * 0.4
            };
            m.block(x, 0.19, z, 0.09, 0.34, 0.09, 0x608d82);
            m.block(
                x,
                0.38,
                z,
                0.29,
                0.13,
                0.23,
                if i % 3 == 0 { 0xf1bcad } else { 0xf2dd9b },
            );
        }
        let cx = 15.5;
        let cz = -20.;
        for i in 0..5 {
            let y = i as f32 * 1.16;
            m.block(cx, y + 0.55, cz, 3.65, 1.06, 3.15, 0x86aeb3);
            m.block(cx, y + 1.12, cz, 4.24, 0.17, 3.62, IVORY);
            m.block(
                cx,
                y + 0.65,
                cz + 1.61,
                2.96,
                0.49,
                0.09,
                if p.condo != 0 { GOLD } else { 0x426979 },
            );
        }
        m.cyl(cx, 5.87, cz, 1.40, 0.46, 1.38, 8, 0xba979c);
        // Dock machinery, solar arrays, hazard stripes and inset platform lights.
        for i in 0..12 {
            let x = -19. + i as f32 * 3.35;
            for z in [-3.18, 3.2] {
                m.block(x, 0.035, z, 1.28, 0.06, 0.22, INK);
                m.block(
                    x,
                    0.079,
                    z,
                    0.82,
                    0.03,
                    0.07,
                    if i % 3 == 0 { GOLD } else { AQUA },
                );
            }
        }
        for i in 0..5 {
            let x = -17.5 + i as f32 * 1.23;
            let h = 2.95;
            m.block(x, h, 7.99, 1.12, 0.13, 2.25, 0x365d7c);
            for j in 0..3 {
                m.block(
                    x,
                    h + 0.079,
                    7.25 + j as f32 * 0.65,
                    1.10,
                    0.02,
                    0.025,
                    0x81a6b2,
                );
            }
            m.block(x, 1.43, 7.99, 0.1, 2.89, 0.13, NAVY);
        }
        for i in 0..5 {
            let x = -0.8 + i as f32 * 0.36;
            m.block(x, 0.058, 3.1, 0.16, 0.028, 0.68, GOLD);
        }
        for i in 0..5 {
            m.block(-10. + i as f32 * 0.58, 1.82, 6.26, 0.33, 0.16, 0.04, AQUA);
        }
        m.block(-7.87, 2.68, 7.97, 1.4, 0.37, 0.65, NAVY);
        m.cyl(-7.87, 2.84, 7.97, 0.53, 0.38, 0.29, 8, AQUA);
        m.block(-5.30, 1.98, 7.96, 0.08, 0.21, 1.82, GOLD);
        for i in 0..7 {
            let x = -14. + (i % 3) as f32 * 1.35;
            let z = 4. + (i / 3) as f32 * 1.25;
            m.block(x, 0.54, z, 1.16, 1.07, 1.08, 0xb98962);
            m.block(x, 0.57, z, 0.21, 1.10, 1.11, IVORY);
        }
    }
    pub fn dynamic(&mut self, p: &Play) {
        let v = &mut self.objects;
        v.clear();
        let t = p.time;
        {
            let mut m = Model::at(v, 0., 0., 0., 1., 0.);
            m.cyl(p.x, 0.055, p.z, 0.54, 0.54, 0.012, 10, 0x687681);
            let lift =
                if [CHASE, CAPTURE].contains(&p.phase) || (p.phase == EXIT && p.decision == 1) {
                    1.0
                } else {
                    0.
                };
            m.block(8., 1.25 + lift * 2.15, 0., 0.17, 0.22, 5.6, 0xe8ad6c);
            for z in -3..4 {
                m.block(
                    7.9,
                    1.25 + lift * 2.15,
                    z as f32 * 0.66,
                    0.03,
                    0.24,
                    0.3,
                    IVORY,
                );
            }
        }
        let diverted = if p.phase == EXIT && p.decision == 0 {
            (p.truck * 0.38).min(4.8)
        } else {
            0.
        };
        truck(
            v,
            p.truck,
            -diverted,
            [0xea975d, 0x76b4b1, 0xe5bb65, 0x9399c9][p.face as usize % 4],
            p.flags,
            p.tier,
            TRUCK_SCALE,
            if p.phase == PARK {
                0.
            } else {
                (t * 10.).sin().abs()
            },
            if diverted > 0. && diverted < 4.8 {
                0.34
            } else {
                0.
            },
        );
        for n in 1..p.lanes {
            let x = (t * (1.15 + n as f32 * 0.13) + n as f32 * 11.) % 42. - 21.;
            truck(
                v,
                x,
                -10. - (n - 1) as f32 * 3.4,
                0x7794ac,
                0,
                1,
                0.65,
                0.5,
                0.,
            );
        }
        // A hovering harbour tug brings life to the far side of the fence.
        {
            let x = (t * 0.85) % 51. - 24.;
            let mut tug = Model::at(v, x, 3.7 + (t * 0.5).sin() * 0.25, -17.5, 0.82, 0.);
            tug.block(0., 0., 0., 3.0, 0.47, 1.16, IVORY);
            tug.block(0.5, 0.37, 0., 1.36, 0.43, 0.85, 0x477487);
            tug.block(-0.43, -0.08, 0., 0.85, 0.12, 2.69, RED);
            tug.block(-1.64, 0., 0., 0.37, 0.18, 0.83, AQUA);
        }
        let turn = if diverted > 0. && diverted < 4.8 {
            0.34_f32
        } else {
            0.
        };
        let (st, ct) = turn.sin_cos();
        let d = p.driver;
        let seated_x = p.truck + (1.85 * ct + 0.55 * st) * TRUCK_SCALE;
        let seated_z = (-1.85 * st + 0.55 * ct) * TRUCK_SCALE - diverted;
        let slide = (d / 0.63).clamp(0., 1.);
        let drop = ((d - 0.45) / 0.55).clamp(0., 1.);
        let mut driver_x = seated_x * (1. - slide) + (p.truck + 2.38) * slide;
        let mut driver_z = seated_z * (1. - slide) + 2.62 * slide;
        let fleeing = matches!(p.phase, CHASE | HOP) || p.flags & 4096 != 0;
        if fleeing {
            driver_x = p.tx;
            driver_z = p.tz;
        }
        person(
            v,
            driver_x,
            if fleeing {
                if p.phase == HOP {
                    (t * 4.).sin().abs() * 0.92
                } else {
                    0.
                }
            } else {
                1.43 * TRUCK_SCALE * (1. - drop)
            },
            driver_z,
            if fleeing {
                1.65
            } else {
                (0.63 + turn) * (1. - d)
            },
            if fleeing && (p.phase == CHASE || p.phase == HOP) {
                (t * 12.).sin()
            } else {
                0.
            },
            false,
            p.face,
            p.mark,
            if fleeing { 0. } else { 1. - d },
        );
        models::ranger(
            v,
            p.x,
            p.y,
            p.z,
            p.facing,
            p.stride.sin() * p.moving,
            p.look_code,
            (p.aim * 1.5).clamp(0., 1.),
        );
        for i in 0..2 {
            if p.flags & (if i == 0 { 2 } else { 4 }) == 0 && !(p.tier < 2 && p.flags & 2 != 0) {
                continue;
            }
            let [x, y, z] = p.goods(i);
            let held = p.held == i as i32;
            let scale = if held {
                1.72
            } else if p.seized(i) {
                0.85
            } else {
                TRUCK_SCALE
            };
            let start = v.len();
            models::cargo(&mut Model::at(v, 0., 0., 0., 1., 0.), p.bag[i], 0., 0., 0.);
            let (sp, cp) = p.twist[i][1].sin_cos();
            let (sy, cy) = (p.twist[i][0] + if p.placed[i] || held { 0. } else { turn }).sin_cos();
            for v in &mut v[start..] {
                let u = v.p;
                let h = u.y - 0.34;
                let zz = u.z * cp - h * sp;
                v.p = V::new(
                    x + (u.x * cy + zz * sy) * scale,
                    y + (h * cp + u.z * sp + 0.34) * scale,
                    z + (-u.x * sy + zz * cy) * scale,
                );
            }
        }
        if p.phase == BEAST
            || (p.phase == ALERT && p.incident == 2)
            || (p.phase == CAPTURE && p.incident == 2)
        {
            let yaw = (p.x - p.tx).atan2(p.z - p.tz);
            creature(&mut Model::at(v, p.tx, 0., p.tz, 1.14, yaw), t);
        }
        if p.beam[4] > 0. || p.phase == CAPTURE {
            let mut m = Model::at(v, 0., 0., 0., 1., 0.);
            if p.beam[4] > 0. {
                for i in 0..10 {
                    let k = i as f32 / 10.;
                    m.block(
                        p.beam[0] + (p.beam[2] - p.beam[0]) * k,
                        1.1 + (k * PI).sin() * 0.8,
                        p.beam[1] + (p.beam[3] - p.beam[1]) * k,
                        0.10,
                        0.1,
                        0.1,
                        AQUA,
                    );
                }
            }
            if p.beam[4] > 0. {
                for i in 0..12 {
                    let (dx, dz) = (i as f32 * TAU / 12.).sin_cos();
                    m.block(
                        p.beam[2] + dx * 0.46,
                        1.08 + 0.29 * dz,
                        p.beam[3] + dz * 0.33,
                        0.14,
                        0.085,
                        0.10,
                        0xa9ffcc,
                    );
                }
            }
            if p.phase == CAPTURE {
                let radius = if p.incident == 2 { 1.02 } else { 0.84 };
                for i in 0..10 {
                    let (a, b) = (i as f32 * TAU / 10.).sin_cos();
                    m.block(
                        p.tx + a * radius,
                        1.0,
                        p.tz + b * radius,
                        0.07,
                        1.68,
                        0.07,
                        AQUA,
                    );
                }
                for y in [0.35, 0.9, 1.45] {
                    for i in 0..18 {
                        let (a, b) = (i as f32 * TAU / 18.).sin_cos();
                        m.block(
                            p.tx + a * radius,
                            y,
                            p.tz + b * radius,
                            0.29,
                            0.09,
                            0.29,
                            0xa5ffdd,
                        );
                    }
                }
            }
        }
    }
    pub fn raster(&mut self, p: &Play, w: usize, h: usize) -> *const u32 {
        let (w, h) = (w.clamp(1, 1024), h.clamp(1, 768));
        self.pixels.resize(w * h, 0);
        self.depth.resize(w * h, 0.);
        self.pixels.fill(0);
        self.depth.fill(0.);
        let cam = Cam::new(p, w as f32 / h as f32);
        for mesh in [&self.ground, &self.objects] {
            for tri in mesh.chunks_exact(3) {
                let vs = [cam.view(tri[0].p), cam.view(tri[1].p), cam.view(tri[2].p)];
                if vs.iter().all(|v| v[2] < 0.25)
                    || vs.iter().all(|v| v[0] < -v[2])
                    || vs.iter().all(|v| v[0] > v[2])
                    || vs.iter().all(|v| v[1] < -v[2])
                    || vs.iter().all(|v| v[1] > v[2])
                {
                    continue;
                }
                let mut polygon = [[0.; 3]; 4];
                let mut n = 0;
                let mut prev = vs[2];
                for v in vs {
                    let a = prev[2] >= 0.25;
                    let b = v[2] >= 0.25;
                    if a != b {
                        let t = (0.25 - prev[2]) / (v[2] - prev[2]);
                        polygon[n] = [
                            prev[0] + t * (v[0] - prev[0]),
                            prev[1] + t * (v[1] - prev[1]),
                            0.25,
                        ];
                        n += 1;
                    }
                    if b {
                        polygon[n] = v;
                        n += 1;
                    }
                    prev = v;
                }
                if n < 3 {
                    continue;
                }
                for q in &mut polygon[..n] {
                    let inv = 1. / q[2];
                    *q = [
                        (0.5 + 0.5 * q[0] * inv) * w as f32,
                        (0.5 - 0.5 * q[1] * inv) * h as f32,
                        inv,
                    ];
                }
                for i in 1..n - 1 {
                    paint_triangle(
                        &mut self.pixels,
                        &mut self.depth,
                        w,
                        h,
                        polygon[0],
                        polygon[i],
                        polygon[i + 1],
                        tri[0].c,
                    );
                }
            }
        }
        self.pixels.as_ptr()
    }
}
fn paint_triangle(
    pixels: &mut [u32],
    depth: &mut [f32],
    w: usize,
    h: usize,
    a: [f32; 3],
    b: [f32; 3],
    c: [f32; 3],
    color: u32,
) {
    let den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if den >= -0.08 {
        return;
    }
    let l = a[0].min(b[0]).min(c[0]).max(0.) as usize;
    let r = (a[0].max(b[0]).max(c[0]).ceil() as usize).min(w);
    let top = a[1].min(b[1]).min(c[1]).max(0.) as usize;
    let bottom = (a[1].max(b[1]).max(c[1]).ceil() as usize).min(h);
    for y in top..bottom {
        let py = y as f32 + 0.5 - c[1];
        let px = l as f32 + 0.5 - c[0];
        let mut u = ((b[1] - c[1]) * px + (c[0] - b[0]) * py) / den;
        let mut v = ((c[1] - a[1]) * px + (a[0] - c[0]) * py) / den;
        let du = (b[1] - c[1]) / den;
        let dv = (c[1] - a[1]) / den;
        for x in l..r {
            let z = u * a[2] + v * b[2] + (1. - u - v) * c[2];
            let i = y * w + x;
            if u >= 0. && v >= 0. && u + v <= 1. && z > depth[i] {
                depth[i] = z;
                pixels[i] = color;
            }
            u += du;
            v += dv;
        }
    }
}
struct Cam {
    sy: f32,
    cy: f32,
    sp: f32,
    cp: f32,
    x: f32,
    y: f32,
    z: f32,
    d: f32,
    a: f32,
}
impl Cam {
    fn new(p: &Play, a: f32) -> Self {
        let (sy, cy) = p.yaw.sin_cos();
        let (sp, cp) = p.pitch.sin_cos();
        Self {
            sy,
            cy,
            sp,
            cp,
            x: p.x,
            y: 1.28 + p.y * 0.58,
            z: p.z,
            d: p.zoom,
            a,
        }
    }
    fn view(&self, v: V) -> [f32; 3] {
        let x = v.x - self.x;
        let y = v.y - self.y;
        let z = v.z - self.z;
        let f = x * self.sy + z * self.cy;
        let d = self.d - f * self.cp - y * self.sp;
        [
            (x * self.cy - z * self.sy) * 1.93 / self.a,
            (y * self.cp - f * self.sp) * 1.93,
            d,
        ]
    }
    fn proj(&self, v: V) -> [f32; 3] {
        let [x, y, d] = self.view(v);
        [x / d.max(0.05), y / d.max(0.05), d]
    }
}
pub fn project(p: &Play, v: V, a: f32) -> [f32; 3] {
    Cam::new(p, clamp(a, 0.1, 10.)).proj(v)
}
