module.exports = async (hap, accessory, el, address, eoj)  => {
  if (eoj[0] == 0x02 && eoj[1] == 0x90) {
    await buildLight(hap, accessory, el, address, eoj)
    return true
  }
  return false
}

async function buildLight(hap, accessory, el, address, eoj) {
  const service = accessory.getService(hap.Service.Lightbulb) ||
                  accessory.addService(hap.Service.Lightbulb)

  const {status} = (await el.getPropertyValue(address, eoj, 0x80)).message.data
  service.setCharacteristic(hap.Characteristic.On, status)

  service.getCharacteristic(hap.Characteristic.On)
  .on('set', async (value, callback) => {
    try {
      await el.setPropertyValue(address, eoj, 0x80, {status: value})
      callback(null)
    } catch (err) {
      callback(err)
    }
  })
  .on('get', async (callback) => {
    try {
      const res = await el.getPropertyValue(address, eoj, 0x80)
      callback(null, res.message.data.status)
    } catch (err) {
      callback(err)
    }
  })

  // Not all lights support brightness.
  try {
    const {level} = (await el.getPropertyValue(address, eoj, 0xF7)).message.data
    service.setCharacteristic(hap.Characteristic.Brightness, level)

    service.getCharacteristic(hap.Characteristic.Brightness)
    .on('set', async (value, callback) => {
      try {
        await el.setPropertyValue(address, eoj, 0xF7, {level: value})
        callback(null)
      } catch (err) {
        callback(err)
      }
    })
    .on('get', async (callback) => {
      try {
        const res = await el.getPropertyValue(address, eoj, 0xF7)
        callback(null, res.message.data.level)
      } catch (err) {
        callback(err)
      }
    })
  } catch {
  }
}
