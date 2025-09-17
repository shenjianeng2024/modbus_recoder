use log::{debug, error, info, warn};
use std::net::SocketAddr;
use std::time::Duration;
use tokio::time::timeout;
use tokio_modbus::prelude::*;

use crate::modbus::{
    error::{ModbusError, Result},
    system_proxy::SystemTcpProxy,
    types::{
        AddressRange, AddressReadResult, BatchReadResult, ByteOrder, ConnectionState, ModbusConfig,
        ReadResult,
    },
};

pub struct ModbusClient {
    context: Option<tokio_modbus::client::Context>,
    config: ModbusConfig,
    state: ConnectionState,
    system_proxy: Option<SystemTcpProxy>,
    use_system_proxy: bool,
}

impl Default for ModbusClient {
    fn default() -> Self {
        Self::new()
    }
}

impl ModbusClient {
    pub fn new() -> Self {
        Self {
            context: None,
            config: ModbusConfig::default(),
            state: ConnectionState::Disconnected,
            system_proxy: None,
            use_system_proxy: false,
        }
    }

    /// 格式化数值为指定格式
    fn format_value(value: u16, format: &str) -> String {
        match format {
            "hex" => format!("0x{:04X}", value),
            "bin" => format!("0b{:016b}", value),
            "dec" => value.to_string(),
            _ => value.to_string(),
        }
    }

    /// 将原始数据转换为AddressReadResult
    pub fn create_address_result(
        address: u16,
        value: u16,
        format: &str,
        timestamp: &str,
        error: Option<String>,
        data_type: &str,
        next_value: Option<u16>,
    ) -> AddressReadResult {
        Self::create_address_result_with_byte_order(
            address,
            value,
            format,
            timestamp,
            error,
            data_type,
            next_value,
            &ByteOrder::BigEndian, // 默认大端序保持兼容性
        )
    }

    /// 将原始数据转换为AddressReadResult，支持字节序配置
    pub fn create_address_result_with_byte_order(
        address: u16,
        value: u16,
        format: &str,
        timestamp: &str,
        error: Option<String>,
        data_type: &str,
        next_value: Option<u16>,
        byte_order: &ByteOrder,
    ) -> AddressReadResult {
        let (raw_value, parsed_value, actual_data_type) = match data_type {
            "float32" => {
                if let Some(next) = next_value {
                    // 根据字节序配置组合32位值
                    let raw_value = match byte_order {
                        ByteOrder::BigEndian => {
                            // 大端序：value为高位，next为低位 (标准Modbus)
                            ((value as u32) << 16) | (next as u32)
                        }
                        ByteOrder::LittleEndian => {
                            // 小端序：next为高位，value为低位 (某些设备)
                            ((next as u32) << 16) | (value as u32)
                        }
                    };
                    let parsed_value = f32::from_bits(raw_value);
                    (raw_value, parsed_value.to_string(), "float32".to_string())
                } else {
                    (
                        value as u32,
                        Self::format_value(value, format),
                        "uint16".to_string(),
                    )
                }
            }
            "uint32" => {
                if let Some(next) = next_value {
                    // 根据字节序配置组合32位值
                    let raw_value = match byte_order {
                        ByteOrder::BigEndian => {
                            // 大端序：value为高位，next为低位
                            ((value as u32) << 16) | (next as u32)
                        }
                        ByteOrder::LittleEndian => {
                            // 小端序：next为高位，value为低位
                            ((next as u32) << 16) | (value as u32)
                        }
                    };
                    (raw_value, raw_value.to_string(), "uint32".to_string())
                } else {
                    (
                        value as u32,
                        Self::format_value(value, format),
                        "uint16".to_string(),
                    )
                }
            }
            "int32" => {
                if let Some(next) = next_value {
                    // 根据字节序配置组合32位值
                    let raw_value = match byte_order {
                        ByteOrder::BigEndian => {
                            // 大端序：value为高位，next为低位
                            ((value as u32) << 16) | (next as u32)
                        }
                        ByteOrder::LittleEndian => {
                            // 小端序：next为高位，value为低位
                            ((next as u32) << 16) | (value as u32)
                        }
                    };
                    let parsed_value = raw_value as i32;
                    (
                        raw_value as u32,
                        parsed_value.to_string(),
                        "int32".to_string(),
                    )
                } else {
                    (
                        value as u32,
                        Self::format_value(value, format),
                        "uint16".to_string(),
                    )
                }
            }
            "int16" => {
                // 将 u16 转换为 i16（有符号16位整数）
                let parsed_value = value as i16;
                (value as u32, parsed_value.to_string(), "int16".to_string())
            }
            _ => (
                value as u32,
                Self::format_value(value, format),
                data_type.to_string(),
            ),
        };

        AddressReadResult {
            address,
            raw_value,
            parsed_value,
            timestamp: timestamp.to_string(),
            success: error.is_none(),
            error,
            data_type: actual_data_type,
        }
    }


