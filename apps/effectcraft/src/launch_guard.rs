//! Settings ▸ Startup & Repair ▸ Window Graphics, and the launch guard behind it.
//!
//! Some graphics drivers crash EffectCraft as its window's device is created (an access
//! violation in an older Intel UHD driver with DirectX 12 / Vulkan, #243). A crash in a driver
//! can't be caught, so each launch leaves a marker in the settings folder until its window has
//! drawn a frame. A launch that finds the previous one's marker switches Window Graphics to
//! OpenGL, which those drivers run, and says so once the window is up. `WGPU_BACKEND` (wgpu's
//! own override) still wins over both.

use std::path::{Path, PathBuf};

use effectcraft_engine::prefs::{PREFS_FILE, Prefs};
use eframe::wgpu::Backends;

/// Left in the settings folder from a launch until its window draws.
const MARKER: &str = "launch-pending";

/// This launch's window graphics.
#[derive(Debug, Default)]
pub struct Launch {
    /// The graphics APIs the window may use (`None`: eframe's default).
    pub backends: Option<Backends>,
    /// Switched to OpenGL because the previous launch never drew: the message to show.
    pub notice: Option<String>,
    marker: Option<PathBuf>,
}

impl Launch {
    /// Read Window Graphics in the settings folder `dir`, switch it to OpenGL when the previous
    /// launch never drew (where OpenGL exists: not macOS), and leave this launch's marker.
    /// `env_override`: `WGPU_BACKEND` is set.
    pub fn begin(dir: Option<&Path>, env_override: bool) -> Launch {
        let Some(dir) = dir.filter(|_| !env_override) else { return Launch::default() };
        let prefs_path = dir.join(PREFS_FILE);
        let mut prefs = std::fs::read_to_string(&prefs_path).map(|t| Prefs::from_json(&t)).unwrap_or_default();
        let marker = dir.join(MARKER);
        let mut notice = None;
        if marker.exists() && prefs.startup.window_graphics == "auto" && cfg!(not(target_os = "macos")) {
            prefs.startup.window_graphics = "gl".into();
            match std::fs::create_dir_all(dir).and_then(|()| std::fs::write(&prefs_path, prefs.to_json())) {
                Ok(()) => log::warn!("the last launch never drew its window: switching Window Graphics to OpenGL"),
                Err(e) => log::warn!("the last launch never drew its window; saving Window Graphics failed: {e}"),
            }
            notice = Some(
                "EffectCraft's last launch stopped before its window opened, so it now draws with OpenGL \
                 (Settings ▸ Startup & Repair ▸ Window Graphics). Updating the graphics driver may let it use \
                 Automatic again."
                    .to_string(),
            );
        }
        let backends = (prefs.startup.window_graphics == "gl").then_some(Backends::GL);
        let marker = match std::fs::create_dir_all(dir).and_then(|()| std::fs::write(&marker, "")) {
            Ok(()) => Some(marker),
            Err(e) => {
                log::warn!("launch marker: {e}");
                None
            }
        };
        Launch { backends, notice, marker }
    }

    /// The window drew its first frame: the launch made it.
    pub fn drawn(&mut self) {
        if let Some(m) = self.marker.take()
            && let Err(e) = std::fs::remove_file(&m)
        {
            log::warn!("launch marker: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn window_graphics(dir: &Path) -> String {
        Prefs::from_json(&std::fs::read_to_string(dir.join(PREFS_FILE)).unwrap_or_default()).startup.window_graphics
    }

    /// A launch that never drew switches the next one to OpenGL, which then stays (#243).
    #[test]
    fn a_launch_that_never_drew_switches_the_next_to_opengl() {
        let dir = std::env::temp_dir().join(format!("ec-launch-guard-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        // A first launch that draws: nothing changes.
        let mut l = Launch::begin(Some(&dir), false);
        assert_eq!((l.backends, l.notice.is_some()), (None, false));
        assert!(dir.join(MARKER).exists());
        l.drawn();
        assert!(!dir.join(MARKER).exists());
        // A launch that crashes before drawing (it never calls `drawn`)…
        let _crashed = Launch::begin(Some(&dir), false);
        // …makes the next one use OpenGL and say so, once.
        let mut l = Launch::begin(Some(&dir), false);
        if cfg!(target_os = "macos") {
            assert_eq!((l.backends, l.notice.is_some()), (None, false), "no OpenGL on macOS");
        } else {
            assert_eq!(l.backends, Some(Backends::GL));
            assert!(l.notice.is_some());
            assert_eq!(window_graphics(&dir), "gl", "saved in Settings");
            l.drawn();
            let l = Launch::begin(Some(&dir), false);
            assert_eq!((l.backends, l.notice.is_some()), (Some(Backends::GL), false), "it stays, without the notice");
        }
        // `WGPU_BACKEND` wins, and leaves no marker.
        let _ = std::fs::remove_file(dir.join(MARKER));
        assert_eq!(Launch::begin(Some(&dir), true).backends, None);
        assert!(!dir.join(MARKER).exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
