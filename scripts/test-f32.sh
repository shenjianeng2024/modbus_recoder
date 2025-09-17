#!/bin/bash

# 测试 f32 Modbus 读取功能的脚本
# 这个脚本演示如何使用 float32 数据类型读取

echo "开始测试 Modbus f32 浮点数读取功能..."

# 检查 Rust 编译
echo "1. 检查 Rust 代码编译..."
cd src-tauri
cargo check --quiet
if [ $? -eq 0 ]; then
    echo "✅ Rust 代码编译通过"
else
    echo "❌ Rust 代码编译失败"
    exit 1
fi

# 运行 Rust 测试
echo "2. 运行 Rust 单元测试..."
cargo test client_tests --quiet
if [ $? -eq 0 ]; then
    echo "✅ Rust 单元测试通过"
else
    echo "❌ Rust 单元测试失败"
    exit 1
fi

# 运行前端测试
echo "3. 运行前端测试..."
cd ..
pnpm test --run float32
if [ $? -eq 0 ]; then
    echo "✅ 前端测试通过"
else
    echo "❌ 前端测试失败"
    exit 1
fi

echo ""
echo "🎉 所有测试通过！f32 浮点数读取功能已实现"
echo ""
echo "使用示例："
echo "在读取地址范围时，设置 data_type 为 'float32' 即可读取浮点数"
echo "例如："
echo "```typescript"
echo "const range = {"
echo "  start: 100,"
echo "  count: 4,"     // 注意：float32 需要偶数个寄存器
echo "  data_type: 'float32'"
echo "};"
echo "```"
echo ""
echo "这将读取地址 100 和 101 的两个寄存器，组合成一个 32 位浮点数"