    pub async fn connect(&mut self, ip: &str, port: u16) -> Result<()> {
        info!("开始连接 Modbus 设备: {}:{}", ip, port);

        // 验证输入参数
        if ip.is_empty() {
            let error = ModbusError::ConfigError("IP地址不能为空".to_string());
            error!("连接失败: {}", error.user_friendly_message());
            return Err(error);
        }

        if port == 0 {
            let error = ModbusError::ConfigError("端口号不能为0".to_string());
            error!("连接失败: {}", error.user_friendly_message());
            return Err(error);
        }

        self.state = ConnectionState::Connecting;
        debug!("连接状态更新为: Connecting");

        // 更新配置
        self.config.ip = ip.to_string();
        self.config.port = port;

        // 解析地址
        let address_str = format!("{}:{}", ip, port);
        let socket_addr: SocketAddr = address_str.parse().map_err(|e| {
            let error = ModbusError::ConnectionFailed(format!("Invalid address: {}", e));
            error!("地址解析失败: {}", error.user_friendly_message());
            error
        })?;

        debug!("解析地址成功: {}", socket_addr);

        // 断开现有连接
        if self.context.is_some() {
            warn!("检测到现有连接，将先断开");
            self.disconnect().await?;
        }

        // 创建 TCP 连接，设置从站ID
        debug!("正在建立 TCP 连接，超时时间: {}ms", self.config.timeout_ms);
        debug!(
            "目标地址: {}, 从站ID: {}",
            socket_addr, self.config.slave_id
        );

        // 首先尝试正常的tokio-modbus连接
        let tokio_result = timeout(
            Duration::from_millis(self.config.timeout_ms as u64),
            tcp::connect(socket_addr),
        )
        .await;

        // 根据tokio-modbus 0.16 API，处理嵌套Result
        match tokio_result {
            Ok(connection_result) => {
                match connection_result {
                    Ok(context) => {
                        self.context = Some(context);
                        self.state = ConnectionState::Connected;
                        info!(
                            "成功连接到 Modbus 设备: {}:{} (从站ID: {})",
                            ip, port, self.config.slave_id
                        );

                        // 尝试测试连接
                        if let Err(e) = self.test_connection().await {
                            warn!("连接测试失败: {}", e.user_friendly_message());
                        }

                        Ok(())
                    }
                    Err(e) => {
                // 详细记录连接错误，便于调试
                error!("TCP连接失败，目标: {}, 错误详情: {:?}", socket_addr, e);

                // 检查是否是需要系统代理的错误类型
                let error_str = format!("{}", e);
                if error_str.contains("No route to host") {
                    warn!("检测到网络路由问题，尝试使用系统代理连接...");
                    return self.try_system_proxy_connection(ip, port).await;
                } else if error_str.contains("Connection refused") {
                    warn!("检测到连接被拒绝，尝试使用系统代理连接...");
                    return self.try_system_proxy_connection(ip, port).await;
                }

                // 分析其他错误原因并提供友好的错误信息
                let error_msg = {
                    if error_str.contains("timed out") || error_str.contains("timeout") {
                        format!(
                            "连接超时: 设备{}:{}响应超时，请检查网络或增加超时时间",
                            ip, port
                        )
                    } else if error_str.contains("Permission denied") {
                        format!("权限拒绝: 无法访问设备{}:{}，可能需要管理员权限", ip, port)
                    } else if error_str.contains("Network is unreachable") {
                        format!("网络不可达: 无法连接到{}，请检查网络配置", ip)
                    } else {
                        format!("连接失败: {} (目标: {}:{})", e, ip, port)
                    }
                };

                        self.state = ConnectionState::Error(error_msg.clone());
                        let error = ModbusError::ConnectionFailed(error_msg);
                        error!("连接失败: {}", error.user_friendly_message());
                        Err(error)
                    }
                }
            }
            Err(_timeout_error) => {
                let timeout_msg = format!(
                    "连接超时: {}ms内未能连接到{}:{}",
                    self.config.timeout_ms, ip, port
                );
                self.state = ConnectionState::Error(timeout_msg.clone());
                let error = ModbusError::ConnectionFailed(timeout_msg);
                error!("连接超时: {}", error.user_friendly_message());
                Err(error)
            }
        }
    }

