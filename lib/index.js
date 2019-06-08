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

class ELPlatform {
  constructor(log, config, api) {
    this.log = log
    this.config = config
    this.api = api

    this.accessories = new Map
    this.api.once('didFinishLaunching', () => this._init())
  }

  configureAccessory(accessory) {
    accessory.reachable = false
    this.accessories.set(accessory.UUID, accessory)
  }

  configurationRequestHandler(context, request, callback) {
  }

  async _init() {
    await el.init()

    el.startDiscovery(async (err, res) => {
      if (err) {
        this.log(err)
        return
      }

      const device = res.device
      const address = device.address

      for (const eoj of device.eoj) {
        const uid = `${address}|${eoj[0].toString(16)}|${eoj[1].toString(16)}|${eoj[2].toString(16)}`
        const uuid = hap.uuid.generate(uid)
        await this._addAccesory(address, eoj, uuid)
      }

      // Removed unreachable accessories.
      this.accessories.forEach((accessory, uuid) => {
        if (!accessory.reachable) {
          this.accessories.delete(uuid)
          this.api.unregisterPlatformAccessories(packageJson.name, "ELPlatform", [accessory])
        }
      })
    })

    // Stop discovery after 2s, and then listen to broadcast automatically.
    setTimeout(() => { el.stopDiscovery() }, 2000)
  }

  async _addAccesory(address, eoj, uuid) {
    const registered = this.accessories.has(uuid)
    let accessory = registered ? this.accessories.get(uuid)
                               : new Accessory(el.getClassName(eoj[0], eoj[1]), uuid)

    if (!await buildAccessory(hap, accessory, el, address, eoj))
      return

    accessory.updateReachability(true)
    accessory.once('identify', (paired, callback) => callback())

    if (!registered) {
      this.accessories.set(uuid, accessory)
      this.api.registerPlatformAccessories(packageJson.name, "ELPlatform", [accessory])
    }
  }
}
