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
const moment = require('moment')
// const _ = require('lodash')
const { ioc } = require('@adonisjs/fold')
const { Config, setupResolver } = require('@adonisjs/sink')

const helpers = require('./helpers')
const Model = require('../../src/LucidMongo/Model')
const DatabaseManager = require('../../src/Database/Manager')
const VanillaSerializer = require('../../src/LucidMongo/Serializers/Vanilla')
const _ = require('lodash')

test.group('MongoModel', (group) => {
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
    await helpers.createCollections(ioc.use('MongoDatabase'))
    setupResolver()
  })

  group.afterEach(async () => {
    await ioc.use('MongoDatabase').collection('users').delete()
    await ioc.use('MongoDatabase').collection('my_users').delete()
  })

  group.after(async () => {
    await helpers.dropCollections(ioc.use('MongoDatabase'))
    ioc.use('MongoDatabase').close()
    try {
      await fs.remove(path.join(__dirname, './tmp'))
    } catch (error) {
      if (process.platform !== 'win32' || error.code !== 'EBUSY') {
        throw error
      }
    }
  }).timeout(0)

  test('run queries using query builder', (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const query = User.query()
    assert.deepEqual(query.query._conditions, {})
  })

  test('define different collection for a model', (assert) => {
    class User extends Model {
      static get collection () {
        return 'my_users'
      }
    }

    User._bootIfNotBooted()
    const query = User.query()
    assert.equal(query.collection, 'my_users')
  })

  test('define collection prefix for a model', (assert) => {
    class User extends Model {
      static get prefix () {
        return 'my_'
      }
    }

    User._bootIfNotBooted()
    const query = User.query()
    assert.equal(query.collection, 'my_users')
  })

  test('call the boot method only once', (assert) => {
    let callCounts = 0
    class User extends Model {
      static boot () {
        super.boot()
        callCounts++
      }
    }

    User._bootIfNotBooted()
    User._bootIfNotBooted()
    assert.equal(callCounts, 1)
  })

  test('should be able to define model attributes on model instance', (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const user = new User()
    user.fill({ username: 'virk', age: 22 })
    assert.deepEqual(user.$attributes, { username: 'virk', age: 22 })
  })

  test('do not remove attribute values when calling merge', (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const user = new User()
    user.fill({ username: 'virk', age: 22 })
    user.merge({ age: 23 })
    assert.deepEqual(user.$attributes, { username: 'virk', age: 23 })
  })

  test('call setters when defining attributes via merge', (assert) => {
    class User extends Model {
      setUsername (username) {
        return username.toUpperCase()
      }
    }

    User._bootIfNotBooted()
    const user = new User()
    user.merge({ username: 'virk', age: 22 })
    assert.deepEqual(user.$attributes, { username: 'VIRK', age: 22 })
  })

  test('remove existing attributes when calling fill', (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const user = new User()
    user.fill({ username: 'virk', age: 22 })
    user.fill({ username: 'virk' })
    assert.deepEqual(user.$attributes, { username: 'virk' })
  })

  test('call setters when defining attributes via fill', (assert) => {
    class User extends Model {
      setUsername (username) {
        return username.toUpperCase()
      }
    }

    User._bootIfNotBooted()
    const user = new User()
    user.fill({ username: 'virk', age: 22 })
    assert.deepEqual(user.$attributes, { username: 'VIRK', age: 22 })
  })

  test('call setters when defining attributes manually', (assert) => {
    class User extends Model {
      setUsername (username) {
        return username.toUpperCase()
      }
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'virk'
    assert.deepEqual(user.$attributes, { username: 'VIRK' })
  })

  test('save attributes to the database and update model state', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'virk'
    await user.save()
    assert.isTrue(user.$persisted)
    assert.isFalse(user.isNew)
  })

  test('return proper primary key value using primaryKeyValue getter', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'virk'
    await user.save()
    assert.isNotNull(user.primaryKeyValue)
  })

  // test('define different primary key for a given model', async (assert) => {
  //   class User extends Model {
  //     static get primaryKey () {
  //       return 'uuid'
  //     }

  //     static get collection () {
  //       return 'my_users'
  //     }

  //     static get incrementing () {
  //       return false
  //     }
  //   }

  //   User._bootIfNotBooted()
  //   const user = new User()
  //   user.username = 'virk'
  //   user.uuid = 112000
  //   await user.save()

  //   assert.equal(user.primaryKeyValue, 112000)
  //   assert.equal(user.primaryKeyValue, user.uuid)
  // })

  test('add hook for a given type', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    User.addHook('beforeCreate', function () { })
    User.addHook('afterCreate', function () { })

    assert.lengthOf(User.$hooks.before._handlers.create, 1)
    assert.lengthOf(User.$hooks.after._handlers.create, 1)
  })

  test('add hooks as an array', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    User.addHook('beforeCreate', [function () { }, function () { }])
    assert.lengthOf(User.$hooks.before._handlers.create, 2)
  })

  test('throw exception when hook cycle is invalid', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const fn = () => User.addHook('orCreate', function () {
    })
    assert.throw(fn, 'E_INVALID_PARAMETER: Invalid hook event {orCreate}')
  })

  test('call before and after create hooks when saving the model for first time', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const stack = []
    User.addHook('beforeCreate', function () {
      stack.push('before')
    })

    User.addHook('afterCreate', function () {
      stack.push('after')
    })

    const user = new User()
    await user.save()
    assert.deepEqual(stack, ['before', 'after'])
  })

  test('abort insert if before create throws an exception', async (assert) => {
    assert.plan(2)
    class User extends Model {
    }

    User._bootIfNotBooted()

    User.addHook('beforeCreate', function () {
      throw new Error('Something bad happened')
    })

    User.addHook('afterCreate', function () { })

    const user = new User()
    try {
      await user.save()
    } catch ({ message }) {
      assert.equal(message, 'Something bad happened')
      const users = await ioc.use('MongoDatabase').collection('users').find()
      assert.lengthOf(users, 0)
    }
  })

  test('update model when already persisted', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'virk'
    await user.save()
    user.username = 'nikk'
    await user.save()
    const users = await ioc.use('MongoDatabase').collection('users').find()
    assert.lengthOf(users, 1)
    assert.equal(users[0].username, user.username)
    assert.equal(String(users[0]._id), String(user.primaryKeyValue))
  })

  test('only update when there are dirty values', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const queries = []
    User.onQuery((query) => queries.push(query))

    const user = new User()
    user.username = 'virk'
    await user.save()
    await user.save()

    // assert.lengthOf(queries, 1)
  })

  test('update model for multiple times', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const queries = []
    User.onQuery((query) => queries.push(query))

    const user = new User()
    user.username = 'virk'
    await user.save()
    user.username = 'nikk'
    await user.save()
    user.username = 'virk'
    await user.save()

    // assert.lengthOf(queries, 3)

    assert.deepEqual(user.dirty, {})
  })

  test('set timestamps automatically', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'virk'
    await user.save()
    assert.isDefined(user.created_at)
    assert.isDefined(user.updated_at)
  })

  test('set timestamps automatically in existing instance', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'virk'
    await user.save()
    const originalCreatedAt = user.created_at
    const originalUpdatedAt = user.updated_at

    user.username = 'zizaco'
    await user.save()
    assert.strictEqual(user.created_at, originalCreatedAt, 'created_at should NOT be replaced upon update')
    assert.notStrictEqual(user.updated_at, originalUpdatedAt, 'updated_at of instance SHOULD be replaced upon update')
  })

  test('do not set timestamps when columns are not defined', async (assert) => {
    class User extends Model {
      static get createdAtColumn () {
        return null
      }
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'virk'
    await user.save()
    assert.isUndefined(user.created_at)
    assert.isDefined(user.updated_at)
  })

  test('return serializer instance when calling fetch', async (assert) => {
    class User extends Model {
    }
    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const users = await User.query().fetch()
    assert.instanceOf(users, VanillaSerializer)
  })

  test('cast all dates to moment objects after fetch', async (assert) => {
    class User extends Model {
    }
    User._bootIfNotBooted()
    const user = new User()
    user.username = 'virk'
    await user.save()

    const users = await User.query().fetch()
    assert.instanceOf(users.first().created_at, moment)
  })

  test('collection toJSON should call model toJSON and getters', async (assert) => {
    class User extends Model {
      getCreatedAt (date) {
        return date.fromNow()
      }
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'virk'
    await user.save()

    const users = await User.query().fetch()
    const json = users.toJSON()
    assert.equal(json[0].created_at, 'a few seconds ago')
  })

  test('update model over insert when fetched from database', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const users = await User.query().fetch()
    const user = users.first()
    user.username = 'nikk'
    await user.save()
  })

  test('call update hooks when updating model', async (assert) => {
    const stack = []
    class User extends Model {
      static boot () {
        super.boot()
        this.addHook('beforeUpdate', function () {
          stack.push('before')
        })

        this.addHook('afterUpdate', function () {
          stack.push('after')
        })
      }
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'nikk'
    await user.save()
    user.username = 'virk'
    await user.save()
    assert.deepEqual(stack, ['before', 'after'])
  })

  test('call save hooks when updating or creating model', async (assert) => {
    const stack = []
    class User extends Model {
      static boot () {
        super.boot()
        this.addHook('beforeSave', function (model) {
          stack.push(`before:${model.$persisted}`)
        })

        this.addHook('afterSave', function () {
          stack.push('after')
        })
      }
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'nikk'
    await user.save()
    user.username = 'virk'
    await user.save()
    assert.deepEqual(stack, ['before:false', 'after', 'before:true', 'after'])
  })

  test('update updated_at timestamp for mass updates', async (assert) => {
    class User extends Model {
      static get dates () {
        const dates = super.dates
        dates.push('login_at')
        return dates
      }
    }

    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await User.query().where('username', 'virk').update({ login_at: new Date() })
    const users = await ioc.use('MongoDatabase').collection('users').find()
    assert.equal(moment(users[0].updated_at).format('YYYY-MM-DD'), moment().format('YYYY-MM-DD'))
  })

  test('attach computed properties to the final output', async (assert) => {
    class User extends Model {
      static get computed () {
        return ['full_name']
      }

      getFullName ({ username }) {
        return `Mr. ${username}`
      }
    }

    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const users = await User.query().where('username', 'virk').fetch()
    assert.equal(users.first().toObject().full_name, 'Mr. virk')
  })

  test('only pick visible fields', async (assert) => {
    class User extends Model {
      static get visible () {
        return ['created_at']
      }
    }

    User._bootIfNotBooted()

    let user = await User.create({ username: 'virk' })
    assert.deepEqual(Object.keys(user.toObject()), ['created_at'])

    await User.createMany([{ username: 'virk' }, { username: 'nikk' }])
    const users = await User.query().where('username', 'virk').fetch()
    user = users.first()
    assert.deepEqual(Object.keys(user.toObject()), ['created_at'])

    user.reload()
    assert.deepEqual(Object.keys(user.toObject()), ['created_at'])

    user = await User.find(users.first()._id)
    assert.deepEqual(Object.keys(user.toObject()), ['created_at'])

    await user.reload()
    assert.deepEqual(Object.keys(user.toObject()), ['created_at'])
  })

  test('omit hidden fields', async (assert) => {
    class User extends Model {
      static get hidden () {
        return ['created_at']
      }
    }

    User._bootIfNotBooted()
    let user = await User.create({ username: 'virk' })
    assert.deepEqual(Object.keys(user.toObject()).sort(), [
      '_id', 'username', 'updated_at'
    ].sort())

    await User.createMany([{ username: 'virk' }, { username: 'nikk' }])
    const users = await User.query().where('username', 'virk').fetch()

    user = users.first()
    assert.deepEqual(Object.keys(user.toObject()).sort(), [
      '_id', 'username', 'updated_at'
    ].sort())

    await user.reload()
    assert.deepEqual(Object.keys(users.first().toObject()).sort(), [
      '_id', 'username', 'updated_at'
    ].sort())

    user = await User.find(user._id)
    assert.deepEqual(Object.keys(users.first().toObject()).sort(), [
      '_id', 'username', 'updated_at'
    ].sort())

    await user.reload()
    assert.deepEqual(Object.keys(users.first().toObject()).sort(), [
      '_id', 'username', 'updated_at'
    ].sort())
  })

  test('apply all global scopes to the query builder', async (assert) => {
    class User extends Model {
    }
    User._bootIfNotBooted()
    User.addGlobalScope(function (builder) {
      builder.where('deleted_at', null)
    })

    const query = User.query().where('username', 'virk')._applyScopes()
    assert.deepEqual(query.query._conditions, { username: 'virk', deleted_at: null })
  })

  test('instruct query builder to ignore all query scopes', async (assert) => {
    class User extends Model {
    }
    User._bootIfNotBooted()
    User.addGlobalScope(function (builder) {
      builder.where('deleted_at', null)
    })

    const query = User.query().where('username', 'virk').ignoreScopes()._applyScopes()
    assert.deepEqual(query.query._conditions, { username: 'virk' })
  })

  test('instruct query builder to ignore selected scopes', async (assert) => {
    class User extends Model {
    }
    User._bootIfNotBooted()
    User.addGlobalScope(function (builder) {
      builder.where('deleted_at', null)
    }, 'softDeletes')

    User.addGlobalScope(function (builder) {
      builder.where('login_at', '>=', '2017')
    }, 'loggedOnce')

    const query = User.query().where('username', 'virk').ignoreScopes(['softDeletes'])._applyScopes()
    assert.deepEqual(query.query._conditions, { username: 'virk', login_at: { $gte: '2017' } })
  })

  test('define local scopes', async (assert) => {
    class User extends Model {
      static scopeIsLogged (builder) {
        builder.whereNotNull('login_at')
      }
    }

    User._bootIfNotBooted()

    const query = User.query().where('username', 'virk').isLogged()
    assert.deepEqual(query.query._conditions, { username: 'virk', login_at: { $exists: true } })
  })

  test('pass arguments to local scopes', async (assert) => {
    class User extends Model {
      static scopeIsLogged (builder, time) {
        builder.where('login_at', '>', time)
      }
    }

    User._bootIfNotBooted()

    const date = new Date()
    const query = User.query().where('username', 'virk').isLogged(date)
    assert.deepEqual(query.query._conditions, { username: 'virk', login_at: { $gt: moment(date).toDate() } })
  })

  test('find model instance using find method', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const result = await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.find(result.insertedIds[0])
    assert.instanceOf(user, User)
    assert.equal(user.username, 'virk')
    assert.isFalse(user.isNew)
    assert.isFalse(user.isDirty)
  })

  test('find with a single where clause', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.findBy('username', 'virk')
    assert.instanceOf(user, User)
    assert.equal(user.username, 'virk')
    assert.isFalse(user.isNew)
    assert.isFalse(user.isDirty)
  })

  test('call after find hooks on findBy', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    const stack = []
    User.addHook('afterFind', async function () {
      await helpers.sleep(1)
      stack.push('afterFind')
    })

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    await User.findBy('username', 'virk')
    assert.deepEqual(stack, ['afterFind'])
  })

  test('pass model instance to after find hook', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    let hookInstance = null
    User.addHook('afterFind', function (model) {
      hookInstance = model
    })

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.findBy('username', 'virk')
    assert.deepEqual(hookInstance, user)
  })

  test('return everything from the database', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const users = await User.all()
    assert.instanceOf(users, VanillaSerializer)
  })

  test('pick x number of rows from database', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const users = await User.pick(1)
    assert.instanceOf(users, VanillaSerializer)
    assert.equal(users.first().username, 'virk')
  })

  test('pick inverse x number of rows from database', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const users = await User.pickInverse(1)
    assert.instanceOf(users, VanillaSerializer)
    assert.equal(users.first().username, 'nikk')
  })

  test('return an array of ids from the database', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const userIds = await User.ids()
    assert.lengthOf(userIds, 2)
  })

  test('return a pair of key/values from the database', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const users = await User.pair('_id', 'username')
    assert.deepEqual(Object.values(users), ['virk', 'nikk'])
  })

  test('paginate model', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const users = await User.query().paginate(1, 1)
    assert.instanceOf(users, VanillaSerializer)
    assert.deepEqual(users.pages, { perPage: 1, total: helpers.formatNumber(2), page: 1, lastPage: 2 })
    assert.equal(users.first().username, 'virk')
  })

  test('paginate model with select clause', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk', name: 'virk' }, { username: 'nikk', name: 'nikk' }])
    const users = await User.query({ select: 'username' }).paginate(1, 1)
    assert.instanceOf(users, VanillaSerializer)
    assert.deepEqual(users.pages, { perPage: 1, total: helpers.formatNumber(2), page: 1, lastPage: 2 })
    assert.equal(users.first().username, 'virk')
    assert.notExists(users.first().name)
  })

  test('return first row from database on calling static method', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const user = await User.first()
    assert.instanceOf(user, User)
    assert.equal(user.username, 'virk')
  })

  test('return find static method', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    const result = await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    const user = await User.find(result.insertedIds[0])
    assert.instanceOf(user, User)
    assert.equal(user.username, 'virk')
  })

  test('auto format dates via formatDates when creating', async (assert) => {
    const formatting = []

    class User extends Model {
      static formatDates (key, value) {
        const formattedValue = super.formatDates(key, value)
        formatting.push({ key, value: formattedValue })
      }
    }

    User._bootIfNotBooted()
    const user = new User()
    user.username = 'virk'
    await user.save()
    const keys = formatting.map((item) => item.key)
    const values = formatting.map((item) => moment(item.value).isValid())
    assert.deepEqual(keys, ['created_at', 'updated_at'])
    assert.deepEqual(values, [true, true])
  })

  test('auto format just updated_at via formatDates when updating', async (assert) => {
    const formatting = []

    class User extends Model {
      static formatDates (key, value) {
        const formattedValue = super.formatDates(key, value)
        formatting.push({ key, value: formattedValue })
      }
    }

    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.first()
    user.username = 'nikk'
    await user.save()
    const keys = formatting.map((item) => item.key)
    const values = formatting.map((item) => moment(item.value).isValid())
    assert.deepEqual(keys, ['updated_at'])
    assert.deepEqual(values, [true])
  })

  test('auto format when bulk updating', async (assert) => {
    const formatting = []

    class User extends Model {
      static formatDates (key, value) {
        const formattedValue = super.formatDates(key, value)
        formatting.push({ key, value: formattedValue })
      }
    }

    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    await User.query().where('username', 'virk').update({ username: 'nikk' })
    const keys = formatting.map((item) => item.key)
    const values = formatting.map((item) => moment(item.value).isValid())
    assert.deepEqual(keys, ['updated_at'])
    assert.deepEqual(values, [true])
  })

  test('do not mutate bulk updates object', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const updates = { username: 'nikk' }
    await User.query().where('username', 'virk').update(updates)
    assert.deepEqual(updates, { username: 'nikk' })
  })

  test('do not call formatDates when setters for them are defined', async (assert) => {
    const formatting = []

    class User extends Model {
      static formatDates (key, value) {
        const formattedValue = super.formatDates(key, value)
        formatting.push({ key, value: formattedValue })
        return formattedValue
      }

      setCreatedAt () {
        return null
      }
    }

    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    const keys = formatting.map((item) => item.key)
    const values = formatting.map((item) => moment(item.value).isValid())
    assert.deepEqual(keys, ['updated_at'])
    assert.deepEqual(values, [true])
    assert.isNull(user.created_at)
  })

  test('do not call formatDates when not part of dates', async (assert) => {
    const formatting = []

    class User extends Model {
      static formatDates (key, value) {
        const formattedValue = super.formatDates(key, value)
        formatting.push({ key, value: formattedValue })
        return formattedValue
      }

      static get createdAtColumn () {
        return null
      }
    }

    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    const keys = formatting.map((item) => item.key)
    const values = formatting.map((item) => moment(item.value).isValid())
    assert.deepEqual(keys, ['updated_at'])
    assert.deepEqual(values, [true])
    assert.isUndefined(user.created_at)
  })

  test('use setter value when bulk updating and do not call formatDates', async (assert) => {
    const formatting = []

    class User extends Model {
      static formatDates (key, value) {
        const formattedValue = super.formatDates(key, value)
        formatting.push({ key, value: formattedValue })
        return formattedValue
      }

      setUpdatedAt () {
        return null
      }
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    await User.query().where('username', 'virk').update({ username: 'nikk' })
    const users = await User.query().pair('_id', 'updated_at')
    assert.deepEqual(formatting, [])
    assert.isObject(users)
  })

  test('call castDates when toJSON or toObject is called', async (assert) => {
    const casting = []

    class User extends Model {
      static castDates (key, value) {
        const formattedValue = super.castDates(key, value)
        casting.push({ key, value: formattedValue })
        return formattedValue
      }
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase')
      .collection('users')
      .insert({ username: 'virk', created_at: new Date(), updated_at: new Date() })

    const user = await User.first()
    const json = user.toObject()
    assert.isTrue(moment(json.created_at).isValid())
    assert.isTrue(moment(json.updated_at).isValid())
    assert.deepEqual(casting.map((field) => field.key), ['created_at', 'updated_at'])
  })

  test('do not cast date when field not defined as date', async (assert) => {
    const casting = []

    class User extends Model {
      static castDates (key, value) {
        const formattedValue = value.format('YYYY-MM-DD')
        casting.push({ key, value: formattedValue })
        return formattedValue
      }

      static get createdAtColumn () {
        return null
      }
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase')
      .collection('users')
      .insert({ username: 'virk', created_at: new Date(), updated_at: new Date() })

    const user = await User.first()
    const json = user.toObject()
    assert.isFalse(moment(json.created_at.toString(), 'YYYY-MM-DD', true).isValid())
    assert.isTrue(moment(json.updated_at.toString(), 'YYYY-MM-DD', true).isValid())
    assert.deepEqual(casting.map((field) => field.key), ['updated_at'])
  })

  test('do not cast date when field has a getter', async (assert) => {
    const casting = []

    class User extends Model {
      static castDates (key, value) {
        const formattedValue = super.castDates(key, value)
        casting.push({ key, value: formattedValue })
        return formattedValue
      }

      getCreatedAt (value) {
        return value.fromNow(true)
      }
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase')
      .collection('users')
      .insert({ username: 'virk', created_at: new Date(), updated_at: new Date() })

    const user = await User.first()
    const json = user.toObject()
    assert.equal(json.created_at, 'a few seconds')
    assert.deepEqual(casting.map((field) => field.key), ['updated_at'])
  })

  test('cast dates should work for custom dates as well', async (assert) => {
    const casting = []

    class User extends Model {
      static castDates (key, value) {
        const formattedValue = super.castDates(key, value)
        casting.push({ key, value: formattedValue })
        return formattedValue
      }

      static get dates () {
        const existingDates = super.dates
        existingDates.push('login_at')
        return existingDates
      }
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase')
      .collection('users')
      .insert({ username: 'virk', created_at: new Date(), updated_at: new Date(), login_at: new Date() })

    const user = await User.first()
    const json = user.toObject()
    assert.isTrue(moment(json.created_at).isValid())
    assert.isTrue(moment(json.updated_at).isValid())
    assert.isTrue(moment(json.login_at).isValid())
    assert.deepEqual(casting.map((field) => field.key), ['created_at', 'updated_at', 'login_at'])
  })

  test('create model instance and persist it to database', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const user = await User.create({ username: 'virk' })
    assert.isTrue(user.$persisted)
    assert.isFalse(user.isNew)
  })

  test('further changes to instance returned by create should update the model', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    const user = await User.create({ username: 'virk' })
    assert.isTrue(user.$persisted)
    assert.isFalse(user.isNew)
    user.username = 'nikk'
    await user.save()
  })

  test('should be able to delete the model instance', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    const user = await User.create({ username: 'virk' })
    assert.isTrue(user.$persisted)
    assert.isFalse(user.isNew)
    await user.delete()
    const fn = () => {
      user.username = 'virk'
    }

    assert.isTrue(user.isDeleted)
    assert.throw(fn, 'E_DELETED_MODEL: Cannot edit deleted model instance for User model')
  })

  test('ignore global scopes when deleting model', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    User.addGlobalScope(function (builder) {
      builder.where('username', 'virk')
    })

    const user = await User.create({ username: 'virk' })
    assert.isTrue(user.$persisted)
    assert.isFalse(user.isNew)
    await user.delete()
    const fn = () => {
      user.username = 'virk'
    }

    assert.isTrue(user.isDeleted)
    assert.throw(fn, 'E_DELETED_MODEL: Cannot edit deleted model instance for User model')
  })

  test('create an array of models', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()
    const users = await User.createMany([{ username: 'virk' }, { username: 'nikk' }])
    assert.isArray(users)
    assert.isTrue(users[0].$persisted)
    assert.isFalse(users[0].isNew)
    assert.isTrue(users[1].$persisted)
    assert.isFalse(users[1].isNew)
  })

  test('run create hooks for all the models to be created via createMany', async (assert) => {
    const stack = []

    class User extends Model {
    }

    User._bootIfNotBooted()
    User.addHook('beforeCreate', (ctx) => {
      stack.push(ctx.username)
    })

    await User.createMany([{ username: 'virk' }, { username: 'nikk' }])
    assert.deepEqual(stack, ['virk', 'nikk'])
  })

  test('throw an exception when createMany doesn\'t recieves an array', async (assert) => {
    assert.plan(1)
    class User extends Model {
    }

    User._bootIfNotBooted()
    try {
      await User.createMany({ username: 'virk' })
    } catch ({ message }) {
      assert.match(message, /E_INVALID_PARAMETER: User.createMany expects an array of values instead received object/)
    }
  })

  test('throw exception when unable to find row', async (assert) => {
    assert.plan(1)
    class User extends Model {
    }

    try {
      await User.findOrFail(1)
    } catch ({ message }) {
      assert.match(message, /E_MISSING_DATABASE_ROW: Cannot find database row for User model/)
    }
  })

  test('throw exception when unable to find row via findByOrFail', async (assert) => {
    assert.plan(1)
    class User extends Model {
    }

    try {
      await User.findByOrFail('username', 'virk')
    } catch ({ message }) {
      assert.match(message, /E_MISSING_DATABASE_ROW: Cannot find database row for User model/)
    }
  })

  test('throw exception via firstOrFail', async (assert) => {
    assert.plan(1)
    class User extends Model {
    }

    try {
      await User.firstOrFail()
    } catch ({ message }) {
      assert.match(message, /E_MISSING_DATABASE_ROW: Cannot find database row for User model/)
    }
  })

  test('return model instance findByOrFail finds row', async (assert) => {
    assert.plan(1)
    class User extends Model {
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.findByOrFail('username', 'virk')
    assert.instanceOf(user, User)
  })

  test('delete existing model instance', async (assert) => {
    assert.plan(2)
    class User extends Model {
    }
    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    await user.delete()

    assert.isTrue(user.$frozen)
    try {
      user.username = 'foo'
    } catch ({ message }) {
      assert.match(message, /E_DELETED_MODEL: Cannot edit deleted model instance for User model/)
    }
  })

  test('allow to unfreeze model instance', async (assert) => {
    assert.plan(1)
    class User extends Model {
    }

    const user = new User()
    user.freeze()
    user.unfreeze()

    assert.isFalse(user.$frozen)
  })

  test('dates should be an empty array when createdAtColumn and updatedAtColumn is not defined', async (assert) => {
    class User extends Model {
      static get createdAtColumn () {
        return null
      }

      static get updatedAtColumn () {
        return null
      }
    }
    User._bootIfNotBooted()
    assert.deepEqual(User.dates, [])
  })

  test('do not populate dates when columns are set to null', async (assert) => {
    class User extends Model {
      static get createdAtColumn () {
        return null
      }

      static get updatedAtColumn () {
        return null
      }
    }
    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    assert.isUndefined(user.created_at)
    assert.isUndefined(user.updated_at)
  })

  test('throw exception when onQuery doesn\'t recieves as callback', (assert) => {
    assert.plan(1)

    class User extends Model {
      static boot () {
        super.boot()
      }
    }

    const fn = () => User.onQuery('foo')
    assert.throw(fn, 'E_INVALID_PARAMETER: Model.onQuery expects a closure as first parameter')
  })

  test('throw exception when addGlobalScope doesn\'t recieves as callback', (assert) => {
    assert.plan(1)

    class User extends Model {
      static boot () {
        super.boot()
      }
    }

    const fn = () => User.addGlobalScope('foo')
    assert.throw(fn, 'E_INVALID_PARAMETER: Model.addGlobalScope expects a closure as first parameter')
  })

  test('refresh model state', async (assert) => {
    class User extends Model {
      static boot () {
        super.boot()
      }
    }

    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    assert.isUndefined(user.type)
    await ioc.use('MongoDatabase').collection('users').update({ type: 'admin' })
    await user.reload()
    assert.equal(user.type, 'admin')
  })

  test('do not reload when isNew', async (assert) => {
    class User extends Model {
      static boot () {
        super.boot()
      }
    }

    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    assert.isUndefined(user.type)
    await user.reload()
    assert.isUndefined(user.type)
  })

  test('throw exception when on reloas the row is missing', async (assert) => {
    assert.plan(2)
    class User extends Model {
      static boot () {
        super.boot()
      }
    }

    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    assert.isUndefined(user.type)

    await ioc.use('MongoDatabase').collection('users').delete()
    try {
      await user.reload()
    } catch ({ message }) {
      assert.isString(message)
    }
  })

  test('do not reload when model is deleted', async (assert) => {
    assert.plan(2)
    class User extends Model {
      static boot () {
        super.boot()
      }
    }

    User._bootIfNotBooted()

    const user = new User()
    user.username = 'virk'
    await user.save()
    assert.isUndefined(user.type)
    await user.delete()

    try {
      await user.reload()
    } catch ({ message }) {
      assert.match(message, /E_RUNTIME_ERROR: Cannot reload a deleted model instance/)
    }
  })

  test('define after fetch hook', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    const fn = async function () { }
    User.addHook('afterFetch', fn)

    assert.deepEqual(User.$hooks.after._handlers.fetch, [{ handler: fn, name: undefined }])
  })

  test('call after fetch hook when fetching data', async (assert) => {
    assert.plan(2)
    class User extends Model {
    }

    User._bootIfNotBooted()

    const fn = async function (instances) {
      instances.forEach((instance) => {
        assert.instanceOf(instance, User)
      })
    }

    User.addHook('afterFetch', fn)
    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await User.all('username', 'virk')
  })

  test('create a new row when unable to find one', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    const existing = await User.first()
    assert.isNull(existing)

    const user = await User.findOrCreate({ username: 'foo' })
    assert.isTrue(user.$persisted)
    assert.equal(user.username, 'foo')
  })

  test('return existing row when found one', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'foo' })
    const user = await User.findOrCreate({ username: 'foo' })
    assert.isTrue(user.$persisted)
    assert.equal(user.username, 'foo')
  })

  test('pass different payload for create', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    const user = await User.findOrCreate({ username: 'foo' }, { username: 'foo', vid: 2 })
    assert.isTrue(user.$persisted)
    assert.equal(user.username, 'foo')
    assert.equal(user.vid, 2)
  })

  test('new up a row when old doesn\'t exists', async (assert) => {
    class User extends Model {
    }

    User._bootIfNotBooted()

    const user = await User.findOrNew({ username: 'foo' }, { username: 'foo', vid: 2 })
    assert.isFalse(user.$persisted)
    assert.equal(user.username, 'foo')
    assert.equal(user.vid, 2)
  })

  test('should update sub attribute', async (assert) => {
    class User extends Model {
      static get dates () { return super.dates.concat(['birthDate', 'joinDate']) }
    }

    User._bootIfNotBooted()

    const user = await User.create({
      name: 'vik',
      age: 10,
      birthDate: '2000-12-12',
      joinDate: '2000-12-12',
      address: {
        line: 'foo',
        city: 'bar'
      }
    })

    user.address.city = 'hnn'
    user.age = 20
    user.birthDate = '2001-12-12'
    assert.deepEqual(user.dirty, {
      address: {
        line: 'foo',
        city: 'hnn'
      },
      age: 20,
      birthDate: moment.utc('2001-12-12')
    })
  })
})

