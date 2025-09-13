import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AddressRangeProvider, useAddressRangeContext } from '../AddressRangeContext';

// 测试组件
const TestComponent = () => {
  const context = useAddressRangeContext();
  return (
    <div>
      <span data-testid="ranges-count">{context.ranges.length}</span>
      <span data-testid="total-addresses">{context.totalAddresses}</span>
      <button
        data-testid="export-config"
        onClick={() => {
          const config = context.exportConfig();
          (window as any).testExportResult = config;
        }}
      >
        Export
      </button>
      <button
        data-testid="import-config"
        onClick={() => {
          const testConfig = JSON.stringify({
            version: "1.0",
            address_ranges: [
              {
                name: "Test Range",
                start_address: 40001,
                count: 5,
                data_type: "uint16",
                enabled: true
              }
            ]
          });
          const result = context.importConfig(testConfig);
          (window as any).testImportResult = result;
        }}
      >
        Import
      </button>
      <button
        data-testid="preview-config"
        onClick={() => {
          const testConfig = JSON.stringify({
            version: "1.0",
            address_ranges: [
              {
                name: "Preview Range",
                start_address: 40010,
                count: 3,
                data_type: "float32",
                enabled: true
              }
            ]
          });
          const result = context.previewConfig(testConfig);
          (window as any).testPreviewResult = result;
        }}
      >
        Preview
      </button>
      <button
        data-testid="generate-template"
        onClick={() => {
          const template = context.generateTemplate();
          (window as any).testTemplateResult = template;
        }}
      >
        Template
      </button>
    </div>
  );
};

describe('AddressRangeContext - JSON Import/Export', () => {
  beforeEach(() => {
    // 清理localStorage
    localStorage.clear();
    // 清理测试结果
    delete (window as any).testExportResult;
    delete (window as any).testImportResult;
    delete (window as any).testPreviewResult;
    delete (window as any).testTemplateResult;
  });

  it('应该能够导出空配置', async () => {
    render(
      <AddressRangeProvider>
        <TestComponent />
      </AddressRangeProvider>
    );

    const exportButton = screen.getByTestId('export-config');
    act(() => {
      exportButton.click();
    });

    const result = (window as any).testExportResult;
    expect(result).toBeDefined();
    
    const config = JSON.parse(result);
    expect(config).toHaveProperty('version', '1.0');
    expect(config).toHaveProperty('export_date');
    expect(config).toHaveProperty('description');
    expect(config).toHaveProperty('address_ranges');
    expect(config).toHaveProperty('metadata');
    expect(config.address_ranges).toHaveLength(0);
    expect(config.metadata.total_ranges).toBe(0);
    expect(config.metadata.total_addresses).toBe(0);
  });

  it('应该能够导入新格式的JSON配置', async () => {
    render(
      <AddressRangeProvider>
        <TestComponent />
      </AddressRangeProvider>
    );

    const importButton = screen.getByTestId('import-config');
    act(() => {
      importButton.click();
    });

    const result = (window as any).testImportResult;
    expect(result).toBe(true);

    // 验证地址段已添加
    const rangesCount = screen.getByTestId('ranges-count');
    expect(rangesCount.textContent).toBe('1');

    const totalAddresses = screen.getByTestId('total-addresses');
    expect(totalAddresses.textContent).toBe('5');
  });

  it('应该能够预览配置文件', async () => {
    render(
      <AddressRangeProvider>
        <TestComponent />
      </AddressRangeProvider>
    );

    const previewButton = screen.getByTestId('preview-config');
    act(() => {
      previewButton.click();
    });

    const result = (window as any).testPreviewResult;
    expect(result).toBeDefined();
    expect(result.isValid).toBe(true);
    expect(result.ranges).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    
    const range = result.ranges[0];
    expect(range.name).toBe('Preview Range');
    expect(range.startAddress).toBe(40010);
    expect(range.length).toBe(3);
    expect(range.dataType).toBe('float32');
    expect(range.enabled).toBe(true);
  });

  it('应该能够生成配置模板', async () => {
    render(
      <AddressRangeProvider>
        <TestComponent />
      </AddressRangeProvider>
    );

    const templateButton = screen.getByTestId('generate-template');
    act(() => {
      templateButton.click();
    });

    const result = (window as any).testTemplateResult;
    expect(result).toBeDefined();
    
    const template = JSON.parse(result);
    expect(template).toHaveProperty('version', '1.0');
    expect(template).toHaveProperty('export_date');
    expect(template).toHaveProperty('description');
    expect(template).toHaveProperty('address_ranges');
    expect(template).toHaveProperty('metadata');
    expect(template).toHaveProperty('usage_notes');
    
    expect(template.address_ranges).toHaveLength(3);
    expect(template.usage_notes).toBeInstanceOf(Array);
    expect(template.metadata.total_ranges).toBe(3);
  });

  it('应该能够处理无效的JSON格式', async () => {
    const TestInvalidJsonComponent = () => {
      const context = useAddressRangeContext();
      
      const handlePreviewInvalid = () => {
        const invalidJson = "{ invalid json }";
        const result = context.previewConfig(invalidJson);
        (window as any).testInvalidJsonResult = result;
      };

      return (
        <button data-testid="preview-invalid" onClick={handlePreviewInvalid}>
          Preview Invalid
        </button>
      );
    };

    render(
      <AddressRangeProvider>
        <TestInvalidJsonComponent />
      </AddressRangeProvider>
    );

    const previewButton = screen.getByTestId('preview-invalid');
    act(() => {
      previewButton.click();
    });

    const result = (window as any).testInvalidJsonResult;
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('JSON 格式错误');
    expect(result.ranges).toHaveLength(0);
  });

  it('应该支持旧格式的配置文件', async () => {
    const TestImportComponent = () => {
      const context = useAddressRangeContext();
      
      // 旧格式配置
      const oldFormatConfig = {
        version: "1.0",
        ranges: [
          {
            name: "Old Format Range",
            startAddress: 40020,
            length: 4,
            dataType: "int16",
            enabled: true
          }
        ]
      };
      
      const handleImport = () => {
        const result = context.importConfig(JSON.stringify(oldFormatConfig));
        (window as any).testOldFormatResult = result;
      };

      return (
        <div>
          <span data-testid="ranges-count">{context.ranges.length}</span>
          <button data-testid="import-old-format" onClick={handleImport}>
            Import Old Format
          </button>
        </div>
      );
    };

    render(
      <AddressRangeProvider>
        <TestImportComponent />
      </AddressRangeProvider>
    );

    const importButton = screen.getByTestId('import-old-format');
    act(() => {
      importButton.click();
    });

    const result = (window as any).testOldFormatResult;
    expect(result).toBe(true);

    // 验证地址段已添加
    const rangesCount = screen.getByTestId('ranges-count');
    expect(rangesCount.textContent).toBe('1');
  });
});