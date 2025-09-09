#[cfg(test)]
mod tests {
    use crate::modbus::client::ModbusClient;
    use crate::modbus::types::AddressRange;

    #[test]
    fn test_address_range_with_data_type() {
        // 测试带数据类型的地址范围创建
        let range = AddressRange::new_with_type(0, 4, "float32");
        assert_eq!(range.start, 0);
        assert_eq!(range.count, 4);
        assert_eq!(range.data_type, "float32");
        assert!(range.is_valid());
    }

    #[test]
    fn test_address_range_default_data_type() {
        // 测试默认数据类型
        let range = AddressRange::new(0, 2);
        assert_eq!(range.data_type, "uint16");
    }

    #[test]
    fn test_float32_parsing() {
        // 测试 float32 解析逻辑
        // 使用已知的 IEEE 754 值进行测试
        // 0x40490FDB = 3.1415927410125732 (π 的近似值)
        let high_word: u16 = 0x4049;
        let low_word: u16 = 0x0FDB;
        
        // 组合成 32 位整数
        let raw_value = ((high_word as u32) << 16) | (low_word as u32);
        
        // 转换为 f32
        let float_value = f32::from_bits(raw_value);
        
        // 验证结果
        assert!((float_value - 3.1415927).abs() < 0.0001);
        
        // 测试字符串表示
        let parsed_str = float_value.to_string();
        assert!(parsed_str.starts_with("3.14159"));
    }

    #[test]
    fn test_create_address_result_float32() {
        // 测试创建带 float32 类型的地址结果
        let timestamp = "2024-01-01T00:00:00Z";
        let addr = 100;
        let value = 0x4049;
        let next_value = Some(0x0FDB);
        
        let result = ModbusClient::create_address_result(
            addr,
            value,
            "dec",
            timestamp,
            None,
            "float32",
            next_value,
        );
        
        assert_eq!(result.address, addr);
        assert_eq!(result.raw_value, 0x40490FDB);
        assert!(result.parsed_value.starts_with("3.14159"));
        assert_eq!(result.data_type, "float32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_uint16() {
        // 测试创建 uint16 类型的地址结果
        let timestamp = "2024-01-01T00:00:00Z";
        let addr = 100;
        let value = 1234;
        
        let result = ModbusClient::create_address_result(
            addr,
            value,
            "hex",
            timestamp,
            None,
            "uint16",
            None,
        );
        
        assert_eq!(result.address, addr);
        assert_eq!(result.raw_value, 1234);
        assert_eq!(result.parsed_value, "0x04D2");
        assert_eq!(result.data_type, "uint16");
        assert!(result.success);
    }

    #[test]
    fn test_float32_special_values() {
        // 测试特殊的 float32 值
        
        // 测试 0.0
        let zero_bits = 0x00000000u32;
        let zero = f32::from_bits(zero_bits);
        assert_eq!(zero, 0.0);
        
        // 测试 NaN
        let nan_bits = 0x7FC00000u32;
        let nan = f32::from_bits(nan_bits);
        assert!(nan.is_nan());
        
        // 测试正无穷
        let inf_bits = 0x7F800000u32;
        let inf = f32::from_bits(inf_bits);
        assert!(inf.is_infinite() && inf.is_sign_positive());
        
        // 测试负无穷
        let neg_inf_bits = 0xFF800000u32;
        let neg_inf = f32::from_bits(neg_inf_bits);
        assert!(neg_inf.is_infinite() && neg_inf.is_sign_negative());
    }

    #[test]
    fn test_float32_edge_cases() {
        // 测试 float32 的边界情况
        
        // 最大正浮点数
        let max_float_bits = 0x7F7FFFFFu32;
        let max_float = f32::from_bits(max_float_bits);
        assert!(max_float > 0.0 && max_float.is_finite());
        
        // 最小正非零浮点数
        let min_float_bits = 0x00000001u32;
        let min_float = f32::from_bits(min_float_bits);
        assert!(min_float > 0.0 && min_float < 1e-38);
        
        // 测试 -0.0
        let neg_zero_bits = 0x80000000u32;
        let neg_zero = f32::from_bits(neg_zero_bits);
        assert_eq!(neg_zero, -0.0);
    }

    #[test]
    fn test_create_address_result_uint32() {
        // 测试创建 uint32 类型的地址结果
        let timestamp = "2024-01-01T00:00:00Z";
        let addr = 100;
        let value = 0x1234;
        let next_value = Some(0x5678);
        
        let result = ModbusClient::create_address_result(
            addr,
            value,
            "dec",
            timestamp,
            None,
            "uint32",
            next_value,
        );
        
        assert_eq!(result.address, addr);
        assert_eq!(result.raw_value, 0x12345678);
        assert_eq!(result.parsed_value, "305419896");
        assert_eq!(result.data_type, "uint32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_int32() {
        // 测试创建 int32 类型的地址结果
        let timestamp = "2024-01-01T00:00:00Z";
        let addr = 100;
        let value = 0xFFFF;
        let next_value = Some(0xFFFF);
        
        let result = ModbusClient::create_address_result(
            addr,
            value,
            "dec",
            timestamp,
            None,
            "int32",
            next_value,
        );
        
        assert_eq!(result.address, addr);
        assert_eq!(result.raw_value, 0xFFFFFFFF);
        assert_eq!(result.parsed_value, "-1");
        assert_eq!(result.data_type, "int32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_uint32_no_next_value() {
        // 测试 uint32 类型但没有下一个值的情况
        let timestamp = "2024-01-01T00:00:00Z";
        let addr = 100;
        let value = 0x1234;
        let next_value = None;
        
        let result = ModbusClient::create_address_result(
            addr,
            value,
            "dec",
            timestamp,
            None,
            "uint32",
            next_value,
        );
        
        assert_eq!(result.address, addr);
        assert_eq!(result.raw_value, 0x1234);
        assert_eq!(result.parsed_value, "4660");
        assert_eq!(result.data_type, "uint16");
        assert!(result.success);
    }
}