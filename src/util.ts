import _ from 'lodash'
import fs from 'fs'
import { subMinutes, subDays, startOfDay as startOfDayFn } from 'date-fns'
import jsonfile from 'jsonfile'
import { getPriceInfo, getProductInfo, searchQuery } from './api'
import { Rarity, Type, Set, ProductInfo, PriceInfo, MarketInfo } from './enums'
import { getHeapStatistics } from 'v8'
import { consoleTestResultHandler } from 'tslint/lib/test'

const today = new Date()
const getMonthsFromToday = (d: string) => _.round(Math.abs((new Date(d)).getTime() - today.getTime()) / 1000 / 60 / 60 / 24 / 30, 0)

type UtilParams = {
    accessToken: string
    cache: any
    sets: any
    verbose: boolean
}

type HistoryCard = {
    name: string
    productId: number
    set: string
    history: HistoryItem[]
}

type HistoryItem = {
    date: string
    marketPrice: number
    cardType: string
}

type Change = {
    id: number
    name: string
    set: string
    buyPrice?: number // Price invested in
    todaysPrice?: number // Current value
    yesterdaysPrice?: number
    lastWeekPrice?: HistoryItem
    dailyChange?: number
    weeklyChange?: number
}

export default class Util {
    public sets: Set[]
    public cache: any
    public verbose: boolean
    public accessToken: string

    constructor(params: UtilParams) {
        _.merge(this, params)
    }

    public async aggregatePrices(
        set: string,
        rarity: Rarity,
        cardType: Type,
        minPrice: number
    ): Promise<MarketInfo[]> {
        let search: number[]
        let productInfo: ProductInfo[]
        let priceInfo: PriceInfo[]
        const setData = _.find(this.sets, (s) => s.name === set)
        if (!this.cache[set] || !this.cache[set][rarity] || !this.cache[set][rarity][cardType]) {
            search = await searchQuery(rarity, set, this.accessToken)
            productInfo = await getProductInfo(search, this.accessToken)
            priceInfo = await getPriceInfo(search, this.accessToken)
            if (!this.cache[set]) this.cache[set] = {}
            if (!this.cache[set][rarity]) this.cache[set][rarity] = {}
            this.cache[set][rarity][cardType] = { search, productInfo, priceInfo }
            if (!this.cache.products) this.cache.products = { }
            _.each(productInfo, (product) => this.cache.products[product.productId] = product)
        } else {
            const cacheData = this.cache[set][rarity][cardType]
            search = cacheData.search
            productInfo = cacheData.productInfo
            priceInfo = cacheData.priceInfo
            if (!this.cache.products) this.cache.products = { }
            _.each(productInfo, (product) => this.cache.products[product.productId] = product)
        }
        let marketInfo: MarketInfo[] = []
        for (let i = 0; i < search.length; i++) {
            const result = search[i]
            const product = _.find(productInfo, (pi) => pi.productId === result)
            const price = _.find(priceInfo, (pi) => pi.productId === result && pi.subTypeName === cardType)
            if (price && product && setData) {
                const monthsFromToday = getMonthsFromToday(setData.date)
                if ((minPrice > 0 && price.marketPrice > minPrice) || minPrice === 0) {
                    marketInfo.push({
                        marketPrice: price.marketPrice,
                        name: product.name,
                        set,
                        productId: price.productId,
                        monthsFromToday,
                        increasePerMonth: price.marketPrice / monthsFromToday
                    })
                }
            }
        }

        marketInfo = _.orderBy(marketInfo, (p) => p.marketPrice)
        if (this.verbose) {
            const averagePrice = _.round(_.meanBy(marketInfo, (p) => p.marketPrice), 2)
            console.log('\nSet: ' + set)
            console.log(`Average Price: $${averagePrice}`)
            console.log(`Total Price: $${_.round(_.sumBy(marketInfo, (p) => p.marketPrice), 2)}`)
        }
        jsonfile.writeFileSync('data/cache.json', this.cache)
        return marketInfo
    }

