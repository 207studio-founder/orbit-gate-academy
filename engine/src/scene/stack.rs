//! Rasterize an art model into a stack of transparent horizontal pixel layers.
//! Build only adjacent exposed plate faces, merging equal-colored rectangles so
//! a whole layered sprite can share the existing draw call and depth buffer.
use super::{Model, Vertex, V};
use std::{
    cell::RefCell,
    collections::{HashMap, VecDeque},
};
#[derive(Default)]
struct Library {
    sprites: HashMap<u64, Vec<Vertex>>,
    order: VecDeque<u64>,
}
thread_local! {static LIB:RefCell<Library>=RefCell::new(Library::default());}
pub(super) fn draw(
    key: u64,
    step: f32,
    placement: &mut Model,
    make: impl FnOnce(&mut Vec<Vertex>),
) {
    LIB.with(|pool| {
        let mut lib = pool.borrow_mut();
        if !lib.sprites.contains_key(&key) {
            let mut raw = Vec::new();
            make(&mut raw);
            let skin = slices(&raw, step);
            if lib.order.len() >= 144 {
                if let Some(old) = lib.order.pop_front() {
                    lib.sprites.remove(&old);
                }
            }
            lib.order.push_back(key);
            lib.sprites.insert(key, skin);
        }
        let source = &lib.sprites[&key];
        placement.v.reserve(source.len());
        for v in source {
            let p = v.p;
            let position = placement.v([p.x, p.y, p.z]);
            placement.v.push(Vertex {
                p: position,
                c: v.c,
            });
        }
    });
}
fn slices(source: &[Vertex], step: f32) -> Vec<Vertex> {
    if source.is_empty() {
        return vec![];
    }
    let mut lo = [f32::INFINITY; 3];
    let mut hi = [f32::NEG_INFINITY; 3];
    for v in source {
        for (axis, n) in [v.p.x, v.p.y, v.p.z].iter().enumerate() {
            lo[axis] = lo[axis].min(*n);
            hi[axis] = hi[axis].max(*n);
        }
    }
    let dim: [usize; 3] = std::array::from_fn(|a| ((hi[a] - lo[a]) / step).ceil() as usize + 2);
    let mut vox = vec![0u32; dim.iter().product()];
    let index = |p: [usize; 3]| (p[1] * dim[2] + p[2]) * dim[0] + p[0];
    for t in source.chunks_exact(3) {
        let [a, b, c] = [t[0].p, t[1].p, t[2].p];
        let d =
            |u: V, v: V| ((u.x - v.x).powi(2) + (u.y - v.y).powi(2) + (u.z - v.z).powi(2)).sqrt();
        let n = ((d(a, b).max(d(b, c)).max(d(a, c)) / step * 1.8).ceil() as usize).max(1);
        for i in 0..=n {
            let u = i as f32 / n as f32;
            for j in 0..=n - i {
                let v = j as f32 / n as f32;
                let coord = [
                    a.x + (b.x - a.x) * u + (c.x - a.x) * v,
                    a.y + (b.y - a.y) * u + (c.y - a.y) * v,
                    a.z + (b.z - a.z) * u + (c.z - a.z) * v,
                ];
                let px = std::array::from_fn(|k| {
                    (((coord[k] - lo[k]) / step).round() as usize).min(dim[k] - 1)
                });
                vox[index(px)] = t[0].c;
            }
        }
    }
    let mut output = vec![];
    for ax in 0..3 {
        let u = (ax + 1) % 3;
        let v = (ax + 2) % 3;
        let w = dim[u];
        let h = dim[v];
        let mut mask = vec![0u32; w * h];
        for sign in [-1isize, 1] {
            for plane in 0..dim[ax] {
                for j in 0..h {
                    for i in 0..w {
                        let mut p = [0; 3];
                        p[ax] = plane;
                        p[u] = i;
                        p[v] = j;
                        let col = vox[index(p)];
                        let q = plane as isize + sign;
                        let exposed = q < 0 || q >= dim[ax] as isize || {
                            p[ax] = q as usize;
                            vox[index(p)] == 0
                        };
                        mask[j * w + i] = if exposed { col } else { 0 };
                    }
                }
                for j in 0..h {
                    let mut i = 0;
                    while i < w {
                        let color = mask[j * w + i];
                        if color == 0 {
                            i += 1;
                            continue;
                        }
                        let mut n = 1;
                        while i + n < w && mask[j * w + i + n] == color {
                            n += 1;
                        }
                        let mut hh = 1;
                        while j + hh < h && (0..n).all(|k| mask[(j + hh) * w + i + k] == color) {
                            hh += 1;
                        }
                        for jy in j..j + hh {
                            mask[jy * w + i..jy * w + i + n].fill(0);
                        }
                        let vertex = |x: usize, y: usize| {
                            let mut p = [0.; 3];
                            p[ax] = plane as f32 + if sign > 0 { 0.5 } else { -0.5 };
                            p[u] = x as f32 - 0.5;
                            p[v] = y as f32 - 0.5;
                            Vertex {
                                p: V::new(
                                    lo[0] + step * p[0],
                                    lo[1] + step * p[1],
                                    lo[2] + step * p[2],
                                ),
                                c: color,
                            }
                        };
                        let a = vertex(i, j);
                        let b = vertex(i + n, j);
                        let c = vertex(i + n, j + hh);
                        let d = vertex(i, j + hh);
                        let (b, d) = if sign > 0 { (b, d) } else { (d, b) };
                        output.extend_from_slice(&[a, b, c, a, c, d]);
                        i += n;
                    }
                }
            }
        }
    }
    output
}
