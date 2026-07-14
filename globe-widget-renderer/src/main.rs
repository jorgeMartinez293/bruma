use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};
use globe::{Canvas, CameraConfig, GlobeConfig, GlobeTemplate};

fn main() {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as f32
        / 1000.0;

    // one full rotation every 240 seconds
    let angle = (secs / 240.0) * std::f32::consts::PI * 2.0;

    // canvas: 240x240 pixels → 60 cols × 30 rows with default char_pix (4,8)
    let mut canvas = Canvas::new(240, 240, None);

    let mut globe = GlobeConfig::new()
        .use_template(GlobeTemplate::Earth)
        .with_camera(CameraConfig::new(1.7, 0.0, 0.0))
        .build();

    globe.angle = angle;
    globe.render_on(&mut canvas);

    let stdout = std::io::stdout();
    let mut out = std::io::BufWriter::new(stdout.lock());

    let (size_x, size_y) = canvas.get_size();
    let cols = size_x / canvas.char_pix.0;
    let rows = size_y / canvas.char_pix.1;

    for i in 0..rows {
        for j in 0..cols {
            write!(out, "{}", canvas.matrix[i][j]).unwrap();
        }
        writeln!(out).unwrap();
    }
}
