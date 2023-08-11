import Module from './module'
import { assert, forEachValue } from '../util'

// 假设传进来rawRootModule如下
// {
// 	state: {},
// 	getters: {},
// 	mutations: {},
// 	actions: {},
// 	modules: {
// 		subModule1: {
// 			state: {},
// 			getters: {},
// 			mutations: {},
// 			actions: {},
//    },
// 		subModule2: {
// 			state: {},
// 			getters: {},
// 			mutations: {},
// 			actions: {},
//    }
// 	}
export default class ModuleCollection {
  constructor (rawRootModule) {
    // register root module (Vuex.Store options)
    this.register([], rawRootModule, false)
  }

  get (path) {
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }

  getNamespace (path) {
    let module = this.root
    return path.reduce((namespace, key) => {
      module = module.getChild(key)
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }

  update (rawRootModule) {
    update([], this.root, rawRootModule)
  }

  register (path, rawModule, runtime = true) {
    if (__DEV__) {
      assertRawModule(path, rawModule)
    }

    const newModule = new Module(rawModule, runtime)
    if (path.length === 0) {
			// 第一次递归调用走这里，此时的newModule如下
			// {
			// 	runtime: false,
			// 	state: {},
			// 	_children:{},
			// 	_rawModule: rawRootModule,
			// 	namespaced: false
			// }
      this.root = newModule
    } else {
			// 第二次递归调用走这里，此时的newModule如下
			// {
			// 	runtime: false,
			// 	state: {},
			// 	_children: {subModule1、 subModule1,},
			// 	_rawModule: subModule1、 subModule1,
			// 	namespaced: false
			// }
			// path.slice(0, -1)得到了一个空数组[]
			// 所以得到的parent是this.root，也就是第一次递归时new Module产生的结果
      const parent = this.get(path.slice(0, -1))
			// addChild就是往parent的_children对象上添加newModule
      parent.addChild(path[path.length - 1], newModule)
    }

		// 第二次递归调用走这里，不存在moudles了。所以 递归暂定的
    // register nested modules
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
				// 程序开始变得复杂了，开始递归调用了
        this.register(path.concat(key), rawChildModule, runtime)

				// this.register(['subModule1'], subModule1, runtime)
				// this.register(['subModule2'], subModule2, runtime)
      })
    }
  }

  unregister (path) {
    const parent = this.get(path.slice(0, -1))
    const key = path[path.length - 1]
    if (!parent.getChild(key).runtime) return

    parent.removeChild(key)
  }

  isRegistered (path) {
    const parent = this.get(path.slice(0, -1))
    const key = path[path.length - 1]

    return parent.hasChild(key)
  }
}

function update (path, targetModule, newModule) {
  if (__DEV__) {
    assertRawModule(path, newModule)
  }

  // update target module
  targetModule.update(newModule)

  // update nested modules
  if (newModule.modules) {
    for (const key in newModule.modules) {
      if (!targetModule.getChild(key)) {
        if (__DEV__) {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
            'manual reload is needed'
          )
        }
        return
      }
      update(
        path.concat(key),
        targetModule.getChild(key),
        newModule.modules[key]
      )
    }
  }
}

const functionAssert = {
  assert: value => typeof value === 'function',
  expected: 'function'
}

const objectAssert = {
  assert: value => typeof value === 'function' ||
    (typeof value === 'object' && typeof value.handler === 'function'),
  expected: 'function or object with "handler" function'
}

const assertTypes = {
  getters: functionAssert,
  mutations: functionAssert,
  actions: objectAssert
}

function assertRawModule (path, rawModule) {
  Object.keys(assertTypes).forEach(key => {
    if (!rawModule[key]) return

    const assertOptions = assertTypes[key]

    forEachValue(rawModule[key], (value, type) => {
      assert(
        assertOptions.assert(value),
        makeAssertionMessage(path, key, type, value, assertOptions.expected)
      )
    })
  })
}

function makeAssertionMessage (path, key, type, value, expected) {
  let buf = `${key} should be ${expected} but "${key}.${type}"`
  if (path.length > 0) {
    buf += ` in module "${path.join('.')}"`
  }
  buf += ` is ${JSON.stringify(value)}.`
  return buf
}
