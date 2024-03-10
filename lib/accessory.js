module.exports = async (platform, accessory, el, address, eoj)  => {
  if ((eoj[0] === 0x02 && eoj[1] === 0x90) ||
      (eoj[0] === 0x02 && eoj[1] === 0x91)) {
    return await require('./accessory-light')(platform, accessory, el, address, eoj)
  } else if (eoj[0] === 0x01 && eoj[1] === 0x30) {
    return await require('./accessory-aircon')(platform, accessory, el, address, eoj)
  }
  return false
}
