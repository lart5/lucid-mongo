'use strict'

/*
 * adonis-lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

require('../../lib/iocResolver').setFold(require('@adonisjs/fold'))
require('../../lib/iocResolver').setFold(require('@adonisjs/fold'))
const test = require('japa')
const fs = require('fs-extra')
const path = require('path')
const { ioc } = require('@adonisjs/fold')
const { Config } = require('@adonisjs/sink')

const helpers = require('./helpers')
const Model = require('../../src/LucidMongo/Model')
const DatabaseManager = require('../../src/Database/Manager')
const VanillaSerializer = require('../../src/LucidMongo/Serializers/Vanilla')

test.group('Relations | Morph To', (group) => {
  group.before(async () => {
    ioc.singleton('Adonis/Src/MongoDatabase', function () {
      const config = new Config()
      config.set('database', {
        connection: 'testing',
        testing: helpers.getConfig()
      })
      return new DatabaseManager(config)
    })
    ioc.alias('Adonis/Src/MongoDatabase', 'MongoDatabase')

    await fs.ensureDir(path.join(__dirname, './tmp'))
    await helpers.createCollections(ioc.use('Adonis/Src/MongoDatabase'))
  })

  group.afterEach(async () => {
    await ioc.use('Adonis/Src/MongoDatabase').collection('users').delete()
    await ioc.use('Adonis/Src/MongoDatabase').collection('posts').delete()
    await ioc.use('Adonis/Src/MongoDatabase').collection('pictures').delete()
  })

  group.after(async () => {
    await helpers.dropCollections(ioc.use('Adonis/Src/MongoDatabase'))
    ioc.use('MongoDatabase').close()
    try {
      await fs.remove(path.join(__dirname, './tmp'))
    } catch (error) {
      if (process.platform !== 'win32' || error.code !== 'EBUSY') {
        throw error
      }
    }
  }).timeout(0)

  test('get related row via first method', async (assert) => {
    class User extends Model {
    }

    class Post extends Model {
    }

    class Picture extends Model {
      pictureable () {
        return this.morphTo()
      }
    }

    ioc.fake('App/Models/User', () => {
      User._bootIfNotBooted()
      return User
    })

    ioc.fake('App/Models/Post', () => {
      Post._bootIfNotBooted()
      return Post
    })

    ioc.fake('App/Models/Picture', () => {
      Picture._bootIfNotBooted()
      return Picture
    })

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const rsPost = await ioc.use('MongoDatabase').collection('post').insert({ title: 'test post' })
    const rsPicture = await ioc.use('MongoDatabase').collection('pictures').insert([{ parent_id: rs.insertedIds[0], determiner: 'User', path: '/foo' }, { parent_id: rsPost.insertedIds[0], determiner: 'Post', path: '/foo' }])

    const picture = await Picture.find(rsPicture.insertedIds[0])
    const pictureable = await picture.pictureable().first()
    assert.instanceOf(pictureable, User)
  })

  test('get related row via fetch method alias of first', async (assert) => {
    class User extends Model {
    }

    class Post extends Model {
    }

    class Picture extends Model {
      pictureable () {
        return this.morphTo()
      }
    }

    ioc.fake('App/Models/User', () => {
      User._bootIfNotBooted()
      return User
    })

    ioc.fake('App/Models/Post', () => {
      Post._bootIfNotBooted()
      return Post
    })

    ioc.fake('App/Models/Picture', () => {
      Picture._bootIfNotBooted()
      return Picture
    })

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const rsPost = await ioc.use('MongoDatabase').collection('post').insert({ title: 'test post' })
    const rsPicture = await ioc.use('MongoDatabase').collection('pictures').insert([{ parent_id: rs.insertedIds[0], determiner: 'User', path: '/foo' }, { parent_id: rsPost.insertedIds[0], determiner: 'Post', path: '/foo' }])

    const picture = await Picture.find(rsPicture.insertedIds[0])
    const pictureable = await picture.pictureable().fetch()
    assert.instanceOf(pictureable, User)
  })

  test('eager load when call fetch', async (assert) => {
    class User extends Model {
    }

    class Post extends Model {
    }

    class Picture extends Model {
      pictureable () {
        return this.morphTo()
      }
    }

    ioc.fake('App/Models/User', () => {
      User._bootIfNotBooted()
      return User
    })

    ioc.fake('App/Models/Post', () => {
      Post._bootIfNotBooted()
      return Post
    })

    ioc.fake('App/Models/Picture', () => {
      Picture._bootIfNotBooted()
      return Picture
    })

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const rsPost = await ioc.use('MongoDatabase').collection('posts').insert({ title: 'test post' })
    await ioc.use('MongoDatabase').collection('pictures').insert([{ parent_id: rs.insertedIds[0], determiner: 'User', path: '/foo' }, { parent_id: rsPost.insertedIds[0], determiner: 'Post', path: '/foo' }])
    const pictures = await Picture.with('pictureable').fetch()
    assert.instanceOf(pictures, VanillaSerializer)
    const user = pictures.rows[0].getRelated('pictureable')
    const post = pictures.rows[1].getRelated('pictureable')
    assert.equal(user.username, 'virk')
    assert.equal(post.title, 'test post')
  })

  test('through error when call paginate method', async (assert) => {
    class User extends Model {
    }

    class Post extends Model {
    }

    class Picture extends Model {
      pictureable () {
        return this.morphTo()
      }
    }

    ioc.fake('App/Models/User', () => {
      User._bootIfNotBooted()
      return User
    })

    ioc.fake('App/Models/Post', () => {
      Post._bootIfNotBooted()
      return Post
    })

    ioc.fake('App/Models/Picture', () => {
      Picture._bootIfNotBooted()
      return Picture
    })

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const rsPost = await ioc.use('MongoDatabase').collection('post').insert({ title: 'test post' })
    const rsPicture = await ioc.use('MongoDatabase').collection('pictures').insert([{ parent_id: rs.insertedIds[0], determiner: 'User', path: '/foo' }, { parent_id: rsPost.insertedIds[0], determiner: 'Post', path: '/foo' }])

    const picture = await Picture.find(rsPicture.insertedIds[0])
    try {
      await picture.pictureable().paginate(2, 1)
    } catch ({ message }) {
      assert.equal(message, 'E_INVALID_RELATION_METHOD: paginate is not supported by MorphTo relation')
    }
  })

  test('through error when call save method', async (assert) => {
    class User extends Model {
    }

    class Post extends Model {
    }

    class Picture extends Model {
      pictureable () {
        return this.morphTo()
      }
    }

    ioc.fake('App/Models/User', () => {
      User._bootIfNotBooted()
      return User
    })

    ioc.fake('App/Models/Post', () => {
      Post._bootIfNotBooted()
      return Post
    })

    ioc.fake('App/Models/Picture', () => {
      Picture._bootIfNotBooted()
      return Picture
    })

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const rsPost = await ioc.use('MongoDatabase').collection('post').insert({ title: 'test post' })
    const rsPicture = await ioc.use('MongoDatabase').collection('pictures').insert([{ parent_id: rs.insertedIds[0], determiner: 'User', path: '/foo' }, { parent_id: rsPost.insertedIds[0], determiner: 'Post', path: '/foo' }])

    const picture = await Picture.find(rsPicture.insertedIds[0])
    try {
      await picture.pictureable().save(new User({ name: 'vik' }))
    } catch ({ message }) {
      assert.equal(message, 'E_INVALID_RELATION_METHOD: save is not supported by MorphTo relation')
    }
  })
})
