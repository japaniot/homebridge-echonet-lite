module.exports = async (hap, accessory, el, address, eoj) => {
  const service = accessory.getService(hap.Service.Switch) ||
                  accessory.addService(hap.Service.Switch)

  let status = {
    on : false
  }

  const updateStatusOn = (s) => {
//    if(s === undefined)
//      return
//    status.on = s
    service.updateCharacteristic(hap.Characteristic.On, s)
  }

  service.getCharacteristic(hap.Characteristic.On)
  .on('set', (value, callback) => {
    updateStatusOn(value)
    el.setPropertyValue(address, eoj, 0x80, {status: value})
    callback()
  })
  .on('get', (callback) => {
    callback(null, status.on)
    el.getPropertyValue(address, eoj, 0x80, (err, res) => {
      if(err)
        return
      updateStatusOn(res.message.data.status)
    })
  })

  const _polling = async () => {
    el.getPropertyValue(address, eoj, 0x80, (err, res) => {
      if(err)
        return
      updateStatusOn(res.message.data.status)
    })
    setTimeout(() => {
      _polling()
    }, 10 * 1000)
  }

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
        updateStatusOn(p.edt.status)
    }
  })
  _polling()
}
