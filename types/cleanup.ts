export interface CleanupSubmission {
  id?: string
  beforePhotos: File[] | string[]
  afterPhotos: File[] | string[]
  location: {
    latitude: number
    longitude: number
    address?: string
  }
  timestamp: number
  wasteType?: string[]
  weight?: number // in kg
  area?: number // in m²
  duration?: number // in minutes
  environmentalContext?: 'beach' | 'park' | 'waterway' | 'forest' | 'urban' | 'other'
  beforeCondition?: number // 1-5 rating
  afterCondition?: number // 1-5 rating
  description?: string
  userId?: string
  status?: 'pending' | 'approved' | 'rejected'
}

export interface CleanupVerification {
  id: string
  cleanupId: string
  verifierId: string
  status: 'approved' | 'rejected'
  timestamp: number
  notes?: string
}

