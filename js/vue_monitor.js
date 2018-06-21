//功能：前端监控vue插件

/**
 * 高版本浏览器使用：Chrome39+ Edge Firefox(31) Opera(26) 即必须支持navigator.sendBeacon
 */
const monitor = (function(W,D) {
    const F = {
        code: 'monitor', // 上报的code标识
        uin: '', // 用户
        whiteList:[location.hostname,'www.qq.com','www.baidu.com'], //白名单（非数组表示不过滤）
        pathname:['/','/index.html','/login'],//需要性能测试页面
        prevent:location.hostname !== 'localhost', //是否禁止捕获（开发时可设为true）
        key:'monitor',//localStorage key
        url:'http://localhost:8000/api/beacon', //上报接口(默认不应该修改)
        ignore: [], // 忽略某些关键词错误, 支持String或Regexp
        random: 1 // 抽样 (0-1] 1-全量
    };
    if(!navigator.sendBeacon||!W.performance){
        return {
            init(){return F},
            push(){},
            beacon(){}
        }
    }
    const T = {
        isType(o, type) {
            return Object.prototype.toString.call(o) === '[object ' + (type || 'Object') + ']';
        },
        checkURL(url){
            //检查白名单
            if(Array.isArray(F.whiteList)){
                let reg = url.toString().match(/https?:\/\/([^:\/]+)/i)
                return reg ? F.whiteList.includes(reg[1]) : !0
            }else{
                return !0;
            }
        },
        getStorage(){
            let arr;
            try{
                arr = JSON.parse(localStorage.getItem(F.key));
            }catch (e){}
            return T.isType(arr,'Array') ? arr : [];
        },
        getTime(t){
            return t ? (performance.now() - t) >> 0 : performance.now()
        },
        isIgnore(msg){
            //必须有title和info属性,然后才抽样
            let ignore = msg.title && msg.info ? F.random <= Math.random() : !0;
            if(!ignore){
                //处理一下数据
                msg.title = msg.title.substring(0,200);
                msg.url = (msg.url||W.location.href).substring(0,200);
                msg.occurrence = Date.now();
                msg.amount = 1;
                if(!Number.isInteger(msg.info)||!msg.title.startsWith('API:')){
                    msg.title = msg.title.replace(/API:/g,'');//过滤非法字符
                    msg.info = msg.info.toString().substring(0,200);
                }
                if (T.isType(F.ignore, 'Array')) {
                    for (let i = F.ignore.length;i--;) {
                        let _s = F.ignore[i];
                        if (T.isType(_s, 'RegExp') && _s.test(msg.title) || T.isType(_s, 'String') && msg.title.includes(_s)) {
                            ignore = !0;
                            break;
                        }
                    }
                }
            }
            return ignore;
        }
    };
    W.monitor = {
        //初始化配置
        init(config) {
            if(T.isType(config)){
                for (const key in config) {
                    if(config.hasOwnProperty(key)){
                        F[key] = config[key];
                    }
                }
            }
            //判断条件自动上报
            let _this = this;
            let d = F.key+'_Date';
            let k = F.key+'_Url';
            let l = localStorage.getItem(d);
            let t = new Date().toDateString();
            /\d/.test(l) && l !== t && this.beacon();
            localStorage.setItem(d,t);//总是写入

            let u = JSON.parse(localStorage.getItem(k));
            let p = location.pathname;//当前页面地址
            if(!Array.isArray(u)){
                u = [];
                localStorage.setItem(k,'[]');
            }
            W.addEventListener('load', function () {
                //如果没有阻止上报，且本页在列表中并且没有汇报过
                if (!F.prevent && !u.includes(p)) {
                    if (Array.isArray(F.pathname) && F.pathname.includes(p) || p.includes('index')) {
                        setTimeout(_this.performance, 1)
                        u.push(p)
                        localStorage.setItem(k, JSON.stringify(u))
                    }
                }
            }, false)
            return F;
        },
        //上报性能测试
        performance(){
            let url = location.pathname;//当前页面地址
            let timing = performance.timing;
            let entries = [];
            performance.getEntries().forEach(function (per) {
                if(per.entryType === 'resource'){
                    entries.push({
                        'url': per.name,
                        'type': per.initiatorType,
                        'duration': Math.round(per.duration * 100) / 100
                    });
                }
            });
            let obj = {
                code:F.code,
                uin:F.uin,
                screen_width:W.screen.width,
                screen_height:W.screen.height,
                pixel_ratio:W.devicePixelRatio,
                url,
                type:performance.navigation.type,
                redirect_count:performance.navigation.redirectCount,
                redirect: timing.fetchStart - timing.navigationStart,
                dns_lookup: timing.domainLookupEnd - timing.domainLookupStart,
                tcp_connect: timing.connectEnd - timing.connectStart,
                request: timing.responseStart - timing.requestStart,
                response: timing.responseEnd - timing.responseStart,
                first_paint: timing.domInteractive - timing.fetchStart,
                dom_complete: timing.domComplete - timing.domInteractive,
                dom_ready: timing.domContentLoadedEventEnd - timing.domainLookupStart,
                dom_load: timing.loadEventEnd - timing.domainLookupStart,
                timing: JSON.stringify(timing),
                entries: JSON.stringify(entries)
            }
            console.log(JSON.stringify(obj));
            navigator.sendBeacon(F.url.replace('beacon','performance'),JSON.stringify(obj));
        },
        //先缓存不上报
        push(msg){
            if(F.prevent||!T.isType(msg)||T.isIgnore(msg)){
                return;//没有阻止，参数必须是对象,同时在抽样范围内
            }
            const arr = T.getStorage();
            let has = false;//判断缓存中是否有相同的错误，有就累加1，没就存入缓存
            for(let i = arr.length;i--;){
                if(arr[i].title === msg.title){
                    has = !0;
                    if(msg.title.startsWith('API:')){
                        arr[i].info.push(msg.info);
                    }else{
                        arr[i].amount ++;
                    }
                    break;
                }
            }
            if(!has){
                if(msg.title.startsWith('API:')){
                    msg.info = [msg.info];
                }
                arr.push(msg);
            }
            localStorage.setItem(F.key,JSON.stringify(arr));
        },
        //开始上报
        beacon(msg){
            const isObj = T.isType(msg);
            let arr = T.getStorage();
            if(isObj){
                if(T.isIgnore(msg))return;//不在抽样范围内或是忽略的错误
                arr = [msg];
            }
            arr.forEach(o=>{
                if(o.title.startsWith('API:')){
                    o.amount = o.info.reduce((a,v)=>a+v,0)/o.info.length >> 0;//求平均值
                    o.info = o.info.join();
                }
            });
            if(!F.prevent && arr.length){
                //如果全量上报且上报成功，删除缓存
                navigator.sendBeacon(F.url,JSON.stringify({code:F.code,uin:F.uin,list:arr})) && !isObj && localStorage.removeItem(F.key);
            }
        }
    };
    W.onerror = function(msg,url,line,col,error) {
        msg = typeof msg === 'object'? msg.message:msg;
        if(msg === 'Script error.')return;//忽略第三方js链接文件错误
        monitor.push({
            title: msg,
            url: url,
            info: 'line:' + line + 'col:' + col
        });
    }
    //重写fetch
    if (W.fetch) {
        let q = W.fetch;
        W.fetch = function() {
            let r = [].slice.call(arguments)
            let t = T.getTime()
            let n = q.apply(W, r)
            n.then(function(e) {
                let i = T.getTime(t)
                let a = document.createElement('a')
                a.href = e.url
                monitor.push({
                    title: e.ok?`API:${a.pathname} fetch 请求耗时(毫秒)`:`fetch 请求出错${a.pathname},错误码 ${e.status}`,
                    url: e.url,
                    info: e.ok?i:`请求错误：${e.statusText} 方式：${r[0].method} 耗时：${i}`
                })
            })
            return n
        }
    }
    //重写XMLHttpRequest
    function ajaxPush(r,type){
        let a = document.createElement('a');
        a.href = r.tracker.url;
        let t = T.getTime(r.tracker.time)
        monitor.push({
            title: type+':'+a.pathname,
            url: r.tracker.url,
            info: type === 'API' ? t : `耗时：${t} 方式：${r.tracker.method} 状态：${r.statusText} 参数：${r.tracker.data||a.search}`
        });
    }
    function ajax(e) {
        let r = e.target
        if ("readystatechange" === e.type) {
            if (4 === r.readyState) {
                ajaxPush(r, 200 === r.status ? 'API' : r.status)
            }
        } else if ('error' === e.type || 'timeout' === e.type) {
            ajaxPush(r, e.type)
        }
    }
    let XML = W.XMLHttpRequest;
    W.XMLHttpRequest = function () {
        let e = new XML
        e._open = e.open
        e._send = e.send
        e.tracker = {
            url:'',
            time:'',
            method:'',
            data:''
        }
        e.addEventListener("error", ajax)
        e.addEventListener("timeout", ajax)
        e.addEventListener("readystatechange", ajax)
        e.open = function (method, url, async, username, password) {
            e.tracker.method = method
            e.tracker.url = url
            e.tracker.time = T.getTime()
            return e._open(method, url, async, username, password)
        }
        e.send = function(d){
            e.tracker.data = d;
            return e._send(d);
        }
        return e
    }
    //监听注入
    const _w = D.write;//备用方法
    const _i = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const fun = (d, t, c) => {
        if(typeof d === 'object'){
            if(d.nodeName === 'SCRIPT' && !T.checkURL(d.src)){
                monitor.push({
                    title: t + ' '+ d.tagName,
                    info: d.outerHTML
                });
            }
        }else{
            //扩展防劫持
            let str = d.toString();
            let reg = str.match(/<script[^>]+?src=[^<]+?<\/script>/gi);
            if(reg){
                let arr = [];
                reg.forEach(s=>{
                    if(!T.checkURL(s)){
                        str = str.replace(s,'')
                        arr.push(s);
                    }
                })
                monitor.push({
                    title: t + ' SCRIPT',
                    info: reg.join()+(arr.length?`已拦截${arr.join(',')}`:'')
                });
            }
            t === 'innerHTML'?_i.set.call(c, str):_w.call(c, str)
        }
    };
    D.write = D.writeln = str => {
        fun(str,'Document.write',D);
    };
    Object.defineProperty(Element.prototype, 'innerHTML', {
        set (str) {
            fun(str,'innerHTML',this);
        }
    });
    if (MutationObserver) {
        const observer = new MutationObserver(m => {
            m.forEach(n => {
                n.type === 'childList' ? n.addedNodes.forEach(t => fun(t, 'append')) : fun(n.target, 'modify')
            });
        });
        observer.observe(D, {
            attributes: !0,
            childList: !0,
            subtree: !0,
            attributeOldValue: !0,
            attributesFilter: ['src']
        });
    }
    return W.monitor;
}(window,document));

export default {
    install(Vue) {
        if (typeof process === 'undefined' || process.browser) {
            Vue.config.productionTip = !1;//阻止 vue 在启动时生成生产提示
            Vue.config.warnHandler = (msg, vm, trace)=> {
                monitor.push({
                    title: msg,
                    info:`错误源自：${trace} 错误`
                });
            };
            Vue.config.errorHandler = (err, vm, info)=> {
                let name = 'root instance';
                if (vm.$root !== vm) {
                    name = vm._isVue ? vm.$options.name || vm.$options._componentTag : vm.name;
                    name = (name ? 'component <' + name + '>' : 'anonymous component') + (vm._isVue && vm.$options.__file ? ' at ' + vm.$options.__file : '');
                }
                monitor.push({
                    title:`VUE组件：${name} 源自：${info} 错误`,
                    info: err.message ? err.name + ':' + err.message : err
                });
            };
            Object.defineProperty(Vue.prototype, '$monitor', { value: monitor });
        }
    }
}
