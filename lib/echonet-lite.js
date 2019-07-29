const util = require('util')
const Bobolink = require('bobolink')
const EchonetLite = require('echonet-lite-more')

// Wrapper that provide promisified methods.
class PromisifiedEchonetLite {
  constructor(arg) {
    this.el = new EchonetLite(arg)
    this.queue = new Bobolink({concurrency: 9})
  }
}

// Populate methods.
const callbackMethods = [
  'init', 'getPropertyMaps', 'getPropertyValue', 'setPropertyValue',
  'send', 'close',
]
const limitedMethods = [ 'getPropertyValue', 'setPropertyValue' ]
for (const method in EchonetLite.prototype) {
  if (method.startsWith('_'))  // private method
    continue
  const old = EchonetLite.prototype[method]
  if (typeof old === 'function') {
    PromisifiedEchonetLite.prototype[method] = function (...args) {
      if (callbackMethods.includes(method)) {
        if (limitedMethods.includes(method))
          return this.queue.put(() => {
            return util.promisify(old).apply(this.el, args)
          }).then(ts => {
            return ts.res
          })
        else
          return util.promisify(old).apply(this.el, args)
      } else {
        return old.apply(this.el, args)
      }
    }
  }
}

module.exports = new PromisifiedEchonetLite({lang: 'ja', type: 'lan'})
