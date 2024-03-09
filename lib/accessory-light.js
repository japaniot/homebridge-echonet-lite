module.exports = async (platform, accessory, el, address, eoj) => {
  const hap = platform.api.hap
  const context = accessory.context
  const service = accessory.getService(hap.Service.Lightbulb) ||
                  accessory.addService(hap.Service.Lightbulb)

  context.status ??= false
  context.Brightness ??= 100

  let {status} = (await el.getPropertyValue(address, eoj, 0x80)).message.data
  context.status = status
  service.updateCharacteristic(hap.Characteristic.On, status)

  const updateStatus = (s) => {
    context.status = s
    service.updateCharacteristic(hap.Characteristic.On, status)
  }

  service.getCharacteristic(hap.Characteristic.On)
  .on('set', (value, callback) => {
    context.status = value
    el.setPropertyValue(address, eoj, 0x80, {context.status})
    callback()
  })
  .on('get', (callback) => {
    callback(null, context.status)
    el.getPropertyValue(address, eoj, 0x80).then((res) => {
      if (res)
        updateStatus(res.message.data.status)
    })
  })

  const properties = (await el.getPropertyMaps(address, eoj)).message.data.set
  if (properties.includes(0xB0)) {
    service.getCharacteristic(hap.Characteristic.Brightness)
    .on('set', async (value, callback) => {
      try {
	context.Brightness = value
        await el.setPropertyValue(address, eoj, 0xB0, {level: value})
        callback()
      } catch (err) {
        callback(err)
      }
    })
    .on('get', async (callback) => {
      if (!context.status) {
        callback(null, 0)
        return
      }
      try {
        const res = await el.getPropertyValue(address, eoj, 0xB0)
	context.Brightness = res.message.data.level
        callback(null, res.message.data.level)
      } catch (err) {
        callback(err)
      }
    })
  }

  // Subscribe to status changes.
  platform.onNotifyHandler[`${address}${eoj.toString()}`] = (message) => {
    const {seoj, prop} = message

    for (const p of prop) {
      if (!p.edt)
        continue
      if (p.epc === 0x80)  // status
        updateStatus(p.edt.status)
      else if (p.epc === 0xB0) { // level
	context.Brightness = p.edt.level
        service.updateCharacteristic(hap.Characteristic.Brightness, p.edt.level)
      }
    }
  }

  return true
}
