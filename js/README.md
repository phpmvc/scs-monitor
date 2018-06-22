# 前端监控系统<sup>monitor</sup>上报插件V3.0

	新增防劫持功能

### 使用方法

```
<script type="text/javascript" src="monitor.js"></script>
```

#### 初始化init

```
monitor.init({
    code: 'monitor', // 上报的code标识
    uin: '', // 用户
    whiteList:[location.hostname,'www.qq.com','www.baidu.com'], //白名单（非数组表示不过滤）
    pathname:['/','/index.html','/login'],//需要性能测试页面
    prevent:location.hostname !== 'localhost', //是否禁止捕获（开发时可设为true）
    key:'monitor',//localStorage key
    url:'http://localhost:8000/api/beacon', //上报接口(默认不应该修改)
    ignore: [], // 忽略某些关键词错误, 支持String或Regexp
    random: 1 // 抽样 (0-1] 1-全量
})
```

- code:就是监控网站标识，让后台知道是哪个网站上报的错误。请参见server/common.js  sort_type配置
- uin:被监控网站所登录的用户（可选），为方便追踪错误来源及还原bug操作。
- whiteList:表示可以加载哪些网站的资源，不在列表中的将会禁止并上报情况。此字段不是数组表示全开放。
- pathname:需要统计首屏加载情况的页面路径。
- key:存储localStorage的key，可任意修改。
- url:上报日志地址（重要）
- ignore:忽略某些关键词错误, 支持String或Regexp。
- random:抽样上报(0-1] 1-全量。

> code标识必须与网站中的`监控项目`中有相应配置，否则后台不保存数据。
> random指前端的抽样上报。后端同样有日志和性能上报抽样配置。入库的机率等于两者相乘。

***注意：初始化后基本上就可以了，如果你想手动添加日志也是可以的。***

##### 手动新增日志

```
monitor.push({
    title: '错误标题',
    info: '错误详情',
    url:'错误来源页（可选）为空时自动取location.href值'
})
```
##### 捕捉try错误日志：

```
try{
    let a = b + 1;
    if(a){
        throw Error("手动抛出错误");
    }
}catch(e){
    this.$monitor.push({
        title: e.message,
        info: e.stack
    });
    console.error('捕捉有误：',e.stack)
}
```
注意：此处默认获取js自身错误。如果需要手动抛出错误，请使用`throw Error("something");`而不要使用`throw "something";`


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


### 待办事项
1.改写console捕获日志上报
