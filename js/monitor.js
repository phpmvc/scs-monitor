/**
 * 高版本浏览器使用：Chrome39+ Edge Firefox(31) Opera(26) 即必须支持navigator.sendBeacon
 */
const monitor = (function(W,D) {
    const F = {
        random: location.hostname === 'localhost' ? 0 : 1, // 抽样上报[0-1] 1:100%上报,0:关闭上报。
        code: 'monitor', // 后台监控项目相应的编码（必配置）。
        url:'http://localhost:8000/api/beacon', //上报接口（必配置）,
        key:'monitor',//存储localStorage的key。以防与其他脚本重复请适当修改。
        uin: '', // 被监控网站所登录的用户（可选），为方便追踪错误来源。也要警防用户信息泄漏。,
        ignore: ['[HMR]','Ignored an update'], // 忽略某些关键词错误, 支持String或Regexp
        hostList:[location.host,'qq.com'], //host白名单（非数组表示不过滤）
        pathname:['/login','/index.html'],//需要性能测试的页面，必须数组一般只统计首页。
    };
    if(!navigator.sendBeacon||!W.performance){
        return W.monitor = {
            init:function(){return F},
            push:function(){},
            beacon:function(){}
        }
    }
    const T = {
        log: W.console.log,
        warn: W.console.warn,
        error: W.console.error,
        isType(o, type) {
            return Object.prototype.toString.call(o) === '[object ' + (type || 'Object') + ']';
        },
        checkURL(url){
            //检查白名单
            if(Array.isArray(F.hostList)){
                let reg = url.toString().match(/https?:\/\/([^\/]+)/i)
                return reg ? F.hostList.some(v=>reg[1].endsWith(v)) : !0
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
                msg.title = msg.title.substring(0,50);
                msg.url = (msg.url||W.location.href).substring(0,200);
                if(msg.url.endsWith('.hot-update.json')){
                    ignore = !0 //忽略webpack热更新文件
                }
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
                view_time: Date.now() - T.timeIn,
                timing: JSON.stringify(timing),
                entries: JSON.stringify(entries)
            }
            navigator.sendBeacon(F.url.replace('beacon','performance'),JSON.stringify(obj));
        },
        //先缓存不上报
        push(msg){
            if(!T.isType(msg)||T.isIgnore(msg)){
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
            if(arr.length){
                //如果全量上报且上报成功，删除缓存
                navigator.sendBeacon(F.url,JSON.stringify({code:F.code,uin:F.uin,list:arr})) && !isObj && localStorage.removeItem(F.key);
            }
        }
    };
    W.addEventListener('load', function () {
        T.timeIn = Date.now()//用于统计用户停留时间
    })
    W.addEventListener('beforeunload', function () {
        monitor.beacon();//上报日志
        let k = F.key+'_Url';
        let u = [];
        let p = location.pathname;//当前页面地址
        let n = F.pathname
        !Array.isArray(n) && (n = ['/']) //必须是指定页面统计，否则太多没意义。
        try{
            u = JSON.parse(localStorage.getItem(k));
        }catch (e){}
        if(!Array.isArray(u)){
            u = [];
            localStorage.setItem(k,'[]');
        }
        if (!u.includes(p) && n.includes(p)) {
            u.push(p)
            localStorage.setItem(k, JSON.stringify(u))
            monitor.performance()
        }
    }, false)
    W.onerror = function(msg,url,line,col,error) {
        msg = T.isType(msg)? msg.message:msg;
        if(msg === 'Script error.')return;//忽略第三方js链接文件错误
        monitor.push({
            title: msg,
            url: url,
            info: 'line:' + line + 'col:' + col
        });
    }
    //写入缓存
    localStorage.setItem(F.key+'_Date',new Date().toDateString());
    //重写console
    function handleConsole(t,arg){
        let r = [].slice.call(arg)
        let i = r.map(v=>T.isType(v)?JSON.stringify(v):v).join(',')
        monitor.push({
            title: `console.${t}: ${i}`,
            info: i
        });
        T[t].apply(W.console,r)
    }
    W.console.log = function() {
        handleConsole('log',arguments)
    }
    W.console.warn = function() {
        handleConsole('warn',arguments)
    }
    W.console.error = function() {
        handleConsole('error',arguments)
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
        if(T.isType(d)){
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
            t === 'innerHTML' && _i.set.call(c, str)
            t === 'Document.write' && _w.call(c, str)
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

if (typeof module !== 'undefined') {
    module.exports = monitor;
}