    pub async fn disconnect(&mut self) -> Result<()> {
        info!("断开 Modbus 设备连接");

        if let Some(_context) = self.context.take() {
            // tokio-modbus Context doesn't have explicit disconnect method
            // Connection will be dropped automatically
            debug!("清理现有连接上下文");
        } else {
            debug!("没有活动连接需要断开");
        }

        self.state = ConnectionState::Disconnected;
        info!("连接已断开");
        Ok(())
    }

    pub async fn test_connection(&mut self) -> Result<bool> {
        debug!("测试 Modbus 连接");

        if !self.is_connected() {
            debug!("连接状态检查失败，未建立连接");
            return Ok(false);
        }

        // 尝试读取一个寄存器来测试连接
        debug!("尝试读取地址0的1个寄存器进行连接测试");
        match self.read_holding_registers_raw(0, 1).await {
            Ok(data) => {
                debug!("连接测试成功，读取到 {} 个寄存器", data.len());
                Ok(true)
            }
            Err(ModbusError::DeviceError(_)) => {
                debug!("设备响应异常但连接正常（可能是地址不存在）");
                Ok(true) // 设备响应了，连接正常
            }
            Err(e) => {
                warn!("连接测试失败: {}", e.user_friendly_message());
                self.state = ConnectionState::Error("Connection test failed".to_string());
                Ok(false)
            }
        }
    }

    pub async fn read_holding_registers(&mut self, range: AddressRange) -> Result<ReadResult> {
        info!(
            "开始读取保持寄存器: 起始地址={}, 数量={}",
            range.start, range.count
        );

        if !range.is_valid() {
            let error = ModbusError::InvalidAddressRange {
                start: range.start,
                count: range.count,
            };
            error!("地址范围无效: {}", error.user_friendly_message());
            return Err(error);
        }

        if !self.is_connected() {
            let error = ModbusError::NotConnected;
            error!("读取失败: {}", error.user_friendly_message());
            return Err(error);
        }

        debug!("开始执行寄存器读取操作");
        let start_time = std::time::Instant::now();

        match self
            .read_holding_registers_raw(range.start, range.count)
            .await
        {
            Ok(data) => {
                let duration = start_time.elapsed();
                let data_len = data.len();
                info!(
                    "成功读取 {} 个寄存器，耗时: {:?}ms",
                    data_len,
                    duration.as_millis()
                );
                debug!("读取数据: {:?}", data);

                Ok(ReadResult {
                    success: true,
                    data,
                    address_range: range,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    message: format!("成功读取 {} 个寄存器", data_len),
                })
            }
            Err(e) => {
                let duration = start_time.elapsed();
                error!(
                    "读取寄存器失败，耗时: {:?}ms, 错误: {}",
                    duration.as_millis(),
                    e.user_friendly_message()
                );
                Err(e)
            }
        }
    }

    async fn read_holding_registers_raw(&mut self, start: u16, count: u16) -> Result<Vec<u16>> {
        debug!(
            "执行原始寄存器读取: start={}, count={}, timeout={}ms",
            start, count, self.config.timeout_ms
        );

        // 检查是否需要使用系统代理
        if self.use_system_proxy {
            if let Some(proxy) = &self.system_proxy {
                debug!("使用系统代理进行寄存器读取");
                match proxy
                    .read_holding_registers(self.config.slave_id, start, count)
                    .await
                {
                    Ok(data) => {
                        debug!("系统代理读取成功: 获得 {} 个数据值", data.len());
                        Ok(data)
                    }
                    Err(e) => {
                        let error_msg = format!("系统代理读取失败: {}", e);
                        warn!("{}", error_msg);
                        self.state = ConnectionState::Error(error_msg.clone());
                        Err(ModbusError::DeviceError(error_msg))
                    }
                }
            } else {
                let error_msg = "系统代理未初始化".to_string();
                error!("{}", error_msg);
                Err(ModbusError::DeviceError(error_msg))
            }
        } else {
            // 使用常规tokio-modbus连接
            let context = self.context.as_mut().ok_or(ModbusError::NotConnected)?;

            // 添加超时处理，正确处理三层嵌套的 Result
            match timeout(
                Duration::from_millis(self.config.timeout_ms as u64),
                context.read_holding_registers(start, count),
            )
            .await
            {
                Ok(transport_result) => {
                    // timeout success - now handle transport result
                    match transport_result {
                        Ok(modbus_result) => {
                            // transport success - now handle modbus result
                            match modbus_result {
                                Ok(data) => {
                                    debug!("原始读取成功: 获得 {} 个数据值", data.len());
                                    Ok(data)
                                }
                                Err(exception) => {
                                    let error_msg = format!("Modbus exception: {}", exception);
                                    warn!("Modbus协议异常: {}", error_msg);
                                    self.state = ConnectionState::Error(error_msg.clone());
                                    Err(ModbusError::DeviceError(error_msg))
                                }
                            }
                        }
                        Err(e) => {
                            let error_msg = format!("Transport error: {}", e);
                            warn!("传输层错误: {}", error_msg);
                            self.state = ConnectionState::Error(error_msg.clone());
                            Err(ModbusError::DeviceError(error_msg))
                        }
                    }
                }
                Err(_) => {
                    warn!("读取操作超时 ({}ms)", self.config.timeout_ms);
                    self.state = ConnectionState::Error("Read timeout".to_string());
                    Err(ModbusError::Timeout)
                }
            }
        }
    }

