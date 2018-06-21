<template>
    <div>
        <div id="myChart">
            <div id="main" style="height:300px;width:100%"></div>
        </div>
        <el-row class="grid-table">
            <el-form :inline="true" :model='search_data'>
                <el-form-item v-if="showSort">
                    <el-select size="small" placeholder="选择项目" clearable v-model="search_data.sort_id">
                        <el-option v-for="(value,key) in sort_type" :key="key"
                                   :label="value" :value="key">
                        </el-option>
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-date-picker v-model="dateRange" type="daterange" size="small"
                        range-separator=" 至 " placeholder="选择日期范围">
                    </el-date-picker>
                </el-form-item>
                <el-form-item style="text-align: right">
                    <el-input-number v-model="search_data.pageSize" size="small" :min="10" :max="100" label="分页"></el-input-number>
                </el-form-item>
                <el-form-item style="text-align: right">
                    <el-button size="small" icon="search" @click='onSearch'>查询</el-button>
                </el-form-item>
            </el-form>
            <el-button type="danger" :disabled="grade.deleteReport" @click='deleteReport()'>批量删除</el-button>
            <el-table stripe border style="width:100%;margin-top:10px" :data="table_data.data" @selection-change="handleSelectionChange" @expand-change="expandChange">
                <el-table-column type="selection" width="38"></el-table-column>
                <el-table-column type="expand">
                    <template slot-scope="props">
                        <keep-alive>
                        <div class="chart" :id="'chart'+props.row.id"></div>
                        </keep-alive>
                        <el-form label-position="left" inline class="table-expand">
                            <el-form-item label="用户："><span>{{ props.row.uin }}</span></el-form-item>
                            <el-form-item label="上报IP："><span>{{ props.row.ip }}</span></el-form-item>
                            <el-form-item label="系统："><span>{{ props.row.os +' 宽：'+ props.row.screen_width+' 高：'+ props.row.screen_height+' 像素比：'+ props.row.pixel_ratio}}</span></el-form-item>
                            <el-form-item label="来源页："><span>{{ props.row.referrer }}</span></el-form-item>
                            <el-form-item label="当前页面："><span>{{ props.row.url +' 类型：'+ props.row.type+' 重定向数：'+ props.row.redirect_count}}</span></el-form-item>
                            <el-form-item label="浏览器："><span>{{ props.row.browser }}</span></el-form-item>
                        </el-form>
                    </template>
                </el-table-column>
                <el-table-column type="index" width="50"></el-table-column>
                <el-table-column
                    v-for="item in table_data.columns"
                    :label="item.name"
                    :key="item.key"
                    :prop="item.key"
                    :formatter="columnFormatter"
                    :min-width="item.minWidth" :width="item.width">
                </el-table-column>
            </el-table>
            <el-pagination
                @current-change="handleCurrentChange"
                :current-page="search_data.page"
                :page-size="search_data.pageSize"
                layout="total, prev, pager, next,jumper"
                :total="table_data.total">
            </el-pagination>
        </el-row>
    </div>
