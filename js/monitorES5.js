/**
 * 高版本浏览器使用：Chrome39+ Edge Firefox(31) Opera(26) 即必须支持navigator.sendBeacon
 * 注意不能使用严格模式'use strict'否则不能读取arguments
 */
(function (W, D) {
    W.monitor = {
        init: function init() {},
        push: function push() {},
        beacon: function beacon() {}
    };
    if (!navigator.sendBeacon || !W.performance) {
        return;
    }
    var F = {
        random: 1, // 抽样上报[0-1] 1:100%上报,0:关闭上报。
        code: 'monitor', // 后台监控项目相应的编码（必配置）同时也是存储localStorage的key。
        url: 'http://localhost:8000/api/beacon', //上报接口（必配置）,
        uin: '', // 被监控网站所登录的用户（可选），为方便追踪错误来源。也要警防用户信息泄漏。,
        ignore: ['[HMR]', 'Ignored an update'], // 忽略某些关键词错误, 支持String或Regexp
        hostList: [location.host, 'qq.com'], //host白名单（非数组表示不过滤）
        pathname: ['/', '/login', '/index.html'] //需要性能测试的页面，必须数组一般只统计首页。
    };
    var T = {
        log: W.console.log,
        warn: W.console.warn,
        error: W.console.error,
        isType: function isType(o, type) {
            return Object.prototype.toString.call(o) === '[object ' + (type || 'Object') + ']';
        },
        isIllegalURL: function isIllegalURL(url) {
            //检查非法链接
            if (Array.isArray(F.hostList)) {
                var reg = url.toString().match(/https?:\/\/[^\/]+/i);
                return reg ? !F.hostList.some(function (v) {
                    return reg[0].endsWith(v);
                }) : !1;
            } else {
                return !1;
            }
        },
        getStorage: function getStorage() {
            var arr = void 0;
            try {
                arr = JSON.parse(localStorage.getItem(F.code));
            } catch (e) {}
            return T.isType(arr, 'Array') ? arr : [];
        },
        getTime: function getTime(t) {
            return t ? performance.now() - t >> 0 : performance.now();
        },
        isIgnore: function isIgnore(msg) {
            //必须有title和info属性,然后才抽样
            var ignore = msg.title && msg.info ? F.random <= Math.random() : !0;
            if (!ignore) {
                //处理一下数据
                msg.title = msg.title.substring(0, 50);
                msg.url = (msg.url || W.location.href).substring(0, 200);
                if (msg.url.endsWith('.hot-update.json')) {
                    ignore = !0; //忽略webpack热更新文件
                }
                msg.occurrence = Date.now();
                msg.amount = 1;
                if (!Number.isInteger(msg.info) || !msg.title.startsWith('API:')) {
                    msg.title = msg.title.replace(/API:/g, ''); //过滤非法字符
                    msg.info = msg.info.toString().substring(0, 200);
                }
                if (T.isType(F.ignore, 'Array')) {
                    for (var i = F.ignore.length; i--;) {
                        var _s = F.ignore[i];
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
    var monitor = {
        //初始化配置
        init: function init(config) {
            if (T.isType(config)) {
                for (var key in config) {
                    if (config.hasOwnProperty(key)) {
                        F[key] = config[key];
                    }
                }
            }
            return F;
        },

        //上报性能测试
        performance: function (_performance) {
            function performance() {
                return _performance.apply(this, arguments);
            }

            performance.toString = function () {
                return _performance.toString();
            };

            return performance;
        }(function () {
            var timing = performance.timing;
            var entries = [];
            performance.getEntries().forEach(function (per) {
                if (per.entryType === 'resource') {
                    entries.push({
                        'url': per.name,
                        'type': per.initiatorType,
                        'duration': Math.round(per.duration * 100) / 100
                    });
                }
            });
            var obj = {
                code: F.code,
                uin: F.uin,
                screen_width: W.screen.width,
                screen_height: W.screen.height,
                pixel_ratio: W.devicePixelRatio,
                url: location.pathname,
                type: performance.navigation.type,
                redirect_count: performance.navigation.redirectCount,
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
            };
            navigator.sendBeacon(F.url.replace('beacon', 'performance'), JSON.stringify(obj));
        }),

        //先缓存不上报
        push: function push(msg) {
            if (!T.isType(msg) || T.isIgnore(msg)) {
                return; //没有阻止，参数必须是对象,同时在抽样范围内
            }
            var arr = T.getStorage();
            var has = false; //判断缓存中是否有相同的错误，有就累加1，没就存入缓存
            for (var i = arr.length; i--;) {
                if (arr[i].title === msg.title) {
                    has = !0;
                    if (msg.title.startsWith('API:')) {
                        arr[i].info.push(msg.info);
                    } else {
                        arr[i].amount++;
                    }
                    break;
                }
            }
            if (!has) {
                if (msg.title.startsWith('API:')) {
                    msg.info = [msg.info];
                }
                arr.push(msg);
            }
            localStorage.setItem(F.code, JSON.stringify(arr));
        },

        //开始上报
        beacon: function beacon(msg) {
            var isObj = T.isType(msg);
            var arr = T.getStorage();
            if (isObj) {
                if (T.isIgnore(msg)) return; //不在抽样范围内或是忽略的错误
                arr = [msg];
            }
            arr.forEach(function (o) {
                if (o.title.startsWith('API:')) {
                    o.amount = o.info.reduce(function (a, v) {
                        return a + v;
                    }, 0) / o.info.length >> 0; //求平均值
                    o.info = o.info.join();
                }
            });
            if (arr.length) {
                //如果全量上报且上报成功，删除缓存
                !isObj && localStorage.removeItem(F.code);
                navigator.sendBeacon(F.url, JSON.stringify({ code: F.code, uin: F.uin, list: arr }));
            }
        }
    };
    W.addEventListener('load', function () {
        T.timeIn = Date.now(); //用于统计用户停留时间
    });
    W.addEventListener('beforeunload', function () {
        monitor.beacon(); //上报日志
        var k = F.code + '_Url';
        var u = [];
        var p = location.pathname; //当前页面地址
        var n = F.pathname;
        !Array.isArray(n) && (n = ['/']); //必须是指定页面统计，否则太多没意义。
        try {
            u = JSON.parse(localStorage.getItem(k));
        } catch (e) {}
        if (!Array.isArray(u)) {
            u = [];
            localStorage.setItem(k, '[]');
        }
        if (!u.includes(p) && n.includes(p)) {
            u.push(p);
            localStorage.setItem(k, JSON.stringify(u));
            monitor.performance();
        }
    }, false);
    W.onerror = function (msg, url, line, col, error) {
        msg = T.isType(msg) ? msg.message : msg;
        if (msg === 'Script error.') return; //忽略第三方js链接文件错误
        monitor.push({
            title: 'error: 源自window.onerror事件',
            url: url,
            info: msg + 'line:' + line + 'col:' + col
        });
    };
    //写入缓存
    localStorage.setItem(F.code + '_Date', new Date().toDateString());
    //重写console
    function handleConsole(t, arg) {
        var r = [].slice.call(arg);
        monitor.push({
            title: t + ': \u6E90\u81EAconsole\u76D1\u542C',
            info: r.map(function (v) {
                return T.isType(v) ? JSON.stringify(v) : v;
            }).join(',')
        });
        T[t].apply(W.console, r);
    }
    W.console.log = function () {
        handleConsole('log', arguments);
    };
    W.console.warn = function () {
        handleConsole('warn', arguments);
    };
    W.console.error = function () {
        handleConsole('error', arguments);
    };
    //重写fetch
    if (W.fetch) {
        var q = W.fetch;
        W.fetch = function () {
            var r = [].slice.call(arguments);
            var t = T.getTime();
            var n = q.apply(W, r);
            n.then(function (e) {
                var i = T.getTime(t);
                var a = document.createElement('a');
                a.href = e.url;
                monitor.push({
                    title: e.ok ? 'API:' + a.pathname + ' fetch \u8BF7\u6C42\u8017\u65F6(\u6BEB\u79D2)' : 'fetch \u8BF7\u6C42\u51FA\u9519' + a.pathname + ',\u9519\u8BEF\u7801 ' + e.status,
                    url: e.url,
                    info: e.ok ? i : '\u8BF7\u6C42\u9519\u8BEF\uFF1A' + e.statusText + ' \u65B9\u5F0F\uFF1A' + r[0].method + ' \u8017\u65F6\uFF1A' + i
                });
            });
            return n;
        };
    }
    //重写XMLHttpRequest
    function ajaxPush(r, type) {
        var a = document.createElement('a');
        a.href = r.tracker.url;
        var t = T.getTime(r.tracker.time);
        monitor.push({
            title: type + ':' + a.pathname,
            url: r.tracker.url,
            info: type === 'API' ? t : '\u8017\u65F6\uFF1A' + t + ' \u65B9\u5F0F\uFF1A' + r.tracker.method + ' \u72B6\u6001\uFF1A' + r.statusText + ' \u53C2\u6570\uFF1A' + (r.tracker.data || a.search)
        });
    }
    function ajax(e) {
        var r = e.target;
        var E = 'error' === e.type;
        if ("readystatechange" === e.type) {
            if (4 === r.readyState) {
                ajaxPush(r, 200 === r.status ? 'API' : r.status);
            }
        } else if (E || 'timeout' === e.type) {
            ajaxPush(r, E ? 'error' : 'error:timeout');
        }
    }
    var XML = W.XMLHttpRequest;
    W.XMLHttpRequest = function () {
        var e = new XML();
        e._open = e.open;
        e._send = e.send;
        e.tracker = {
            url: '',
            time: '',
            method: '',
            data: ''
        };
        e.addEventListener("error", ajax);
        e.addEventListener("timeout", ajax);
        e.addEventListener("readystatechange", ajax);
        e.open = function (method, url, async, username, password) {
            e.tracker.method = method;
            e.tracker.url = url;
            e.tracker.time = T.getTime();
            return e._open(method, url, async, username, password);
        };
        e.send = function (d) {
            e.tracker.data = d;
            return e._send(d);
        };
        return e;
    };
    //监听注入
    var _w = D.write; //备用方法
    var _i = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    var fun = function fun(d, t, c) {
        if (c) {
            var str = d.toString();
            var reg = str.match(/<script[^>]+?src=[^<]+?<\/script>/gi);
            if (reg) {
                var arr = [];
                reg.forEach(function (s) {
                    if (T.isIllegalURL(s)) {
                        str = str.replace(s, ''); //扩展防劫持
                        arr.push(s);
                    }
                });
                arr.length && monitor.push({
                    title: 'script: ' + t,
                    info: '\u5DF2\u62E6\u622A\uFF1A' + arr.join(',')
                });
            }
            t === 'innerHTML' ? _i.set.call(c, str) : _w.call(c, str);
        } else {
            if (d.nodeName === 'SCRIPT' && T.isIllegalURL(d.src)) {
                monitor.push({
                    title: 'script: ' + t,
                    info: '\u672A\u963B\u6B62\uFF1A' + d.outerHTML
                });
            }
        }
    };
    D.write = D.writeln = function (str) {
        fun(str, 'Document.write', D);
    };
    Object.defineProperty(Element.prototype, 'innerHTML', {
        set: function set(str) {
            fun(str, 'innerHTML', this);
        }
    });
    if (MutationObserver) {
        var observer = new MutationObserver(function (m) {
            m.forEach(function (n) {
                n.type === 'childList' ? n.addedNodes.forEach(function (t) {
                    return fun(t, 'append');
                }) : fun(n.target, 'modify');
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
    W.monitor = monitor;
})(window, document);

if (typeof module !== 'undefined') {
    module.exports = monitor;
}
