use std::fs;
use crate::app_dir;

#[tauri::command]
pub async fn fetch_rscripts(page: u32, query: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("SirHurtV5/1.0")
        .build()
        .map_err(|e| format!("Client error: {e}"))?;

    let mut url = format!("https://rscripts.net/api/v2/scripts?page={page}");
    if !query.is_empty() { url = format!("{url}&q={}", query); }

    let json = client.get(&url).send().await.map_err(|e| format!("Request failed: {e}"))?
        .json::<serde_json::Value>().await.map_err(|e| format!("Parse failed: {e}"))?;
    Ok(json)
}

#[tauri::command]
pub fn kill_roblox() -> Result<String, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("taskkill")
            .args(["/F", "/IM", "RobloxPlayerBeta.exe"])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;
        Ok("Roblox process terminated.".into())
    }
    #[cfg(not(windows))]
    { Ok("Not supported on this OS.".into()) }
}

#[tauri::command]
pub fn save_local_version(version: String) -> Result<(), String> {
    fs::write(app_dir().join("version.txt"), version).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn launch_bootstrapper() -> Result<(), String> {
    let bootstrapper_path = app_dir().join("bootstrapper.exe");
    if !bootstrapper_path.exists() {
        return Err("bootstrapper.exe not found in app directory.".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new(bootstrapper_path)
            .current_dir(app_dir())
            .creation_flags(0x00000010)
            .spawn()
            .map_err(|e| format!("Failed to launch bootstrapper: {e}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    { Err("Bootstrapper is only supported on Windows.".into()) }
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_url_content(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("SirHurtV5/1.0")
        .build()
        .map_err(|e| format!("Client build error: {e}"))?;

    let res = client.get(&url).send().await.map_err(|e| format!("Request failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("Server returned error: {}", res.status()));
    }
    res.text().await.map_err(|e| format!("Read failed: {e}"))
}

#[tauri::command]
pub fn find_roblox_exe(folder: String) -> Option<String> {
    let targets = ["RobloxPlayerBeta.exe", "RobloxPlayerLauncher.exe", "RobloxPlayer.exe", "Sirstrap.exe"];
    fn walk(dir: &std::path::Path, targets: &[&str], depth: u32) -> Option<String> {
        if depth > 4 { return None; }
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if targets.iter().any(|t| name.eq_ignore_ascii_case(t)) {
                    return Some(path.to_string_lossy().to_string());
                }
                if path.is_dir() {
                    if let Some(found) = walk(&path, targets, depth + 1) {
                        return Some(found);
                    }
                }
            }
        }
        None
    }
    walk(std::path::Path::new(&folder), &targets, 0)
}

#[tauri::command]
pub fn launch_roblox(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let exe = std::path::Path::new(&path);
        if !exe.exists() {
            return Err(format!("Roblox executable not found at: {path}"));
        }
        std::process::Command::new(exe)
            .creation_flags(0x00000008)
            .spawn()
            .map_err(|e| format!("Failed to launch Roblox: {e}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    Err("Only supported on Windows.".into())
}

#[tauri::command]
pub fn clean_roblox() -> Result<String, String> {
    #[cfg(windows)]
    {
        let userprofile = std::env::var("USERPROFILE").unwrap_or_default();
        let targets = [
            format!("{userprofile}\\AppData\\LocalLow\\rbxcsettings.rbx"),
            format!("{userprofile}\\AppData\\Local\\Roblox\\GlobalBasicSettings_13.xml"),
        ];
        let logs_dir = format!("{userprofile}\\AppData\\Local\\Roblox\\logs");
        let mut removed = 0u32;
        for t in &targets {
            if std::path::Path::new(t).exists() {
                if fs::remove_file(t).is_ok() { removed += 1; }
            }
        }
        if let Ok(entries) = fs::read_dir(&logs_dir) {
            for e in entries.flatten() {
                if fs::remove_file(e.path()).is_ok() { removed += 1; }
            }
        }
        return Ok(format!("Cleaned {removed} Roblox file(s)."));
    }
    #[cfg(not(windows))]
    Err("Only supported on Windows.".into())
}
