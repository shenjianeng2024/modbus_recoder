# Issue #006 Work Stream Analysis

## Issue: 单次读取功能实现

### Summary
实现单次Modbus数据读取功能，用户可以立即读取配置的地址段数据并在界面上查看结果。

### Dependencies Status ✅
- ✅ **Task 002 (Modbus核心功能)**: 后端client.rs, manager.rs已实现
- ✅ **Task 003 (连接配置)**: ConnectionConfig.tsx已实现
- ✅ **Task 005 (地址范围管理)**: AddressRangeManager.tsx已实现

### Work Streams

由于任务标记为`parallel: false`，但功能相对独立，我们可以将其拆分为3个串行阶段：

#### Stream 1: Backend Commands (后端命令层)
**Agent**: `rust-axum-backend-expert`
**Estimated Time**: 3-4小时
**Dependencies**: 无，可立即开始

**Files to modify**:
- `src-tauri/src/commands/reading.rs` (新建)
- `src-tauri/src/commands/mod.rs` (添加模块)
- `src-tauri/src/main.rs` (注册命令)

**Deliverables**:
- `read_modbus_ranges` Tauri命令
- `ReadResult` 数据结构定义
- 批量地址段读取逻辑
- 错误处理和状态管理

**Success Criteria**:
- Tauri命令可以从前端调用
- 支持读取多个地址段
- 返回标准化的ReadResult数据结构

#### Stream 2: Data Parser & Utils (数据解析层)
**Agent**: `tauri-shadcn-expert`
**Estimated Time**: 2-3小时
**Dependencies**: 需要Stream 1的数据结构定义

**Files to modify**:
- `src/utils/dataParser.ts` (新建)
- `src/types/modbus.ts` (扩展)
- `src/utils/__tests__/dataParser.test.ts` (新建)

**Deliverables**:
- Modbus数据解析器
- 数据格式化工具 (dec/hex/bin)
- 数据类型转换 (uint16, int16, float32等)
- 完整的单元测试

**Success Criteria**:
- 正确解析不同数据类型
- 格式化显示功能正常
- 测试覆盖率 >90%

#### Stream 3: DataReader Component (前端界面层)
**Agent**: `tauri-shadcn-expert` 
**Estimated Time**: 4-5小时
**Dependencies**: 需要Stream 1和Stream 2完成

**Files to modify**:
- `src/components/DataReader.tsx` (新建)
- `src/components/__tests__/DataReader.test.tsx` (新建)
- `src/App.tsx` (集成DataReader组件)
- `src/hooks/useReadHistory.ts` (新建，可选)

**Deliverables**:
- 完整的DataReader React组件
- 实时读取状态指示器
- 结果表格显示界面
- 数据格式切换功能
- 错误处理和显示

**Success Criteria**:
- 用户可以触发立即读取
- 读取结果在表格中正确显示
- 读取状态变化用户可见
- 错误信息清晰易懂

### Total Estimated Time: 9-12小时 (串行执行)

### Risk Assessment
- **Low Risk**: 所有依赖已满足，架构清晰
- **技术风险**: 数据解析器的正确性需要仔细测试
- **集成风险**: 前后端数据结构需要保持一致

### Testing Strategy
- **Unit Tests**: dataParser.ts, reading.rs
- **Component Tests**: DataReader.tsx
- **Integration Tests**: 完整读取流程
- **Manual Tests**: 真实设备读取测试

### Implementation Notes
- 保持数据结构简单且一致
- 优先实现核心功能，后续迭代增强
- 错误处理要用户友好
- 性能要求：<2秒完成常规读取