export interface ImpactProduct {
  id: string
  tokenId: number
  owner: string
  tier: 'Seedling' | 'Sapling' | 'Tree' | 'Forest' | 'Guardian'
  level: number
  totalCleanups: number
  totalImpact: {
    wasteRemoved: number // kg
    areaCleaned: number // m²
    co2Offset?: number // kg CO2
  }
  metadata: {
    name: string
    description: string
    image: string
    attributes: Array<{
      trait_type: string
      value: string | number
    }>
  }
  createdAt: number
  updatedAt: number
}

export interface UserImpact {
  userId: string
  totalCleanups: number
  verifiedCleanups: number
  pendingCleanups: number
  totalImpact: {
    wasteRemoved: number
    areaCleaned: number
    co2Offset?: number
  }
  impactProducts: ImpactProduct[]
  dcuBalance: number
  rwiScore?: number
}

