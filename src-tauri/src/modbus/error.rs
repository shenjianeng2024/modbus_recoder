use thiserror::Error;

#[derive(Error, Debug)]
pub enum ModbusError {
    #[error("无法连接到 Modbus 设备: {0}")]
    ConnectionFailed(String),

    #[error("设备未连接，请先建立连接")]
    NotConnected,

    #[error("地址范围无效: 起始地址={start}, 寄存器数量={count}。请检查地址范围是否在有效范围内")]
    InvalidAddressRange { start: u16, count: u16 },

    #[error("操作超时，设备可能无响应或网络延迟过高")]
    Timeout,

    #[error("设备响应错误: {0}")]
    DeviceError(String),

    #[error("网络或IO错误: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Modbus协议错误: {0}")]
    ProtocolError(String),

    #[error("配置错误: {0}")]
    ConfigError(String),

    #[error("内部错误: {0}")]
    InternalError(String),
}

pub type Result<T> = std::result::Result<T, ModbusError>;

impl ModbusError {
    pub fn to_string(&self) -> String {
        format!("{}", self)
    }

    /// 返回用户友好的错误消息
    pub fn user_friendly_message(&self) -> String {
        match self {
            ModbusError::ConnectionFailed(msg) => {
                if msg.contains("Connection refused") {
                    "连接被拒绝，请检查设备IP地址和端口是否正确，设备是否在线".to_string()
                } else if msg.contains("timeout") || msg.contains("Timeout") {
                    "连接超时，请检查网络连接和设备状态".to_string()
                } else if msg.contains("Invalid address") {
                    "IP地址格式错误，请检查输入的地址格式".to_string()
                } else {
                    format!("连接失败: {}", msg)
                }
            }
            ModbusError::NotConnected => "设备未连接，请先点击'连接'按钮建立连接".to_string(),
            ModbusError::InvalidAddressRange { start, count } => {
                if *count == 0 {
                    "寄存器数量不能为0".to_string()
                } else if *count > 125 {
                    "单次读取的寄存器数量不能超过125个".to_string()
                } else if start.saturating_add(*count) <= *start {
                    "地址范围溢出，请调整起始地址或寄存器数量".to_string()
                } else {
                    format!("地址范围无效 (起始: {}, 数量: {})", start, count)
                }
            }
            ModbusError::Timeout => "操作超时，设备可能繁忙或网络延迟过高，请稍后重试".to_string(),
            ModbusError::DeviceError(msg) => {
                if msg.contains("Illegal data address") {
                    "设备中不存在指定的寄存器地址".to_string()
                } else if msg.contains("Illegal function") {
                    "设备不支持此功能".to_string()
                } else if msg.contains("exception") && msg.contains("0x02") {
                    "非法数据地址 - 请检查寄存器地址是否正确".to_string()
                } else if msg.contains("exception") && msg.contains("0x03") {
                    "非法数据值 - 设备无法处理请求的数据".to_string()
                } else {
                    format!("设备错误: {}", msg)
                }
            }
            ModbusError::IoError(err) => {
                format!("网络错误: {}", err)
            }
            ModbusError::ProtocolError(msg) => {
                format!("协议错误: {}", msg)
            }
            ModbusError::ConfigError(msg) => {
                format!("配置错误: {}", msg)
            }
            ModbusError::InternalError(msg) => {
                format!("内部错误: {}", msg)
            }
        }
    }
}
