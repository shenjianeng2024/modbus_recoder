import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useErrorHandler, useFormErrorHandler, useAsyncErrorHandler } from '../useErrorHandler'
import { ErrorType, ErrorSeverity } from '../../types/errors'

// Mock the dependencies
vi.mock('../../utils/errorHandler', () => ({
  ErrorHandler: {
    getInstance: () => ({
      addErrorListener: vi.fn(),
      removeErrorListener: vi.fn(),
      handleError: vi.fn(),
    }),
  },
  createAppError: vi.fn((type, message, details, context, recovery) => ({
    id: `error-${Date.now()}`,
    type,
    message: message || 'Test error',
    details: details || 'Test details',
    severity: ErrorSeverity.HIGH,
    timestamp: new Date().toISOString(),
    context,
    recovery,
  })),
  convertNativeError: vi.fn((error, type, context) => ({
    id: `error-${Date.now()}`,
    type,
    message: error.message,
    details: error.stack,
    severity: ErrorSeverity.HIGH,
    timestamp: new Date().toISOString(),
    context,
  })),
  retryWithBackoff: vi.fn(),
}))

vi.mock('../../utils/notifications', () => ({
  notifications: {
    showError: vi.fn(),
  },
}))

describe('useErrorHandler Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('应该初始化正确的默认状态', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    expect(result.current.errors).toEqual([])
    expect(result.current.hasActiveErrors).toBe(false)
    expect(result.current.lastError).toBeNull()
    expect(result.current.errorCount).toBe(0)
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.hasCriticalErrors).toBe(false)
  })

  it('应该正确处理错误', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    act(() => {
      result.current.handleError(new Error('Test error'))
    })
    
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.errorCount).toBe(1)
  })

  it('应该能够创建应用错误', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    act(() => {
      result.current.createError(ErrorType.VALIDATION_ERROR, 'Custom message')
    })
    
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.errorCount).toBe(1)
  })

  it('应该能够清除特定错误', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    let errorId: string
    act(() => {
      const error = result.current.createError(ErrorType.VALIDATION_ERROR, 'Test error')
      errorId = error.id
    })
    
    expect(result.current.errorCount).toBe(1)
    
    act(() => {
      result.current.clearError(errorId)
    })
    
    expect(result.current.errorCount).toBe(0)
    expect(result.current.hasErrors).toBe(false)
  })

  it('应该能够清除所有错误', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    act(() => {
      result.current.createError(ErrorType.VALIDATION_ERROR, 'Error 1')
      result.current.createError(ErrorType.NETWORK_ERROR, 'Error 2')
    })
    
    expect(result.current.errorCount).toBe(2)
    
    act(() => {
      result.current.clearAllErrors()
    })
    
    expect(result.current.errorCount).toBe(0)
    expect(result.current.hasErrors).toBe(false)
  })

  it('应该限制最大错误数量', () => {
    const { result } = renderHook(() => useErrorHandler({ maxErrors: 3 }))
    
    act(() => {
      result.current.createError(ErrorType.VALIDATION_ERROR, 'Error 1')
      result.current.createError(ErrorType.VALIDATION_ERROR, 'Error 2')
      result.current.createError(ErrorType.VALIDATION_ERROR, 'Error 3')
      result.current.createError(ErrorType.VALIDATION_ERROR, 'Error 4')
      result.current.createError(ErrorType.VALIDATION_ERROR, 'Error 5')
    })
    
    expect(result.current.errorCount).toBe(3)
  })

  it('应该按严重程度过滤错误', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    // Mock critical errors
    vi.mocked(result.current.createError).mockImplementation(() => ({
      id: `error-${Date.now()}`,
      type: ErrorType.VALIDATION_ERROR,
      message: 'Critical error',
      severity: ErrorSeverity.CRITICAL,
      timestamp: new Date().toISOString(),
    }))
    
    act(() => {
      result.current.createError(ErrorType.VALIDATION_ERROR, 'Critical error')
    })
    
    const criticalErrors = result.current.getCriticalErrors()
    expect(criticalErrors).toHaveLength(1)
  })

  it('应该正确处理异步操作', async () => {
    const { result } = renderHook(() => useErrorHandler())
    
    const mockOperation = vi.fn().mockResolvedValue('success')
    
    await act(async () => {
      const result_value = await result.current.safeExecute(mockOperation)
      expect(result_value).toBe('success')
    })
    
    expect(mockOperation).toHaveBeenCalled()
  })

  it('应该处理异步操作中的错误', async () => {
    const { result } = renderHook(() => useErrorHandler())
    
    const mockOperation = vi.fn().mockRejectedValue(new Error('Async error'))
    
    await act(async () => {
      const result_value = await result.current.safeExecute(mockOperation)
      expect(result_value).toBeNull()
    })
    
    expect(result.current.hasErrors).toBe(true)
  })
})

