---
last_sync: 2025-09-10T04:07:26Z
name: modbus_reader
status: backlog
created: 2025-09-09T04:07:07Z
progress: 0%
prd: .claude/prds/modbus_reader.md
github: https://github.com/shenjianeng2024/modbus_recoder/issues/1
---

# Epic: modbus_reader

## Overview

modbus_reader是一个基于Tauri + React + shadcn + Rust构建的桌面应用，专为实验室环境的Modbus TCP/IP设备数据采集而设计。核心特色是双模式操作：单次读取用于设备验证，批量采集用于长期数据记录，数据导出为CSV格式便于分析。

## Architecture Decisions

### 关键技术决策
- **跨平台桌面应用**: 使用Tauri框架确保Windows/macOS/Linux兼容性
- **前后端分离**: React前端处理UI交互，Rust后端负责Modbus通信
- **异步I/O**: 使用tokio-modbus实现非阻塞的网络通信
- **本地优先**: 数据存储在本地文件系统，避免外部数据库依赖
- **组件化UI**: 使用shadcn/ui确保一致的用户体验

### 技术栈选择
- **前端**: React 19 + TypeScript + shadcn/ui + Tailwind CSS
- **后端**: Rust + Tauri + tokio-modbus + tokio runtime
- **构建工具**: pnpm + Vite + Tauri CLI
- **状态管理**: React hooks (useState, useReducer) + Context API
- **数据格式**: CSV导出 + JSON内存存储

### 设计模式
- **命令模式**: Tauri命令处理前后端通信
- **观察者模式**: 采集状态变更通知机制
- **策略模式**: 单次读取vs批量采集的不同处理策略
- **工厂模式**: Modbus连接和请求的统一创建

## Technical Approach

### Frontend Components
```
├── src/
│   ├── components/
│   │   ├── ConnectionConfig.tsx    # IP/端口配置
│   │   ├── AddressRangeManager.tsx # 地址段管理
│   │   ├── DataReader.tsx          # 单次读取界面
│   │   ├── DataCollector.tsx       # 批量采集界面
│   │   └── DataExporter.tsx        # CSV导出界面
│   ├── hooks/
│   │   ├── useModbusConnection.ts  # 连接状态管理
│   │   ├── useDataCollection.ts    # 采集状态管理
│   │   └── useErrorHandler.ts      # 错误处理
│   ├── types/
│   │   └── modbus.ts               # TypeScript类型定义
│   └── utils/
│       ├── validation.ts           # 输入验证
│       └── formatters.ts           # 数据格式化
```

### Backend Services
```rust
// src-tauri/src/
├── modbus/
│   ├── client.rs          # Modbus TCP客户端
│   ├── collector.rs       # 数据采集服务
│   └── types.rs           # 数据类型定义
├── storage/
│   ├── csv_writer.rs      # CSV导出功能
│   └── memory_store.rs    # 内存数据存储
├── commands/
│   ├── connection.rs      # 连接相关命令
│   ├── reading.rs         # 读取相关命令
│   └── collection.rs      # 采集相关命令
└── error.rs               # 错误处理
```

### 状态管理策略
- **连接状态**: Connected/Disconnected/Connecting
- **采集状态**: Idle/Running/Paused/Error
- **数据状态**: 实时数据 + 历史记录分离管理
- **UI状态**: 表单验证 + 加载指示器

### 数据流设计
1. **单次读取流**: UI配置 → Tauri命令 → Modbus请求 → 结果返回 → UI显示
2. **批量采集流**: UI启动 → 后台任务 → 定时采集 → 内存缓存 → CSV导出
3. **错误处理流**: 异常捕获 → 错误分类 → 用户提示 → 自动重试

### Infrastructure

#### 部署考虑
- **打包方式**: Tauri生成原生可执行文件，无需额外运行时
- **依赖管理**: 静态链接减少外部依赖
- **更新机制**: 预留Tauri自动更新能力

#### 性能优化
- **异步处理**: 网络I/O不阻塞UI线程
- **内存管理**: 大量采集数据的分批写入和清理
- **连接池**: 复用Modbus TCP连接减少开销

#### 监控和可观测性
- **日志记录**: 结构化日志记录关键操作
- **错误追踪**: 详细的错误上下文和堆栈信息
- **性能指标**: 采集频率、响应时间、错误率

## Implementation Strategy

### 开发阶段
1. **Phase 1 - 基础架构**: 项目搭建 + 基本UI框架 + Modbus连接
2. **Phase 2 - 核心功能**: 单次读取 + 地址管理 + 基本错误处理
3. **Phase 3 - 高级功能**: 批量采集 + CSV导出 + 状态持久化
4. **Phase 4 - 优化完善**: 错误处理完善 + 性能优化 + 用户体验

### 风险缓解
- **技术风险**: 创建最小可行原型验证tokio-modbus兼容性
- **集成风险**: 渐进式集成，每个功能独立测试
- **用户体验风险**: 早期用户反馈，迭代改进界面设计

### 测试策略
- **单元测试**: Rust后端逻辑测试
- **集成测试**: 前后端通信测试
- **端到端测试**: 真实Modbus设备测试
- **跨平台测试**: 主要操作系统兼容性验证

## Task Breakdown Preview

