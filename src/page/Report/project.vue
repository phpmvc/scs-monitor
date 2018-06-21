<template>
    <div>
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
            <el-button icon="el-icon-plus" type="success" @click="addProject">添加项目</el-button>
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
    import {ajax,storage} from 'utils';
    module.exports = {
        name: 'project',
        data() {
            return {
                dialogVisible:!1,
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
                    domain: { required: true, message: '请正确填写项目域名', pattern:/^(\w+\.?)+$/}
                },
                multipleSelection:[],
                table_data: {
                    columns: [
                        {"key": "code", "name": "编码", width: 120},
                        {"key": "name", "name": "项目名称", width: 120},
                        {"key": "domain", "name": "域名", width: 150},
                        {"key": "log_odds", "name": "日志率?", width:100,question:'日志采集率：0至0.9'},
                        {"key": "performance_odds", "name": "性能率?", width:100,question:'性能采集率：0至0.9'},
                        {"key": "comment", "name": "说明", minWidth:120},
                        {"key": "operations", "name": "操作", width: 135}
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
                ajax.call(this, '/project', {}, (obj, err) => {
                    if (!err) {
                        this.table_data.data = obj.data;
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
                        this.createButton(h,row,'edit','编辑'),this.createButton(h,row,'delete','删除')
                    ])
                }else if(key.includes('odds')){
                    str = str === '0.0' ? '关闭' : str
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
                }else if(code === 'edit'){
                    this.dialogVisible = !0;
                    Object.assign(this.form_data,row);
                }
            }
        },
        mounted() {
            this.ajaxData();
        }
    }
</script>
