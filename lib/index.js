const packageJson = require('../package.json')

const el = require('./echonet-lite')
const buildAccessory = require('./accessory')

// Lazy-initialized.
let Accessory, hap

// Called by homebridge.
module.exports = (homebridge) => {
  Accessory = homebridge.platformAccessory
  hap = homebridge.hap

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
    await this._startDiscovery()
  }

  async _startDiscovery() {
    if (!this._setIsDiscovering(true))
      return

    // Mark all as unreachable, the reachable ones will be updated later.
    this.accessories.forEach((accessory, uuid) => {
      accessory.updateReachability(false)
    })

    el.startDiscovery(async (err, res) => {
      if (err) {
        this.log(err)
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

    setTimeout(() => { this._stopDiscovery() }, 2000)
  }

  async _stopDiscovery() {
    if (!this._setIsDiscovering(false))
      return

    // Removed unreachable accessories.
    this.accessories.forEach((accessory, uuid) => {
      if (!accessory.reachable) {
        this.accessories.delete(uuid)
        this.api.unregisterPlatformAccessories(packageJson.name, "ELPlatform", [accessory])
      }
    })

    // After stopping discovery, el would listen to broadcast.
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
      this.accessories.set(uuid, accessory)
      this.api.registerPlatformAccessories(packageJson.name, "ELPlatform", [accessory])
    }
  }
}