    pub fn is_connected(&self) -> bool {
        matches!(self.state, ConnectionState::Connected)
            && (self.context.is_some() || (self.use_system_proxy && self.system_proxy.is_some()))
    }

    pub fn get_state(&self) -> &ConnectionState {
        &self.state
    }

    pub fn get_config(&self) -> &ModbusConfig {
        &self.config
    }

    pub fn set_slave_id(&mut self, slave_id: u8) {
        debug!("设置从站ID: {} -> {}", self.config.slave_id, slave_id);
        self.config.slave_id = slave_id;
        if let Some(context) = &mut self.context {
            context.set_slave(Slave(slave_id));
            info!("已更新连接的从站ID为: {}", slave_id);
        } else {
            debug!("暂存从站ID设置，将在下次连接时应用");
        }
    }

    pub fn set_timeout(&mut self, timeout_ms: u32) {
        debug!(
            "设置超时时间: {}ms -> {}ms",
            self.config.timeout_ms, timeout_ms
        );
        self.config.timeout_ms = timeout_ms;
    }

    /// 获取连接统计信息
    pub fn get_connection_info(&self) -> String {
        format!(
            "状态: {:?}, 设备: {}:{}, 从站ID: {}, 超时: {}ms",
            self.state,
            self.config.ip,
            self.config.port,
            self.config.slave_id,
            self.config.timeout_ms
        )
    }

    /// 批量读取多个地址范围
    pub async fn read_multiple_ranges(
        &mut self,
        ranges: Vec<AddressRange>,
    ) -> Result<Vec<ReadResult>> {
        info!("开始批量读取 {} 个地址范围", ranges.len());
        let mut results = Vec::new();

        for (i, range) in ranges.iter().enumerate() {
            debug!(
                "读取第 {}/{} 个范围: 起始地址={}, 数量={}",
                i + 1,
                ranges.len(),
                range.start,
                range.count
            );

            match self.read_holding_registers(range.clone()).await {
                Ok(result) => {
                    debug!("第 {} 个范围读取成功", i + 1);
                    results.push(result);
                }
                Err(e) => {
                    error!("第 {} 个范围读取失败: {}", i + 1, e.user_friendly_message());
                    return Err(e);
                }
            }
        }

        info!("批量读取完成，成功读取 {} 个范围", results.len());
        Ok(results)
    }

    /// 验证配置是否有效
    pub fn validate_config(&self) -> Result<()> {
        if self.config.ip.is_empty() {
            return Err(ModbusError::ConfigError("IP地址不能为空".to_string()));
        }

        if self.config.port == 0 {
            return Err(ModbusError::ConfigError("端口号不能为0".to_string()));
        }

        if self.config.timeout_ms == 0 {
            return Err(ModbusError::ConfigError("超时时间不能为0".to_string()));
        }

        if self.config.timeout_ms > 60000 {
            return Err(ModbusError::ConfigError("超时时间不能超过60秒".to_string()));
        }

        Ok(())
    }

    /// 智能调整32位数据类型的地址范围
    fn adjust_range_for_32bit_data(range: &AddressRange) -> AddressRange {
        match range.data_type.as_str() {
            "float32" | "uint32" | "int32" => {
                if range.count == 1 {
                    // 单地址32位数据读取：自动读取2个连续寄存器
                    debug!(
                        "检测到单地址{}读取，自动扩展为读取2个寄存器: 地址{}-{}",
                        range.data_type,
                        range.start,
                        range.start + 1
                    );
                    AddressRange::new_with_type(range.start, 2, &range.data_type)
                } else {
                    // 多地址读取：确保是偶数个寄存器
                    let adjusted_count = if range.count % 2 == 1 {
                        debug!(
                            "{}需要偶数个寄存器，从{}调整为{}",
                            range.data_type,
                            range.count,
                            range.count + 1
                        );
                        range.count + 1
                    } else {
                        range.count
                    };
                    AddressRange::new_with_type(range.start, adjusted_count, &range.data_type)
                }
            }
            _ => range.clone(), // 其他数据类型不需要调整
        }
    }