describe('useFormErrorHandler Hook', () => {
  it('应该初始化正确的默认状态', () => {
    const { result } = renderHook(() => useFormErrorHandler())
    
    expect(result.current.fieldErrors).toEqual({})
    expect(result.current.formError).toBeNull()
    expect(result.current.hasFieldErrors).toBe(false)
    expect(result.current.hasFormError).toBe(false)
  })

  it('应该能够设置字段错误', () => {
    const { result } = renderHook(() => useFormErrorHandler())
    
    act(() => {
      result.current.setFieldError('email', 'Invalid email format')
    })
    
    expect(result.current.hasFieldError('email')).toBe(true)
    expect(result.current.getFieldError('email')).toBe('Invalid email format')
    expect(result.current.hasFieldErrors).toBe(true)
  })

  it('应该能够清除字段错误', () => {
    const { result } = renderHook(() => useFormErrorHandler())
    
    act(() => {
      result.current.setFieldError('email', 'Invalid email format')
    })
    
    expect(result.current.hasFieldError('email')).toBe(true)
    
    act(() => {
      result.current.clearFieldError('email')
    })
    
    expect(result.current.hasFieldError('email')).toBe(false)
    expect(result.current.hasFieldErrors).toBe(false)
  })

  it('应该能够设置和清除表单错误', () => {
    const { result } = renderHook(() => useFormErrorHandler())
    
    act(() => {
      result.current.setFormError('Form submission failed')
    })
    
    expect(result.current.formError).toBe('Form submission failed')
    expect(result.current.hasFormError).toBe(true)
    
    act(() => {
      result.current.clearFormError()
    })
    
    expect(result.current.formError).toBeNull()
    expect(result.current.hasFormError).toBe(false)
  })

  it('应该能够清除所有字段错误', () => {
    const { result } = renderHook(() => useFormErrorHandler())
    
    act(() => {
      result.current.setFieldError('email', 'Invalid email')
      result.current.setFieldError('password', 'Password too short')
    })
    
    expect(result.current.hasFieldErrors).toBe(true)
    
    act(() => {
      result.current.clearAllFieldErrors()
    })
    
    expect(result.current.hasFieldErrors).toBe(false)
    expect(result.current.fieldErrors).toEqual({})
  })
})

describe('useAsyncErrorHandler Hook', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('应该初始化正确的默认状态', () => {
    const { result } = renderHook(() => useAsyncErrorHandler())
    
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBeNull()
    expect(result.current.hasError).toBe(false)
    expect(result.current.hasData).toBe(false)
  })

  it('应该正确处理成功的异步操作', async () => {
    const { result } = renderHook(() => useAsyncErrorHandler<string>())
    
    const mockOperation = vi.fn().mockResolvedValue('success data')
    
    await act(async () => {
      const data = await result.current.execute(mockOperation)
      expect(data).toBe('success data')
    })
    
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBe('success data')
    expect(result.current.error).toBeNull()
    expect(result.current.hasData).toBe(true)
    expect(result.current.hasError).toBe(false)
  })

  it('应该正确处理失败的异步操作', async () => {
    const { result } = renderHook(() => useAsyncErrorHandler<string>())
    
    const mockError = new Error('Operation failed')
    const mockOperation = vi.fn().mockRejectedValue(mockError)
    
    await act(async () => {
      try {
        await result.current.execute(mockOperation)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
    
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeDefined()
    expect(result.current.hasData).toBe(false)
    expect(result.current.hasError).toBe(true)
  })

  it('应该在执行期间显示加载状态', async () => {
    const { result } = renderHook(() => useAsyncErrorHandler<string>())
    
    const mockOperation = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('data'), 100))
    )
    
    act(() => {
      result.current.execute(mockOperation)
    })
    
    expect(result.current.loading).toBe(true)
    
    await act(async () => {
      vi.runAllTimers()
    })
    
    expect(result.current.loading).toBe(false)
  })

  it('应该能够重置状态', () => {
    const { result } = renderHook(() => useAsyncErrorHandler<string>())
    
    act(() => {
      // 手动设置一些状态来测试重置
      result.current.execute(() => Promise.resolve('test data'))
    })
    
    act(() => {
      result.current.reset()
    })
    
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBeNull()
    expect(result.current.hasError).toBe(false)
    expect(result.current.hasData).toBe(false)
  })
})