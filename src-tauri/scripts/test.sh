#!/bin/bash

# Rust后端测试运行脚本
# 用法: ./scripts/test.sh [test_type]
# test_type: unit, integration, bench, coverage, all (默认)

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否在正确的目录
check_directory() {
    if [[ ! -f "Cargo.toml" ]]; then
        print_error "请在src-tauri目录中运行此脚本"
        exit 1
    fi
}

# 安装测试依赖
install_dependencies() {
    print_info "检查并安装测试依赖..."
    
    # 检查cargo-tarpaulin是否安装
    if ! command -v cargo-tarpaulin &> /dev/null; then
        print_info "安装代码覆盖率工具 cargo-tarpaulin..."
        cargo install cargo-tarpaulin
    fi
    
    # 检查cargo-nextest是否安装（更快的测试运行器）
    if ! command -v cargo-nextest &> /dev/null; then
        print_info "安装高性能测试运行器 cargo-nextest..."
        cargo install cargo-nextest --locked
    fi
    
    print_success "依赖检查完成"
}

# 运行单元测试
run_unit_tests() {
    print_info "运行单元测试..."
    
    # 使用nextest运行测试（如果可用），否则使用标准cargo test
    if command -v cargo-nextest &> /dev/null; then
        print_info "使用cargo-nextest运行测试..."
        cargo nextest run --lib --bins
    else
        print_info "使用cargo test运行测试..."
        cargo test --lib --bins
    fi
    
    print_success "单元测试完成"
}

# 运行集成测试
run_integration_tests() {
    print_info "运行集成测试..."
    
    # 设置测试环境变量
    export RUST_LOG=debug
    export RUST_BACKTRACE=1
    
    if command -v cargo-nextest &> /dev/null; then
        cargo nextest run --tests --test-threads=1
    else
        cargo test --tests --test-threads=1
    fi
    
    print_success "集成测试完成"
}

# 运行基准测试
run_benchmarks() {
    print_info "运行性能基准测试..."
    
    # 确保在release模式下运行基准测试
    cargo bench --bench modbus_benchmarks
    
    print_info "基准测试报告已生成在 target/criterion/ 目录"
    print_success "基准测试完成"
}

# 运行代码覆盖率测试
run_coverage_tests() {
    print_info "运行代码覆盖率测试..."
    
    # 使用tarpaulin生成覆盖率报告
    cargo tarpaulin \
        --verbose \
        --all-features \
        --workspace \
        --timeout 120 \
        --out Html \
        --out Lcov \
        --output-dir target/coverage \
        --exclude-files "src/main.rs" \
        --exclude-files "build.rs" \
        --exclude-files "tests/*" \
        --exclude-files "benches/*" \
        --ignore-panics
    
    print_info "覆盖率报告已生成:"
    print_info "  - HTML报告: target/coverage/tarpaulin-report.html"
    print_info "  - LCOV报告: target/coverage/lcov.info"
    
    # 检查覆盖率是否达标
    coverage_percent=$(grep -oP 'covered":"\K[^"]*' target/coverage/tarpaulin-report.html | head -1 || echo "0")
    if (( $(echo "$coverage_percent >= 90" | bc -l) )); then
        print_success "代码覆盖率: $coverage_percent% (达标: ≥90%)"
    else
        print_warning "代码覆盖率: $coverage_percent% (未达标: <90%)"
        print_warning "请增加测试用例以提高覆盖率"
    fi
}

# 运行代码质量检查
run_quality_checks() {
    print_info "运行代码质量检查..."
    
    # Clippy检查
    print_info "运行Clippy静态分析..."
    cargo clippy --all-targets --all-features -- -D warnings
    
    # 格式检查
    print_info "检查代码格式..."
    cargo fmt -- --check
    
    # 安全漏洞检查（如果安装了cargo-audit）
    if command -v cargo-audit &> /dev/null; then
        print_info "运行安全审计..."
        cargo audit
    fi
    
    print_success "代码质量检查完成"
}

# 清理测试产物
clean_test_artifacts() {
    print_info "清理测试产物..."
    
    cargo clean
    rm -rf target/coverage
    rm -rf target/criterion
    
    print_success "清理完成"
}

# 生成测试报告
generate_test_report() {
    print_info "生成测试报告..."
    
    local report_file="target/test_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# Rust后端测试报告

**生成时间:** $(date '+%Y-%m-%d %H:%M:%S')
**Git提交:** $(git rev-parse --short HEAD 2>/dev/null || echo "未知")
**Git分支:** $(git branch --show-current 2>/dev/null || echo "未知")

## 测试环境

- **Rust版本:** $(rustc --version)
- **Cargo版本:** $(cargo --version)
- **操作系统:** $(uname -s) $(uname -r)

## 测试结果概要

EOF

    # 如果有覆盖率数据，添加到报告
    if [[ -f "target/coverage/tarpaulin-report.html" ]]; then
        echo "## 代码覆盖率" >> "$report_file"
        echo "" >> "$report_file"
        coverage_percent=$(grep -oP 'covered":"\K[^"]*' target/coverage/tarpaulin-report.html | head -1 || echo "未知")
        echo "- **总体覆盖率:** $coverage_percent%" >> "$report_file"
        echo "- **HTML报告:** target/coverage/tarpaulin-report.html" >> "$report_file"
        echo "" >> "$report_file"
    fi

    # 添加基准测试信息
    if [[ -d "target/criterion" ]]; then
        echo "## 性能基准测试" >> "$report_file"
        echo "" >> "$report_file"
        echo "- **基准测试报告:** target/criterion/index.html" >> "$report_file"
        echo "" >> "$report_file"
    fi

    print_success "测试报告已生成: $report_file"
}

# 主函数
main() {
    check_directory
    
    local test_type="${1:-all}"
    
    print_info "开始运行Rust后端测试套件..."
    print_info "测试类型: $test_type"
    
    case "$test_type" in
        "unit")
            install_dependencies
            run_quality_checks
            run_unit_tests
            ;;
        "integration")
            install_dependencies
            run_integration_tests
            ;;
        "bench")
            install_dependencies
            run_benchmarks
            ;;
        "coverage")
            install_dependencies
            run_unit_tests
            run_integration_tests
            run_coverage_tests
            ;;
        "quality")
            run_quality_checks
            ;;
        "clean")
            clean_test_artifacts
            ;;
        "all")
            install_dependencies
            run_quality_checks
            run_unit_tests
            run_integration_tests
            run_benchmarks
            run_coverage_tests
            generate_test_report
            ;;
        *)
            print_error "未知的测试类型: $test_type"
            print_info "可用选项: unit, integration, bench, coverage, quality, clean, all"
            exit 1
            ;;
    esac
    
    print_success "测试套件执行完成!"
}

# 脚本入口
main "$@"