高级任务类别分解（≤10个核心任务）：

- [ ] **项目初始化**: Tauri + React + shadcn项目搭建，开发环境配置
- [ ] **Modbus核心功能**: tokio-modbus集成，基础连接和读取功能
- [ ] **连接配置界面**: IP/端口配置，连接状态显示，输入验证
- [ ] **地址范围管理**: 多地址段配置，验证逻辑，UI交互
- [ ] **单次读取功能**: 即时读取，结果显示，错误处理
- [ ] **批量采集引擎**: 后台任务，定时采集，状态管理
- [ ] **数据存储和导出**: CSV格式化，文件写入，导出界面
- [ ] **错误处理系统**: 统一错误处理，用户友好提示，自动重试
- [ ] **用户界面优化**: shadcn组件集成，响应式设计，状态指示器
- [ ] **测试和部署**: 跨平台测试，打包配置，文档完善

## Dependencies

### 外部服务依赖
- **无外部服务依赖**: 完全本地运行，减少依赖复杂性

### 内部团队依赖
- **前端开发**: React + TypeScript + shadcn/ui熟练度
- **后端开发**: Rust + Tauri + 异步编程经验  
- **测试工程**: 跨平台测试环境和真实Modbus设备

### 技术先决条件
- 开发环境: Node.js 16+, Rust 1.70+, Tauri CLI
- 测试设备: Modbus TCP/IP兼容设备或模拟器

## Success Criteria (Technical)

### 性能基准
- **启动时间**: <3秒完成应用加载
- **连接建立**: <2秒完成Modbus TCP连接
- **读取响应**: <100ms完成单次地址段读取
- **采集精度**: 时间戳误差<10ms
- **内存使用**: 长期运行<100MB内存占用

### 质量门控
- **代码覆盖率**: >80%单元测试覆盖率
- **错误处理**: 100%已知错误场景有用户友好提示
- **跨平台兼容**: Windows/macOS/Linux三平台功能一致性
- **稳定性**: 24小时连续采集无崩溃

### 验收标准
- [ ] 成功连接标准Modbus TCP/IP设备
- [ ] 准确读取和显示地址数据
- [ ] CSV导出包含完整时间戳和数据
- [ ] 网络中断后自动重连成功
- [ ] 用户在30分钟内完成基本操作

## Estimated Effort

### 整体时间估算
- **开发时间**: 4-6周（1名全栈开发者）
- **测试时间**: 1-2周（包括跨平台测试）
- **文档时间**: 1周（用户手册和技术文档）

### 资源需求
- **开发资源**: 1名熟悉Rust+React的全栈开发者
- **测试资源**: 跨平台测试环境 + Modbus测试设备
- **项目管理**: 敏捷开发，每周迭代

### 关键路径项目
1. **tokio-modbus集成验证** (高风险，需早期验证)
2. **异步数据采集架构** (技术复杂度高)
3. **跨平台兼容性测试** (需要多环境支持)
4. **用户界面响应性优化** (影响用户体验)

### 里程碑检查点
- **Week 2**: 基础项目搭建，Modbus连接成功
- **Week 4**: 单次读取和基础UI完成
- **Week 6**: 批量采集和CSV导出完成
- **Week 8**: 测试完成，准备部署

## Tasks Created

- [ ] 002.md - 项目初始化和开发环境搭建 (GitHub: [#2](https://github.com/shenjianeng2024/modbus_recoder/issues/2), parallel: true)
- [ ] 003.md - Modbus核心功能实现 (GitHub: [#3](https://github.com/shenjianeng2024/modbus_recoder/issues/3), parallel: false)
- [ ] 004.md - 连接配置界面开发 (GitHub: [#4](https://github.com/shenjianeng2024/modbus_recoder/issues/4), parallel: false)
- [ ] 005.md - 地址范围管理功能 (GitHub: [#5](https://github.com/shenjianeng2024/modbus_recoder/issues/5), parallel: true)
- [ ] 006.md - 单次读取功能实现 (GitHub: [#6](https://github.com/shenjianeng2024/modbus_recoder/issues/6), parallel: false)
- [ ] 007.md - 批量数据采集引擎 (GitHub: [#7](https://github.com/shenjianeng2024/modbus_recoder/issues/7), parallel: false)
- [ ] 008.md - 数据存储和CSV导出 (GitHub: [#8](https://github.com/shenjianeng2024/modbus_recoder/issues/8), parallel: true)
- [ ] 009.md - 错误处理和用户体验优化 (GitHub: [#9](https://github.com/shenjianeng2024/modbus_recoder/issues/9), parallel: true)
- [ ] 010.md - 测试框架和质量保证 (GitHub: [#10](https://github.com/shenjianeng2024/modbus_recoder/issues/10), parallel: true)
- [ ] 011.md - 应用打包和部署优化 (GitHub: [#11](https://github.com/shenjianeng2024/modbus_recoder/issues/11), parallel: true)

**任务总数**: 10
**并行任务**: 6 (项目初始化、地址管理、数据导出、错误处理、测试、部署)
**串行任务**: 4 (Modbus核心、连接配置、单次读取、批量采集)
**预估总工作量**: 148-188小时
**关键路径**: 002 → 003 → 004/006 → 007