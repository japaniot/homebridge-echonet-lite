function isAccessorySupported(eoj) {
  if (eoj[0] == 0x02 && eoj[1] == 0x90)
    return true
  return false
}

function buildAccessory(hap, accessory, el, address, eoj) {
  if (eoj[0] == 0x02 && eoj[1] == 0x90)
    buildLight(hap, accessory, el, address, eoj)
}

function buildLight(hap, accessory, el, address, eoj) {
  const service = accessory.getService(hap.Service.Lightbulb) ||
                  accessory.addService(hap.Service.Lightbulb)
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
}

module.exports = {isAccessorySupported, buildAccessory}
