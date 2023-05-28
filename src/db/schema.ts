export type DatabaseSchema = {
  post: Post
  repost: Repost
  atproto_user: User
  sub_state: SubState
}

export type Post = {
  uri: string
  cid: string
  replyParent: string | null
  replyRoot: string | null
  indexedAt: string
}

export type Repost = {
  uri: string
  cid: string
  subject: string
  indexedAt: string
}

export type SubState = {
  service: string
  cursor: number
}

export type User = {
  did: string
  handle: string
  displayName: string | null
  bio: string | null
  indexedAt: string
}