test.group('Lucid | Query builder', (group) => {
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
    await helpers.createCollections(ioc.use('MongoDatabase'))
    setupResolver()
  })

  group.afterEach(async () => {
    await ioc.use('MongoDatabase').collection('users').delete()
    await ioc.use('MongoDatabase').collection('my_users').delete()
  })

  group.after(async () => {
    await helpers.dropCollections(ioc.use('MongoDatabase'))
    ioc.use('MongoDatabase').close()
    try {
      await fs.remove(path.join(__dirname, './tmp'))
    } catch (error) {
      if (process.platform !== 'win32' || error.code !== 'EBUSY') {
        throw error
      }
    }
  }).timeout(0)

  test('query where and', (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const query = User.where({ $and: [{ name: 'vik' }, { age: { $gte: 30 } }] })
    assert.deepEqual(query.query._conditions, { $and: [{ name: 'vik' }, { age: { $gte: 30 } }] })
  })

  test('query where or', (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const query = User.where({ $or: [{ name: 'vik' }, { age: { $gte: 30 } }] })
    assert.deepEqual(query.query._conditions, { $or: [{ name: 'vik' }, { age: { $gte: 30 } }] })
  })

  test('query where near', (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const query = User.where({ location: { $near: { latitude: 1, longitude: 2 }, $maxDistance: 1000 } })
    assert.deepEqual(query.query._conditions, {
      location: {
        $near: { latitude: 1, longitude: 2 },
        $maxDistance: 1000
      }
    })
  })

  test('query where near sphere', (assert) => {
    class User extends Model {
      static get geometries () { return ['location'] }
    }
    User._bootIfNotBooted()
    const query = User.where({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [2, 1],
            spherical: true
          },
          $maxDistance: 1000
        }
      }
    })
    assert.deepEqual(query.query._conditions, {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [2, 1],
            spherical: true
          },
          $maxDistance: 1000
        }
      }
    })
  })

  test('query where with full text search', (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const query = User.where({ name: { $search: 'vik' } })
    assert.deepEqual(query.query._conditions, { name: { $search: 'vik' } })
  })

  test('query where with callback', (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const query = User.where(function () {
      this.where('name', 'vik').limit(10)
    })
    assert.deepEqual(query.query._conditions, { name: 'vik' })
    assert.deepEqual(query.query.options, { limit: 10 })
  })

  test('where method similar sql', (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const query = User
      .where('name', '=', 'vik')
      .where('field1', '>', 20)
      .where('field2', '<', 20)
      .where('field3', '>=', 20)
      .where('field4', '<=', 20)
      .where('field5', '<>', 'disabled')

    assert.deepEqual(query.query._conditions, {
      name: 'vik',
      field1: { $gt: 20 },
      field2: { $lt: 20 },
      field3: { $gte: 20 },
      field4: { $lte: 20 },
      field5: { $ne: 'disabled' }
    })
  })

  test('call chain mquery', (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const query = User.where('name').eq('vik').where('age').gte(20)
    assert.deepEqual(query.query._conditions, { name: 'vik', age: { $gte: 20 } })
  })

  test('whereNull method', (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const query = User.query().whereNull('name')
    assert.deepEqual(query.query._conditions, { name: { $exists: false } })
  })

  test('whereNotNull method', (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const query = User.query().whereNotNull('name')
    assert.deepEqual(query.query._conditions, { name: { $exists: true } })
  })
})

