const packageJson = require('../package.json')

const fs = require('fs')
const path = require('path')
const el = require('./echonet-lite')
const buildAccessory = require('./accessory')

// Lazy-initialized.
let Accessory, hap

// Storage.
let storagePath = null
let storage = {accessories: {}}

// Called by homebridge.
module.exports = (homebridge) => {
  Accessory = homebridge.platformAccessory
  hap = homebridge.hap

  // Read settings.
  try {
    storagePath = path.join(homebridge.user.storagePath(), 'persist', 'ELPlatform.json')
    storage = JSON.parse(fs.readFileSync(storagePath))
  } catch {}

  // Register the platform.
  homebridge.registerPlatform(packageJson.name, "ELPlatform", ELPlatform, true)
}

// UUID for the refresh button.
const kRefreshUUID = '076cc8c6-7f72-441b-81cb-d85e27386dc1'

class ELPlatform {
  constructor(log, config, api) {
    this.log = log
    this.config = config
    this.api = api

    this.isDiscovering = false
    this.refreshSwitch = null

    this.accessories = new Map
    this.api.once('didFinishLaunching', () => this._init())
  }

  configureAccessory(accessory) {
    // Prepare or remove the refresh switch.
    if (accessory.UUID === kRefreshUUID) {
      if (this.config.enableRefreshSwitch)
        this.refreshSwitch = accessory
      else
        this.api.unregisterPlatformAccessories(packageJson.name, "ELPlatform", [accessory])
      return
    }

    // Save the accessory and build later.
    accessory.updateReachability(false)
    this.accessories.set(accessory.UUID, accessory)
  }

  configurationRequestHandler(context, request, callback) {
  }

  async _init() {
    await el.init()
    if (this.config.enableRefreshSwitch)
      await this._buildRefreshAccessory()

    if (this.accessories.size === 0) {
      // If there is no stored information (i.e. first time run) then do
      // discovery.
      await this._startDiscovery()
    } else {
      // Otherwise try to recover old accessories.
      for (const [uuid, accessory] of this.accessories) {
        const info = storage.accessories[accessory.UUID]
        if (info) {
          this._addAccesory(info.address, info.eoj, accessory.UUID)
        } else {
          this.accessories.delete(uuid)
          this.api.unregisterPlatformAccessories(packageJson.name, "ELPlatform", [accessory])
        }
      }
    }
  }

  async _startDiscovery() {
    if (!this._setIsDiscovering(true))
      return

    // Mark all as unreachable, the reachable ones will be updated later.
    this.accessories.forEach((accessory, uuid) => {
      accessory.updateReachability(false)
    })

    return new Promise((resolve, reject) => {
      el.startDiscovery(async (err, res) => {
        if (err) {
          this.log(err)
          reject(err)
          return
        }

        const device = res.device
        const address = device.address

        for (const eoj of device.eoj) {
          // Invalid device.
          if (!el.getClassName(eoj[0], eoj[1]))
            continue

          let uid
          try {
            uid = (await el.getPropertyValue(address, eoj, 0x83)).message.data.uid
          } catch {
            uid = address + '|' + JSON.stringify(eoj)
          }
          const uuid = hap.uuid.generate(uid)
          await this._addAccesory(address, eoj, uuid)
        }
      })

      setTimeout(() => {
        this._stopDiscovery()
        resolve()
      }, 10 * 1000)
    })
  }

  async _stopDiscovery() {
    if (!this._setIsDiscovering(false))
      return

    // Removed unreachable accessories.
    this.accessories.forEach((accessory, uuid) => {
      if (!accessory.reachable) {
        this.log(`Deleteing non-available accessory ${uuid}`)
        this.accessories.delete(uuid)
        this.api.unregisterPlatformAccessories(packageJson.name, "ELPlatform", [accessory])

        delete storage.accessories[uuid]
        writeSettings(this)
      }
    })

    // After stopping discovery, el would listen to broadcast.
    this.log('Finished discovery')
    el.stopDiscovery()
  }

  async _setIsDiscovering(is) {
    if (is == this.isDiscovering)
      return false
    this.isDiscovering = is

    if (this.refreshService)  // update the refresh switch
      this.refreshService.updateCharacteristic(hap.Characteristic.On, is)
    return true
  }

  async _buildRefreshAccessory() {
    if (!this.refreshSwitch) {
      this.refreshSwitch = new Accessory('Refresh ECHONET Lite', kRefreshUUID)
      this.api.registerPlatformAccessories(packageJson.name, "ELPlatform", [this.refreshSwitch])
    }
    this.refreshService = this.refreshSwitch.getService(hap.Service.Switch) ||
                          this.refreshSwitch.addService(hap.Service.Switch)
    this.refreshService.getCharacteristic(hap.Characteristic.On)
    .on('get', (callback) => {
      callback(null, this.isDiscovering)
    })
    .on('set', async (value, callback) => {
      if (value)
        await this._startDiscovery()
      else
        await this._stopDiscovery()
      callback()
    })
  }

  async _addAccesory(address, eoj, uuid) {
    const registered = this.accessories.has(uuid)
    let accessory = registered ? this.accessories.get(uuid)
                               : new Accessory(el.getClassName(eoj[0], eoj[1]), uuid)

    // The _addAccesory may be called twice due to refreshing.
    if (!accessory.alreadyBuilt) {
      if (!await buildAccessory(hap, accessory, el, address, eoj))
        return  // unsupported accessory
      accessory.alreadyBuilt = true
      accessory.once('identify', (paired, callback) => callback())
    }

    accessory.updateReachability(true)

    if (!registered) {
      this.log(`Found new accessory: ${uuid}`)
      this.accessories.set(uuid, accessory)
      this.api.registerPlatformAccessories(packageJson.name, "ELPlatform", [accessory])

      storage.accessories[uuid] = {address, eoj}
      writeSettings(this)
    }
  }
}

function writeSettings(platform) {
  try {
    fs.writeFileSync(storagePath, JSON.stringify(storage))
  } catch (e) {
    platform.log(`Failed to write settings: ${e}`)
  }
}
