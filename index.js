function MyVue(options = {}) {    
  // 将所有的属性挂载到$options身上
  this.$options = options;    
  // 获取到data数据（Model）
  var data = this._data = this.$options.data;
  observe(data);    
  
  // this 就代理数据 this._data
  for (const key in data) {        
    Object.defineProperty(this, key, {
          enumerable: true,
          get() {                
              // this.a 这里取值的时候 实际上是去_data中的值
              return this._data[key] 
          },
          set(newVal) { 
              // 设置值的时候其实也是去改this._data.a的值
              this._data[key] = newVal
          }
      })
  }
  this.$compile = new Compile(options.el || document.body, this)
}
function Observe(data) {    
  let dep = new Dep();     
  for (let key in data) {        
      let val = data[key];        
      // 递归 =》来实现深层的数据监听
      observe(val)        
      Object.defineProperty(data, key, {
          enumerable: true,
          get() {                
            /* 获取值的时候 Dep.target 
                对于着 watcher的实例，把他创建的实例加到订阅队列中
            */
            Dep.target && dep.addSub(Dep.target); 
            return val
          },
          set(newval) { 
              if (val === newval) { //设置的值是否和以前是一样的，如果是就什么都不做
                  return
              }
              val = newval // 这里要把新设置的值也在添加一次数据劫持来实现深度响应,
              observe(newval);
              // 设置值的时候让所有的watcher.update方法执行即可触发所有数据更新
              dep.notify() 
          }
      })
  }
}
function observe(data) {
  // 这里做一下数据类型的判断，只有引用数据类型才去做数据劫持
  if (typeof data != 'object') return
  return new Observe(data)
}

// 将数据和节点挂载在一起
function Compile(el, vm) {    
  // el表示替换的范围
  vm.$el = document.querySelector(el);    
  // 这里注意我们没有去直接操作DOM，而是把这个步骤移到内存中来操作，这里的操作是不会引发DOM节点的回流
  let fragment = document.createDocumentFragment(); // 文档碎片
  let child;   
  
  while (child = vm.$el.firstChild) { 
      // 将app的内容移入内存中
      fragment.appendChild(child);
  }
      
  replace(fragment)    
  function replace(fragment) {        
      Array.from(fragment.childNodes).forEach(function (node) { //循环每一层
          let text = node.textContent;            
          let reg = /\{\{(.*)\}\}/g;
                      
          // 这里做了判断只有文本节点才去匹配，而且还要带{{***}}的字符串
          if (node.nodeType === 3 && reg.test(text)) {  
              // 把匹配到的内容拆分成数组              
              let arr = RegExp.$1.split('.'); 
              let val = vm;                
              
              // 这里对我们匹配到的定义数组，会依次去遍历它，来实现对实例的深度赋值
              arr.forEach(function (k) { // this.a.b  this.c
                  val = val[k]
              })      
               // 在这里运用了Watcher函数来新增要操作的事情
              new Watcher(vm, RegExp.$1, function (newVal) {
                node.textContent = text.replace(/\{\{(.*)\}\}/, newVal)
              })          
              // 用字符串的replace方法替换掉我们获取到的数据val
              node.textContent = text.replace(/\{\{(.*)\}\}/, val)
          } 
          // 获取所有元素节点
          if (node.nodeType === 1) {    
            let nodeAttr = node.attributes    
            Array.from(nodeAttr).forEach(function (attr) {        
                let name = attr.name; // v-model="a.b"
                let exp = attr.value; // a.b

                if (name.indexOf('v-') >= 0) {            
                    let val = vm;            
                    let arr = exp.split('.');
                    arr.forEach(function (n) {
                        val = val[n]
                    })            
                    // 这个还好处理，取到对应的值设置给input.value就好
                    node.value = val;
                }        
                // 这里也要定义一个Watcher，因为数据变更的时候也要变更带有v-model属性名的值
                new Watcher(vm, exp, function (newVal) {
                    node.value = newVal
                })        
                // 这里是视图变化的时候，变更数据结构上面的值
                node.addEventListener('input', function (e) {            
                    let newVal = e.target.value            
                    if (name.indexOf('v-') >= 0) {                
                        let val = vm;                
                        let arr = exp.split('.');
                        arr.forEach(function (k,index) {     
                            if (typeof val[k] === 'object') {
                                val = val[k]
                            } else{                        
                            if (index === arr.length-1) {
                                    val[k] = newVal
                                }
                            }
                        })
                    }
                })
            })
          }        
                 
          // 这里做了判断，如果有子节点的话 使用递归
          if (node.childNodes) {
              replace(node)
          }
      })
  }    
  // 最后把编译完的DOM加入到app元素中
  vm.$el.appendChild(fragment)
}

// 发布订阅
function Dep() {    
  this.subs = []
}
// 订阅
Dep.prototype.addSub = function (sub) {    
  this.subs.push(sub)
}
// 通知
Dep.prototype.notify = function (sub) {    
  this.subs.forEach(item => item.update())
}
  
// watcher是一个类，通过这个类创建的函数都会有update的方法
function Watcher(vm, exp, fn) {    
  this.fn = fn;
  this.vm = vm;    
  this.exp = exp; 
  Dep.target = this
  let val = vm;    
  let arr = exp.split('.');    
  /* 执行这一步的时候操作的是vm.a，
  而这一步操作其实就是操作的vm._data.a的操作，
  会触发this代理的数据和_data上面的数据
  */
  arr.forEach(function (k) {
      val = val[k]
  })
  Dep.target = null;
}
Watcher.prototype.update = function () {    
  let val = this.vm;    
  let arr = this.exp.split('.');
  arr.forEach(function (k) {
      val = val[k]
  })    
  this.fn(val) //这里面要传一个新值
}