test.group('Lucid | Query update', (group) => {
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
    await helpers.createCollections(ioc.use('MongoDatabase'))
    setupResolver()
  })

  group.afterEach(async () => {
    await ioc.use('MongoDatabase').collection('users').delete()
    await ioc.use('MongoDatabase').collection('my_users').delete()
  })

  group.after(async () => {
    await helpers.dropCollections(ioc.use('MongoDatabase'))
    ioc.use('MongoDatabase').close()
    try {
      await fs.remove(path.join(__dirname, './tmp'))
    } catch (error) {
      if (process.platform !== 'win32' || error.code !== 'EBUSY') {
        throw error
      }
    }
  }).timeout(0)

  test('Should update all', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [{ name: 'vik', isActive: true }, { name: 'nik', isActive: true }]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    await User.query().update({ isActive: false })
    const newUsers = await User.where({ isActive: false }).fetch()
    assert.lengthOf(newUsers.rows, 2)
  })

  test('should update with condition', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [{ name: 'vik' }, { name: 'vik' }, { name: 'nik' }, { name: 'nik' }]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    await User.query().where({ name: 'vik' }).update({ isActive: true })
    const newUsers = await User.where({ isActive: true }).fetch()
    assert.lengthOf(newUsers.rows, 2)
  })
})

