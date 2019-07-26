const util = require('util')
const EchonetLite = require('echonet-lite-more')

// Wrapper that provide promisified methods.
class PromisifiedEchonetLite {
  constructor(arg) {
    this.el = new EchonetLite(arg)
  }
}

// Populate methods.
const callbackMethods = [
  'init', 'getPropertyMaps', 'getPropertyValue', 'setPropertyValue',
  'send', 'close',
]
for (const method in EchonetLite.prototype) {
  if (method.startsWith('_'))  // private method
    continue
  const old = EchonetLite.prototype[method]
  if (typeof old === 'function') {
    PromisifiedEchonetLite.prototype[method] = function (...args) {
      if (callbackMethods.includes(method))
        return util.promisify(old).apply(this.el, args)
      else
        return old.apply(this.el, args)
    }
  }
}

module.exports = new PromisifiedEchonetLite({lang: 'ja', type: 'lan'})
