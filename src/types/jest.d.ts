// Ambient declarations for Jest when @types/jest is not installed.
// Covers globals (it, expect, describe…), jest.fn() / jest.Mock, and expect matchers.

interface JestMockFn<T = any> {
  (...args: any[]): T
  mock: {
    calls: any[][]
    results: any[]
    instances: any[]
    contexts: any[]
    invocationCallOrder: number[]
    lastCall: any[]
  }
  mockClear(): void
  mockReset(): void
  mockRestore(): void
  mockReturnValueOnce(value: T): JestMockFn<T>
  mockResolvedValueOnce(value: T): JestMockFn<T>
  mockRejectedValueOnce(value: any): JestMockFn<T>
  mockResolvedValue(value: T): JestMockFn<T>
  mockRejectedValue(value: any): JestMockFn<T>
  mockImplementation(fn: (...args: any[]) => T): JestMockFn<T>
  calls: any[][]
  results: any[]
}

declare function it(name: string, fn?: () => void | Promise<void>, timeout?: number): void
declare function test(name: string, fn?: () => void | Promise<void>, timeout?: number): void
declare function describe(name: string, fn: () => void): void
declare function beforeEach(fn: () => void): void
declare function afterEach(fn: () => void): void
declare function beforeAll(fn: () => void): void
declare function afterAll(fn: () => void): void

interface Expect {
  <T = any>(actual: T): ExpectResult
  any(constructorClass: any): boolean
  arrayContaining(arr: any[]): any
  objectContaining(obj: any): any
  stringContaining(str: string): any
  stringMatching(regex: string | RegExp): any
}

interface ExpectResult {
  toBe(expected: any): void
  toEqual(expected: any): void
  toBeTruthy(): void
  toBeFalsy(): void
  toBeNull(): void
  toBeUndefined(): void
  toBeDefined(): void
  toHaveBeenCalled(): void
  toHaveBeenCalledTimes(n: number): void
  toHaveBeenCalledWith(...args: any[]): void
  toHaveBeenLastCalledWith(...args: any[]): void
  toHaveProperty(path: string | string[], value?: any): void
  toMatchObject(expected: any): void
  toContain(item: any): void
  toContainEqual(item: any): void
  toHaveLength(n: number): void
  toBeGreaterThan(n: number): void
  toBeGreaterThanOrEqual(n: number): void
  toBeLessThan(n: number): void
  toBeLessThanOrEqual(n: number): void
  toBeCloseTo(n: number, numDigits?: number): void
  toMatch(regex: string | RegExp): void
  toThrow(message?: string | RegExp | Error): void
  rejects: any
  resolves: any
  not: ExpectResult
  toHaveBeenCalledTimes(n: number): void
}

declare const expect: Expect

declare namespace jest {
  type Mock<T = any> = JestMockFn<T>

  function fn<T = any>(implementation?: (...args: any[]) => T): JestMockFn<T>
  function mock(moduleName: string, factory?: any): void
  function clearAllMocks(): void
  function resetAllMocks(): void
  function restoreAllMocks(): void
}
