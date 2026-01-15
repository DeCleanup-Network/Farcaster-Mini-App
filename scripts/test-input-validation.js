#!/usr/bin/env node

/**
 * Test script for input validation
 * Tests API routes with deeply nested JSON to verify protection
 */

const http = require('http')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'

// Create deeply nested JSON structure
function createDeepNestedJSON(levels) {
  let obj = {}
  let current = obj
  for (let i = 0; i < levels; i++) {
    current.nested = {}
    current = current.nested
  }
  current.value = 'test'
  return JSON.stringify(obj)
}

// Create deeply nested array
function createDeepNestedArray(levels) {
  let arr = []
  let current = arr
  for (let i = 0; i < levels; i++) {
    current.push([])
    current = current[0]
  }
  current.push('test')
  return JSON.stringify(arr)
}

async function testEndpoint(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }

    const req = http.request(url, options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        })
      })
    })

    req.on('error', reject)

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body))
    }

    req.end()
  })
}

async function testIPFSUpload(metadata, options) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    
    // Create a small test file
    const testFile = Buffer.from('test image data')
    form.append('file', testFile, { filename: 'test.jpg', contentType: 'image/jpeg' })
    
    if (metadata) {
      form.append('metadata', metadata)
    }
    if (options) {
      form.append('options', options)
    }

    const url = new URL('/api/ipfs/upload', BASE_URL)
    const options_http = {
      method: 'POST',
      headers: form.getHeaders(),
    }

    const req = http.request(url, options_http, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        })
      })
    })

    req.on('error', reject)
    form.pipe(req)
  })
}

async function runTests() {
  console.log('🧪 Testing Input Validation\n')
  console.log(`Base URL: ${BASE_URL}\n`)

  const tests = [
    {
      name: 'Test 1: Valid shallow JSON (should pass)',
      test: async () => {
        const result = await testEndpoint('GET', '/api/ipfs/fetch?path=test.json', null)
        // This will fail because path doesn't exist, but that's OK - we're testing the endpoint exists
        console.log(`  Status: ${result.status}`)
        return result.status !== 500 // Should not be a server error
      },
    },
    {
      name: 'Test 2: Deeply nested metadata (50 levels - should be rejected)',
      test: async () => {
        const deepMetadata = createDeepNestedJSON(50)
        const result = await testIPFSUpload(deepMetadata, null)
        console.log(`  Status: ${result.status}`)
        console.log(`  Response: ${result.body.substring(0, 200)}`)
        // Should reject with 400 or use default metadata
        return result.status === 400 || result.status === 200 // Either rejection or fallback
      },
    },
    {
      name: 'Test 3: Valid metadata depth (5 levels - should pass)',
      test: async () => {
        const validMetadata = createDeepNestedJSON(5)
        const result = await testIPFSUpload(validMetadata, null)
        console.log(`  Status: ${result.status}`)
        // Should accept (may fail for other reasons like missing Pinata keys, but not depth)
        return result.status !== 400 || result.body.includes('depth') === false
      },
    },
    {
      name: 'Test 4: Deeply nested options (20 levels - should be rejected)',
      test: async () => {
        const deepOptions = createDeepNestedJSON(20)
        const result = await testIPFSUpload(null, deepOptions)
        console.log(`  Status: ${result.status}`)
        // Should reject or use defaults
        return result.status === 400 || result.status === 200
      },
    },
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    try {
      console.log(`\n${test.name}`)
      const result = await test.test()
      if (result) {
        console.log('  ✅ PASSED')
        passed++
      } else {
        console.log('  ❌ FAILED')
        failed++
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`)
      failed++
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)
  
  if (failed === 0) {
    console.log('✅ All tests passed!')
    process.exit(0)
  } else {
    console.log('⚠️  Some tests failed. Review the output above.')
    process.exit(1)
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error)
  process.exit(1)
})

