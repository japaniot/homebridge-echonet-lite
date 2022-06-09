module.exports = async (hap, accessory, el, address, eoj) => {
  const service = accessory.getService(hap.Service.SecuritySystem) ||
                  accessory.addService(hap.Service.SecuritySystem)

  let status = {
    target_state : 3,
    state : 3,
  }
  const hstate2e = {
    0: 2, // Stay arm
    1: 3, // Away arm
    3: 1, // Disarmed
    4: '' // Alarm triggered
  }

  const estate2h = {
    2:0,
    3:1,
    1:3
  }

  const updateStatusState = (s) => {
    service.updateCharacteristic(hap.Characteristic.SecuritySystemCurrentState, s)
    status.state = s
  }
  const updateStatusTargetState = (s) => {
    if(s != 4) {
      service.updateCharacteristic(hap.Characteristic.SecuritySystemTargetState, s)
      status.target_state = s
    }
  }

  const getElSecurityAlarm = async () => {
    try{ 
      let status
      const res = (await el.getPropertyValue(address, eoj, 0xB1))
      const triggered = res.message && res.message.data ? res.message.data.status : false
      if(triggered) {
        updateStatusState(4)
      }else{
        status =  (await el.getPropertyValue(address, eoj, 0xB0)).message.data.level
        updateStatusState(estate2h[status])
        updateStatusTargetState(estate2h[status])
      }
    }catch(err){
      throw err
    }
  }
// Worked fine, but look like GUI can control security system.
//  service.getCharacteristic(hap.Characteristic.SecuritySystemTargetState).setProps(
//    {'validValues': [0, 1, 3], minValue: 0, maxValue: 3, perms:['pr', 'pw', 'ev']})
  service.getCharacteristic(hap.Characteristic.SecuritySystemTargetState).setProps(
    {'validValues': [0, 1, 3], minValue: 0, maxValue: 3, perms:['pr', 'pw', 'ev']})
  service.getCharacteristic(hap.Characteristic.SecuritySystemCurrentState).setProps(
            {'validValues': [0, 1, 3, 4]})
//   service.removeCharacteristic(hap.Characteristic.SecuritySystemTargetState)

  updateStatusState(3)
  updateStatusTargetState(3)

  service.getCharacteristic(hap.Characteristic.SecuritySystemCurrentState)
  .on('get', async (callback) => {
    callback(null, status.state)
    getElSecurityAlarm()
  })

  service.getCharacteristic(hap.Characteristic.SecuritySystemTargetState)
  .on('get', (callback) => {
    callback(null, status.target_state)
  })
  .on('set', (value, callback) => {
    updateStatusTargetState(status.state)
    callback(hap.HapStatusError)
  })

  const _polling = async () => {
    getElSecurityAlarm()
    setTimeout(() => {
      _polling()
    }, 10 * 1000)
  }

  _polling()
  // Subscribe to status changes.
  el.on('notify', (res) => {
    const {seoj, prop} = res.message
    if (res.device.address !== address ||
        eoj[0] !== seoj[0] || eoj[1] !== seoj[1] || eoj[2] !== seoj[2])
      return
    for (const p of prop) {
      if (!p.edt)
        continue
      if (p.epc === 0xB1 && p.edt.status)  // status
        updateStatusState(4)
      if (p.epc === 0xB0 && p.edt.level && !status.state != 4){  //
        updateStatusState(estate2h[p.edt.level])
        updateStatusTargetState(estate2h[p.edt.level])
      }
    }
  })
}
