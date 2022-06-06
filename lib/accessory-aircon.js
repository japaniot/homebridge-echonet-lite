module.exports = async (hap, accessory, el, address, eoj) => {
  const service = accessory.getService(hap.Service.Thermostat) ||
                  accessory.addService(hap.Service.Thermostat)
// Aircon status code tables
  const emode2h = [
    hap.Characteristic.CurrentHeatingCoolingState.OFF,
    hap.Characteristic.CurrentHeatingCoolingState.AUTO,
    hap.Characteristic.CurrentHeatingCoolingState.COOL,
    hap.Characteristic.CurrentHeatingCoolingState.HEAT,
  ]
  const hmode2e = [
    0,
    3,
    2,
    1
  ]

  let status = {
    initialized : false,
    on : 0,
    state: hap.Characteristic.CurrentHeatingCoolingState.OFF,
    target_state: hap.Characteristic.TargetHeatingCoolingState.OFF,
    current: 25,
    target: 25
  }

  const properties = (await el.getPropertyMaps(address, eoj)).message.data.set

  service.getCharacteristic(hap.Characteristic.Active)
  .on('set', async (value, callback) => {
    status.on = value
    callback()
    if(value == 0) status.target_state = hap.Characteristic.TargetHeatingCoolingState.OFF
    el.setPropertyValue(address, eoj, 0x80, {status: value != 0 })
  })
  .on('get', async (callback) => {
    callback(null, status.on)
  })

  service.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
  .on('get', async (callback) => {
     callback(null, status.state)
  })

  service.getCharacteristic(hap.Characteristic.TargetHeatingCoolingState)
  .on('set', async (value, callback) => {
    try {
      if (value != hap.Characteristic.TargetHeatingCoolingState.OFF ) {
        if(value < hmode2e.length) {
          const mode = hmode2e[value]
          await el.setPropertyValue(address, eoj, 0xB0, {mode})
        }
        if(!status.on) {
          await el.setPropertyValue(address, eoj, 0x80, {status: true})
          status.on = 1
        }
      } else {
        await el.setPropertyValue(address, eoj, 0x80, {status: false})
        status.on = 0
      }
      status.target_state = value
      callback()
    } catch (err) {
      callback(err)
    }
  })
  .on('get', async (callback) => {
    callback(null, status.target_state)
  })

  const temperatureSetter = async (edt, value, callback) => {
    try {
      await el.setPropertyValue(address, eoj, edt, {temperature: parseInt(value)})
      callback()
    } catch (err) {
      callback(err)
    }
  }
  const temperatureGetter = async (edt, callback) => {
    try {
      const {temperature} = (await el.getPropertyValue(address, eoj, edt)).message.data
      if(temperature != null)
          callback(null, temperature)
      else
          callback(accessoryResponseError)
    } catch (err) {
      // Some air conditioners do not have temperature sensor, reporting error
      // would make the accessory stop working.
      callback(err)
    }
  }

  const _polling = async () => {
    el.getPropertyValue(address, eoj, 0x80, (err, res) => {
      if(err)
        return
      status.on = res.message.data.status ? 1 : 0
    })
    if(status.on)
      el.getPropertyValue(address, eoj, 0xB0, (err, res) => {
        if(err)
          return
        status.state = res.message.data.mode < emode2h.length
                        ? emode2h[res.message.data.mode]
                        : status.state
        if(!status.initialized)
          status.target_state = status.state
          status.initialized = true
        return
    })
    el.getPropertyValue(address, eoj, 0xBB, (err, res) => {
      if(err)
        return
      if(res.message.data.temperature)
        status.current = res.message.data.temperature
      return
    })
    el.getPropertyValue(address, eoj, 0xB3, (err, res) => {
      if(err)
        return
      if(res.message.data.temperature)
        status.target = res.message.data.temperature
      return
    })

    setTimeout(() => {
      _polling()
    }, 10 * 1000)
  }

  service.getCharacteristic(hap.Characteristic.CurrentTemperature)
  .setProps({minValue: -127, maxValue: 125, minStep: 1})
  .on('get', async (callback) => {callback(null, status.current)})
  service.getCharacteristic(hap.Characteristic.TargetTemperature)
  .setProps({minValue: 16, maxValue: 30, minStep: 1})
  .on('set', temperatureSetter.bind(null, 0xB3))
  .on('get', async (callback) => {callback(null, status.target)})

  // Subscribe to status changes.
  el.on('notify', (res) => {
    const {seoj, prop} = res.message
    if (res.device.address !== address ||
        eoj[0] !== seoj[0] || eoj[1] !== seoj[1] || eoj[2] !== seoj[2])
      return

    for (const p of prop) {
      if (!p.edt)
        continue
      if (p.epc === 0x80)  // status
        status.on = p.edt.status ? 1 : 0
      else if (p.epc === 0xB0) {  // level
        status.state = res.message.data.mode < emode2h.length
                        ? emode2h[res.message.data.mode]
                        : status.state
      }
      service.updateCharacteristic(Characteristic.Active, status.on)
      service.updateCharacteristic(Characteristic.CurrentHeatingCoolingState, status.state)
      service.updateCharacteristic(Characteristic.TargetHeatingCoolingState, status.target_state)
    }
  })

  _polling()
}
