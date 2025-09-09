use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio_modbus::{prelude::*, server::tcp::Server};

/// 模拟Modbus服务器，用于测试
pub struct MockModbusServer {
    port: u16,
    registers: Arc<Mutex<HashMap<u16, u16>>>,
    server_handle: Option<tokio::task::JoinHandle<()>>,
    addr: Option<SocketAddr>,
}

impl MockModbusServer {
    /// 创建新的模拟Modbus服务器
    pub fn new() -> Self {
        Self {
            port: 0, // 让系统选择可用端口
            registers: Arc::new(Mutex::new(HashMap::new())),
            server_handle: None,
            addr: None,
        }
    }

    /// 启动模拟服务器
    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let addr = listener.local_addr()?;
        self.addr = Some(addr);
        self.port = addr.port();

        let registers = Arc::clone(&self.registers);
        
        let handle = tokio::spawn(async move {
            let service = MockModbusService::new(registers);
            let server = Server::new(listener);
            if let Err(e) = server.serve(&service).await {
                eprintln!("模拟Modbus服务器错误: {}", e);
            }
        });

        self.server_handle = Some(handle);
        
        // 等待服务器启动
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        Ok(())
    }

    /// 获取服务器端口
    pub fn port(&self) -> u16 {
        self.port
    }

    /// 获取服务器地址
    pub fn addr(&self) -> Option<SocketAddr> {
        self.addr
    }

    /// 设置寄存器值
    pub fn set_register(&self, addr: u16, value: u16) {
        let mut registers = self.registers.lock().unwrap();
        registers.insert(addr, value);
    }

    /// 设置多个寄存器
    pub fn set_registers(&self, start_addr: u16, values: &[u16]) {
        let mut registers = self.registers.lock().unwrap();
        for (i, &value) in values.iter().enumerate() {
            registers.insert(start_addr + i as u16, value);
        }
    }

    /// 获取寄存器值
    pub fn get_register(&self, addr: u16) -> Option<u16> {
        let registers = self.registers.lock().unwrap();
        registers.get(&addr).copied()
    }

    /// 清空所有寄存器
    pub fn clear_registers(&self) {
        let mut registers = self.registers.lock().unwrap();
        registers.clear();
    }

    /// 停止服务器
    pub async fn stop(&mut self) {
        if let Some(handle) = self.server_handle.take() {
            handle.abort();
            // 等待handle完成或被中止
            let _ = handle.await;
        }
    }
}

impl Drop for MockModbusServer {
    fn drop(&mut self) {
        if let Some(handle) = &self.server_handle {
            handle.abort();
        }
    }
}

/// 模拟Modbus服务实现
struct MockModbusService {
    registers: Arc<Mutex<HashMap<u16, u16>>>,
}

impl MockModbusService {
    fn new(registers: Arc<Mutex<HashMap<u16, u16>>>) -> Self {
        Self { registers }
    }
}

impl tokio_modbus::server::Service for MockModbusService {
    type Request = Request;
    type Response = Response;
    type Error = std::io::Error;
    type Future = futures::future::Ready<Result<Self::Response, Self::Error>>;

    fn call(&self, req: Self::Request) -> Self::Future {
        let response = match req {
            Request::ReadHoldingRegisters(addr, cnt) => {
                let registers = self.registers.lock().unwrap();
                let mut values = Vec::new();
                
                for i in 0..cnt {
                    let reg_addr = addr + i;
                    let value = registers.get(&reg_addr).copied().unwrap_or(0);
                    values.push(value);
                }
                
                Response::ReadHoldingRegisters(values)
            }
            Request::ReadInputRegisters(addr, cnt) => {
                let registers = self.registers.lock().unwrap();
                let mut values = Vec::new();
                
                for i in 0..cnt {
                    let reg_addr = addr + i;
                    let value = registers.get(&reg_addr).copied().unwrap_or(0);
                    values.push(value);
                }
                
                Response::ReadInputRegisters(values)
            }
            Request::WriteSingleRegister(addr, value) => {
                let mut registers = self.registers.lock().unwrap();
                registers.insert(addr, value);
                Response::WriteSingleRegister(addr, value)
            }
            Request::WriteMultipleRegisters(addr, values) => {
                let mut registers = self.registers.lock().unwrap();
                for (i, &value) in values.iter().enumerate() {
                    registers.insert(addr + i as u16, value);
                }
                Response::WriteMultipleRegisters(addr, values.len() as u16)
            }
            _ => {
                return futures::future::ready(Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "不支持的Modbus功能码",
                )));
            }
        };

        futures::future::ready(Ok(response))
    }
}

