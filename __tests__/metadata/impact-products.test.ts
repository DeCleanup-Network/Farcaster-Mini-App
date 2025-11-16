/**
 * Tests for Impact Product metadata files
 */

import fs from 'fs'
import path from 'path'

const METADATA_DIR = path.join(__dirname, '../../metadata/impact-products')

describe('Impact Product Metadata', () => {
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('should have metadata files for all levels', () => {
    levels.forEach((level) => {
      const filePath = path.join(METADATA_DIR, `level${level}.json`)
      expect(fs.existsSync(filePath)).toBe(true)
    })
  })

  it('should have valid JSON structure for each level', () => {
    levels.forEach((level) => {
      const filePath = path.join(METADATA_DIR, `level${level}.json`)
      const content = fs.readFileSync(filePath, 'utf-8')
      const metadata = JSON.parse(content)

      expect(metadata).toHaveProperty('name')
      expect(metadata).toHaveProperty('description')
      expect(metadata).toHaveProperty('image')
      expect(metadata).toHaveProperty('attributes')
      expect(Array.isArray(metadata.attributes)).toBe(true)
    })
  })

  it('should have correct image paths (IP1.png format)', () => {
    levels.forEach((level) => {
      const filePath = path.join(METADATA_DIR, `level${level}.json`)
      const content = fs.readFileSync(filePath, 'utf-8')
      const metadata = JSON.parse(content)

      if (level === 10) {
        expect(metadata.image).toContain('IP10Placeholder.png')
        expect(metadata).toHaveProperty('animation_url')
        expect(metadata.animation_url).toContain('IP10VIdeo.mp4')
      } else {
        expect(metadata.image).toContain(`IP${level}.png`)
      }
    })
  })

  it('should have correct tier names', () => {
    const tierMapping: Record<number, string> = {
      1: 'Newbie',
      2: 'Newbie',
      3: 'Newbie',
      4: 'Pro',
      5: 'Pro',
      6: 'Pro',
      7: 'Hero',
      8: 'Hero',
      9: 'Hero',
      10: 'Guardian',
    }

    levels.forEach((level) => {
      const filePath = path.join(METADATA_DIR, `level${level}.json`)
      const content = fs.readFileSync(filePath, 'utf-8')
      const metadata = JSON.parse(content)

      const levelAttribute = metadata.attributes.find(
        (attr: any) => attr.trait_type === 'Level'
      )
      expect(levelAttribute).toBeDefined()
      expect(levelAttribute.value).toBe(tierMapping[level])
    })
  })

  it('should have IPFS image URLs', () => {
    levels.forEach((level) => {
      const filePath = path.join(METADATA_DIR, `level${level}.json`)
      const content = fs.readFileSync(filePath, 'utf-8')
      const metadata = JSON.parse(content)

      expect(metadata.image).toMatch(/^ipfs:\/\//)
    })
  })
})

