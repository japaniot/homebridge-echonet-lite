module.exports = async (hap, accessory, el, address, eoj) => {
  const service = accessory.getService(hap.Service.MotionSensor) ||
                  accessory.addService(hap.Service.MotionSensor)

  let status = {
    active : true,
    detected : false
  }

  const updateStatusDetected = (s) => {
    service.updateCharacteristic(hap.Characteristic.MotionDetected, s)
  }
  const updateStatusActive = (s) => {
    service.updateCharacteristic(hap.Characteristic.StatusActive, s)
  }

  service.getCharacteristic(hap.Characteristic.MotionDetected)
  .on('get', (callback) => {
    callback(null, status.detected)
    el.getPropertyValue(address, eoj, 0xB1, (err, res) => {
      if(err)
        return
      if(res.message.data)
        updateStatusDetected(res.message.data.status)
    })
  })

  service.getCharacteristic(hap.Characteristic.StatusActive)
  .on('get', (callback) => {
    callback(null, status.active)
    el.getPropertyValue(address, eoj, 0xB0, (err, res) => {
      if(err)
        return
      if(res.message.data)
        updateStatusActive(res.message.data.status)
    })
  })

  const _polling = async () => {
    el.getPropertyValue(address, eoj, 0xB1, (err, res) => {
      if(err)
        return
      if(res.message.data)
        updateStatusDetected(res.message.data.status)
    })
    el.getPropertyValue(address, eoj, 0xB0, (err, res) => {
      if(err)
        return
      if(res.message.data)
        updateStatusActive(res.message.data.status)
      return(null)
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
      if (p.epc === 0xB1)  // status
        updateStatusDetected(p.edt.status)
    }
  })
  updateStatusActive(true)
  updateStatusDetected(false)
  _polling()
}
