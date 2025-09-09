import { describe, it, expect } from 'vitest'
import {
  validateAddressRange,
  detectRangeOverlaps,
  isValidRangeLength,
  getEndAddress,
  formatAddressRange,
  calculateTotalAddresses,
  generateRangeId,
  DATA_TYPE_LABELS,
  ADDRESS_RANGE_TEMPLATES,
} from '../addressValidation'
import { ManagedAddressRange } from '../../types/modbus'

describe('Address Validation Utils', () => {
  describe('validateAddressRange', () => {
    it('应该验证正确的地址段', () => {
      const validRange: ManagedAddressRange = {
        id: 'test-1',
        name: '测试地址段',
        startAddress: 1000,
        length: 10,
        dataType: 'uint16',
        enabled: true,
      }
      
      const result = validateAddressRange(validRange)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('应该检测起始地址过小的错误', () => {
      const invalidRange: ManagedAddressRange = {
        id: 'test-1',
        name: '无效地址段',
        startAddress: 0,
        length: 10,
        dataType: 'uint16',
        enabled: true,
      }
      
      const result = validateAddressRange(invalidRange)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('起始地址不能小于 1')
    })

    it('应该检测起始地址过大的错误', () => {
      const invalidRange: ManagedAddressRange = {
        id: 'test-1',
        name: '无效地址段',
        startAddress: 70000,
        length: 10,
        dataType: 'uint16',
        enabled: true,
      }
      
      const result = validateAddressRange(invalidRange)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('起始地址不能大于 65535')
    })

    it('应该检测长度过小的错误', () => {
      const invalidRange: ManagedAddressRange = {
        id: 'test-1',
        name: '无效地址段',
        startAddress: 1000,
        length: 0,
        dataType: 'uint16',
        enabled: true,
      }
      
      const result = validateAddressRange(invalidRange)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('地址段长度必须大于 0')
    })

    it('应该检测长度过大的错误', () => {
      const invalidRange: ManagedAddressRange = {
        id: 'test-1',
        name: '无效地址段',
        startAddress: 1000,
        length: 150,
        dataType: 'uint16',
        enabled: true,
      }
      
      const result = validateAddressRange(invalidRange)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('地址段长度不能超过 120')
    })

    it('应该检测结束地址超出范围的错误', () => {
      const invalidRange: ManagedAddressRange = {
        id: 'test-1',
        name: '无效地址段',
        startAddress: 65530,
        length: 10,
        dataType: 'uint16',
        enabled: true,
      }
      
      const result = validateAddressRange(invalidRange)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('结束地址 (65539) 超出最大地址范围 (65535)')
    })

    it('应该检测空名称的警告', () => {
      const rangeWithEmptyName: ManagedAddressRange = {
        id: 'test-1',
        name: '   ',
        startAddress: 1000,
        length: 10,
        dataType: 'uint16',
        enabled: true,
      }
      
      const result = validateAddressRange(rangeWithEmptyName)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('地址段名称不能为空字符串')
    })

    it('应该检测大长度的性能警告', () => {
      const largeRange: ManagedAddressRange = {
        id: 'test-1',
        name: '大地址段',
        startAddress: 1000,
        length: 110,
        dataType: 'uint16',
        enabled: true,
      }
      
      const result = validateAddressRange(largeRange)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('地址段长度较大，可能影响读取性能')
    })

    it('应该同时检测多个错误', () => {
      const multiErrorRange: ManagedAddressRange = {
        id: 'test-1',
        name: '多错误地址段',
        startAddress: 0,
        length: -5,
        dataType: 'uint16',
        enabled: true,
      }
      
      const result = validateAddressRange(multiErrorRange)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
      expect(result.errors).toContain('起始地址不能小于 1')
      expect(result.errors).toContain('地址段长度必须大于 0')
    })
  })

  describe('detectRangeOverlaps', () => {
    it('应该检测到重叠的地址段', () => {
      const ranges: ManagedAddressRange[] = [
        {
          id: 'range-1',
          name: '地址段1',
          startAddress: 1000,
          length: 10,
          dataType: 'uint16',
          enabled: true,
        },
        {
          id: 'range-2',
          name: '地址段2',
          startAddress: 1005,
          length: 10,
          dataType: 'uint16',
          enabled: true,
        },
      ]
      
      const result = detectRangeOverlaps(ranges)
      
      expect(result.hasOverlap).toBe(true)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].overlapStart).toBe(1005)
      expect(result.conflicts[0].overlapEnd).toBe(1009)
    })

    it('应该检测没有重叠的地址段', () => {
      const ranges: ManagedAddressRange[] = [
        {
          id: 'range-1',
          name: '地址段1',
          startAddress: 1000,
          length: 10,
          dataType: 'uint16',
          enabled: true,
        },
        {
          id: 'range-2',
          name: '地址段2',
          startAddress: 1020,
          length: 10,
          dataType: 'uint16',
          enabled: true,
        },
      ]
      
      const result = detectRangeOverlaps(ranges)
      
      expect(result.hasOverlap).toBe(false)
      expect(result.conflicts).toHaveLength(0)
    })

    it('应该忽略禁用的地址段', () => {
      const ranges: ManagedAddressRange[] = [
        {
          id: 'range-1',
          name: '地址段1',
          startAddress: 1000,
          length: 10,
          dataType: 'uint16',
          enabled: true,
        },
        {
          id: 'range-2',
          name: '地址段2',
          startAddress: 1005,
          length: 10,
          dataType: 'uint16',
          enabled: false,
        },
      ]
      
      const result = detectRangeOverlaps(ranges)
      
      expect(result.hasOverlap).toBe(false)
      expect(result.conflicts).toHaveLength(0)
    })

    it('应该检测相邻地址段（无重叠）', () => {
      const ranges: ManagedAddressRange[] = [
        {
          id: 'range-1',
          name: '地址段1',
          startAddress: 1000,
          length: 10,
          dataType: 'uint16',
          enabled: true,
        },
        {
          id: 'range-2',
          name: '地址段2',
          startAddress: 1010,
          length: 10,
          dataType: 'uint16',
          enabled: true,
        },
      ]
      
      const result = detectRangeOverlaps(ranges)
      
      expect(result.hasOverlap).toBe(false)
      expect(result.conflicts).toHaveLength(0)
    })

    it('应该检测完全包含的地址段', () => {
      const ranges: ManagedAddressRange[] = [
        {
          id: 'range-1',
          name: '大地址段',
          startAddress: 1000,
          length: 20,
          dataType: 'uint16',
          enabled: true,
        },
        {
          id: 'range-2',
          name: '小地址段',
          startAddress: 1005,
          length: 5,
          dataType: 'uint16',
          enabled: true,
        },
      ]
      
      const result = detectRangeOverlaps(ranges)
      
      expect(result.hasOverlap).toBe(true)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].overlapStart).toBe(1005)
      expect(result.conflicts[0].overlapEnd).toBe(1009)
    })
  })

  describe('isValidRangeLength', () => {
    it('应该验证有效的长度', () => {
      expect(isValidRangeLength(1)).toBe(true)
      expect(isValidRangeLength(50)).toBe(true)
      expect(isValidRangeLength(120)).toBe(true)
    })

    it('应该拒绝无效的长度', () => {
      expect(isValidRangeLength(0)).toBe(false)
      expect(isValidRangeLength(-1)).toBe(false)
      expect(isValidRangeLength(121)).toBe(false)
    })
  })

  describe('getEndAddress', () => {
    it('应该正确计算结束地址', () => {
      const range: ManagedAddressRange = {
        id: 'test-1',
        name: '测试地址段',
        startAddress: 1000,
        length: 10,
        dataType: 'uint16',
        enabled: true,
      }
      
      expect(getEndAddress(range)).toBe(1009)
    })

    it('应该处理单个地址的情况', () => {
      const range: ManagedAddressRange = {
        id: 'test-1',
        name: '单地址段',
        startAddress: 1000,
        length: 1,
        dataType: 'uint16',
        enabled: true,
      }
      
      expect(getEndAddress(range)).toBe(1000)
    })
  })

  describe('formatAddressRange', () => {
    it('应该正确格式化地址范围', () => {
      const range: ManagedAddressRange = {
        id: 'test-1',
        name: '测试地址段',
        startAddress: 1000,
        length: 10,
        dataType: 'uint16',
        enabled: true,
      }
      
      expect(formatAddressRange(range)).toBe('1000-1009')
    })
  })

  describe('calculateTotalAddresses', () => {
    it('应该正确计算总地址数', () => {
      const ranges: ManagedAddressRange[] = [
        {
          id: 'range-1',
          name: '地址段1',
          startAddress: 1000,
          length: 10,
          dataType: 'uint16',
          enabled: true,
        },
        {
          id: 'range-2',
          name: '地址段2',
          startAddress: 2000,
          length: 20,
          dataType: 'uint16',
          enabled: true,
        },
      ]
      
      expect(calculateTotalAddresses(ranges)).toBe(30)
    })

    it('应该忽略禁用的地址段', () => {
      const ranges: ManagedAddressRange[] = [
        {
          id: 'range-1',
          name: '地址段1',
          startAddress: 1000,
          length: 10,
          dataType: 'uint16',
          enabled: true,
        },
        {
          id: 'range-2',
          name: '地址段2',
          startAddress: 2000,
          length: 20,
          dataType: 'uint16',
          enabled: false,
        },
      ]
      
      expect(calculateTotalAddresses(ranges)).toBe(10)
    })

    it('应该处理空数组', () => {
      expect(calculateTotalAddresses([])).toBe(0)
    })
  })

  describe('generateRangeId', () => {
    it('应该生成唯一的ID', () => {
      const id1 = generateRangeId()
      const id2 = generateRangeId()
      
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^range_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^range_\d+_[a-z0-9]+$/)
    })

    it('应该生成带有range_前缀的ID', () => {
      const id = generateRangeId()
      expect(id).toMatch(/^range_/)
    })
  })

  describe('DATA_TYPE_LABELS', () => {
    it('应该包含所有数据类型的中文标签', () => {
      expect(DATA_TYPE_LABELS.uint16).toBe('无符号16位整数')
      expect(DATA_TYPE_LABELS.int16).toBe('有符号16位整数')
      expect(DATA_TYPE_LABELS.uint32).toBe('无符号32位整数')
      expect(DATA_TYPE_LABELS.int32).toBe('有符号32位整数')
      expect(DATA_TYPE_LABELS.float32).toBe('32位浮点数')
    })
  })

  describe('ADDRESS_RANGE_TEMPLATES', () => {
    it('应该包含预定义的模板', () => {
      expect(ADDRESS_RANGE_TEMPLATES).toHaveLength(4)
      
      const temperatureTemplate = ADDRESS_RANGE_TEMPLATES.find(t => t.name === '温度传感器')
      expect(temperatureTemplate).toBeDefined()
      expect(temperatureTemplate?.startAddress).toBe(1000)
      expect(temperatureTemplate?.length).toBe(10)
      expect(temperatureTemplate?.dataType).toBe('int16')
    })

    it('模板应该有不同的起始地址', () => {
      const addresses = ADDRESS_RANGE_TEMPLATES.map(t => t.startAddress)
      const uniqueAddresses = [...new Set(addresses)]
      
      expect(uniqueAddresses).toHaveLength(addresses.length)
    })

    it('所有模板都应该有必需的字段', () => {
      ADDRESS_RANGE_TEMPLATES.forEach(template => {
        expect(template.name).toBeDefined()
        expect(template.startAddress).toBeGreaterThan(0)
        expect(template.length).toBeGreaterThan(0)
        expect(template.dataType).toBeDefined()
        expect(template.description).toBeDefined()
      })
    })
  })
})