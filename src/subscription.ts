import { BskyAgent } from '@atproto/api'
import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent, agent: BskyAgent) {
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)
    const postsToDelete = ops.posts.deletes
      .map((del) => ({
        uri: del.uri,
        author: del.uri.split('/')[2],
      }))
      .map((del) => del.uri)
    const postsToCreate = ops.posts.creates.map((create) => {
      return {
        uri: create.uri,
        cid: create.cid,
        replyParent: create.record?.reply?.parent.uri ?? null,
        replyRoot: create.record?.reply?.root.uri ?? null,
        indexedAt: new Date().toISOString(),
      }
    })

    if (postsToDelete.length > 0) {
      console.log('🗑️ new deletes 🗑️: ', postsToDelete)
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }

    if (postsToCreate.length > 0) {
      postsToCreate.forEach(async (post) => {
        console.log('fetching post ', post.uri)
        const postContent = await agent.api.app.bsky.feed.post.get({
          cid: post.cid,
          repo: post.uri.split('/')[2],
          rkey: post.uri.split('/')[4],
        })

        if (postContent.value.text.match(/\beepy\b/)) {
          console.log('❗️ new post ❗️: ', postsToCreate)
          await this.db
            .insertInto('post')
            .values(postsToCreate)
            .onConflict((oc) => oc.doNothing())
            .execute()
        }
      })
    }

    ops.posts.creates.forEach(async (create) => {
      const user = await this.db
        .selectFrom('atproto_user')
        .select('did')
        .where('did', '=', create.author)
        .execute()
      if (user.length === 0) {
        console.log(`!!!!! fetching profile for ${create.author}`)
        let profile
        try {
          profile = await agent.api.app.bsky.actor.getProfile({
            actor: create.author,
          })
        } catch (e) {
          console.error('error fetching profile: ', e)
          return
        }

        try {
          await this.db
            .insertInto('atproto_user')
            .values({
              did: create.author,
              handle: profile.data.handle,
              displayName: profile.data.displayName,
              bio: profile.data.description,
              indexedAt: new Date().toISOString(),
            })
            .execute()
        } catch (e) {
          console.error('error inserting user: ', e)
        }
      }
    })
  }
}
