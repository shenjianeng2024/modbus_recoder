// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod modbus;

use commands::{connection, reading, file_operations};
use modbus::{
    manager::{
        modbus_connect, modbus_disconnect, modbus_get_connection_state,
        modbus_read_holding_registers, modbus_set_config, modbus_test_connection,
        modbus_read_multiple_ranges, modbus_get_connection_info, 
        modbus_get_config, modbus_validate_config,
    },
    AppState,
};

fn main() {
    // 初始化日志记录
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    log::info!("Modbus Reader 应用程序启动");

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // 原有命令（兼容性）
            connection::test_connection,
            reading::read_single,
            reading::read_modbus_ranges,
            reading::start_collection,
            reading::stop_collection,
            reading::export_csv,
            // 文件操作命令
            file_operations::initialize_csv_file,
            file_operations::append_data_to_file,
            // 新的 Modbus 命令
            modbus_connect,
            modbus_disconnect,
            modbus_test_connection,
            modbus_get_connection_state,
            modbus_read_holding_registers,
            modbus_set_config,
            modbus_read_multiple_ranges,
            modbus_get_connection_info,
            modbus_get_config,
            modbus_validate_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