    /// 批量读取多个地址范围并返回详细结果
    pub async fn read_ranges_detailed(
        &mut self,
        ranges: Vec<AddressRange>,
        format: Option<String>,
    ) -> Result<BatchReadResult> {
        info!("开始详细读取 {} 个地址范围", ranges.len());
        let start_time = std::time::Instant::now();
        let timestamp = chrono::Utc::now().to_rfc3339();
        let format_str = format.as_deref().unwrap_or("dec");

        let mut all_results = Vec::new();
        let mut success_count = 0;
        let mut failed_count = 0;

        for (range_idx, original_range) in ranges.iter().enumerate() {
            debug!(
                "处理第 {}/{} 个范围: 起始地址={}, 数量={}, 数据类型={}",
                range_idx + 1,
                ranges.len(),
                original_range.start,
                original_range.count,
                original_range.data_type
            );

            // 智能调整32位数据类型的读取范围
            let adjusted_range = Self::adjust_range_for_32bit_data(original_range);

            match self.read_holding_registers(adjusted_range.clone()).await {
                Ok(read_result) => {
                    // 根据原始请求的数据类型处理结果
                    match original_range.data_type.as_str() {
                        "float32" | "uint32" | "int32" => {
                            // 对于 32 位数据类型，每两个寄存器组成一个 32 位值
                            let expected_pairs = if original_range.count == 1 {
                                1 // 单地址读取只期望1个32位值
                            } else {
                                (original_range.count + 1) / 2 // 多地址读取的32位值数量
                            };

                            let mut processed_pairs = 0;
                            for i in (0..read_result.data.len()).step_by(2) {
                                if processed_pairs >= expected_pairs {
                                    break; // 已处理完所有期望的32位值
                                }

                                if i + 1 < read_result.data.len() {
                                    let addr = original_range.start + (processed_pairs * 2) as u16;
                                    let addr_result = Self::create_address_result_with_byte_order(
                                        addr,
                                        read_result.data[i],
                                        format_str,
                                        &timestamp,
                                        None, // 成功读取，无错误
                                        &original_range.data_type,
                                        Some(read_result.data[i + 1]),
                                        &self.config.byte_order,
                                    );
                                    all_results.push(addr_result);
                                    success_count += 1;
                                    processed_pairs += 1;
                                } else {
                                    // 理论上不应该到达这里，因为我们已经调整了读取范围
                                    let addr = original_range.start + (processed_pairs * 2) as u16;
                                    let error_msg = "数据不完整：缺少配对寄存器".to_string();
                                    let addr_result = Self::create_address_result(
                                        addr,
                                        read_result.data[i],
                                        format_str,
                                        &timestamp,
                                        Some(error_msg),
                                        "uint16",
                                        None,
                                    );
                                    all_results.push(addr_result);
                                    failed_count += 1;
                                    break;
                                }
                            }
                        }
                        _ => {
                            // 其他数据类型（uint16, int16），每个寄存器单独处理
                            let expected_count = original_range.count as usize;
                            let actual_count = read_result.data.len().min(expected_count);

                            for i in 0..actual_count {
                                let addr = original_range.start + i as u16;
                                let addr_result = Self::create_address_result(
                                    addr,
                                    read_result.data[i],
                                    format_str,
                                    &timestamp,
                                    None, // 成功读取，无错误
                                    &original_range.data_type,
                                    None,
                                );
                                all_results.push(addr_result);
                                success_count += 1;
                            }
                        }
                    }
                    debug!(
                        "第 {} 个范围读取成功，获得 {} 个寄存器数据",
                        range_idx + 1,
                        read_result.data.len()
                    );
                }
                Err(e) => {
                    // 为原始范围内的地址创建失败结果
                    let error_msg = e.user_friendly_message();
                    error!("第 {} 个范围读取失败: {}", range_idx + 1, error_msg);

                    // 根据数据类型确定失败结果数量
                    let failure_count = match original_range.data_type.as_str() {
                        "float32" | "uint32" | "int32" => {
                            // 32位数据类型：按照用户请求的数量创建失败结果
                            if original_range.count == 1 {
                                1 // 单地址读取只失败1个32位值
                            } else {
                                (original_range.count + 1) / 2 // 多地址的32位值数量
                            }
                        }
                        _ => original_range.count, // 其他数据类型按寄存器数量
                    };

                    for i in 0..failure_count {
                        let addr = match original_range.data_type.as_str() {
                            "float32" | "uint32" | "int32" => {
                                original_range.start + (i * 2) as u16 // 32位数据的地址间隔
                            }
                            _ => original_range.start + i as u16, // 16位数据的地址
                        };

                        let addr_result = Self::create_address_result(
                            addr,
                            0, // 失败时使用0作为原始值
                            format_str,
                            &timestamp,
                            Some(error_msg.clone()),
                            &original_range.data_type,
                            None,
                        );
                        all_results.push(addr_result);
                        failed_count += 1;
                    }
                }
            }
        }

        let duration = start_time.elapsed();
        let total_count = all_results.len();

        info!(
            "详细读取完成: 总计 {} 个地址, 成功 {}, 失败 {}, 耗时 {}ms",
            total_count,
            success_count,
            failed_count,
            duration.as_millis()
        );

        Ok(BatchReadResult {
            results: all_results,
            total_count,
            success_count,
            failed_count,
            timestamp,
            duration_ms: duration.as_millis() as u64,
        })
    }

