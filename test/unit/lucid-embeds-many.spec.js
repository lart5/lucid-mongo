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
const ObjectID = require('mongodb').ObjectID
const helpers = require('./helpers')
const Model = require('../../src/LucidMongo/Model')
const DatabaseManager = require('../../src/Database/Manager')
const VanillaSerializer = require('../../src/LucidMongo/Serializers/Vanilla')

test.group('Relations | Embeds many', (group) => {
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

  test('fetch related instances', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk', emails: [{ address: 'example@gmail.com' }, { address: 'example2@gmail.com' }] })
    const user = await User.first()
    assert.instanceOf(user, User)
    const emails = user.emails().fetch()
    assert.instanceOf(emails, VanillaSerializer)
    assert.equal(emails.size(), 2)
    assert.instanceOf(emails.first(), Email)
    assert.equal(emails.first().address, 'example@gmail.com')
  })

  test('get first related instance', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk', emails: [{ address: 'example@gmail.com' }, { address: 'example2@gmail.com' }] })
    const user = await User.first()
    assert.instanceOf(user, User)
    const email = user.emails().first()
    assert.instanceOf(email, Email)
    assert.equal(email.address, 'example@gmail.com')
  })

  test('find by id related instance', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk', emails: [{ _id: ObjectID(), address: 'example@gmail.com' }, { _id: ObjectID(), address: 'example2@gmail.com' }] })
    const user = await User.first()
    assert.instanceOf(user, User)
    const email = user.emails().find(user.$attributes.emails[1]._id)
    assert.instanceOf(email, Email)
    assert.equal(email.address, 'example2@gmail.com')
  })

  test('through exception when call paginate', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk', emails: [{ _id: 1, address: 'example@gmail.com' }, { _id: 2, address: 'example2@gmail.com' }] })
    const user = await User.first()
    assert.instanceOf(user, User)
    const fn = () => user.emails().paginate(1, 1)
    assert.throw(fn, 'E_INVALID_RELATION_METHOD: paginate is not supported by EmbedsMany relation')
  })

  test('eager load with fetch', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk', emails: [{ address: 'example@gmail.com' }, { address: 'example2@gmail.com' }] })
    const users = await User.with('emails').fetch()
    const emails = users.first().getRelated('emails')
    assert.instanceOf(emails, VanillaSerializer)
    assert.equal(emails.size(), 2)
    assert.instanceOf(emails.first(), Email)
    assert.equal(emails.first().address, 'example@gmail.com')
  })

  test('eager load with first', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk', emails: [{ address: 'example@gmail.com' }, { address: 'example2@gmail.com' }] })
    const user = await User.with('emails').first()
    const emails = user.getRelated('emails')
    assert.instanceOf(emails, VanillaSerializer)
    assert.equal(emails.size(), 2)
    assert.instanceOf(emails.first(), Email)
    assert.equal(emails.first().address, 'example@gmail.com')
  })

  test('eager load with paginate', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk', emails: [{ address: 'example@gmail.com' }, { address: 'example2@gmail.com' }] })
    const users = await User.with('emails').paginate()
    const emails = users.first().getRelated('emails')
    assert.instanceOf(emails, VanillaSerializer)
    assert.equal(emails.size(), 2)
    assert.instanceOf(emails.first(), Email)
    assert.equal(emails.first().address, 'example@gmail.com')
  })

  test('save relation', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.first()
    const email = new Email({ address: 'example@gmail.com' })
    await user.emails().save(email)
    assert.isNotNull(email._id)
    await user.reload()
    assert.lengthOf(user.$attributes.emails, 1)
  })

  test('create new relation', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.first()
    const email = await user.emails().create({ address: 'example@gmail.com' })
    assert.isNotNull(email._id)
    assert.equal(email.address, 'example@gmail.com')
    await user.reload()
    assert.lengthOf(user.$attributes.emails, 1)
  })

  test('call hooks when create new relation', async (assert) => {
    assert.plan(2)
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    const fn = async function (instance) {
      assert.instanceOf(instance, Email)
    }

    Email.addHook('beforeCreate', fn)
    Email.addHook('afterCreate', fn)

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.first()
    await user.emails().create({ address: 'example@gmail.com' })
  })

  test('update existing relation', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.first()
    await user.emails().create({ address: 'example@gmail1.com' })
    await user.emails().create({ address: 'example@gmail2.com' })
    const email = await user.emails().first()
    email.merge({ enabled: true })
    await user.emails().save(email)
    await user.reload()
    assert.lengthOf(user.$attributes.emails, 2)
    const emails = await user.emails().fetch()
    assert.equal(emails.first().enabled, true)
    assert.equal(emails.last().enabled, undefined)
  })

  test('call hooks when create new relation', async (assert) => {
    assert.plan(2)
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    const fn = async function (instance) {
      assert.instanceOf(instance, Email)
    }

    Email.addHook('beforeUpdate', fn)
    Email.addHook('afterUpdate', fn)

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.first()
    await user.emails().create({ address: 'example@gmail1.com' })
    await user.emails().create({ address: 'example@gmail2.com' })
    const email = await user.emails().first()
    email.merge({ enabled: true })
    await user.emails().save(email)
  })

  test('delete a relation', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.first()
    const email = await user.emails().create({ address: 'example@gmail.com' })
    await user.emails().delete(email._id)
    assert.lengthOf(user.$attributes.emails, 0)
  })

  test('delete All relations', async (assert) => {
    class User extends Model {
      emails () {
        return this.embedsMany(Email)
      }
    }

    class Email extends Model {

    }

    User._bootIfNotBooted()
    Email._bootIfNotBooted()

    await ioc.use('MongoDatabase').collection('users').insert({ username: 'virk' })
    const user = await User.first()
    await user.emails().create({ address: 'example@gmail1.com' })
    await user.emails().create({ address: 'example@gmail2.com' })
    await user.emails().create({ address: 'example@gmail3.com' })
    await user.emails().deleteAll()
    await user.reload()
    assert.isUndefined(user.$attributes.emails)
  })
})