test.group('Lucid | Query delete', (group) => {
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
    await helpers.createCollections(ioc.use('MongoDatabase'))
    setupResolver()
  })

  group.afterEach(async () => {
    await ioc.use('MongoDatabase').collection('users').delete()
    await ioc.use('MongoDatabase').collection('my_users').delete()
  })

  group.after(async () => {
    await helpers.dropCollections(ioc.use('MongoDatabase'))
    ioc.use('MongoDatabase').close()
    try {
      await fs.remove(path.join(__dirname, './tmp'))
    } catch (error) {
      if (process.platform !== 'win32' || error.code !== 'EBUSY') {
        throw error
      }
    }
  }).timeout(0)

  test('Should delete all', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [{ name: 'vik', isActive: true }, { name: 'nik', isActive: true }]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    await User.query().delete()
    const newUsers = await User.all()
    assert.lengthOf(newUsers.rows, 0)
  })

  test('should delete items match with condition', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [{ name: 'vik' }, { name: 'vik' }, { name: 'nik' }, { name: 'nik' }]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    await User.query().where({ name: 'vik' }).delete()
    const newUsers = await User.all()
    assert.lengthOf(newUsers.rows, 2)
  })

  test('call after paginate hook when calling paginate method', async (assert) => {
    assert.plan(3)
    class User extends Model {
    }

    User._bootIfNotBooted()

    const fn = async function (instances, pages) {
      assert.deepEqual(pages, { perPage: 20, total: helpers.formatNumber(2), page: 1, lastPage: 1 })

      instances.forEach((instance) => {
        assert.instanceOf(instance, User)
      })
    }

    User.addHook('afterPaginate', fn)
    await ioc.use('MongoDatabase').collection('users').insert([{ username: 'virk' }, { username: 'nikk' }])
    await User.query().paginate()
  })
})