    public async getBestCardAppreciation(
        minMonths: number,
        maxMonths: number,
        rarity: Rarity,
        cardType: Type,
        limit: number = 0,
        minPrice: number = 0
    ): Promise<MarketInfo[]> {
        let setData: MarketInfo[] = []
        for (let i = 0; i < this.sets.length; i++) {
            const set = this.sets[i]
            const monthsFromToday = getMonthsFromToday(set.date)
            if (monthsFromToday > maxMonths || monthsFromToday < minMonths) {
                continue
            }
            const marketInfo = await this.aggregatePrices(set.name, rarity, cardType, minPrice)
            for (let j = 0; j < marketInfo.length; j++) {
                setData.push(marketInfo[j])
            }
        }
        setData = _.reverse(_.orderBy(_.uniqBy(setData, (d) => d.productId), (d) => d.increasePerMonth))
        if (limit !== 0) {
            setData = setData.slice(0, limit)
        }
        if (this.verbose) {
            _.each(setData, (d, i) => console.log(`${i + 1}: increase: $${_.round(d.increasePerMonth, 2)}/month - market: $${_.round(d.marketPrice, 2)} ${d.name} (${d.name}) [released ${d.monthsFromToday > 12 ? `${Math.floor(d.monthsFromToday / 12)} year(s) and ${d.monthsFromToday % 12}` : d.monthsFromToday} months ago]`))
        }
        return setData
    }

    public async saveHistoricalData(
        cards: { id: number, set: string }[],
        cardType: string
    ): Promise<void> {
        const history = Util.getHistory()
        const cardIds = _.map(cards, 'id')
        const priceInfo: PriceInfo[] = _.filter(await getPriceInfo(cardIds, this.accessToken), (c) => c.subTypeName === cardType)
        const productInfo: ProductInfo[] = _.reject(_.map(cardIds, (id) => this.cache.products[id]), (card) => !card)
        const lostIds = _.filter(cardIds, (id) => !_.find(productInfo, (product) => product.productId === id))
        const lostProductInfo = await getProductInfo(lostIds, this.accessToken)
        _.each(lostProductInfo, (product) => this.cache.products[product.productId] ? this.cache.products[product.productId] = product : false)
        if (lostProductInfo.length > 0) {
            jsonfile.writeFileSync('data/cache.json', this.cache)
        }
        _.each(lostProductInfo, (info) => productInfo.push(info))
        let startOfDay = startOfDayFn(new Date()).toISOString()
        startOfDay = startOfDay.slice(0, startOfDay.indexOf('T'))
        for (let i = 0; i < cardIds.length; i++) {
            const card = cards[i]
            const cardPriceInfo = _.find(priceInfo, (p) => p.productId === card.id)
            const cardProductInfo = _.find(productInfo, (p) => p.productId === card.id)
            if (!cardPriceInfo || !cardProductInfo) continue
            const productKey = card.id.toString()
            if (!history[productKey]) history[productKey] = {
                name: cardProductInfo.name,
                set: card.set,
                productId: card.id,
                history: []
            }
            if (!history[productKey].set) {
                history[productKey].set = card.set
            }
            if (_.some(history[productKey].history, (h) => h.date === startOfDay)) continue
            history[productKey].history.push({
                date: startOfDay,
                marketPrice: cardPriceInfo.marketPrice,
                cardType
            })
        }
        jsonfile.writeFileSync('data/history.json', { cards: history })
    }

    public static getDateString(date: Date) {
        const d = startOfDayFn(date).toISOString()
        return d.slice(0, d.indexOf('T'))
    }

    public static getHistory() {
        return (fs.existsSync('data/history.json') ? jsonfile.readFileSync('data/history.json') : { cards: {} }).cards
    }