    /// 尝试使用系统代理连接（绕过Rust网络栈问题）
    async fn try_system_proxy_connection(&mut self, ip: &str, port: u16) -> Result<()> {
        info!("尝试使用系统代理连接到 {}:{}", ip, port);

        // 创建系统代理实例
        let proxy = SystemTcpProxy::new(ip, port);

        // 先测试系统级连接
        match proxy.test_connection().await {
            Ok(msg) => {
                info!("系统代理连接测试成功: {}", msg);

                // 存储系统代理实例并设置标志
                self.system_proxy = Some(proxy);
                self.use_system_proxy = true;
                self.state = ConnectionState::Connected;

                info!("成功通过系统代理连接到 Modbus 设备: {}:{}", ip, port);
                Ok(())
            }
            Err(e) => {
                // 分析系统代理失败的原因并提供更具体的错误信息和解决建议
                let error_str = format!("{}", e);
                let detailed_error_msg = if error_str.contains("Connection refused") || error_str.contains("ECONNREFUSED") {
                    format!(
                        "连接被拒绝: 设备 {}:{} 拒绝连接。\n\
                        可能原因：\n\
                        • Modbus 服务未启动或已停止\n\
                        • 设备端口 {} 上没有运行 Modbus TCP 服务\n\
                        • 设备防火墙阻止了端口 {} 的访问\n\
                        • 设备配置错误或需要重启\n\n\
                        建议解决方案：\n\
                        • 检查设备 Modbus TCP 服务是否正常运行\n\
                        • 确认端口 {} 配置正确（标准 Modbus TCP 端口为 502）\n\
                        • 检查设备防火墙设置\n\
                        • 尝试重启设备或 Modbus 服务",
                        ip, port, port, port, port
                    )
                } else if error_str.contains("No route to host") || error_str.contains("EHOSTUNREACH") {
                    format!(
                        "无法到达主机: 设备 {} 网络不可达。\n\
                        可能原因：\n\
                        • 设备 IP 地址错误或已更改\n\
                        • 网络路由配置问题\n\
                        • 设备离线或网络连接断开\n\
                        • 子网配置不正确\n\n\
                        建议解决方案：\n\
                        • 使用 'ping {}' 验证设备是否在线\n\
                        • 检查 IP 地址是否正确\n\
                        • 确认设备和本机在同一网络或可路由网络中\n\
                        • 检查网络交换机和路由器配置",
                        ip, ip
                    )
                } else if error_str.contains("timed out") || error_str.contains("timeout") {
                    format!(
                        "连接超时: 设备 {}:{} 响应超时。\n\
                        可能原因：\n\
                        • 网络延迟过高\n\
                        • 设备响应缓慢\n\
                        • 网络拥塞\n\
                        • 设备负载过高\n\n\
                        建议解决方案：\n\
                        • 增加连接超时时间\n\
                        • 检查网络质量和延迟\n\
                        • 确认设备负载是否正常\n\
                        • 尝试减少并发连接数",
                        ip, port
                    )
                } else {
                    format!(
                        "系统代理连接失败: {}\n\
                        设备 {}:{} 无法连接。\n\n\
                        通用解决方案：\n\
                        • 检查设备电源和网络连接\n\
                        • 确认 IP 地址和端口配置正确\n\
                        • 验证 Modbus TCP 服务状态\n\
                        • 检查网络防火墙设置",
                        error_str, ip, port
                    )
                };

                warn!("系统代理连接失败，详细诊断: {}", detailed_error_msg);
                self.state = ConnectionState::Error(detailed_error_msg.clone());
                Err(ModbusError::ConnectionFailed(detailed_error_msg))
            }
        }
    }
}

impl std::fmt::Debug for ModbusClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ModbusClient")
            .field("context", &self.context.is_some())
            .field("config", &self.config)
            .field("state", &self.state)
            .field("system_proxy", &self.system_proxy.is_some())
            .field("use_system_proxy", &self.use_system_proxy)
            .finish()
    }
}

