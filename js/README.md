# 前端监控系统<sup>monitor</sup>上报插件V3.0.1

	新增防劫持功能

### 使用方法

```
<script type="text/javascript" src="monitor.js"></script>
```

#### 初始化init

```
monitor.init({
    random: location.hostname === 'localhost' ? 0 : 1, // 抽样上报[0-1] 1:100%上报,0:关闭上报。
    code: 'monitor', // 后台监控项目相应的编码（必配置）。
    url:'http://localhost:8000/api/beacon', //上报接口（必配置）,
    key:'monitor',//存储localStorage的key。以防与其他脚本重复请适当修改。
    uin: '', // 被监控网站所登录的用户（可选），为方便追踪错误来源。也要警防用户信息泄漏。,
    ignore: [], // 忽略某些关键词错误, 支持String或Regexp
    hostList:[location.host,'qq.com'], //host白名单（非数组表示不过滤）
    pathname:['/','/index.html'],//需要性能测试的页面，必须数组一般只统计首页。
})
```

> random指前端的抽样上报。后端同样有日志和性能上报抽样配置。入库的机率等于两者相乘。
> code标识必须与网站中的`监控项目`中有相应配置，否则后台不保存数据。

***注意：初始化后基本上就可以了，如果你想手动添加日志也是可以的。***

##### 手动新增日志

```
monitor.push({
    title: '错误标题',
    info: '错误详情',
    url:'错误来源页（可选）为空时自动取location.href值'
})
```
##### 捕捉console日志：

```
console.log('一条日志');
console.warn('一条警告');
console.error('一条错误');
throw Error("手动抛出错误");
//以上方法都会监听并上报日志

console.info('一条信息');//没有监听此函数，不想被上报的信息建议使用此方法。
```
注意：此处默认获取js自身错误。如果需要手动抛出错误，请使用`throw Error("something");`而不要使用`throw "something";`。而vue内部做了处理，两都都可以捕获到。


---

### vue版本vue_monitor.js

#### 使用方法：

```
import monitor from './js/vue_monitor'
Vue.use(monitor);
```

#### 调用方法：

参考上面方法，把`monitor`替换成`this.$monitor`即可。

示范例子请查看`tests`目录。


### 升级日志
1.添加view_time用户停留时间统计 2018-6-25
2.改写console捕获日志上报 2018-6-25
3.使用puppeteer辅助获取首屏性能测试数据（计划中...）
