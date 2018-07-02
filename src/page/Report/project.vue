<template>
    <div>
        <div class="myChart">
            <div id="main" style="height:300px;width:100%"></div>
        </div>
        <el-dialog :title="form_data.id ? '编辑项目' : '添加项目'" :visible.sync="dialogVisible" :rules="rules" width="500">
            <el-form ref="perfor" :rules="rules" :model='form_data' label-width="100px">
                <el-form-item label="编码" prop="code">
                    <el-input v-model="form_data.code" :disabled="form_data.id!==''"></el-input>
                </el-form-item>
                <el-form-item label="排序" prop="sort">
                    <el-slider v-model="form_data.sort" :max="99"></el-slider>
                </el-form-item>
                <el-form-item label="项目名称" prop="name">
                    <el-input v-model="form_data.name"></el-input>
                </el-form-item>
                <el-form-item label="项目域名" prop="domain">
                    <el-input v-model="form_data.domain"></el-input>
                </el-form-item>
                <el-form-item label="日志采集率">
                    <el-input-number v-model="form_data.log_odds" :min="0" :max="0.9" :step="0.1"></el-input-number>
                </el-form-item>
                <el-form-item label="性能采集率">
                    <el-input-number v-model="form_data.performance_odds" :min="0" :max="0.9" :step="0.1"></el-input-number>
                </el-form-item>
                <el-form-item>
                    <el-input type="textarea" :rows="2" v-model="form_data.comment">
                    </el-input>
                </el-form-item>
            </el-form>
            <span slot="footer" class="dialog-footer">
    <el-button @click="dialogVisible = false">取 消</el-button>
    <el-button type="primary" @click="saveProject">提交</el-button>
  </span>
        </el-dialog>

        <el-row class="grid-table">
            <el-button icon="el-icon-plus" type="success" style="float:right" @click="addProject">添加项目</el-button>
            <el-select placeholder="选择项目" @change="ajaxData" clearable v-model="search_data.sort_id">
                <el-option v-for="(value,key) in sortType" :key="key"
                           :label="value" :value="key">
                </el-option>
            </el-select>
            <el-table stripe border style="width:100%;margin-top:10px" :data="table_data.data">
                <el-table-column
                    show-overflow-tooltip
                    v-for="item in table_data.columns"
                    :render-header="renderHeader"
                    :key="item.key"
                    :prop="item.key"
                    :formatter="columnFormatter"
                    :min-width="item.minWidth" :width="item.width">
                </el-table-column>
            </el-table>
        </el-row>
    </div>