impl Drop for ModbusClient {
    fn drop(&mut self) {
        // Context will be dropped automatically
        self.context = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modbus::types::ByteOrder;

    #[test]
    fn test_create_address_result_float32() {
        // 测试 f32 解析：42.0 的 IEEE 754 表示
        // 42.0 = 0x42280000 = 高位字节: 0x4228, 低位字节: 0x0000
        let result = ModbusClient::create_address_result(
            100,                   // address
            0x4228,                // 高位字节
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "float32",             // data_type
            Some(0x0000),          // 低位字节
        );

        assert_eq!(result.address, 100);
        assert_eq!(result.raw_value, 0x42280000);
        assert_eq!(result.parsed_value, "42");
        assert_eq!(result.data_type, "float32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_float32_negative() {
        // 测试负数 f32：-3.14 的 IEEE 754 表示
        // -3.14 ≈ 0xC048F5C3 = 高位字节: 0xC048, 低位字节: 0xF5C3
        let result = ModbusClient::create_address_result(
            200,                   // address
            0xC048,                // 高位字节
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "float32",             // data_type
            Some(0xF5C3),          // 低位字节
        );

        assert_eq!(result.address, 200);
        assert_eq!(result.raw_value, 0xC048F5C3);
        // 验证解析后的值是负数且近似等于 -3.14
        let parsed_float: f32 = result.parsed_value.parse().unwrap();
        assert!(parsed_float < 0.0);
        assert!((parsed_float + 3.14).abs() < 0.01); // 允许小的浮点误差
        assert_eq!(result.data_type, "float32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_uint32() {
        // 测试 uint32：65537 = 0x00010001 = 高位字节: 0x0001, 低位字节: 0x0001
        let result = ModbusClient::create_address_result(
            300,                   // address
            0x0001,                // 高位字节
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "uint32",              // data_type
            Some(0x0001),          // 低位字节
        );

        assert_eq!(result.address, 300);
        assert_eq!(result.raw_value, 0x00010001);
        assert_eq!(result.parsed_value, "65537");
        assert_eq!(result.data_type, "uint32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_int32() {
        // 测试 int32：-1 = 0xFFFFFFFF = 高位字节: 0xFFFF, 低位字节: 0xFFFF
        let result = ModbusClient::create_address_result(
            400,                   // address
            0xFFFF,                // 高位字节
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "int32",               // data_type
            Some(0xFFFF),          // 低位字节
        );

        assert_eq!(result.address, 400);
        assert_eq!(result.raw_value, 0xFFFFFFFF);
        assert_eq!(result.parsed_value, "-1");
        assert_eq!(result.data_type, "int32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_single_register() {
        // 测试单个寄存器（无 next_value）
        let result = ModbusClient::create_address_result(
            500,                   // address
            1234,                  // value
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "uint16",              // data_type
            None,                  // no next_value
        );

        assert_eq!(result.address, 500);
        assert_eq!(result.raw_value, 1234);
        assert_eq!(result.parsed_value, "1234");
        assert_eq!(result.data_type, "uint16");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_float32_partial_data() {
        // 测试 f32 但没有提供 next_value（应该退化为 uint16）
        let result = ModbusClient::create_address_result(
            600,                   // address
            0x4228,                // value
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "float32",             // data_type (请求f32但数据不足)
            None,                  // no next_value
        );

        assert_eq!(result.address, 600);
        assert_eq!(result.raw_value, 0x4228);
        assert_eq!(result.parsed_value, "16936"); // 0x4228 的十进制表示
        assert_eq!(result.data_type, "uint16"); // 退化为uint16
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_int16() {
        // 测试 int16：-1（0xFFFF 的有符号表示）
        let result = ModbusClient::create_address_result(
            700,                   // address
            0xFFFF,                // value (65535，但作为int16应该是-1)
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "int16",               // data_type
            None,                  // no next_value (int16只需要一个寄存器)
        );

        assert_eq!(result.address, 700);
        assert_eq!(result.raw_value, 0xFFFF);
        assert_eq!(result.parsed_value, "-1"); // 应该解析为有符号值
        assert_eq!(result.data_type, "int16");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_int16_positive() {
        // 测试 int16：32767（最大正数）
        let result = ModbusClient::create_address_result(
            800,                   // address
            0x7FFF,                // value (32767)
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "int16",               // data_type
            None,                  // no next_value
        );

        assert_eq!(result.address, 800);
        assert_eq!(result.raw_value, 0x7FFF);
        assert_eq!(result.parsed_value, "32767");
        assert_eq!(result.data_type, "int16");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_int16_negative() {
        // 测试 int16：-32768（最小负数）
        let result = ModbusClient::create_address_result(
            900,                   // address
            0x8000,                // value (32768，但作为int16应该是-32768)
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "int16",               // data_type
            None,                  // no next_value
        );

        assert_eq!(result.address, 900);
        assert_eq!(result.raw_value, 0x8000);
        assert_eq!(result.parsed_value, "-32768");
        assert_eq!(result.data_type, "int16");
        assert!(result.success);
    }

    #[test]
    fn test_adjust_range_for_32bit_data_single_address() {
        // 测试单地址32位数据类型的范围调整
        let float32_range = AddressRange::new_with_type(100, 1, "float32");
        let adjusted = ModbusClient::adjust_range_for_32bit_data(&float32_range);
        assert_eq!(adjusted.start, 100);
        assert_eq!(adjusted.count, 2); // 自动扩展为2个寄存器
        assert_eq!(adjusted.data_type, "float32");

        let uint32_range = AddressRange::new_with_type(200, 1, "uint32");
        let adjusted = ModbusClient::adjust_range_for_32bit_data(&uint32_range);
        assert_eq!(adjusted.start, 200);
        assert_eq!(adjusted.count, 2);
        assert_eq!(adjusted.data_type, "uint32");

        let int32_range = AddressRange::new_with_type(300, 1, "int32");
        let adjusted = ModbusClient::adjust_range_for_32bit_data(&int32_range);
        assert_eq!(adjusted.start, 300);
        assert_eq!(adjusted.count, 2);
        assert_eq!(adjusted.data_type, "int32");
    }

    #[test]
    fn test_adjust_range_for_32bit_data_multiple_addresses() {
        // 测试多地址32位数据类型的范围调整
        let float32_range = AddressRange::new_with_type(100, 3, "float32"); // 奇数
        let adjusted = ModbusClient::adjust_range_for_32bit_data(&float32_range);
        assert_eq!(adjusted.start, 100);
        assert_eq!(adjusted.count, 4); // 调整为偶数
        assert_eq!(adjusted.data_type, "float32");

        let uint32_range = AddressRange::new_with_type(200, 4, "uint32"); // 偶数
        let adjusted = ModbusClient::adjust_range_for_32bit_data(&uint32_range);
        assert_eq!(adjusted.start, 200);
        assert_eq!(adjusted.count, 4); // 保持不变
        assert_eq!(adjusted.data_type, "uint32");
    }

    #[test]
    fn test_adjust_range_for_16bit_data_no_change() {
        // 测试16位数据类型不需要调整
        let uint16_range = AddressRange::new_with_type(100, 1, "uint16");
        let adjusted = ModbusClient::adjust_range_for_32bit_data(&uint16_range);
        assert_eq!(adjusted.start, 100);
        assert_eq!(adjusted.count, 1); // 保持不变
        assert_eq!(adjusted.data_type, "uint16");

        let int16_range = AddressRange::new_with_type(200, 5, "int16");
        let adjusted = ModbusClient::adjust_range_for_32bit_data(&int16_range);
        assert_eq!(adjusted.start, 200);
        assert_eq!(adjusted.count, 5); // 保持不变
        assert_eq!(adjusted.data_type, "int16");
    }

    #[test]
    fn test_create_address_result_with_byte_order_little_endian() {
        // 测试小端序的32位浮点数解析
        // 42.0的IEEE 754表示：0x42280000
        // 小端序：低位字节在前，高位字节在后
        let result = ModbusClient::create_address_result_with_byte_order(
            100,                   // address
            0x0000,                // 小端序：低位字节在前
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "float32",             // data_type
            Some(0x4228),          // 小端序：高位字节在后
            &ByteOrder::LittleEndian,
        );

        assert_eq!(result.address, 100);
        assert_eq!(result.raw_value, 0x42280000);
        assert_eq!(result.parsed_value, "42");
        assert_eq!(result.data_type, "float32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_with_byte_order_big_endian() {
        // 测试大端序的32位浮点数解析（默认行为）
        // 42.0的IEEE 754表示：0x42280000
        // 大端序：高位字节在前，低位字节在后
        let result = ModbusClient::create_address_result_with_byte_order(
            100,                   // address
            0x4228,                // 大端序：高位字节在前
            "dec",                 // format
            "2024-01-01T12:00:00", // timestamp
            None,                  // error
            "float32",             // data_type
            Some(0x0000),          // 大端序：低位字节在后
            &ByteOrder::BigEndian,
        );

        assert_eq!(result.address, 100);
        assert_eq!(result.raw_value, 0x42280000);
        assert_eq!(result.parsed_value, "42");
        assert_eq!(result.data_type, "float32");
        assert!(result.success);
    }
}
