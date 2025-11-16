export interface FarcasterUser {
  fid: number
  username: string
  displayName: string
  pfp: {
    url: string
  }
  bio: {
    text: string
  }
  followerCount: number
  followingCount: number
}

export interface FarcasterContext {
  user?: FarcasterUser
  channel?: {
    id: string
    name: string
  }
  cast?: {
    hash: string
    author: FarcasterUser
  }
}

