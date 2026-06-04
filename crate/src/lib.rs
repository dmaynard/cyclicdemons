#![allow(static_mut_refs)]
#![allow(unexpected_cfgs)]
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

const MAX_WIDTH: usize = 2560;
const MAX_HEIGHT: usize = 1440;
const MAX_PIXELS: usize = MAX_WIDTH * MAX_HEIGHT;
const BUFFER_SIZE: usize = MAX_PIXELS * 4;
const UPLOAD_SIZE: usize = MAX_PIXELS * 4;

static mut DISPLAY_BUFFER: [u8; BUFFER_SIZE] = [0; BUFFER_SIZE];
static mut PIXELS_A: [u8; MAX_PIXELS] = [0; MAX_PIXELS];
static mut PIXELS_B: [u8; MAX_PIXELS] = [0; MAX_PIXELS];
static mut INITIAL_PIXELS: [u8; MAX_PIXELS] = [0; MAX_PIXELS];
static mut VIRGIN_PIXELS: [bool; MAX_PIXELS] = [true; MAX_PIXELS];
static mut VIRGIN_COUNT: usize = 0;
const HISTORY_SIZE: usize = 32768;
static mut CHANGED_HISTORY: [usize; HISTORY_SIZE] = [0; HISTORY_SIZE];
static mut FRAME_COUNT: usize = 0;
static mut LAST_CHANGED: [usize; 256] = [0; 256];
static mut N_SYNCED: usize = 0;
static mut ACTIVE_BUFFER_IS_A: bool = true;
static mut RAW_IMAGE_BUFFER: [u8; MAX_PIXELS * 3] = [0; MAX_PIXELS * 3]; // RGB
static mut UPLOAD_BUFFER: [u8; UPLOAD_SIZE] = [0; UPLOAD_SIZE];

static mut PALETTE: [u8; 768] = [0; 768];

static mut IMG_WIDTH: u32 = 0;
static mut IMG_HEIGHT: u32 = 0;
static mut ACTIVE_PALETTE_LEN: usize = 0;

#[wasm_bindgen]
pub struct CyclicDemons {
    // We can add state here if needed, but sticking to globals for raw speed/simplicity as before
}

#[wasm_bindgen]
impl CyclicDemons {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CyclicDemons {
        console_error_panic_hook::set_once();
        log("Rust Core: Cyclic Demons Initialized");
        unsafe {
            IMG_WIDTH = 0;
            IMG_HEIGHT = 0;
            ACTIVE_PALETTE_LEN = 0;
            ACTIVE_BUFFER_IS_A = true;
        }
        CyclicDemons {}
    }

    pub fn get_upload_buffer_ptr(&self) -> *mut u8 {
        unsafe { UPLOAD_BUFFER.as_mut_ptr() }
    }

    pub fn load_image(&self, width: u32, height: u32) {
        unsafe {
            if width as usize > MAX_WIDTH || height as usize > MAX_HEIGHT {
                 return;
            }
            IMG_WIDTH = width;
            IMG_HEIGHT = height;
            let pixel_count = (width * height) as usize;

            for i in 0..pixel_count {
                let src_idx = i * 4;
                let dst_idx = i * 3;
                RAW_IMAGE_BUFFER[dst_idx] = UPLOAD_BUFFER[src_idx];
                RAW_IMAGE_BUFFER[dst_idx + 1] = UPLOAD_BUFFER[src_idx + 1];
                RAW_IMAGE_BUFFER[dst_idx + 2] = UPLOAD_BUFFER[src_idx + 2];
            }
        }
        self.set_color_count(24);
    }

