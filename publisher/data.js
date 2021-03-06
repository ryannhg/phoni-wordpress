const mongoose = require('mongoose')
const { transformPost, error } = require('./logic')

const connections = {
  live: mongoose.createConnection(process.env.LIVE_MONGO_URI),
  preview: mongoose.createConnection(process.env.PREVIEW_MONGO_URI)
}

const storeBasedOnStatus = (doc) => {
  switch (doc.status) {
    case 'publish':
      return storeInBothDatabases(doc)
    case 'trash':
      return removeFromBothDatabases(doc)
    case 'auto-draft':
      return Promise.resolve('Took no action.')
    default:
      return storeInPreviewDatabase(doc)
        .then(() => `Stored ${doc.id} in preview database.`)
  }
}

const storeInDatabase = (conn) => (doc) =>
  new Promise((resolve, reject) =>
    conn.collection(doc.type)
      .update({ id: doc.id }, doc, { upsert: true }, resolve)
  )
    .catch(error('storeInDatabase'))

const removeFromDatabase = (conn) => (doc) =>
  new Promise((resolve, reject) =>
    conn.collection(doc.type)
      .remove({ id: doc.id }, resolve)
  )
    .catch(error('removeFromDatabase'))

const storeInLiveDatabase =
  storeInDatabase(connections.live)

const removeFromLiveDatabase =
  removeFromDatabase(connections.live)

const storeInPreviewDatabase =
  storeInDatabase(connections.preview)

const removeFromPreviewDatabase =
  removeFromDatabase(connections.preview)

const storeInBothDatabases = (doc) =>
  Promise.all([ storeInLiveDatabase(doc), storeInPreviewDatabase(doc) ])
    .then(_msgs => `Stored ${doc.id} in both databases.`)

const removeFromBothDatabases = (doc) =>
  Promise.all([ removeFromLiveDatabase(doc), removeFromPreviewDatabase(doc) ])
    .then(_msgs => `Removed ${doc.id} from both databases.`)

module.exports = {
  storePost: (data) => storeBasedOnStatus(transformPost(data))
}
