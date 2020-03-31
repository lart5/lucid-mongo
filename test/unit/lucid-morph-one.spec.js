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

test.group('Relations | MorphOne', (group) => {
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
    await ioc.use('Adonis/Src/MongoDatabase').collection('profiles').delete()
    await ioc.use('Adonis/Src/MongoDatabase').collection('pictures').delete()
    await ioc.use('Adonis/Src/MongoDatabase').collection('identities').delete()
    await ioc.use('Adonis/Src/MongoDatabase').collection('cars').delete()
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

  test('morphOne relation should make right query', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const result = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: result.insertedIds[0], determiner: 'User', profile_name: 'virk' })
    const user = new User()
    user._id = result.insertedIds[0]
    user.$persisted = true
    const profile = await user.profile().load()
    assert.instanceOf(profile, Profile)
    assert.equal(String(profile.$attributes.parent_id), String(result.insertedIds[0]))
  })

  test('fetch related row', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: user._id, determiner: 'User', profile_name: 'virk' })
    const profile = await user.profile().fetch()
    assert.instanceOf(profile, Profile)
  })

  test('throw exception when trying to fetch row with undefined binding', async (assert) => {
    assert.plan(1)
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const user = new User()
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: 1, determiner: 'User', profile_name: 'virk' })
    try {
      await user.profile().fetch()
    } catch ({ message }) {
      assert.match(message, /E_UNSAVED_MODEL_INSTANCE: Cannot process relation, since User model is not persisted to database or relational value is undefined/)
    }
  })

  test('update related model', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: user._id, determiner: 'User', profile_name: 'virk' })
    await user.profile().where('profile_name', 'virk').update({ profile_name: 'hv' })
    const profile = await ioc.use('MongoDatabase').collection('profiles').findOne()
    assert.equal(profile.profile_name, 'hv')
  })

  test('call static methods on related model', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: user._id, determiner: 'User', profile_name: 'virk', likes: 3 })
    // await user.profile().increment('likes', 1)
  })

  test('eagerload and set relation on model instance', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: user._id, determiner: 'User', profile_name: 'virk', likes: 3 })
    await user.load('profile')
    assert.instanceOf(user.$relations.profile, Profile)
  })

  test('filter results while eagerloading', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: user._id, determiner: 'User', profile_name: 'virk', likes: 3 })
    await user.load('profile', (builder) => {
      builder.where('profile_name', 'nikk')
    })
    assert.isNull(user.$relations.profile)
  })

  test('load multiple relations', async (assert) => {
    class Profile extends Model {
    }

    class Identity extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }

      identities () {
        return this.morphOne(Identity)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()
    Identity._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: user._id, determiner: 'User', profile_name: 'virk', likes: 3 })
    await ioc.use('MongoDatabase').collection('identities').insert({ parent_id: user._id, determiner: 'User' })

    await user.load('profile')
    await user.load('identities')
    assert.property(user.$relations, 'profile')
    assert.property(user.$relations, 'identities')
    assert.instanceOf(user.$relations.profile, Profile)
  })

  test('map whereIn values for array of model instances', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const users = await User.all()
    const userInstances = users.rows
    const values = users.first().profile().mapValues(userInstances)
    assert.deepEqual(userInstances.map((user) => user._id), values)
  })

  test('map whereIn values for different primary keys', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk', vid: 100 }, { username: 'nikk', vid: 101 }])
    const users = await User.all()
    const userInstances = users.rows
    const values = users.first().profile().mapValues(userInstances)
    assert.deepEqual(userInstances.map((user) => user._id), values)
  })

  test('group related rows for each unique instance', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const users = await User.all()

    /**
     * Fake profile 1 for 2nd user
     */
    const fakeProfile1 = new Profile()
    fakeProfile1.name = 'vik'
    fakeProfile1.parent_id = users.rows[1]._id

    /**
     * Fake profile 2 but for first user
     */
    const fakeProfile2 = new Profile()
    fakeProfile2.name = 'nik'
    fakeProfile2.parent_id = users.rows[0]._id

    const { values: grouped } = users.first().profile().group([fakeProfile1, fakeProfile2])
    assert.lengthOf(grouped, 2)
    assert.equal(String(grouped[0].identity), String(users.rows[1]._id)) // 2nd user
    assert.equal(grouped[0].value.name, 'vik') // 1nd profile
    assert.equal(String(grouped[0].value.parent_id), String(users.rows[1]._id)) // 2nd user id

    assert.equal(String(grouped[1].identity), String(users.rows[0]._id)) // 1st user
    assert.equal(grouped[1].value.name, 'nik') // 2nd profile
    assert.equal(String(grouped[1].value.parent_id), String(users.rows[0]._id)) // 1st user id
  })

  test('use 2nd instance of related instance when grouping rows', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const users = await User.all()

    /**
     * Fake profile 1 for 2nd user
     */
    const fakeProfile1 = new Profile()
    fakeProfile1.name = 'vik'
    fakeProfile1.parent_id = users.rows[1]._id

    /**
     * Fake profile 2 but for first user
     */
    const fakeProfile2 = new Profile()
    fakeProfile2.name = 'nik'
    fakeProfile2.parent_id = users.rows[0]._id

    /**
     * Fake profile 3 for 1st user. Now since morphOne can be
     * only one relation, the latest one will be used
     */
    const fakeProfile3 = new Profile()
    fakeProfile3.name = 'lik'
    fakeProfile3.parent_id = users.rows[0]._id

    const { values: grouped } = users.first().profile().group([fakeProfile1, fakeProfile2, fakeProfile3])
    assert.lengthOf(grouped, 2)

    assert.equal(String(grouped[0].identity), String(users.rows[1]._id)) // 2nd user
    assert.equal(grouped[0].value.name, 'vik') // 1nd profile
    assert.equal(String(grouped[0].value.parent_id), String(users.rows[1]._id)) // 2nd user id

    assert.equal(String(grouped[1].identity), String(users.rows[0]._id)) // 1st user
    assert.equal(grouped[1].value.name, 'lik') // 3rd profile, since 2nd is overridden due to duplicate
    assert.equal(String(grouped[1].value.parent_id), String(users.rows[0]._id)) // 1st user id
  })

  test('eagerload via query builder', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 })

    const result = await User.query().with('profile').fetch()
    assert.instanceOf(result.first().getRelated('profile'), Profile)
  })

  test('eagerload for multiple parent records via query builder', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await ioc.use('MongoDatabase').collection('profiles').insert([
      { parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 },
      { parent_id: rs.insertedIds[1], determiner: 'User', profile_name: 'nikk', likes: 2 }
    ])

    const result = await User.query().with('profile').fetch()
    assert.equal(result.size(), 2)
    assert.instanceOf(result.rows[0].getRelated('profile'), Profile)
    assert.instanceOf(result.rows[1].getRelated('profile'), Profile)
    assert.equal(result.rows[0].getRelated('profile').profile_name, 'virk')
    assert.equal(result.rows[1].getRelated('profile').profile_name, 'nikk')
  })

  test('modify query builder when fetching relationships', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await ioc.use('MongoDatabase').collection('profiles').insert([
      { parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 },
      { parent_id: rs.insertedIds[1], determiner: 'User', profile_name: 'nikk', likes: 2 }
    ])

    const result = await User.query().with('profile', (builder) => {
      builder.where('likes', '>', 2)
    }).fetch()
    assert.equal(result.size(), 2)
    assert.instanceOf(result.rows[0].getRelated('profile'), Profile)
    assert.isNull(result.rows[1].getRelated('profile'))
    assert.equal(result.rows[0].getRelated('profile').profile_name, 'virk')
  })

  test('eager load with options', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await ioc.use('MongoDatabase').collection('profiles').insert([
      { parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 },
      { parent_id: rs.insertedIds[1], determiner: 'User', profile_name: 'nikk', likes: 2 }
    ])

    const result = await User.query().with('profile', { where: { likes: { $gt: 2 } } }).fetch()
    assert.equal(result.size(), 2)
    assert.instanceOf(result.rows[0].getRelated('profile'), Profile)
    assert.isNull(result.rows[1].getRelated('profile'))
    assert.equal(result.rows[0].getRelated('profile').profile_name, 'virk')
  })

  test('eager load with array', async (assert) => {
    class Profile extends Model {
    }

    class Avatar extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }

      avatar () {
        return this.morphOne(Avatar)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await ioc.use('MongoDatabase').collection('profiles').insert([
      { parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 },
      { parent_id: rs.insertedIds[1], determiner: 'User', profile_name: 'nikk', likes: 2 }
    ])
    await ioc.use('MongoDatabase').collection('avatars').insert([
      { parent_id: rs.insertedIds[0], determiner: 'User', file: '/images/avatar.png' },
      { parent_id: rs.insertedIds[1], determiner: 'User', file: '/images/avatar.png' }
    ])

    const result = await User.query().with(['avatar', 'profile']).fetch()
    assert.equal(result.size(), 2)
    assert.instanceOf(result.rows[0].getRelated('profile'), Profile)
    assert.equal(result.rows[0].getRelated('profile').profile_name, 'virk')
    assert.instanceOf(result.rows[0].getRelated('avatar'), Avatar)
    assert.equal(result.rows[0].getRelated('avatar').file, '/images/avatar.png')
  })

  test('eager load with object', async (assert) => {
    class Profile extends Model {
    }

    class Avatar extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }

      avatar () {
        return this.morphOne(Avatar)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await ioc.use('MongoDatabase').collection('profiles').insert([
      { parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 },
      { parent_id: rs.insertedIds[1], determiner: 'User', profile_name: 'nikk', likes: 2 }
    ])

    const result = await User.query().with({ profile: { where: { likes: { $gt: 2 } } } }).fetch()
    assert.equal(result.size(), 2)
    assert.instanceOf(result.rows[0].getRelated('profile'), Profile)
    assert.isNull(result.rows[1].getRelated('profile'))
    assert.equal(result.rows[0].getRelated('profile').profile_name, 'virk')
  })

  test('fetch nested relationships', async (assert) => {
    class Picture extends Model {
    }

    class Profile extends Model {
      picture () {
        return this.morphOne(Picture)
      }
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()
    Picture._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const rsProfile = await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 })
    await ioc.use('MongoDatabase').collection('pictures').insert({ parent_id: rsProfile.insertedIds[0], determiner: 'Profile', storage_path: '/foo' })

    const user = await User.query().with('profile.picture').fetch()
    assert.instanceOf(user.first().getRelated('profile').getRelated('picture'), Picture)
  })

  test('add runtime constraints on nested relationships', async (assert) => {
    class Picture extends Model {
    }

    class Profile extends Model {
      picture () {
        return this.morphOne(Picture)
      }
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()
    Picture._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const rsProfile = await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 })
    await ioc.use('MongoDatabase').collection('pictures').insert({ profile_id: rsProfile.insertedIds[0], storage_path: '/foo' })

    const user = await User.query().with('profile.picture', (builder) => {
      builder.where('storage_path', '/bar')
    }).fetch()
    assert.isNull(user.first().getRelated('profile').getRelated('picture'))
  })

  test('add runtime constraints on child relationships and not grandchild', async (assert) => {
    class Picture extends Model {
    }

    class Profile extends Model {
      picture () {
        return this.morphOne(Picture)
      }
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()
    Picture._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const rsProfile = await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 })
    await ioc.use('MongoDatabase').collection('pictures').insert({ profile_id: rsProfile.insertedIds[0], storage_path: '/foo' })

    const user = await User.query().with('profile', (builder) => {
      builder.where('likes', '>', 3).with('picture')
    }).fetch()
    assert.isNull(user.first().getRelated('profile'))
  })

  test('eagerload and paginate via query builder', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await ioc.use('MongoDatabase').collection('profiles').insert([
      { parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 },
      { parent_id: rs.insertedIds[1], determiner: 'User', profile_name: 'nikk', likes: 2 }
    ])

    const users = await User.query().with('profile').paginate(1, 1)
    assert.instanceOf(users, VanillaSerializer)
    assert.equal(users.size(), 1)
    assert.instanceOf(users.first().getRelated('profile'), Profile)
    assert.equal(users.first().getRelated('profile').profile_name, 'virk')
  })

  test('eagerload when calling first', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 })

    const user = await User.query().with('profile').first()
    assert.instanceOf(user.getRelated('profile'), Profile)
  })

  test('set model parent when fetched as a relation', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 })

    const user = await User.query().with('profile').first()
    assert.equal(user.getRelated('profile').$parent, 'User')
    assert.isTrue(user.getRelated('profile').hasParent)
  })

  test('set model parent when fetched via query builder fetch method', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    User._bootIfNotBooted()
    Profile._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 })

    const user = await User.query().with('profile').fetch()
    assert.equal(user.first().getRelated('profile').$parent, 'User')
    assert.isTrue(user.first().getRelated('profile').hasParent)
  })

  test('throw exception when trying to eagerload relation twice', async (assert) => {
    assert.plan(2)

    class Car extends Model {
    }

    class User extends Model {
      cars () {
        return this.hasMany(Car)
      }
    }

    Car._bootIfNotBooted()
    User._bootIfNotBooted()

    const rs = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    await ioc.use('MongoDatabase').collection('profiles').insert({ parent_id: rs.insertedIds[0], determiner: 'User', profile_name: 'virk', likes: 3 })

    const user = await User.query().with('cars').first()
    assert.instanceOf(user.getRelated('cars'), VanillaSerializer)
    // assert.equal(user.getRelated('cars').size(), 1)

    try {
      await user.load('cars')
    } catch ({ message }) {
      assert.match(message, /E_CANNOT_OVERRIDE_RELATION: Trying to eagerload cars relationship twice/)
    }
  })

  test('save related morphOne relation', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    Profile._bootIfNotBooted()
    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()

    assert.isTrue(user.$persisted)

    const profile = new Profile()
    profile.profile_name = 'virk'
    await user.profile().save(profile)

    assert.equal(String(profile.parent_id), String(user._id))
    assert.isTrue(profile.$persisted)
  })

  test('create related instance', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    Profile._bootIfNotBooted()
    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()

    assert.isTrue(user.$persisted)
    const profile = await user.profile().create({ profile_name: 'virk' })
    assert.equal(String(profile.parent_id), String(user._id))
    assert.isTrue(profile.$persisted)
  })

  test('persist parent model if it\'s not persisted', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    Profile._bootIfNotBooted()
    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    assert.isTrue(user.isNew)

    const profile = new Profile()
    profile.profile_name = 'virk'

    await user.profile().save(profile)
    assert.equal(String(profile.parent_id), String(user._id))
    assert.isTrue(profile.$persisted)
    assert.isTrue(user.$persisted)
  })

  test('persist parent model if it\'s not persisted via create method', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    Profile._bootIfNotBooted()
    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    assert.isTrue(user.isNew)

    const profile = await user.profile().create({ profile_name: 'virk' })
    assert.equal(String(profile.parent_id), String(user._id))
    assert.isTrue(profile.$persisted)
    assert.isTrue(user.$persisted)
  })

  test('createMany with morphOne should throw exception', (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    Profile._bootIfNotBooted()
    User._bootIfNotBooted()

    const user = new User()
    const fn = () => user.profile().createMany({ profile_name: 'virk' })
    assert.throw(fn, 'E_INVALID_RELATION_METHOD: createMany is not supported by morphOne relation')
  })

  test('saveMany with morphOne should throw exception', (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    Profile._bootIfNotBooted()
    User._bootIfNotBooted()

    const user = new User()
    const fn = () => user.profile().saveMany({ profile_name: 'virk' })
    assert.throw(fn, 'E_INVALID_RELATION_METHOD: saveMany is not supported by morphOne relation')
  })

  test('delete related row', async (assert) => {
    class Profile extends Model {
    }

    class User extends Model {
      profile () {
        return this.morphOne(Profile)
      }
    }

    Profile._bootIfNotBooted()
    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    await user.profile().create({ profile_name: 'virk' })
    await user.profile().delete()
    const profiles = await ioc.use('MongoDatabase').collection('profiles').find()
    assert.lengthOf(profiles, 0)
  })
})
ame = 'virk'
    await user.save()
    await user.profile().create({ profile_name: 'virk' })
    await user.profile().delete()
    const profiles = await ioc.use('MongoDatabase').collection('profiles').find()
    assert.lengthOf(profiles, 0)
  })
})