    pub fn set_color_count(&self, count: u8) {
        unsafe {
            let pixel_count = (IMG_WIDTH * IMG_HEIGHT) as usize;
            if pixel_count == 0 { return; }
            
            let step = (pixel_count / 4096).max(1);
            let mut sample_pixels = Vec::with_capacity(4096);
            
            for i in (0..pixel_count).step_by(step) {
                let r = RAW_IMAGE_BUFFER[i*3];
                let g = RAW_IMAGE_BUFFER[i*3+1];
                let b = RAW_IMAGE_BUFFER[i*3+2];
                sample_pixels.push([r, g, b]);
            }

            let (mut palette, _) = median_cut(&sample_pixels, count as usize);
            
            palette.sort_by(|a, b| {
                let (h1, _, _) = rgb_to_hsl(a[0], a[1], a[2]);
                let (h2, _, _) = rgb_to_hsl(b[0], b[1], b[2]);
                h1.partial_cmp(&h2).unwrap_or(std::cmp::Ordering::Equal)
            });

            let p_len = palette.len().min(256);
            ACTIVE_PALETTE_LEN = p_len * 3;
            for (i, c) in palette.iter().take(p_len).enumerate() {
                PALETTE[i*3] = c[0];
                PALETTE[i*3+1] = c[1];
                PALETTE[i*3+2] = c[2];
            }

            let colors: Vec<[u8; 3]> = (0..p_len).map(|i| {
                [PALETTE[i*3], PALETTE[i*3+1], PALETTE[i*3+2]]
            }).collect();

            for i in 0..pixel_count {
                let r = RAW_IMAGE_BUFFER[i*3];
                let g = RAW_IMAGE_BUFFER[i*3+1];
                let b = RAW_IMAGE_BUFFER[i*3+2];
                
                let mut min_dist = std::i32::MAX;
                let mut best_idx = 0;
                
                for (idx, color) in colors.iter().enumerate() {
                    let dr = r as i32 - color[0] as i32;
                    let dg = g as i32 - color[1] as i32;
                    let db = b as i32 - color[2] as i32;
                    let dist = dr*dr + dg*dg + db*db;
                    
                    if dist < min_dist {
                        min_dist = dist;
                        best_idx = idx;
                    }
                }
                PIXELS_A[i] = best_idx as u8;
                PIXELS_B[i] = best_idx as u8;
                INITIAL_PIXELS[i] = best_idx as u8;
                VIRGIN_PIXELS[i] = true;
            }
            VIRGIN_COUNT = pixel_count;
            FRAME_COUNT = 0;
            ACTIVE_BUFFER_IS_A = true;
            N_SYNCED = 0;
            for i in 0..256 {
                LAST_CHANGED[i] = 0;
            }
            
            self.render();
        }
    }

    pub fn step(&self) -> usize {
        unsafe {
            let width = IMG_WIDTH as usize;
            let height = IMG_HEIGHT as usize;
            let pixel_count = width * height;
            if pixel_count == 0 { return 0; }
            
            let num_colors = (ACTIVE_PALETTE_LEN / 3) as u8;
            if num_colors < 2 { return 0; }
            
            let (read_buf, write_buf) = if ACTIVE_BUFFER_IS_A {
                (&PIXELS_A, &mut PIXELS_B)
            } else {
                (&PIXELS_B, &mut PIXELS_A)
            };
            
            let mut changed = 0;
            
            for y in 0..height {
                for x in 0..width {
                    let i = y * width + x;
                    let current_color = read_buf[i];
                    
                    let eating_color = if current_color == 0 { num_colors - 1 } else { current_color - 1 };
                    
                    let left = if x == 0 { width - 1 } else { x - 1 };
                    let right = if x == width - 1 { 0 } else { x + 1 };
                    let up = if y == 0 { height - 1 } else { y - 1 };
                    let down = if y == height - 1 { 0 } else { y + 1 };
                    
                    if read_buf[up * width + x] == eating_color ||
                       read_buf[down * width + x] == eating_color ||
                       read_buf[y * width + left] == eating_color ||
                       read_buf[y * width + right] == eating_color {
                        write_buf[i] = eating_color;
                        changed += 1;
                        if VIRGIN_PIXELS[i] {
                            VIRGIN_PIXELS[i] = false;
                            VIRGIN_COUNT -= 1;
                        }
                    } else {
                        write_buf[i] = current_color;
                                }
                }
            }
            
            let current_idx = FRAME_COUNT % HISTORY_SIZE;
            CHANGED_HISTORY[current_idx] = changed;
            
            let period = num_colors as usize + 1;
            let expected = LAST_CHANGED[FRAME_COUNT % period];
            if changed == expected {
                N_SYNCED += 1;
            } else {
                N_SYNCED = 0;
                LAST_CHANGED[FRAME_COUNT % period] = changed;
            }
            
            FRAME_COUNT += 1;
            
            ACTIVE_BUFFER_IS_A = !ACTIVE_BUFFER_IS_A;
            
            if N_SYNCED > period {
                return 0; // Signal halt
            }
            
            changed
        }
    }