test.group('Lucid | Aggregate', (group) => {
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
    await helpers.createCollections(ioc.use('MongoDatabase'))
    setupResolver()
  })

  group.afterEach(async () => {
    await ioc.use('MongoDatabase').collection('users').delete()
    await ioc.use('MongoDatabase').collection('my_users').delete()
  })

  group.after(async () => {
    await helpers.dropCollections(ioc.use('MongoDatabase'))
    ioc.use('MongoDatabase').close()
    try {
      await fs.remove(path.join(__dirname, './tmp'))
    } catch (error) {
      if (process.platform !== 'win32' || error.code !== 'EBUSY') {
        throw error
      }
    }
  }).timeout(0)

  test('count method', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [
      { name: 'vik', value: 10 },
      { name: 'vik', value: 10 },
      { name: 'nik', value: 20 },
      { name: 'nik', value: 10 }
    ]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    const count = await User.count()
    assert.equal(count, 4)
    const count2 = await User.count('name')
    assert.deepEqual(_.sortBy(count2, '_id'), [{ _id: 'nik', count: 2 }, { _id: 'vik', count: 2 }])
    const count3 = await User.count({ name: '$name', value: '$value' })
    assert.deepEqual(_.sortBy(count3, row => row._id.name), [
      { _id: { name: 'nik', value: 10 }, count: 1 },
      { _id: { name: 'nik', value: 20 }, count: 1 },
      { _id: { name: 'vik', value: 10 }, count: 2 }
    ])
  })

  test('sum method', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [
      { name: 'vik', value: 10, scope: 1 },
      { name: 'vik', value: 10, scope: 2 },
      { name: 'nik', value: 20, scope: 2 },
      { name: 'nik', value: 10, scope: 2 }
    ]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    const sum = await User.sum('value')
    assert.equal(sum, 50)
    const sum2 = await User.sum('value', 'name')
    assert.deepEqual(_.sortBy(sum2, '_id'), [{ _id: 'nik', sum: 30 }, { _id: 'vik', sum: 20 }])
    const sum3 = await User.sum('value', { name: '$name', scope: '$scope' })
    assert.deepEqual(_.sortBy(sum3, row => row._id.name), [
      { _id: { name: 'nik', scope: 2 }, sum: 30 },
      { _id: { name: 'vik', scope: 2 }, sum: 10 },
      { _id: { name: 'vik', scope: 1 }, sum: 10 }
    ])
  })

  test('avg method', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [
      { name: 'vik', value: 10, scope: 1 },
      { name: 'vik', value: 10, scope: 2 },
      { name: 'nik', value: 20, scope: 2 },
      { name: 'nik', value: 10, scope: 2 }
    ]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    const avg = await User.avg('value')
    assert.equal(avg, 12.5)
    const avg2 = await User.avg('value', 'name')
    assert.deepEqual(_.sortBy(avg2, '_id'), [{ _id: 'nik', avg: 15 }, { _id: 'vik', avg: 10 }])
    const avg3 = await User.avg('value', { name: '$name', scope: '$scope' })
    assert.deepEqual(_.sortBy(avg3, row => row._id.name), [
      { _id: { name: 'nik', scope: 2 }, avg: 15 },
      { _id: { name: 'vik', scope: 2 }, avg: 10 },
      { _id: { name: 'vik', scope: 1 }, avg: 10 }
    ])
  })

  test('max method', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [
      { name: 'vik', value: 10, scope: 1 },
      { name: 'vik', value: 30, scope: 2 },
      { name: 'nik', value: 30, scope: 2 },
      { name: 'nik', value: 40, scope: 2 }
    ]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    const max = await User.max('value')
    assert.equal(max, 40)
    const max2 = await User.max('value', 'name')
    assert.deepEqual(_.sortBy(max2, '_id'), [{ _id: 'nik', max: 40 }, { _id: 'vik', max: 30 }])
    const max3 = await User.max('value', { name: '$name', scope: '$scope' })
    assert.deepEqual(_.sortBy(max3, row => row._id.name), [
      { _id: { name: 'nik', scope: 2 }, max: 40 },
      { _id: { name: 'vik', scope: 2 }, max: 30 },
      { _id: { name: 'vik', scope: 1 }, max: 10 }
    ])
  })

  test('min method', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [
      { name: 'vik', value: 10, scope: 1 },
      { name: 'vik', value: 30, scope: 2 },
      { name: 'nik', value: 30, scope: 2 },
      { name: 'nik', value: 40, scope: 2 }
    ]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    const min = await User.min('value')
    assert.equal(min, 10)
    const min2 = await User.min('value', 'name')
    assert.deepEqual(_.sortBy(min2, '_id'), [{ _id: 'nik', min: 30 }, { _id: 'vik', min: 10 }])
    const min3 = await User.min('value', { name: '$name', scope: '$scope' })
    assert.deepEqual(_.sortBy(min3, row => row._id.name), [
      { _id: { name: 'nik', scope: 2 }, min: 30 },
      { _id: { name: 'vik', scope: 2 }, min: 30 },
      { _id: { name: 'vik', scope: 1 }, min: 10 }
    ])
  })

  test('aggregate method', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [
      { name: 'vik', value: 10, scope: 1 },
      { name: 'vik', value: 30, scope: 2 },
      { name: 'nik', value: 30, scope: 2 },
      { name: 'nik', value: 40, scope: 2 }
    ]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    const $match = { name: 'nik' }
    const $group = { _id: '', sum: { $sum: '$value' } }
    const result = await User.query().aggregate(([{ $match }, { $group }]))
    assert.deepEqual(result, [{ _id: '', sum: 70 }])
  })

  test('distinct method', async (assert) => {
    class User extends Model { }
    User._bootIfNotBooted()
    const users = [{ name: 'vik', score: 10 }, { name: 'vik', score: 30 }, { name: 'nik', score: 30 }, { name: 'nik', score: 40 }]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    const names = await User.distinct('name')
    assert.deepEqual(names, ['vik', 'nik'])
    const names2 = await User.where({ score: { $lt: 30 } }).distinct('name')
    assert.deepEqual(names2, ['vik'])
  })
})
e: 10 }, { name: 'vik', score: 30 }, { name: 'nik', score: 30 }, { name: 'nik', score: 40 }]
    await ioc.use('MongoDatabase').collection('users').insert(users)
    const names = await User.distinct('name')
    assert.deepEqual(names, ['vik', 'nik'])
    const names2 = await User.where({ score: { $lt: 30 } }).distinct('name')
    assert.deepEqual(names2, ['vik'])
  })
})
