use image::{imageops, RgbaImage};

/// Two texels on every side, filled with the nearest edge pixel.
pub const PAD: u32 = 2;

#[derive(Clone, Copy, Debug, Default)]
pub struct Placement {
    pub page: usize,
    pub x: u32,
    pub y: u32,
}

#[derive(Default)]
struct Shelf {
    y: u32,
    height: u32,
    right: u32,
}

#[derive(Default)]
struct Page {
    shelves: Vec<Shelf>,
    width: u32,
    height: u32,
}

/// Stable height-first, first-fit shelf packing. Returns placements in input order.
pub fn pack(sizes: &[(u32, u32)], limit: u32) -> Result<(Vec<Placement>, Vec<(u32, u32)>), String> {
    if !limit.is_power_of_two() {
        return Err("page limit must be a nonzero power of two".into());
    }
    let mut order: Vec<usize> = (0..sizes.len()).collect();
    order.sort_by_key(|&i| {
        (
            std::cmp::Reverse(sizes[i].1),
            std::cmp::Reverse(sizes[i].0),
            i,
        )
    });
    let mut pages: Vec<Page> = Vec::new();
    let mut placements = vec![Placement::default(); sizes.len()];
    for i in order {
        let (w, h) = sizes[i];
        let padded_w = w.checked_add(2 * PAD).ok_or("frame width overflow")?;
        let padded_h = h.checked_add(2 * PAD).ok_or("frame height overflow")?;
        if w == 0 || h == 0 || padded_w > limit || padded_h > limit {
            return Err(format!(
                "frame {i} ({w}x{h} + padding) does not fit page {limit}"
            ));
        }
        let mut selected = None;
        for (p, page) in pages.iter_mut().enumerate() {
            for shelf in &mut page.shelves {
                if padded_h <= shelf.height && padded_w <= limit - shelf.right {
                    let x = shelf.right;
                    shelf.right += padded_w;
                    page.width = page.width.max(shelf.right);
                    selected = Some(Placement {
                        page: p,
                        x: x + PAD,
                        y: shelf.y + PAD,
                    });
                    break;
                }
            }
            if selected.is_some() {
                break;
            }
            if padded_h <= limit - page.height {
                let y = page.height;
                page.shelves.push(Shelf {
                    y,
                    height: padded_h,
                    right: padded_w,
                });
                page.height += padded_h;
                page.width = page.width.max(padded_w);
                selected = Some(Placement {
                    page: p,
                    x: PAD,
                    y: y + PAD,
                });
                break;
            }
        }
        placements[i] = selected.unwrap_or_else(|| {
            let p = pages.len();
            pages.push(Page {
                shelves: vec![Shelf {
                    y: 0,
                    height: padded_h,
                    right: padded_w,
                }],
                width: padded_w,
                height: padded_h,
            });
            Placement {
                page: p,
                x: PAD,
                y: PAD,
            }
        });
    }
    let dimensions = pages
        .iter()
        .map(|p| (p.width.next_power_of_two(), p.height.next_power_of_two()))
        .collect();
    Ok((placements, dimensions))
}

/// Offset is in the resized, untrimmed canvas. Blank frames remain transparent 1x1.
pub fn trim(image: &RgbaImage) -> (RgbaImage, [u32; 2]) {
    let (mut min_x, mut min_y) = image.dimensions();
    let (mut max_x, mut max_y) = (0, 0);
    for (x, y, pixel) in image.enumerate_pixels() {
        if pixel[3] != 0 {
            min_x = min_x.min(x);
            min_y = min_y.min(y);
            max_x = max_x.max(x);
            max_y = max_y.max(y);
        }
    }
    if min_x == image.width() {
        return (RgbaImage::new(1, 1), [0, 0]);
    }
    (
        imageops::crop_imm(image, min_x, min_y, max_x - min_x + 1, max_y - min_y + 1).to_image(),
        [min_x, min_y],
    )
}

