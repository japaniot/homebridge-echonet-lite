const util = require('util')
const Bobolink = require('bobolink')
//const EchonetLite = require('echonet-lite-more')
const EchonetLite = require('node-echonet-lite')

// Wrapper that provide promisified methods.
class PromisifiedEchonetLite {
  constructor(arg) {
    this.el = new EchonetLite(arg)
    this.setQueue = new Bobolink({concurrency: 1})
    this.getQueue = new Bobolink({concurrency: 9})
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
      if (callbackMethods.includes(method)) {
        if (method === 'getPropertyValue')
          return this.getQueue.put(() => {
            return util.promisify(old).apply(this.el, args)
          }).then(ts => ts.res)
        else if (method === 'setPropertyValue')
          return this.setQueue.put(() => {
            return util.promisify(old).apply(this.el, args)
          }).then(ts => ts.res)
        else
          return util.promisify(old).apply(this.el, args)
      } else {
        return old.apply(this.el, args)
      }
    }
  }
}

module.exports = new PromisifiedEchonetLite({lang: 'ja', type: 'lan'})
