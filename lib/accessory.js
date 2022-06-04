module.exports = async (hap, accessory, el, address, eoj)  => {
console.log(address +  ':' + eoj)
  if ((eoj[0] === 0x02 && eoj[1] === 0x90) ||
      (eoj[0] === 0x02 && eoj[1] === 0x91)) {
    await require('./accessory-light')(hap, accessory, el, address, eoj)
    return true
  } else if (eoj[0] === 0x01 && eoj[1] === 0x30) {
    await require('./accessory-aircon')(hap, accessory, el, address, eoj)
    return true
  } else if (eoj[0] === 0x05 && eoj[1] === 0xfd) {
    await require('./accessory-jema')(hap, accessory, el, address, eoj)
  }
  return false
}