/// 测试工具函数
pub mod utils {
    use super::*;
    use std::time::{Duration, Instant};

    /// 等待条件满足，带超时
    pub async fn wait_for_condition<F>(mut condition: F, timeout: Duration) -> bool
    where
        F: FnMut() -> bool,
    {
        let start = Instant::now();
        while start.elapsed() < timeout {
            if condition() {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        false
    }

    /// 生成测试用的随机寄存器数据
    pub fn generate_test_registers(start: u16, count: u16) -> HashMap<u16, u16> {
        let mut registers = HashMap::new();
        for i in 0..count {
            registers.insert(start + i, rand::random::<u16>());
        }
        registers
    }

    /// 创建测试用的Modbus配置
    pub fn create_test_config(port: u16) -> modbus_reader::modbus::ModbusConfig {
        modbus_reader::modbus::ModbusConfig {
            ip: "127.0.0.1".to_string(),
            port,
            timeout_ms: 1000,
            slave_id: 1,
        }
    }

    /// 验证两个寄存器值数组是否相等
    pub fn assert_registers_equal(expected: &[u16], actual: &[u16]) {
        assert_eq!(expected.len(), actual.len(), "寄存器数量不匹配");
        for (i, (&expected_val, &actual_val)) in expected.iter().zip(actual.iter()).enumerate() {
            assert_eq!(expected_val, actual_val, "寄存器{}的值不匹配", i);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_mock_server_start_stop() {
        let mut server = MockModbusServer::new();
        
        // 启动服务器
        assert!(server.start().await.is_ok());
        assert!(server.port() > 0);
        assert!(server.addr().is_some());
        
        // 停止服务器
        server.stop().await;
    }

    #[tokio::test]
    async fn test_mock_server_register_operations() {
        let server = MockModbusServer::new();
        
        // 测试设置和获取单个寄存器
        server.set_register(100, 1234);
        assert_eq!(server.get_register(100), Some(1234));
        
        // 测试设置多个寄存器
        let values = [100, 200, 300];
        server.set_registers(200, &values);
        
        assert_eq!(server.get_register(200), Some(100));
        assert_eq!(server.get_register(201), Some(200));
        assert_eq!(server.get_register(202), Some(300));
        
        // 测试清空寄存器
        server.clear_registers();
        assert_eq!(server.get_register(100), None);
        assert_eq!(server.get_register(200), None);
    }

    #[test]
    fn test_utils_generate_test_registers() {
        let registers = utils::generate_test_registers(100, 5);
        assert_eq!(registers.len(), 5);
        
        for i in 0..5 {
            assert!(registers.contains_key(&(100 + i)));
        }
    }

    #[test]
    fn test_utils_create_test_config() {
        let config = utils::create_test_config(502);
        assert_eq!(config.ip, "127.0.0.1");
        assert_eq!(config.port, 502);
        assert_eq!(config.timeout_ms, 1000);
        assert_eq!(config.slave_id, 1);
    }

    #[test]
    fn test_utils_assert_registers_equal() {
        let expected = [100, 200, 300];
        let actual = [100, 200, 300];
        
        utils::assert_registers_equal(&expected, &actual);
    }

    #[test]
    #[should_panic(expected = "寄存器数量不匹配")]
    fn test_utils_assert_registers_equal_different_lengths() {
        let expected = [100, 200];
        let actual = [100, 200, 300];
        
        utils::assert_registers_equal(&expected, &actual);
    }

    #[test]
    #[should_panic(expected = "寄存器1的值不匹配")]
    fn test_utils_assert_registers_equal_different_values() {
        let expected = [100, 200];
        let actual = [100, 300];
        
        utils::assert_registers_equal(&expected, &actual);
    }
}