module.exports = async (platform, accessory, el, address, eoj) => {
  const hap = platform.api.hap
  const log = platform.log
  const context = accessory.context
  const service = accessory.getService(hap.Service.HeaterCooler) ||
                  accessory.addService(hap.Service.HeaterCooler)

  context.Active ??= hap.Characteristic.Active.INACTIVE
  context.CurrentHeaterCoolerState ??= hap.Characteristic.CurrentHeaterCoolerState.INACTIVE
  context.TargetHeaterCoolerState ??= hap.Characteristic.TargetHeaterCoolerState.AUTO
  context.CurrentTemperature ??= 25
  context.CoolingThresholdTemperature ??= 30
  context.HeatingThresholdTemperature ??= 16

  platform.onNotifyHandler[`${address}${eoj.toString()}`] = (x) => {
    log.debug(`${accessory.displayName}: ${JSON.stringify(x)}`)
  }

  service.getCharacteristic(hap.Characteristic.Active)
  .on('set', async (value, callback) => {
    try {
      callback()
      await el.setPropertyValue(address, eoj, 0x80, {status: value != 0})
      context.Active = value
    } catch (err) {
      log.debug(`${accessory.displayName}: Failed to set Active. ${err}`)
    }
  })
  .on('get', async (callback) => {
    try {
      callback(null, context.Active)
      const {status} = (await el.getPropertyValue(address, eoj, 0x80)).message.data
      context.Active = status
      service.updateCharacteristic(hap.Characteristic.Active, status)
    } catch (err) {
      log.debug(`${accessory.displayName}: Failed to get Active. ${err}`)
    }
  })

  service.getCharacteristic(hap.Characteristic.CurrentHeaterCoolerState)
  .on('get', async (callback) => {
    try {
      callback(null, context.CurrentHeaterCoolerState)
      const {status} = (await el.getPropertyValue(address, eoj, 0x80)).message.data
      if (!status) {
        state = hap.Characteristic.CurrentHeaterCoolerState.INACTIVE
      } else {
	const compressor = (await el.getPropertyValue(address, eoj, 0xCD))?.message?.data?.compressor
	if (compressor === false) {
          state = hap.Characteristic.CurrentHeaterCoolerState.IDLE
	} else {	// Maps AUTO to COOL
	  const {mode} = (await el.getPropertyValue(address, eoj, 0xB0)).message.data
	  state = mode === 3 ? hap.Characteristic.CurrentHeaterCoolerState.HEATING
                             : hap.Characteristic.CurrentHeaterCoolerState.COOLING
	}
      }
      context.CurrentHeaterCoolerState = state
      service.updateCharacteristic(hap.Characteristic.CurrentHeaterCoolerState, state)
    } catch (err) {
      log.debug(`${accessory.displayName}: Failed to get CurrentHeaterCoolerState. ${err}`)
    }
  })

  service.getCharacteristic(hap.Characteristic.TargetHeaterCoolerState)
  .on('set', async (value, callback) => {
    try {
      callback()
      // if (value !== hap.Characteristic.TargetHeaterCoolerState.OFF) {	// no such state
        let mode = 1
        if (value === hap.Characteristic.TargetHeaterCoolerState.COOL)
          mode = 2
        else if (value === hap.Characteristic.TargetHeaterCoolerState.HEAT)
          mode = 3
        await el.setPropertyValue(address, eoj, 0xB0, {mode})
      // } else {
      //   await el.setPropertyValue(address, eoj, 0x80, {status: false})
      // }
    } catch (err) {
      log.debug(`${accessory.displayName}: Failed to set TargetHeaterCoolerState. ${err}`)
    }
  })
  .on('get', async (callback) => {
    try {
      callback(null, context.TargetHeaterCoolerState)
      let state = hap.Characteristic.TargetHeaterCoolerState.COOL
      // const {status} = (await el.getPropertyValue(address, eoj, 0x80)).message.data
      // if (status) {
        const {mode} = (await el.getPropertyValue(address, eoj, 0xB0)).message.data
        if (mode === 1)
          state = hap.Characteristic.TargetHeaterCoolerState.AUTO
        else if (mode === 3)
          state = hap.Characteristic.TargetHeaterCoolerState.HEAT
      // } else {
      //   state = hap.Characteristic.TargetHeaterCoolerState.OFF	// no such state
      // }
      context.TargetHeaterCoolerState = state
      service.updateCharacteristic(hap.Characteristic.TargetHeaterCoolerState, state)
    } catch (err) {
      log.debug(`${accessory.displayName}: Failed to get TargetHeaterCoolerState. ${err}`)
    }
  })

  // const temperatureSetter = async (edt, value, callback) => {
  //   try {
  //     await el.setPropertyValue(address, eoj, edt, {temperature: parseInt(value)})
  //     callback()
  //   } catch (err) {
  //     callback(err)
  //   }
  // }
  // const temperatureGetter = async (edt, callback) => {
  //   try {
  //     const {temperature} = (await el.getPropertyValue(address, eoj, edt)).message.data
  //     callback(null, temperature)
  //   } catch (err) {
  //     // Some air conditioners do not have temperature sensor, reporting error
  //     // would make the accessory stop working.
  //     callback(null, 0)
  //   }
  // }
  // service.getCharacteristic(hap.Characteristic.CurrentTemperature)
  // .setProps({minValue: -127, maxValue: 125, minStep: 1})
  // .on('get', temperatureGetter.bind(null, 0xBB))
  // service.getCharacteristic(hap.Characteristic.CoolingThresholdTemperature)
  // .setProps({minValue: 16, maxValue: 30, minStep: 1})
  // .on('set', temperatureSetter.bind(null, 0xB5))
  // .on('get', temperatureGetter.bind(null, 0xB5))
  // service.getCharacteristic(hap.Characteristic.HeatingThresholdTemperature)
  // .setProps({minValue: 16, maxValue: 30, minStep: 1})
  // .on('set', temperatureSetter.bind(null, 0xB6))
  // .on('get', temperatureGetter.bind(null, 0xB6))

  service.getCharacteristic(hap.Characteristic.CurrentTemperature)
  .setProps({minValue: -127, maxValue: 125, minStep: 1})
  .on('get', async (callback) => {
    try {
      callback(null, context.CurrentTemperature)
      const {temperature} = (await el.getPropertyValue(address, eoj, 0xBB)).message.data
      context.CurrentTemperature = temperature
      service.updateCharacteristic(hap.Characteristic.CurrentTemperature, temperature)
    } catch (err) {
      log.debug(`${accessory.displayName}: Failed to get CurrentTemperature. ${err}`)
    }
  })

  service.getCharacteristic(hap.Characteristic.CoolingThresholdTemperature)
  .setProps({minValue: 16, maxValue: 30, minStep: 1})
  .on('set', async (value, callback) => {
    try {
      callback()
      await el.setPropertyValue(address, eoj, 0xB5, {temperature: parseInt(value)})
      context.CoolingThresholdTemperature = value
    } catch (err) {
      log.debug(`${accessory.displayName}: Failed to set CoolingThresholdTemperature. ${err}`)
    }
  })
  .on('get', async (callback) => {
    try {
      callback(null, context.CoolingThresholdTemperature)
      const {temperature} = (await el.getPropertyValue(address, eoj, 0xB5)).message.data
      context.CoolingThresholdTemperature = temperature
      service.updateCharacteristic(hap.Characteristic.CoolingThresholdTemperature, temperature)
    } catch (err) {
      log.debug(`${accessory.displayName}: Failed to get CoolingThresholdTemperature. ${err}`)
    }
  })

  service.getCharacteristic(hap.Characteristic.HeatingThresholdTemperature)
  .setProps({minValue: 16, maxValue: 30, minStep: 1})
  .on('set', async (value, callback) => {
    try {
      callback()
      await el.setPropertyValue(address, eoj, 0xB6, {temperature: parseInt(value)})
      context.HeatingThresholdTemperature = value
    } catch (err) {
      log.debug(`${accessory.displayName}: Failed to set HeatingThresholdTemperature. ${err}`)
    }
  })
  .on('get', async (callback) => {
    try {
      callback(null, context.HeatingThresholdTemperature)
      const {temperature} = (await el.getPropertyValue(address, eoj, 0xB6)).message.data
      context.HeatingThresholdTemperature = temperature
      service.updateCharacteristic(hap.Characteristic.HeatingThresholdTemperature, temperature)
    } catch (err) {
      log.debug(`${accessory.displayName}: Failed to get HeatingThresholdTemperature. ${err}`)
    }
  })

  return true
}