pub fn extrude(page: &mut RgbaImage, sprite: &RgbaImage, at: Placement) {
    for dy in 0..sprite.height() + 2 * PAD {
        for dx in 0..sprite.width() + 2 * PAD {
            let sx = dx.saturating_sub(PAD).min(sprite.width() - 1);
            let sy = dy.saturating_sub(PAD).min(sprite.height() - 1);
            page.put_pixel(at.x - PAD + dx, at.y - PAD + dy, *sprite.get_pixel(sx, sy));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    #[test]
    fn packing_preserves_bounds_padding_and_nonoverlap() {
        let mut sizes = vec![(60, 60), (60, 60), (124, 7), (1, 1), (1, 124)];
        for i in 0..250 {
            sizes.push((1 + i * 37 % 120, 1 + i * 53 % 120));
        }
        let (positions, pages) = pack(&sizes, 128).unwrap();
        assert!(pages.len() > 1);
        for (i, (&(w, h), a)) in sizes.iter().zip(&positions).enumerate() {
            let (pw, ph) = pages[a.page];
            assert!(pw.is_power_of_two() && ph.is_power_of_two() && pw <= 128 && ph <= 128);
            assert!(a.x >= PAD && a.y >= PAD);
            assert!(a.x + w + PAD <= pw && a.y + h + PAD <= ph);
            for (j, b) in positions.iter().enumerate().take(i) {
                if a.page == b.page {
                    let (bw, bh) = sizes[j];
                    assert!(
                        a.x + w + 2 * PAD <= b.x
                            || b.x + bw + 2 * PAD <= a.x
                            || a.y + h + 2 * PAD <= b.y
                            || b.y + bh + 2 * PAD <= a.y
                    );
                }
            }
        }
    }

    #[test]
    fn exact_fit_and_invalid_inputs() {
        let (p, pages) = pack(&[(124, 124)], 128).unwrap();
        assert_eq!(pages, vec![(128, 128)]);
        assert_eq!((p[0].x, p[0].y), (2, 2));
        for (sizes, limit) in [
            (vec![(125, 1)], 128),
            (vec![(0, 1)], 128),
            (vec![(1, 1)], 127),
            (vec![(u32::MAX, 1)], 128),
        ] {
            assert!(pack(&sizes, limit).is_err());
        }
        assert!(pack(&[], 128).unwrap().1.is_empty());
    }

    #[test]
    fn trim_preserves_foot_origin_at_full_and_half_scale() {
        for scale in [1.0, 0.5] {
            let mut image = RgbaImage::new((128.0 * scale) as u32, (128.0 * scale) as u32);
            image.put_pixel(7, 9, Rgba([1, 2, 3, 1]));
            image.put_pixel(24, 40, Rgba([4, 5, 6, 255]));
            let (trimmed, offset) = trim(&image);
            assert_eq!(trimmed.dimensions(), (18, 32));
            assert_eq!(offset, [7, 9]);
            let foot = [64.0 * scale, 125.0 * scale];
            let world_foot = [300.0, 200.0];
            for (x, y, p) in image.enumerate_pixels().filter(|(_, _, p)| p[3] != 0) {
                let tx = x - offset[0];
                let ty = y - offset[1];
                assert_eq!(trimmed.get_pixel(tx, ty), p);
                assert_eq!(
                    world_foot[0] - foot[0] + x as f64,
                    world_foot[0] + offset[0] as f64 - foot[0] + tx as f64
                );
                assert_eq!(
                    world_foot[1] - foot[1] + y as f64,
                    world_foot[1] + offset[1] as f64 - foot[1] + ty as f64
                );
            }
        }
    }

    #[test]
    fn blank_and_untrimmed_frames() {
        let (blank, offset) = trim(&RgbaImage::new(128, 128));
        assert_eq!(blank.dimensions(), (1, 1));
        assert_eq!(blank.get_pixel(0, 0)[3], 0);
        assert_eq!(offset, [0, 0]);
        let image = RgbaImage::from_pixel(5, 7, Rgba([1, 2, 3, 255]));
        assert_eq!(trim(&image), (image, [0, 0]));
    }

    #[test]
    fn extrusion_copies_edges_and_corners() {
        let sprite = RgbaImage::from_fn(3, 2, |x, y| Rgba([x as u8, y as u8, 7, 255]));
        let mut page = RgbaImage::new(16, 16);
        let at = Placement {
            page: 0,
            x: 3,
            y: 4,
        };
        extrude(&mut page, &sprite, at);
        for y in 0..6 {
            for x in 0..7 {
                assert_eq!(
                    page.get_pixel(1 + x, 2 + y),
                    sprite.get_pixel(x.saturating_sub(2).min(2), y.saturating_sub(2).min(1))
                );
            }
        }
        assert_eq!(page.get_pixel(0, 0)[3], 0);
    }
}