    pub fn reset(&self) {
        unsafe {
            let pixel_count = (IMG_WIDTH * IMG_HEIGHT) as usize;
            for i in 0..pixel_count {
                PIXELS_A[i] = INITIAL_PIXELS[i];
                PIXELS_B[i] = INITIAL_PIXELS[i];
                VIRGIN_PIXELS[i] = true;
            }
            VIRGIN_COUNT = pixel_count;
            FRAME_COUNT = 0;
            ACTIVE_BUFFER_IS_A = true;
            N_SYNCED = 0;
            for i in 0..256 {
                LAST_CHANGED[i] = 0;
            }
            self.render();
        }
    }

    pub fn get_virgin_count(&self) -> usize {
        unsafe { VIRGIN_COUNT }
    }

    pub fn get_nsynced(&self) -> usize {
        unsafe { N_SYNCED }
    }

    pub fn get_frame_count(&self) -> usize {
        unsafe { FRAME_COUNT }
    }

    pub fn get_recent_history(&self, n: usize) -> Vec<u32> {
        unsafe {
            let mut res = Vec::with_capacity(n);
            let n_actual = n.min(FRAME_COUNT).min(HISTORY_SIZE);
            if n_actual == 0 { return res; }
            for i in 0..n_actual {
                let idx = (FRAME_COUNT - n_actual + i) % HISTORY_SIZE;
                res.push(CHANGED_HISTORY[idx] as u32);
            }
            res
        }
    }

    pub fn get_cycle_period(&self) -> usize {
        unsafe {
            if FRAME_COUNT < 64 { return 0; }
            
            let current_idx = (FRAME_COUNT - 1) % HISTORY_SIZE;
            let current_val = CHANGED_HISTORY[current_idx];
            
            // Search back for potential period P
            let max_lookback = 8000.min(FRAME_COUNT - 1);
            
            for p in 1..=max_lookback {
                let past_idx = (FRAME_COUNT - 1 - p) % HISTORY_SIZE;
                
                let diff_curr = (CHANGED_HISTORY[past_idx] as isize - current_val as isize).abs();
                if diff_curr <= 2000 {
                    // Potential period found. Verify the last 3*P frames match
                    let check_len = (3 * p).max(10);
                    if FRAME_COUNT < check_len + p + 1 { continue; }
                    
                    let mut is_match = true;
                    for k in 1..check_len {
                        let check_curr = (FRAME_COUNT - 1 - k) % HISTORY_SIZE;
                        let check_past = (FRAME_COUNT - 1 - p - k) % HISTORY_SIZE;
                        
                        let diff = (CHANGED_HISTORY[check_curr] as isize - CHANGED_HISTORY[check_past] as isize).abs();
                        if diff > 2000 {
                            is_match = false;
                            break;
                        }
                    }
                    if is_match {
                        return p;
                    }
                }
            }
            0
        }
    }

    pub fn render(&self) {
        unsafe {
            let pixel_count = (IMG_WIDTH * IMG_HEIGHT) as usize;
            let read_buf = if ACTIVE_BUFFER_IS_A { &PIXELS_A } else { &PIXELS_B };
            
            for i in 0..pixel_count {
                let color_idx = read_buf[i] as usize;
                let base = i * 4;
                
                let p_idx = color_idx * 3;
                if p_idx + 2 < 768 {
                    DISPLAY_BUFFER[base] = PALETTE[p_idx];
                    DISPLAY_BUFFER[base + 1] = PALETTE[p_idx + 1];
                    DISPLAY_BUFFER[base + 2] = PALETTE[p_idx + 2];
                    DISPLAY_BUFFER[base + 3] = 255;
                }
            }
        }
    }

    pub fn get_display_buffer_ptr(&self) -> *const u8 {
        unsafe { DISPLAY_BUFFER.as_ptr() }
    }

    pub fn get_display_buffer_len(&self) -> usize {
        unsafe { (IMG_WIDTH * IMG_HEIGHT * 4) as usize }
    }
    
    pub fn get_width(&self) -> u32 {
        unsafe { IMG_WIDTH }
    }
    
    pub fn get_height(&self) -> u32 {
        unsafe { IMG_HEIGHT }
    }
}

// Median Cut Implementation
#[derive(Clone, Copy, Debug)]
struct Pixel {
    r: u8,
    g: u8,
    b: u8,
    original_idx: usize,
}

