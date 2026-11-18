use super::*;

// The same mesh is used on the lorry, in the inspector and on the training bench.
pub(super) fn cargo(m: &mut Model, code: i32, x: f32, y: f32, z: f32) {
    let pos = m.v([x, y, z]);
    let mut at = Model::at(m.v, pos.x, pos.y, pos.z, m.s, m.si.atan2(m.co));
    stack::draw((4u64 << 60) + code as u64, 0.031, &mut at, |v| {
        cargo_raw(&mut Model::at(v, 0., 0., 0., 1., 0.), code, 0., 0., 0.);
        let family = (code / 6) % 3;
        let scale = match (code % 6, family) {
            (0, 1) => [0.76, 1.42, 0.90],
            (0, 2) => [1.14, 0.83, 1.04],
            (1, 1) => [1.26, 0.78, 1.26],
            (1, 2) => [0.83, 1.34, 0.83],
            (2, 1) => [0.90, 1.58, 1.04],
            (2, 2) => [1.10, 0.93, 1.15],
            (3, 1) => [1.22, 0.88, 1.22],
            (3, 2) => [0.84, 1.23, 0.84],
            (4, 1) => [0.81, 1.30, 0.81],
            (4, 2) => [1.13, 0.80, 1.13],
            (5, 1) => [1.16, 0.83, 1.16],
            (5, 2) => [0.78, 1.34, 0.78],
            _ => [1., 1., 1.],
        };
        for point in v.iter_mut() {
            point.p.x *= scale[0];
            point.p.y *= scale[1];
            point.p.z *= scale[2];
        }
    });
}
fn cargo_raw(m: &mut Model, code: i32, x: f32, y: f32, z: f32) {
    let id = code.rem_euclid(6) as usize;
    let variant = (code / 6).clamp(0, 5) as usize;
    let colors = [0xef9361, 0x60bbb1, 0x638dc0, 0x87ab75, 0xdbb45a, 0xae80ca];
    let hue = (id + [0, 2, 4, 1, 5, 3][variant]) % 6;
    let base = colors[hue];
    let trim = colors[(hue + 2) % 6];
    let h = 1. + 0.10 * (variant % 3) as f32;
    let sides = if variant % 2 == 0 { 10 } else { 8 };
    match id {
        0 => {
            let w = 0.91 + 0.06 * (variant % 3) as f32;
            m.block(x, y + 0.15 * h, z, w, 0.28 * h, 0.62, base);
            m.block(x, y + 0.30 * h, z, w + 0.03, 0.065, 0.65, IVORY);
            m.block(x, y + 0.355 * h, z, w + 0.045, 0.088, 0.67, base);
            for dx in [-0.14, 0.14] {
                m.block(x + dx, y + 0.455 * h, z, 0.045, 0.14, 0.07, INK);
            }
            m.block(x, y + 0.52 * h, z, 0.315, 0.05, 0.074, INK);
            for dx in [-0.29, 0.29] {
                m.block(x + dx, y + 0.30 * h, z + 0.335, 0.11, 0.13, 0.036, trim);
            }
            m.block(x - 0.20, y + 0.406 * h, z + 0.16, 0.17, 0.025, 0.09, IVORY);
        }
        1 => {
            m.cyl(x, y, z, 0.19, 0.24, 0.10, sides, base);
            m.cyl(x, y + 0.10, z, 0.24, 0.24, 0.39 * h, sides, base);
            m.cyl(x, y + 0.22, z, 0.25, 0.25, 0.16, sides, IVORY);
            m.cyl(x, y + 0.10 + 0.39 * h, z, 0.24, 0.115, 0.13, sides, base);
            m.cyl(x, y + 0.23 + 0.39 * h, z, 0.14, 0.14, 0.11, sides, trim);
            m.block(x, y + 0.30, z + 0.243, 0.09, 0.075, 0.025, base);
        }
        2 => {
            let w = 0.8 + 0.06 * (variant % 3) as f32;
            m.block(x, y + 0.048, z, w, 0.07, 0.58, base);
            m.block(x, y + 0.16 * h, z, w - 0.04, 0.18 * h, 0.55, IVORY);
            m.block(x, y + 0.26 * h, z, w, 0.065, 0.58, base);
            m.block(x - w * 0.48, y + 0.15 * h, z, 0.09, 0.24 * h, 0.58, trim);
            for i in 0..3 {
                m.block(
                    x + 0.055,
                    y + (0.11 + 0.041 * i as f32) * h,
                    z + 0.276,
                    w - 0.19,
                    0.012,
                    0.009,
                    0xb9ac96,
                );
            }
            m.block(x + 0.18, y + 0.115 * h, z + 0.326, 0.08, 0.015, 0.13, trim);
            m.block(x + 0.10, y + 0.30 * h, z, 0.18, 0.024, 0.17, IVORY);
        }
        3 => {
            m.cyl(x, y, z, 0.18, 0.29, 0.38 * h, sides, base);
            m.cyl(x, y + 0.34 * h, z, 0.30, 0.30, 0.085, sides, trim);
            m.cyl(x, y + 0.38 * h, z, 0.24, 0.24, 0.047, sides, 0x493a37);
            m.block(x, y + 0.56 * h, z, 0.065, 0.37, 0.065, 0x427b60);
            for i in 0..2 + variant % 3 {
                let a = i as f32 * 2.4;
                let (sn, cs) = a.sin_cos();
                m.block(
                    x + cs * 0.105,
                    y + 0.56 * h + i as f32 * 0.08,
                    z + sn * 0.1,
                    0.22,
                    0.095,
                    0.14,
                    if i % 2 == 0 { GRASS } else { 0xa3ce74 },
                );
            }
        }
        4 => {
            // Fictional sealed hazardous core with a segmented illuminated collar.
            m.cyl(x, y, z, 0.20, 0.32, 0.18, sides, INK);
            m.cyl(x, y + 0.17, z, 0.32, 0.35, 0.21 * h, sides, base);
            m.cyl(x, y + 0.17 + 0.21 * h, z, 0.37, 0.37, 0.13, sides, INK);
            m.cyl(x, y + 0.3 + 0.21 * h, z, 0.33, 0.18, 0.17, sides, base);
            for i in 0..8 {
                let (sn, cs) = (i as f32 * TAU / 8.).sin_cos();
                m.block(
                    x + cs * 0.357,
                    y + 0.234 + 0.21 * h,
                    z + sn * 0.357,
                    0.09,
                    0.07,
                    0.09,
                    0xfeec8f,
                );
            }
            m.cyl(x, y + 0.47 + 0.21 * h, z, 0.12, 0.08, 0.1, 6, trim);
        }
        _ => {
            let mut bottom = 0.;
            let mut prev = 0.12;
            for (r, dy) in [
                (0.265, 0.11),
                (0.33, 0.17),
                (0.315, 0.14),
                (0.245, 0.15),
                (0.145, 0.13),
                (0.035, 0.095),
            ] {
                m.cyl(x, y + bottom * h, z, prev, r, dy * h, sides, base);
                prev = r;
                bottom += dy;
            }
            for i in 0..6 {
                let (sn, cs) = (0.46 + i as f32 * TAU / 6.).sin_cos();
                let yy = 0.27 + 0.09 * (i % 2) as f32;
                m.cyl(
                    x + 0.29 * cs,
                    y + yy * h,
                    z + 0.29 * sn,
                    0.072,
                    0.02,
                    0.09,
                    5,
                    trim,
                );
            }
            for j in 0..3 {
                m.block(
                    x - 0.09 + 0.08 * j as f32,
                    y + (0.45 + 0.045 * (j % 2) as f32) * h,
                    z + 0.285,
                    0.08,
                    0.045,
                    0.04,
                    IVORY,
                );
            }
        }
    }
}

