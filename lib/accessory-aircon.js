module.exports = async (hap, accessory, el, address, eoj) => {
  const service = accessory.getService(hap.Service.Thermostat) ||
                  accessory.addService(hap.Service.Thermostat)
// Aircon status code tables
  const emode2h = [
    hap.Characteristic.TargetHeatingCoolingState.OFF,
    hap.Characteristic.TargetHeatingCoolingState.AUTO,
    hap.Characteristic.TargetHeatingCoolingState.COOL,
    hap.Characteristic.TargetHeatingCoolingState.HEAT,
  ]
  const hmode2e = [
    0,
    3,
    2,
    1
  ]

  let status = {
    initialized : false,
    active : true,
    state: 0,
    current: 25,
    target: 25
  }

  const updateCharacteristics = () => {
//    service.updateCharacteristic(hap.Characteristic.Active, status.active)
//    service.updateCharacteristic(hap.Characteristic.CurrentHeatingCoolingState,
//      status.active ? status.state :hap.Characteristic.CurrentHeatingCoolingState.OFF)
//    service.updateCharacteristic(hap.Characteristic.TargetHeatingCoolingState,
//      status.target_state)
  }

  const properties = (await el.getPropertyMaps(address, eoj)).message.data.set

  service.getCharacteristic(hap.Characteristic.Active)
  .on('set', async (value, callback) => {
    status.active = value != 0
    updateCharacteristics()
    callback()
    await el.setPropertyValue(address, eoj, 0x80, {status: value != 0 })
  })
  .on('get', async (callback) => {
    callback(null, (status.active == 1) & (status.state != 0))
  })

  service.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
  .on('get', async (callback) => {
     callback(null, status.active ? emode2h[status.state] : 0)
  })

  service.getCharacteristic(hap.Characteristic.TargetHeatingCoolingState)
  .on('set', async (value, callback) => {
    try {
      if (value != 0) {
        if(value < hmode2e.length) {
          const mode = hmode2e[value]
          await el.setPropertyValue(address, eoj, 0xB0, {mode})
          status.state = mode
        }
        if(!status.active) {
          await el.setPropertyValue(address, eoj, 0x80, {status: true})
          status.active = true
        }
      } else {
        await el.setPropertyValue(address, eoj, 0x80, {status: false})
        status.active = false
      }
      updateCharacteristics()
      callback()
    } catch (err) {
      callback(err)
    }
  })
  .on('get', async (callback) => {
    callback(null, status.active ? emode2h[status.state] : 0)
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
/**/
    el.getPropertyValue(address, eoj, 0x80, (err, res) => {
      if(err)
        return
      status.active = res.message.data.status
    })
    el.getPropertyValue(address, eoj, 0xB0, (err, res) => {
      if(err)
        return
      status.state = res.message.data.mode
    })
    el.getPropertyValue(address, eoj, 0xBB, (err, res) => {
      if(err)
        return
      status.current = res.message.data.temperature
    })
    el.getPropertyValue(address, eoj, 0xB3, (err, res) => {
      if(err)
        return
      status.target = res.message.data.temperature
    })
/**/
/*
    try{
    status.active = (await el.getPropertyValue(address, eoj, 0x80)).message.data.status
    status.state = (await el.getPropertyValue(address, eoj, 0xB0)).message.data.mode
    status.current = (await el.getPropertyValue(address, eoj, 0xBB)).message.data.temperature
    status.target = (await el.getPropertyValue(address, eoj, 0xB3)).message.data.temperature
    } catch(err) {
      console.log('err')
    }
*/
    setTimeout(() => {
      _polling()
    }, 10 * 1000)

    updateCharacteristics()

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
        status.active = p.edt.status
      else if (p.epc === 0xB0)
        status.state = p.edt.mode
//      else if (p.epc === 0xB1) {  // level
//        status.target_state = p.edt,mode
      updateCharacteristics()
    }
  })

  _polling()
}
