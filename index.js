const io = require('socket.io-client');
const randomstring = require('randomstring');

class PyFiClient {
  constructor(uri){
    this.uri = uri;
    this.run = {};
    this.pythonProcesses = {};
    this.startSocket();
  }
  startSocket(){
    this.socket = io(this.uri);
    this.socket.on('pythonic-modules', (data) => {
      this.initModules(data)
    })
    this.socket.on('connect', ()=>{
      this.socket.emit('pythonic-get-modules')
    })
    this.socket.on('pythonic-run-data', (res) => {
      this.pythonProcesses[res.rid].resolve(res.data)
    })
  }
  initModules(moduleTree){
    this.run = this.getCallables(moduleTree);
    if(this.readyCallback){
      this.readyCallback();
    }
  }
  getCallables(moduleTree, treeLoc){
    return moduleTree.reduce((result, element) => {
      const isFunc = typeof element === 'string';
      const modName = treeLoc ? treeLoc : '';
      if(isFunc){
        result[element] = (args=[], kwargs={}) => {
          return this.callPython({
            action: 'RUN',
            module: modName,
            function: element,
            args: Array.isArray(args) ? args : [],
            kwargs: Array.isArray(args) ? kwargs : args
          })
        }
      }else{
        const subModName = Object.keys(element)[0];
        const nextSubModName = modName ? `${modName}.${subModName}` : subModName;
        result[subModName] = this.getCallables(element[subModName], nextSubModName)
      }
      return result;
    }, {})
  }
  callPython(request){
    const rid = randomstring.generate(5)
    this.socket.emit('pythonic-run', {rid, request})
    return new Promise((resolve, reject) => {
      this.pythonProcesses[rid] = {resolve, reject}
    })
  }
  onReady(callback){
    this.readyCallback = callback;
  }

}

const proxyHandler = {
  get: (target, key, receiver) => {
    if (key === '_') {
      return target;
    } else if (target.run && key in target.run) {
      return target.run[key];
    }
    return undefined;
  },
};

module.exports = function(uri){ return new Proxy(new PyFiClient(uri), proxyHandler) };
