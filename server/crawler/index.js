const puppeteer = require('puppeteer')
const { writeFile } = require('fs')
const { promisify } = require('util')
const { resolve } = require('path')
const url = 'http://www.lssdjt.com/1/1/'
let month = 6
let day = 29
const category = {
    st5: "大事记",
    st4: "出生",
    st3: "逝世",
    st2: "节假日",
    st1: "纪念日"
}
const sleep = (time, cb) => {
    return new Promise((res, rej) => {
        cb && cb()
        setTimeout(res, time)
    })
}
(async () => {
    const host = 'http://www.lssdjt.com/'
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    fetchTheDay()
    async function fetchTheDay() {
        console.log(`正在获取 ${month} 月 ${day} 日的数据`)
        let listUrl = `${host}${month}/${day}/`
        await page.goto(listUrl, { waitUntil: 'networkidle2' });
        //取出当天的列表
        const list = await page.evaluate(() => {
            const categoryMap = {
                st5: "大事记",
                st4: "出生",
                st3: "逝世",
                st2: "节假日",
                st1: "纪念日"
            }
            const $ = window.jQuery
            if(!$){
                // 该天不存在 32
                return null
            }
            let items = $('.gong')
            
            let result = []
            items.each((idx, item) => {
                const el = $(item)
                const cls = item.classList
                let category = ''
                if (cls.length > 1) {
                    category = categoryMap[cls[1]]
                }
                const date = el.find('em').text()
                const title = el.find('i').text()
                const url = el.find('a').length > 0 ? el.find('a').attr('href') : null
                result.push({
                    date,
                    title,
                    category,
                    url
                })
            })
            return result
        })
        if (!list) {
            console.warn(`${month}月${day}日数据不存在，准备爬取${++month}月1日`)
            day = 1
            return fetchTheDay()
        }

        async function getDetailIterator() {
            return new Promise((res, rej) => {
                let i = 0
                const len = list.length
                it(i)
                async function it(i) {
                    console.log('爬取第' + (i + 1) + '页的详情开始，共' + len + '页')
                    if (list[i].url) {
                        const detail = await fetchDetail(list[i].url)
                        console.log('爬取第' + (i + 1) + '页详情结束，剩' + (len - i - 1) + '页')
                        list[i].detail = detail
                    } else {
                        console.log('无详情页')
                    }
                    i++
                    if (i < len) {

                        await it(i)
                    } else {
                        res(true)
                    }
                }
            }).catch(err => console.error(err))

        }


        //开始爬取
        const finished = await getDetailIterator().catch(err => console.error(err))
        if (finished) {
            console.log()
            await promisify(writeFile)(resolve(__dirname, `./${month}-${day}.json`), JSON.stringify(list), 'utf-8')
            await sleep(10000, _ => console.log(`获取 ${month} 月 ${day} 日的数据结束。休息10秒,准备获取${month} 月 ${++day}的数据`))
            fetchTheDay()

        }
        //循环列表 爬下级
        async function fetchDetail(url) {
            try {
                return new Promise(async (res, rej) => {
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 }).catch(err => console.error(err))
                    console.log('sleeping')
                    await sleep(2000)
                    console.log('爬取详情页开始')
                    const detail = await page.evaluate(async () => {
                        const $ = window.jQuery
                        if(!$) return {content:'详情访问出错 后期添加'}
        
                        const el = $('.view')
                        const date = $('.view>h2').text().replace(/^(\d+)年(\d+)月(\d+)日\s+\(([\u4e00-\u9fa5]+)\)/, '$1-$2-$3-$4').split('-')
                        const year = Number(date[0])
                        const month = Number(date[1])
                        const day = Number(date[2])
                        const lunar = date[3]
                        const title = $('.view>h1').text()
                        let contentText = ''
                        const contentEls = $('.content>p')
                        let next
                        contentEls.each((idx, item) => {
                            const itemStr = $(item).text().trim() ? $(item).text().trim() : 'img:' + $(item).find('img').attr('src')
                            contentText += '&' + itemStr
                            next = $('.page>a:contains("下一页")').attr('href')
                        })
                        if (next) {
                            // 如果有分页
                            return {
                                hasMore: true,
                                next,
                                data: {
                                    year,
                                    month,
                                    day,
                                    lunar,
                                    title,
                                    content: contentText.replace(/^&/, '')
                                }
                            }
                        } else {
                            return {
                                year,
                                month,
                                day,
                                lunar,
                                title,
                                content: contentText.replace(/^&/, '')
                            }
                        }

                    }).catch(err => console.error(err))
                    if (detail.hasMore) {
                        const newRes = Object.assign({}, detail.data)
                        const newContent = await fectchNextContent(detail.next)
                        newRes.content += newContent
                        res(newRes)
                    } else {
                        console.log('爬取详情页结束共1页')
                        res(detail)
                    }

                })
            } catch (err) {
                console.error(err)
            }
        }

        // //递归爬下一详情页
        async function fectchNextContent(path) {
            try {
                return new Promise(async (res, rej) => {
                    let contentText = ''
                    let times = 2

                    await getNext(path)
                    async function getNext(path) {
                        console.log('path:', path)
                        let url = 'http://www.lssdjt.com' + path
                        console.log('爬取详情的第' + times + '页开始')
                        await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 }).catch(err => console.error(err))
                        const detail = await page.evaluate(async () => {
                            const $ = window.jQuery
                            const contentEls = $('.content>p')
                            let next = ''
                            let content = ''
                            contentEls.each((idx, item) => {
                                const itemStr = $(item).text().trim() ? $(item).text().replace('（LiShiJinTian.com）', '').trim() : 'img:' + $(item).find('img').attr('src')
                                //打断
                                content += '&' + itemStr
                                next = $('.page>a:contains("下一页")').attr('href')
                            })
                            if (!!next) { //递归
                                return {
                                    hasMore: true,
                                    content,
                                    next
                                }
                            } else {
                                return content
                            }

                        }).catch(err => console.error(err))
                        if (detail.hasMore) {
                            contentText += detail.content
                            getNext(detail.next)
                        } else {
                            contentText += detail
                            console.log('爬取详情的第' + times + '页结束,共爬取' + times + '页')
                        }
                    }

                    res(contentText)
                })
            } catch (err) {
                rej(err)
            }
        }

    }


})();