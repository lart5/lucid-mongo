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
const test = require('japa')
const fs = require('fs-extra')
const path = require('path')
const { ioc } = require('@adonisjs/fold')
const { Config } = require('@adonisjs/sink')

const helpers = require('./helpers')
const Model = require('../../src/LucidMongo/Model')
const DatabaseManager = require('../../src/Database/Manager')
const VanillaSerializer = require('../../src/LucidMongo/Serializers/Vanilla')

test.group('Relations | Serializer', (group) => {
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
    await ioc.use('Adonis/Src/MongoDatabase').collection('my_users').delete()
    await ioc.use('Adonis/Src/MongoDatabase').collection('profiles').delete()
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

  test('return serializer instance when returning multiple rows', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])

    const users = await User.all()
    assert.instanceOf(users, VanillaSerializer)
  })

  test('return json representation of all the models', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])

    const users = await User.all()

    const json = users.toJSON()
    assert.isArray(json)
    assert.lengthOf(json, 2)
    assert.deepEqual(json.map((user) => user.username), ['virk', 'nikk'])
  })

  test('call getters when returning json', async (assert) => {
    class User extends Model {
      getUsername (username) {
        return username.toUpperCase()
      }
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])

    const users = await User.all()

    const json = users.toJSON()
    assert.deepEqual(json.map((user) => user.username), ['VIRK', 'NIKK'])
  })

  test('attach computed properties when calling toJSON', async (assert) => {
    class User extends Model {
      static get computed () {
        return ['salutedName']
      }

      getSalutedName (attrs) {
        return `Mr. ${attrs.username}`
      }
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])

    const users = await User.all()

    const json = users.toJSON()
    assert.deepEqual(json.map((user) => user.salutedName), ['Mr. virk', 'Mr. nikk'])
  })

  test('attach relations when calling toJSON', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.hasOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const result = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await ioc.use('MongoDatabase').collection('profiles').insert([{ user_id: result.insertedIds[0], profile_name: 'virk' }, { user_id: result.insertedIds[1], profile_name: 'nikk' }])

    const users = await User.query().with('profile').fetch()

    const json = users.toJSON()
    assert.property(json[0], 'profile')
    assert.property(json[1], 'profile')
    assert.equal(json[0].profile.user_id, json[0]._id)
    assert.equal(json[1].profile.user_id, json[1]._id)
  })

  test('attach nested relations when calling toJSON', async (assert) => {
    class Picture extends Model {
    }

    class Profile extends Model {
      picture () {
        return this.hasOne(Picture)
      }
    }

    class User extends Model {
      profile () {
        return this.hasOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()
    Picture._bootIfNotBooted()

    const result = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const resultProfile = await ioc.use('MongoDatabase').collection('profiles').insert([{ user_id: result.insertedIds[0], profile_name: 'virk' }, { user_id: result.insertedIds[1], profile_name: 'nikk' }])
    await ioc.use('MongoDatabase').collection('pictures').insert({ profile_id: resultProfile.insertedIds[0], storage_path: '/foo' })

    const users = await User.query().with('profile.picture').fetch()

    const json = users.toJSON()
    assert.property(json[0].profile, 'picture')
    assert.equal(json[0].profile.picture.profile_id, resultProfile.insertedIds[0])
    assert.isNull(json[1].profile.picture)
  })

  test('attach pagination meta data when calling toJSON', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])

    const users = await User.query().paginate()

    const json = users.toJSON()
    assert.property(json, 'data')
    assert.isArray(json.data)
    assert.equal(json.page, 1)
    assert.equal(json.total, 2)
    assert.equal(json.perPage, 20)
    assert.equal(json.lastPage, 1)
  })

  // test('attach sideloaded data as meta', async (assert) => {
  //   class Profile extends Model {
  //   }

  //   class User extends Model {
  //     profile () {
  //       return this.hasOne(Profile)
  //     }
  //   }

  //   User._bootIfNotBooted()
  //   Profile._bootIfNotBooted()

  //   const result = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
  //   await ioc.use('MongoDatabase').collection('profiles').insert([{ user_id: result.insertedIds[0], profile_name: 'virk' }, { user_id: result.insertedIds[1], profile_name: 'nikk' }])

  //   const users = await User.query().withCount('profile').paginate()

  //   const json = users.toJSON()
  //   assert.property(json, 'data')
  //   assert.isArray(json.data)
  //   assert.deepEqual(json.data[0].__meta__, { profile_count: helpers.formatNumber(1) })
  //   assert.equal(json.page, 1)
  //   assert.equal(json.total, 2)
  //   assert.equal(json.perPage, 20)
  //   assert.equal(json.lastPage, 1)
  // })
})