    public static displayChanges(cardIds: number[], prices: number[] = [], limit: number = 0, minPrice: number = 0) {
        console.log(`${cardIds.length} cards...`)
        const history = this.getHistory()
        const startOfDayObj = startOfDayFn(new Date())
        const startOfDay = this.getDateString(new Date())
        const startOfYesterday = this.getDateString(subDays(startOfDayObj, 1))
        let changes: Change[] = []
        const notFound = []
        for (let i = 0; i < cardIds.length; i++) {
            const id = cardIds[i]
            const historicalData: HistoryCard = history[id.toString()]
            if (!historicalData) {
                notFound.push(id)
                continue
            }
            const changeObj: Change = { id, name: historicalData.name, set: historicalData.set }
            if (i < prices.length) {
                changeObj.buyPrice = prices[i]
            }
            const todaysPrice = _.find(historicalData.history, (h) => h.date === startOfDay)
            if (!todaysPrice) continue
            if (todaysPrice) changeObj.todaysPrice = todaysPrice.marketPrice
            const yesterdaysPrice = _.find(historicalData.history, (h) => h.date === startOfYesterday)
            if (yesterdaysPrice) changeObj.yesterdaysPrice = yesterdaysPrice.marketPrice
            if (todaysPrice && yesterdaysPrice) {
                changeObj.dailyChange = _.round(todaysPrice.marketPrice - yesterdaysPrice.marketPrice, 2)
            }
            let lastWeekPrice
            for (let j = 7; j > 0;j--) {
                const lastWeekObj = this.getDateString(subDays(new Date(), j))
                lastWeekPrice = _.find(historicalData.history, (h) => h.date === lastWeekObj)
                if (lastWeekPrice) {
                    changeObj.lastWeekPrice = lastWeekPrice
                    changeObj.weeklyChange = _.round(todaysPrice.marketPrice - lastWeekPrice.marketPrice, 2)
                    break
                }
            }
            if (!lastWeekPrice && changeObj.todaysPrice) {
                changeObj.lastWeekPrice = todaysPrice
                changeObj.weeklyChange = 0

            }
            changes.push(changeObj)
        }
        if (minPrice > 0) {
            changes = _.filter(changes, (c) => c.todaysPrice && c.todaysPrice > minPrice) as Change[]
        }
        changes = _.reverse(_.orderBy(changes, (c) => c.weeklyChange && c.lastWeekPrice ? c.weeklyChange / c.lastWeekPrice.marketPrice : 0))
        if (limit) {
            changes = _.slice(changes, 0, limit)
        }
        changes = _.uniqBy(changes, (c) => c.id)
        _.each(changes, (c) => {
            console.log(`\nCard: ${c.name} (${c.id}) $${c.todaysPrice} - ${c.set}`)
            if (c.buyPrice && c.todaysPrice) {
                const profit = _.round(c.todaysPrice - c.buyPrice, 2)
                console.log(`Profit: $${c.buyPrice} -> $${c.todaysPrice} ($${profit}/${Math.floor((profit / c.buyPrice) * 100)}%)`)
            }
            if (c.dailyChange && c.yesterdaysPrice) {
                const todayString = this.getDateString(new Date())
                console.log(`Daily:  ${todayString} $${_.round(c.dailyChange, 2)}/${Math.floor((c.dailyChange / c.yesterdaysPrice) * 100)}% ($${c.yesterdaysPrice} -> $${c.todaysPrice})`)
            }
            if (c.weeklyChange && c.lastWeekPrice) {
                console.log(`Weekly: ${c.lastWeekPrice.date} $${c.weeklyChange}/${Math.floor((c.weeklyChange / c.lastWeekPrice.marketPrice) * 100)}% ($${c.lastWeekPrice.marketPrice} -> $${c.todaysPrice})`)
            }
        })
    }

    public async getIndex(rarity: Rarity, set: string, cardIds: number[] = []) {
        const search = cardIds.length !== 0 ? cardIds : await searchQuery(rarity, set, this.accessToken)
        const history = Util.getHistory()
        const todayObj = startOfDayFn(new Date())
        const todayString = Util.getDateString(new Date())
        const yesterdayString = Util.getDateString(subDays(todayObj, 1))
        let todayTotal = 0
        let yesterdayTotal = 0
        for (let i = 0; i < search.length;i++) {
            const historyItem: HistoryCard = history[search[i]]
            const todaysPrice = _.find(historyItem.history, (h) => h.date === todayString)
            const yesterdaysPrice = _.find(historyItem.history, (h) => h.date === yesterdayString)
            if (todaysPrice) todayTotal += todaysPrice.marketPrice
            if (yesterdaysPrice) yesterdayTotal += yesterdaysPrice.marketPrice
        }
        console.log(`\nIndex: ${set} (${rarity}) - $${_.round(todayTotal, 2)}`)
        const dailyChange = _.round(todayTotal - yesterdayTotal, 2)
        console.log(`Daily: $${_.round(yesterdayTotal, 2)} -> $${_.round(todayTotal, 2)} ($${dailyChange}/${Math.floor((dailyChange / yesterdayTotal) * 100)}%)`)
    }
}