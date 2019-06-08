module.exports = async (hap, accessory, el, address, eoj) => {
  const service = accessory.getService(hap.Service.HeaterCooler) ||
                  accessory.addService(hap.Service.HeaterCooler)

  service.getCharacteristic(hap.Characteristic.Active)
  .on('set', async (value, callback) => {
    try {
      await el.setPropertyValue(address, eoj, 0x80, {status: value != 0})
      callback()
    } catch (err) {
      callback(err)
    }
  })
  .on('get', async (callback) => {
    try {
      const {status} = (await el.getPropertyValue(address, eoj, 0x80)).message.data
      callback(null, status)
    } catch (err) {
      callback(err)
    }
  })

  service.getCharacteristic(hap.Characteristic.CurrentHeaterCoolerState)
  .on('get', async (callback) => {
    try {
      const {status} = (await el.getPropertyValue(address, eoj, 0x80)).message.data
      if (!status) {
        callback(null, hap.Characteristic.CurrentHeaterCoolerState.INACTIVE)
        return
      }
      const {compressor} = (await el.getPropertyValue(address, eoj, 0xCD)).message.data
      if (!compressor) {
        callback(null, hap.Characteristic.CurrentHeaterCoolerState.IDLE)
        return
      }
      const {mode} = (await el.getPropertyValue(address, eoj, 0xB0)).message.data
      callback(null, mode === 2 ? hap.Characteristic.CurrentHeaterCoolerState.COOLING
                                : hap.Characteristic.CurrentHeaterCoolerState.HEATING)
    } catch (err) {
      callback(null, hap.Characteristic.CurrentHeaterCoolerState.IDLE)
    }
  })

  service.getCharacteristic(hap.Characteristic.TargetHeaterCoolerState)
  .on('set', async (value, callback) => {
    try {
      if (value !== hap.Characteristic.TargetHeaterCoolerState.OFF) {
        let mode = 1
        if (value === hap.Characteristic.TargetHeaterCoolerState.COOL)
          mode = 2
        else if (value === hap.Characteristic.TargetHeaterCoolerState.HEAT)
          mode = 3
        await el.setPropertyValue(address, eoj, 0xB0, {mode})
      } else {
        await el.setPropertyValue(address, eoj, 0x80, {status: false})
      }
      callback()
    } catch (err) {
      callback(err)
    }
  })
  .on('get', async (callback) => {
    try {
      let state = hap.Characteristic.TargetHeaterCoolerState.AUTO
      const {status} = (await el.getPropertyValue(address, eoj, 0x80)).message.data
      if (status) {
        const {mode} = (await el.getPropertyValue(address, eoj, 0xB0)).message.data
        if (mode === 2)
          state = hap.Characteristic.TargetHeaterCoolerState.COOL
        else if (mode === 3)
          state = hap.Characteristic.TargetHeaterCoolerState.HEAT
      } else {
        state = hap.Characteristic.TargetHeaterCoolerState.OFF
      }
      callback(null, state)
    } catch (err) {
      callback(err)
    }
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
      callback(null, temperature)
    } catch (err) {
      // Some air conditioners do not have temperature sensor, reporting error
      // would make the accessory stop working.
      callback(null, 0)
    }
  }
  service.getCharacteristic(hap.Characteristic.CurrentTemperature)
  .setProps({minValue: -127, maxValue: 125, minStep: 1})
  .on('get', temperatureGetter.bind(null, 0xBB))
  service.getCharacteristic(hap.Characteristic.CoolingThresholdTemperature)
  .setProps({minValue: 16, maxValue: 30, minStep: 1})
  .on('set', temperatureSetter.bind(null, 0xB5))
  .on('get', temperatureGetter.bind(null, 0xB5))
  service.getCharacteristic(hap.Characteristic.HeatingThresholdTemperature)
  .setProps({minValue: 16, maxValue: 30, minStep: 1})
  .on('set', temperatureSetter.bind(null, 0xB6))
  .on('get', temperatureGetter.bind(null, 0xB6))
}