struct Bucket {
    pixels: Vec<Pixel>,
}

impl Bucket {
    fn range(&self) -> (u8, u8, u8) {
        let mut min_r = 255; let mut max_r = 0;
        let mut min_g = 255; let mut max_g = 0;
        let mut min_b = 255; let mut max_b = 0;
        
        for p in &self.pixels {
            if p.r < min_r { min_r = p.r; }
            if p.r > max_r { max_r = p.r; }
            if p.g < min_g { min_g = p.g; }
            if p.g > max_g { max_g = p.g; }
            if p.b < min_b { min_b = p.b; }
            if p.b > max_b { max_b = p.b; }
        }
        (max_r - min_r, max_g - min_g, max_b - min_b)
    }
    
    fn volume(&self) -> u32 {
        let (r, g, b) = self.range();
        (r as u32) * (g as u32) * (b as u32)
    }

    fn split(mut self) -> (Bucket, Bucket) {
        let (r_range, g_range, b_range) = self.range();
        
        if r_range >= g_range && r_range >= b_range {
            self.pixels.sort_by(|a, b| a.r.cmp(&b.r));
        } else if g_range >= r_range && g_range >= b_range {
            self.pixels.sort_by(|a, b| a.g.cmp(&b.g));
        } else {
            self.pixels.sort_by(|a, b| a.b.cmp(&b.b));
        }
        
        let mid = self.pixels.len() / 2;
        let right_pixels = self.pixels.split_off(mid);
        
        (self, Bucket { pixels: right_pixels })
    }
    
    fn average_color(&self) -> [u8; 3] {
        if self.pixels.is_empty() { return [0, 0, 0]; }
        let mut sum_r: u64 = 0;
        let mut sum_g: u64 = 0;
        let mut sum_b: u64 = 0;
        
        for p in &self.pixels {
            sum_r += p.r as u64;
            sum_g += p.g as u64;
            sum_b += p.b as u64;
        }
        let count = self.pixels.len() as u64;
        [
            (sum_r / count) as u8,
            (sum_g / count) as u8,
            (sum_b / count) as u8,
        ]
    }
}

fn median_cut(pixels: &[[u8; 3]], depth: usize) -> (Vec<[u8; 3]>, Vec<u8>) {
    let mapped_pixels: Vec<Pixel> = pixels.iter().enumerate().map(|(i, &p)| {
        Pixel { r: p[0], g: p[1], b: p[2], original_idx: i }
    }).collect();

    let initial_bucket = Bucket { pixels: mapped_pixels };
    let mut buckets = vec![initial_bucket];
    
    let target_count = depth; 

    while buckets.len() < target_count {
        let mut max_vol = 0;
        let mut split_idx = None;
        
        for (i, bucket) in buckets.iter().enumerate() {
            if bucket.pixels.len() > 1 {
                let vol = bucket.volume();
                if vol >= max_vol {
                    max_vol = vol;
                    split_idx = Some(i);
                }
            }
        }
        
        match split_idx {
            Some(idx) => {
                let bucket = buckets.remove(idx);
                let (b1, b2) = bucket.split();
                buckets.push(b1);
                buckets.push(b2);
            },
            None => break,
        }
    }
    
    let mut palette: Vec<[u8; 3]> = Vec::with_capacity(buckets.len());
    let mut indices: Vec<u8> = vec![0; pixels.len()];
    
    for (i, bucket) in buckets.iter().enumerate() {
        let color = bucket.average_color();
        palette.push(color);
        
        for p in &bucket.pixels {
            indices[p.original_idx] = i as u8;
        }
    }
    
    (palette, indices)
}

fn rgb_to_hsl(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
    let r = r as f32 / 255.0;
    let g = g as f32 / 255.0;
    let b = b as f32 / 255.0;

    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let delta = max - min;

    let l = (max + min) / 2.0;
    let mut h = 0.0;
    let mut s = 0.0;

    if delta != 0.0 {
        s = if l > 0.5 { delta / (2.0 - max - min) } else { delta / (max + min) };

        if max == r {
            h = (g - b) / delta + (if g < b { 6.0 } else { 0.0 });
        } else if max == g {
            h = (b - r) / delta + 2.0;
        } else {
            h = (r - g) / delta + 4.0;
        }
        h /= 6.0;
    }

    (h, s, l)
}
