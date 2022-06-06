module.exports = async (hap, accessory, el, address, eoj)  => {
  if ((eoj[0] === 0x02 && eoj[1] === 0x90) ||
      (eoj[0] === 0x02 && eoj[1] === 0x91)) {
    await require('./accessory-light')(hap, accessory, el, address, eoj)
    return true
  } else if (eoj[0] === 0x01 && eoj[1] === 0x30) {
    await require('./accessory-aircon')(hap, accessory, el, address, eoj)
    return true
  } else
  if (eoj[0] === 0x05 && eoj[1] === 0xfd) {
    await require('./accessory-jema')(hap, accessory, el, address, eoj)
    return true
  } else 
  if (eoj[0] === 0x00 && eoj[1] === 0x02) {
    await require('./accessory-alarm')(hap, accessory, el, address, eoj)
    return true
  } else if ((eoj[0] === 0x00 && eoj[1] === 0x08) ||
             (eoj[0] === 0x00 && eoj[1] === 0x0f)) {
    await require('./accessory-motion')(hap, accessory, el, address, eoj)
    return true
  }
  return false
}