pub(super) fn ranger(
    v: &mut Vec<Vertex>,
    x: f32,
    y: f32,
    z: f32,
    yaw: f32,
    walk: f32,
    look: i32,
    aim: f32,
) {
    let phase = (walk * 3.).round() as i32;
    let shot = (aim * 2.).round() as i32;
    let k = (5u64 << 60) | ((look as u64) << 8) | (((phase + 3) as u64) << 3) | shot as u64;
    let mut at = Model::at(v, x, y, z, 1., yaw);
    stack::draw(k, 0.044, &mut at, |v| {
        ranger_raw(v, 0., 0., 0., 0., phase as f32 / 3., look, shot as f32 / 2.)
    });
}
fn ranger_raw(
    v: &mut Vec<Vertex>,
    x: f32,
    y: f32,
    z: f32,
    yaw: f32,
    walk: f32,
    look: i32,
    aim: f32,
) {
    let mut m = Model::at(v, x, y, z, 0.98, yaw);
    let style = look % 4;
    let (hair, glint, shade) = [
        (0x48364b, 0x796078, 0x322a3c),
        (0x956448, 0xd29a6b, 0x674857),
        (0x5e4e89, 0x9a88c4, 0x483b6b),
        (0xdb9bb6, 0xffd0ce, 0xad769a),
    ][(look / 4 % 4) as usize];
    let skin = [0xffdbbd, 0xeebd97, 0xd19a79, 0xa87256][(look / 16 % 4) as usize];
    let (coat, light) = [
        (0xe29a5b, 0xffc788),
        (0x59a99c, 0x9bdfc9),
        (0x9580b7, 0xcbb0e6),
        (0xce778c, 0xf7acb7),
    ][(look / 64 % 4) as usize];
    for side in [-1., 1.] {
        let step = side * walk;
        bead(
            &mut m,
            side * 0.195,
            0.41,
            step * 0.17,
            0.155,
            0.20,
            0.19,
            0x504760,
        );
        bead(
            &mut m,
            side * 0.195,
            0.195 + step.abs() * 0.055,
            step * 0.25 + 0.06,
            0.213,
            0.16,
            0.28,
            coat,
        );
        m.block(
            side * 0.195,
            0.103 + step.abs() * 0.055,
            step * 0.25 + 0.065,
            0.37,
            0.067,
            0.46,
            IVORY,
        );
        m.block(
            side * 0.195,
            0.268 + step.abs() * 0.055,
            step * 0.25 + 0.24,
            0.17,
            0.045,
            0.10,
            light,
        );
        let lift = if side > 0. { aim } else { 0. };
        bead(
            &mut m,
            side * 0.44,
            0.83 + lift * 0.13,
            -step * 0.18 + lift * 0.18,
            0.145,
            0.22,
            0.17,
            coat,
        );
        bead(
            &mut m,
            side * 0.45,
            0.68 + lift * 0.16,
            -step * 0.18 + lift * 0.29,
            0.118,
            0.125,
            0.14,
            skin,
        );
    }
    bead(&mut m, 0., 0.77, 0., 0.41, 0.36, 0.28, coat);
    m.block(0., 0.67, 0., 0.73, 0.09, 0.52, 0x775d69);
    bead(&mut m, 0., 1.02, 0., 0.43, 0.12, 0.30, IVORY);
    m.block(-0.16, 0.93, 0.27, 0.10, 0.12, 0.045, 0xffe591);
    bead(&mut m, 0., 0.91, -0.32, 0.32, 0.30, 0.145, shade);
    m.block(0., 0.90, -0.463, 0.39, 0.26, 0.055, light);
    m.block(0., 0.89, -0.499, 0.09, 0.12, 0.035, GOLD);
    bead(
        &mut m,
        0.46,
        0.77 + aim * 0.12,
        0.245 + aim * 0.23,
        0.14,
        0.14,
        0.32,
        0x4b6379,
    );
    m.block(
        0.46,
        0.80 + aim * 0.12,
        0.54 + aim * 0.23,
        0.245,
        0.14,
        0.065,
        AQUA,
    );
    // A large rounded face, two-tone irises, highlights and small blush marks.
    bead(&mut m, 0., 1.54, 0., 0.593, 0.506, 0.440, skin);
    for side in [-1., 1.] {
        let ex = side * 0.221;
        bead(&mut m, ex, 1.575, 0.385, 0.138, 0.153, 0.054, IVORY);
        bead(&mut m, ex, 1.58, 0.423, 0.112, 0.145, 0.037, 0x403344);
        bead(&mut m, ex, 1.535, 0.454, 0.081, 0.073, 0.021, 0x946b8a);
        m.block(ex - 0.032, 1.634, 0.457, 0.069, 0.07, 0.028, 0xfff7de);
        m.block(ex + 0.052, 1.525, 0.475, 0.034, 0.035, 0.014, 0xffe2b6);
        bead(
            &mut m,
            side * 0.365,
            1.45,
            0.341,
            0.094,
            0.035,
            0.025,
            0xe9a49b,
        );
        bead(&mut m, side * 0.513, 1.58, -0.038, 0.152, 0.32, 0.23, hair);
    }
    m.block(-0.040, 1.382, 0.414, 0.065, 0.030, 0.021, 0x995e67);
    m.block(0.025, 1.370, 0.418, 0.080, 0.031, 0.021, 0x995e67);
    bead(&mut m, 0., 1.855, -0.034, 0.642, 0.402, 0.478, hair);
    bead(&mut m, 0., 1.66, -0.26, 0.575, 0.40, 0.316, shade);
    for i in 0..6 {
        let a = -0.443 + 0.177 * i as f32;
        let dy = [0.02, 0.10, 0.07, 0.13, 0.10, 0.005][((i + style) % 6) as usize];
        bead(
            &mut m,
            a,
            1.89 + dy,
            0.29 - (a.abs() * 0.15),
            0.17,
            0.20 + 0.06 * (i % 2) as f32,
            0.168,
            hair,
        );
        if i % 2 == 0 {
            bead(
                &mut m,
                a - 0.002,
                2.0 + dy,
                0.405 - a.abs() * 0.18,
                0.073,
                0.025,
                0.022,
                glint,
            );
        }
    }
    match style {
        0 => {
            bead(&mut m, -0.21, 2.18, -0.02, 0.32, 0.15, 0.29, hair);
            bead(&mut m, 0.42, 1.86, 0.34, 0.125, 0.046, 0.043, GOLD);
        }
        1 => {
            for side in [-1., 1.] {
                bead(&mut m, side * 0.59, 1.89, -0.17, 0.23, 0.245, 0.21, glint);
                bead(&mut m, side * 0.70, 1.64, -0.19, 0.22, 0.34, 0.24, hair);
                m.block(side * 0.57, 1.87, 0.016, 0.23, 0.09, 0.17, light);
            }
        }
        2 => {
            bead(&mut m, -0.25, 2.22, -0.26, 0.263, 0.24, 0.24, hair);
            bead(&mut m, 0., 1.44, -0.41, 0.51, 0.43, 0.21, hair);
            bead(&mut m, 0.355, 2.10, 0.28, 0.13, 0.06, 0.083, light);
        }
        _ => {
            bead(&mut m, -0.03, 2.14, -0.05, 0.60, 0.24, 0.47, coat);
            bead(&mut m, -0.16, 2.045, 0.253, 0.49, 0.082, 0.34, light);
            bead(&mut m, 0.066, 2.38, -0.09, 0.075, 0.08, 0.09, coat);
        }
    }
}
fn bead(m: &mut Model, x: f32, y: f32, z: f32, rx: f32, ry: f32, rz: f32, color: u32) {
    let ring = |a: f32, t: f32| {
        [
            x + rx * a.cos() * t.cos(),
            y + ry * a.sin(),
            z + rz * a.cos() * t.sin(),
        ]
    };
    for j in 0..7 {
        let a = -PI / 2. + PI * j as f32 / 7.;
        let b = a + PI / 7.;
        for i in 0..12 {
            let u = TAU * i as f32 / 12.;
            let v = u + TAU / 12.;
            let light = 0.91 + 0.11 * a.sin() + 0.075 * (u.sin() - u.cos()) * a.cos();
            m.q(color, light, ring(a, u), ring(a, v), ring(b, v), ring(b, u));
        }
    }
}