</template>
<script type="text/javascript">
    import {ajax,storage,formatDate} from 'utils';
    import common from 'common';
    module.exports = {
        name: 'list',
        data() {
            return {
                page_grade:common.page_grade,
                grade:{
                    deleteReport: !0,
                },
                chartObj:null,
                setOption:{
                    title:{
                        text:'首屏加载统计'
                    },
                    tooltip: {
                        trigger: 'axis',
                        axisPointer: {
                            type: 'cross',
                            label: {
                                backgroundColor: '#6a7985'
                            }
                        }
                    },
                    toolbox:{
                        feature:{
                            saveAsImage:{}
                        }
                    },
                    grid: {left: '3%',right: '3%',bottom: '3%',containLabel: true},
                    yAxis:  [{type: 'value'}],
                    legend: {
                        selected: {
                            '加载耗时': !0,'重定向耗时': !1,'CDN耗时': !1,'TCP耗时': !1,'请求耗时': !1,'响应耗时': !1,'白屏时间': !0,'渲染耗时': !0, '准备耗时': !0
                        },
                        data: ['重定向耗时', 'CDN耗时','TCP耗时','请求耗时','响应耗时','白屏时间','渲染耗时','准备耗时','加载耗时']
                    },
                    xAxis : [
                        {
                            type : 'category',
                            boundaryGap : false,
                            data : []
                        }
                    ],
                    series: []
                },
                userInfo:{},
                dateRange:'',
                showSort:!0,
                search_data: {
                    table:'performance',
                    sort_id:'',
                    begin: 0,
                    end: 0,
                    page: 1,
                    pageSize: 10
                },
                sort_type:common.sort_type,
                //表格数据
                multipleSelection:[],
                table_data: {
                    columns: [
                        {'key': 'code', 'name': '项目', minWidth: 115},
                        {'key': 'browser_type', 'name': '浏览器', width: 100},
                        {'key': 'redirect', 'name': '重定向耗时', width: 100},
                        {'key': 'dns_lookup', 'name': 'CDN耗时', width: 90},
                        {'key': 'tcp_connect', 'name': 'TCP耗时', width: 90},
                        {'key': 'request', 'name': '请求耗时', width: 90},
                        {'key': 'response', 'name': '响应耗时', width: 90},
                        {'key': 'first_paint', 'name': '白屏时间', width: 90},
                        {'key': 'dom_complete', 'name': '渲染耗时', width: 90},
                        {'key': 'dom_ready', 'name': '准备耗时', width: 90},
                        {'key': 'dom_load', 'name': '加载耗时', width: 90},
                        {'key': 'occurrence', 'name': '时间', width: 170}
                    ],
                    total: 0,
                    data: []
                }
            }
        },
        created(){
            //特定用户
            storage.get('userInfo',obj=>{
                const t = common.sort_type;
                let name = obj.userInfo.user_name;
                Object.keys(t).forEach(k=>{
                    if(name === t[k]){
                        this.showSort = !1;
                        this.search_data.sort_id = k;
                    }
                })
            });
        },
        methods: {
            deleteReport(arr){
                if(!arr){
                    if(this.multipleSelection.length){
                        arr = this.multipleSelection;
                    }else{
                        return this.$message('请先选择上报');
                    }
                }
                this.$confirm(`确定要${arr.length>1?'批量删除上报':'删除此上报'}吗？`, '系统提醒', {
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    type: 'warning'
                }).then(() => {
                    ajax.call(this, '/deleteReport', {ids:arr.map(o=>o.id).join(',')}, (d, err) => {
                        !err && this.ajaxData();
                    })
                }).catch(() => {});
            },
            handleSelectionChange(val){
                this.multipleSelection = val;
            },
            //格式化输出内容
            columnFormatter(row, column){
                let key = column.property;
                let str = row[key];
                str = str === 0 ? 0 : str || ''
                let h = this.$createElement;
                if(key === 'occurrence'){
                    let t = new Date(str);
                    str = formatDate('yyyy-mm-dd hh:mm:ss',t);
                }else if(key === 'code'){
                    str = common.sort_type[str]||'未知';
                }
                return str;
            },
            //ajax请求列表数据
            ajaxData(){
                if(this.dateRange[0]){
                    this.search_data.begin = formatDate('yyyy-mm-dd',this.dateRange[0]);
                    this.search_data.end = formatDate('yyyy-mm-dd',this.dateRange[1]);
                }else{
                    this.search_data.begin = this.search_data.end = '';
                }
                ajax.call(this, '/listReport', this.search_data, (obj, err) => {
                    if (!err) {
                        this.table_data.data = obj.data;
                        this.table_data.total = obj.total;
                        this.search_data.page = obj.page;
                        //渲染图表
                        let o = this.setOption;
                        const arr = ['redirect','dns_lookup','tcp_connect','request','response','first_paint','dom_complete','dom_ready','dom_load']
                        obj.data.forEach((row,i)=>{
                            o.series.forEach((obj,l)=>{
                                if(i === 0){
                                    o.xAxis[0].data = []
                                    obj.data = [] //初始化清空
                                }
                                obj.data.push(row[arr[l]])
                            })
                            o.xAxis[0].data.push(i+1+common.sort_type[row.code]);
                        })
                        if(!this.chartObj){
                            this.chartObj = this.$echarts.init(document.getElementById('main'),'light');
                        }
                        this.chartObj.setOption(o);
                    }
                });
            },
            //点击查询
            onSearch() {
                this.ajaxData();
            },
            handleCurrentChange(page){
                if(page !== this.search_data.page){
                    this.search_data.page = page;
                    this.ajaxData();
                }
            },
            createChart(row,dom){
                let chart = this.$echarts.init(dom,'light');
                let data = []
                JSON.parse(row.entries).forEach(o => {
                    let d = o.duration
                    if (d) {
                        let k = /[^.\/]+\.[^.]+(?=[?#].*)?$/.exec(o.url)
                        k = k ? k[0] : o.type
                        data.push({value:d,name:k})
                    }
                })
                chart.setOption({
                    tooltip : {
                        trigger: 'item',
                        formatter: "{a} <br/>{b} : {c} ({d}%)"
                    },
                    series : [
                        {
                            name: '资源耗时',
                            type: 'pie',
                            radius : '80%',
                            center: ['50%', '50%'],
                            data,
                            itemStyle: {
                                emphasis: {
                                    shadowBlur: 10,
                                    shadowOffsetX: 0,
                                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                                }
                            }
                        }
                    ]
                });
            },
            expandChange(row) {
                this.$nextTick(()=>{
                    let dom = document.getElementById('chart'+row.id)
                    dom && this.createChart(row,dom);
                })
            },
        },
        mounted() {
            let o = this.setOption;
            o.legend.data.forEach((v,i)=>{
                o.series.push({
                    name: v,
                    type: 'line',
                    stack: '耗时',
                    areaStyle: {
                        normal: {}
                    },
                    data: []
                })
            })
            this.ajaxData();
        },
        mixins:[common.mixin],
    }
</script>
<style lang="less">
    #myChart{
        margin-bottom: 10px;
        border:1px solid #cacaca;
        overflow: hidden;
    }
    .chart{
        position: absolute;
        top:0;
        left:900px;
        width:300px;
        height:200px;
    }
</style>
