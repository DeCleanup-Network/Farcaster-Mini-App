import { safeJsonParse, validateObjectDepth, processNestedData, processArray } from '../../lib/input-validation'

describe('Input Validation', () => {
  describe('safeJsonParse', () => {
    it('should parse valid JSON within depth limit', () => {
      const json = JSON.stringify({ a: { b: { c: 'value' } } })
      const result = safeJsonParse(json, 5)
      expect(result).toEqual({ a: { b: { c: 'value' } } })
    })

    it('should reject JSON exceeding depth limit', () => {
      // Create deeply nested JSON (50 levels)
      const deep: any = {}
      let current = deep
      for (let i = 0; i < 50; i++) {
        current.nested = {}
        current = current.nested
      }
      current.value = 'too deep'

      const json = JSON.stringify(deep)
      
      expect(() => {
        safeJsonParse(json, 10)
      }).toThrow('JSON structure exceeds maximum depth')
    })

    it('should reject JSON exceeding size limit', () => {
      // Create large JSON string (> 1MB)
      const largeString = 'a'.repeat(2 * 1024 * 1024) // 2MB
      const json = JSON.stringify({ data: largeString })
      
      expect(() => {
        safeJsonParse(json)
      }).toThrow('JSON string exceeds maximum size')
    })

    it('should handle arrays with depth limits', () => {
      const json = JSON.stringify([[[['value']]]])
      const result = safeJsonParse(json, 5)
      expect(result).toEqual([[[['value']]]])
    })

    it('should reject invalid JSON', () => {
      expect(() => {
        safeJsonParse('{ invalid json }')
      }).toThrow('Invalid JSON')
    })
  })

  describe('validateObjectDepth', () => {
    it('should validate object within depth limit', () => {
      const obj = { a: { b: { c: 'value' } } }
      expect(() => validateObjectDepth(obj, 5)).not.toThrow()
    })

    it('should reject object exceeding depth limit', () => {
      const deep: any = {}
      let current = deep
      for (let i = 0; i < 20; i++) {
        current.nested = {}
        current = current.nested
      }

      expect(() => {
        validateObjectDepth(deep, 10)
      }).toThrow('Object structure exceeds maximum depth')
    })
  })

  describe('processNestedData', () => {
    it('should process data within depth limit', () => {
      const data = { value: 42 }
      const result = processNestedData(data, (item) => item.value * 2, 5)
      expect(result).toBe(84)
    })

    it('should reject processing exceeding depth limit', () => {
      expect(() => {
        processNestedData({}, () => {}, 5, 10) // Already at depth 10
      }).toThrow('Recursion depth exceeded maximum')
    })
  })

  describe('processArray', () => {
    it('should process array within depth limit', () => {
      const array = [1, 2, 3]
      const result = processArray(array, (item) => item * 2, 5)
      expect(result).toEqual([2, 4, 6])
    })

    it('should handle nested arrays within depth limit', () => {
      const array = [[1, 2], [3, 4]]
      const result = processArray(array, (item) => item, 5)
      expect(result).toEqual([[1, 2], [3, 4]])
    })

    it('should reject processing exceeding depth limit', () => {
      const array = [1, 2, 3]
      expect(() => {
        processArray(array, (item) => item, 5, 10) // Already at depth 10
      }).toThrow('Array processing depth exceeded maximum')
    })
  })

  describe('Real-world attack scenarios', () => {
    it('should prevent DoS attack with deeply nested levels', () => {
      // Simulate the attack from the Node.js security advisory
      // Create nested object structure (more reliable than arrays for depth calculation)
      const attack: any = {}
      let current: any = attack
      for (let i = 0; i < 50; i++) { // 50 levels should be rejected (limit is 32)
        current.nested = {}
        current = current.nested
      }

      const json = JSON.stringify(attack)
      
      expect(() => {
        safeJsonParse(json, 32) // Our default limit
      }).toThrow('JSON structure exceeds maximum depth')
    })

    it('should handle legitimate nested structures', () => {
      // Legitimate use case: nested configuration
      const config = {
        app: {
          api: {
            endpoints: {
              upload: {
                limits: {
                  size: 10 * 1024 * 1024,
                  depth: 10
                }
              }
            }
          }
        }
      }

      const json = JSON.stringify(config)
      const result = safeJsonParse(json, 10)
      expect(result.app.api.endpoints.upload.limits.size).toBe(10 * 1024 * 1024)
    })
  })
})

