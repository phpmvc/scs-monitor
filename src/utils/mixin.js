//vue mixins
const ajax = require('./ajax')
const storage = require('./storage')
module.exports = {
    data() {
        return {
            showSort: !0,
            userInfo: {},
            sortType: {}
        }
    },
    methods: {
        handleSizeChange(val) {
            this.search_data.pageSize = val
            this.ajaxData()
        },
        dealUserInfo(o) {
            if (this.hasOwnProperty('userInfo')) {
                this.userInfo = o
            }
            const g = this.grade
            if (g) {
                const p = this.page_grade
                for (let k in g) {
                    if (g.hasOwnProperty(k)) {
                        g[k] = p[k] < o.user_type
                    }
                }
            }
        }
    },
    created() {
        this.dealUserInfo(this.$store.state.userInfo.data)
        ajax.call(this, '/project', {}, (d, err) => {
            if(!err){
                const t = this.sortType
                d.data.forEach(obj => {
                    t[obj.code] = obj.name
                })
                //特定用户
                storage.get('userInfo', obj => {
                    if (Object.keys(t).includes(obj.userInfo.user_name)) {
                        this.showSort = !1
                        this.search_data.sort_id = k
                    }
                })
            }
        })
    },
    watch: {
        '$store.state.userInfo.data': 'dealUserInfo'
    }
}