</template>
<script type="text/javascript">
    import {ajax,storage,mixin} from 'utils';
    module.exports = {
        name: 'project',
        data() {
            return {
                dialogVisible:!1,
                chartObj:null,
                maxPie:{
                    name:'左大圆',
                    type:'pie',
                    center : ['33%', 150],
                    radius : [90, 120],
                    data:[]
                },
                minPie:{
                    name:'左小圆',
                    type:'pie',
                    center : ['33%', 150],
                    radius : 70,
                    itemStyle : {
                        normal : {
                            label : {
                                position : 'inner',
                                formatter : function (params) {
                                    return (params.percent - 0).toFixed(0) + '%'
                                }
                            },
                            labelLine : {
                                show : false
                            }
                        },
                        emphasis : {
                            label : {
                                show : true,
                                formatter : "{b}\n{d}%"
                            }
                        }
                    },
                    data:[]
                },
                setOption:{
                    tooltip : {
                        show: true,
                        formatter: "{a} <br/>{b} : {c} ({d}%)"
                    },
                    toolbox: {
                        show : true,
                        feature : {
                            saveAsImage : {show: true}
                        }
                    },
                    calculable : true,
                    series : []
                },
                form_data: {
                    id: '',
                    sort : 0,
                    code: '',
                    name: '',
                    domain: '',
                    log_odds: 1,
                    performance_odds: 1,
                    comment: '',
                },
                rules:{
                    code: [{type: "string", required: true,message: '请填写4-10个字符的编码', pattern:/^\w{4,10}$/ }],
                    name: { required: true, message: '请填写项目名称',pattern:/(?!=.*['"])/},
                    domain: { required: true, message: '请正确填写项目域名+端口', pattern:/^https?:\/\/(\w+\.?)+(:\d+)?/}
                },
                multipleSelection:[],
                table_data: {
                    columns: [
                        {"key": "code", "name": "编码", width: 120},
                        {"key": "name", "name": "项目名称", width: 120},
                        {"key": "domain", "name": "域名(端口)", width: 150},
                        {"key": "log_odds", "name": "日志机率?", width:100,question:'日志采集机率：0至0.9'},
                        {"key": "rc", "name": "日志数", width:150},
                        {"key": "performance_odds", "name": "性能机率?", width:100,question:'性能采集机率：0至0.9'},
                        {"key": "fc", "name": "首屏耗时", width:100},
                        {"key": "comment", "name": "说明", minWidth:120},
                        {"key": "operations", "name": "操作", width: 210}
                    ],
                    data: []
                }
            }
        },
        methods: {
            //格式化表格表头
            renderHeader(h,obj){
                let key = obj.column.property;
                let arr = this.table_data.columns;
                for(let i = arr.length;i--;){
                    let obj = arr[i];
                    if(obj.key === key){
                        let name = arr[i].name;
                        if(obj.question){
                            return h('el-tooltip', {props: {placement: 'top'}
                            }, [h('div', {slot: 'content'},obj.question),
                                h('span',[name,h('i', {'class': 'el-icon-question',style:{color:'#26bbf0',marginLeft:'2px'}})])
                            ]);
                        }else{
                            return name;
                        }
                    }
                }
            },
            //添加项目
            addProject(){
                this.dialogVisible = !0;
                let d = this.form_data;
                Object.keys(d).forEach(k=>{
                    d[k] = k.includes('odds') ? 0.9 : ''
                })
                d.sort = 50;
            },
            //保存项目
            saveProject(){
                this.$refs.perfor.validate((valid) => {
                    if (valid) {
                        ajax.call(this, '/updateProject', this.form_data, (obj, err) => {
                            if (!err) {
                                this.dialogVisible = !1;
                                this.ajaxData();
                            }
                        });
                    }
                });
            },
            ajaxData(){
                ajax.call(this, '/project', {code:this.search_data.sort_id}, (obj, err) => {
                    if (!err) {
                        this.table_data.data = obj.data;
                        //渲染图表
                        let o = this.setOption;
                        o.series = [];

                        let leftMax = JSON.parse(JSON.stringify(this.maxPie))
                        leftMax.name = '日志统计'
                        leftMax.data = []
                        let rightMax = JSON.parse(JSON.stringify(this.maxPie))
                        rightMax.name = '首屏速度'
                        rightMax.center = ['66%',150]
                        rightMax.data = []
                        obj.statistics.forEach(o=>{
                            obj.data.forEach(v=>{
                                if(v.code === o.code){
                                    v.rc = o.rc;
                                    v.fc = o.fc;
                                }
                            })
                            leftMax.data.push({value:o.rc,name:o.code})
                            rightMax.data.push({value:o.fc,name:o.code})
                        },0);
                        o.series.push(leftMax)
                        o.series.push(rightMax)

                        let leftMin = JSON.parse(JSON.stringify(this.minPie))
                        leftMin.name = '日志类型'
                        const _obj = {
                            api:0,warn:0,error:0,script:0,other:0
                        };
                        obj.reports.forEach(o=>{
                            _obj[this.getLogType(o.t)] += o.counts;
                        },0);
                        leftMin.data = Object.entries(_obj).map(o=>({name:o[0],value:o[1]}))
                        o.series.push(leftMin)

                        let rightMin = JSON.parse(JSON.stringify(this.minPie))
                        rightMin.name = '浏览器占比'
                        rightMin.data = []
                        obj.performance.forEach(o=>{
                            rightMin.data.push({value:o.counts,name:o.browser_type})
                        },0);
                        rightMin.center = ['66%',150]
                        o.series.push(rightMin)

                        if(!this.chartObj){
                            this.chartObj = this.$echarts.init(document.getElementById('main'),'light');
                        }
                        this.chartObj.setOption(o);
                    }
                });
            },
            createButton(h, row, code, text){
                let self = this;
                return h('el-button', {
                    props: {size: 'small'},
                    on: {
                        click(){
                            self.healColumnClick(code, row)
                        }
                    }
                },[text])
            },
            columnFormatter(row, column){
                let key = column.property;
                let str = row[key]||'';
                let h = this.$createElement;
                if(key === 'operations'){
                    return h('div',[
                        this.createButton(h,row,'edit','编辑'),
                        this.createButton(h,row,'test','测试'),
                        this.createButton(h,row,'delete','删除')
                    ])
                }else if(key.includes('odds')){
                    str = str === '0.0' ? '关闭' : str //this.ranking
                }
                return str;
            },
            healColumnClick(code, row){
                if(code === 'delete'){
                    this.$confirm(`确定要删除此项目吗？`, '系统提醒', {
                        confirmButtonText: '确定',
                        cancelButtonText: '取消',
                        type: 'warning'
                    }).then(() => {
                        ajax.call(this, '/updateProject', {id:row.id,del:true}, (d, err) => {
                            !err && this.ajaxData();
                        })
                    }).catch(() => {});
                }else if(code === 'test'){
                    ajax.call(this, '/sendPipe', {url:row.domain}, (d, err) => {
                        !err && this.$message({
                            message: '首屏测试成功！',
                            type: 'success'
                        });
                    })
                }else if(code === 'edit'){
                    this.dialogVisible = !0;
                    Object.assign(this.form_data,row);
                }
            }
        },
        mounted() {
            this.ajaxData();
        },
        mixins:[mixin],
    }
</script>
