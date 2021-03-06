import _ from 'lodash'
import clc from 'cli-color'
import fs from 'fs'
import UrlSafeString from 'url-safe-string'
import { subDays, startOfDay as startOfDayFn, subMonths } from 'date-fns'
import jsonfile from 'jsonfile'
import { getPriceInfo, getProductInfo, searchQuery } from './api'
import {
    Rarity,
    Type,
    Set,
    ProductInfo,
    PriceInfo,
    MarketInfo,
    SetData,
    SetTotal,
    Change,
    HistorySchema,
    HistoryCard,
    HistoryItem
} from './enums'

const today = new Date()

type UtilParams = {
    accessToken: string
    sets: any
    verbose: boolean
}

export default class Util {
    public sets: Set[]
    public verbose: boolean
    public accessToken: string

    constructor(params: UtilParams) {
        _.merge(this, params)
    }

    public static getMonthsFromToday = (d: string) => _.round(Math.abs((new Date(d)).getTime() - today.getTime()) / 1000 / 60 / 60 / 24 / 30, 0)

    public async aggregatePrices(
        set: string,
        rarity: Rarity,
        cardType: Type,
        minPrice: number
    ): Promise<MarketInfo[]> {
        const setData = _.find(this.sets, (s) => s.name === set)
        const search = await searchQuery(rarity, set, this.accessToken)
        const productInfo = await getProductInfo(search, this.accessToken)
        const priceInfo = await getPriceInfo(search, cardType, this.accessToken)
        let marketInfo: MarketInfo[] = []
        for (let i = 0; i < search.length; i++) {
            const result = search[i]
            const product = _.find(productInfo, (pi) => pi.productId === result)
            const price = _.find(priceInfo, (pi) => pi.productId === result && pi.subTypeName === cardType)
            if (price && product && setData) {
                const monthsFromToday = Util.getMonthsFromToday(setData.date)
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
            const monthsFromToday = Util.getMonthsFromToday(set.date)
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
        cardType: Type,
        history?: any
    ): Promise<HistorySchema> {
        const cachedHistory = !!history
        if (!history) history = Util.getHistory()
        const oldHistory = history
        const cardIds = _.map(cards, 'id')
        const priceInfo: PriceInfo[] = await getPriceInfo(cardIds, cardType, this.accessToken)
        const productInfo: ProductInfo[] = await getProductInfo(cardIds, this.accessToken)
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
        if (!cachedHistory && history !== oldHistory) {
            jsonfile.writeFileSync('data/history.json', { cards: history })
        }
        return history
    }

    public static getDateString(date: Date) {
        const d = startOfDayFn(date).toISOString()
        return d.slice(0, d.indexOf('T'))
    }

    public static getHistory(): HistorySchema {
        return (fs.existsSync('data/history.json') ? jsonfile.readFileSync('data/history.json') : { cards: {} }).cards
    }

    public static getSets(): Set[] {
        return (fs.existsSync('data/sets.json') ? jsonfile.readFileSync('data/sets.json') : { sets: [] }).sets
    }

    public static getChange(
        currentPrice: number,
        numDays: number,
        history: HistoryItem[]
    ): {
        price: number
        date: string
        change: number
    } {
        const obj = { price: 0, date: '', change: 0 }
        let historyData
        for (let j = numDays; j > 0;j--) {
            const lastMonthObj = this.getDateString(subDays(new Date(), j))
            historyData = _.find(history, (h) => h.date === lastMonthObj)
            if (historyData) {
                obj.price = historyData.marketPrice
                obj.date = historyData.date
                obj.change = _.round(currentPrice - historyData.marketPrice, 2)
                break
            }
        }
        if (!historyData) {
            obj.price = 0
            obj.date = 'Not Found'
            obj.change = 0
        }

        return obj
    }

    public static displayChanges(cardIds: number[], prices: number[] = [], limit: number = 0, minPrice: number = 0, sort: string = 'monthly', verbose: boolean = false): Change[] {
        // console.log(`${cardIds.length} cards...`)
        const history = this.getHistory()
        const startOfDayObj = startOfDayFn(new Date())
        const startOfDay = this.getDateString(new Date())
        const startOfYesterday = this.getDateString(subDays(startOfDayObj, 1))
        let changes: Change[] = []
        const notFound = []
        for (let i = 0; i < cardIds.length; i++) {
            const id = cardIds[i]
            const historicalData = history[id.toString()]
            if (!historicalData) {
                notFound.push(id)
                continue
            }
            const changeObj: Change = {
                id,
                name: historicalData.name,
                set: historicalData.set,
                setDate: _.find(this.getSets(), (s) => s.name === historicalData.set)?.date
            }
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

            const lastWeekObj = Util.getChange(todaysPrice.marketPrice, 7, historicalData.history)
            changeObj.lastWeekPrice = lastWeekObj.price
            changeObj.lastWeekDate = lastWeekObj.date
            changeObj.weeklyChange = lastWeekObj.change

            const lastMonthObj = Util.getChange(todaysPrice.marketPrice, 31, historicalData.history)
            changeObj.lastMonthPrice = lastMonthObj.price
            changeObj.lastMonthDate = lastMonthObj.date
            changeObj.monthlyChange = lastMonthObj.change

            changes.push(changeObj)
        }
        if (minPrice > 0) {
            changes = _.filter(changes, (c) => c.todaysPrice && c.todaysPrice > minPrice) as Change[]
        }
        changes = _.reverse(_.orderBy(changes, (c) => {
            switch (sort) {
                case 'daily':
                    return c.dailyChange && c.yesterdaysPrice ? c.dailyChange / c.yesterdaysPrice : 0
                case 'weekly':
                    return c.weeklyChange && c.lastWeekPrice ? c.weeklyChange / c.lastWeekPrice : 0
                case 'monthly':
                    return c.monthlyChange && c.lastMonthPrice ? c.monthlyChange / c.lastMonthPrice : 0
            }
        }))
        if (limit) {
            changes = _.slice(changes, 0, limit)
        }
        if (verbose) {
            _.each(changes, (c) => {
                console.log(`\n${clc.red(c.name)} (${clc.redBright(c.id)}) ${clc.blueBright('$' + c.todaysPrice)} | ${clc.yellowBright(c.set)}`)
                if (c.buyPrice && c.todaysPrice) {
                    const profit = _.round(c.todaysPrice - c.buyPrice, 2)
                    console.log(clc.blackBright('Profit: ') + `${clc.blueBright('$' + c.buyPrice)} -> ${clc.blueBright('$' + c.todaysPrice)} (${clc.blueBright('$' + profit)}/${clc.blue(Math.floor((profit / c.buyPrice) * 100) + '%')})`)
                }
                if (c.dailyChange && c.yesterdaysPrice) {
                    const todayString = this.getDateString(new Date())
                    console.log(clc.blackBright('Daily: ') + `${clc.cyanBright(todayString)} ${clc.blueBright('$' + _.round(c.dailyChange, 2))}/${clc.blue(Math.floor((c.dailyChange / c.yesterdaysPrice) * 100) + '%')} (${clc.blueBright('$' + c.yesterdaysPrice)} -> ${clc.blueBright('$' + c.todaysPrice)})`)
                }
                if (c.weeklyChange && c.lastWeekPrice) {
                    console.log(clc.blackBright('Weekly: ') + `${clc.cyanBright(c.lastWeekDate)} ${clc.blueBright('$' + c.weeklyChange)}/${clc.blue(Math.floor((c.weeklyChange / c.lastWeekPrice) * 100) + '%')} (${clc.blueBright('$' + c.lastWeekPrice)} -> ${clc.blueBright('$' + c.todaysPrice)})`)
                }
            })
        }
        return _.map(changes, (c) => ({
            ...c,
            profit: c.todaysPrice && c.buyPrice ? _.round(c.todaysPrice - c.buyPrice, 2) : 0,
            profitPercentage: c.todaysPrice && c.buyPrice ? _.round(((c.todaysPrice - c.buyPrice)/c.buyPrice) * 100, 0) : 0,
            dailyPercentage: c.dailyChange && c.yesterdaysPrice ? _.round((c.dailyChange / c.yesterdaysPrice) * 100, 0) : 0,
            weeklyPercentage: c.weeklyChange && c.lastWeekPrice ? _.round((c.weeklyChange / c.lastWeekPrice) * 100, 0) : 0,
            monthlyPercentage: c.monthlyChange && c.lastMonthPrice ? _.round((c.monthlyChange / c.lastMonthPrice) * 100, 0) : 0,
        }))
    }

    public async getTotals(
        setData: SetData[],
        maxMonths: number,
        cardType: Type,
        verbose: boolean = false,
        sort: string = 'monthly-change'
    ): Promise<SetTotal[]> {
        const maxWatchTime = subMonths(new Date(), maxMonths).getTime()
        const watchSets = _.map(_.filter(setData, (s) =>  (new Date(s.date)).getTime() > maxWatchTime), 'name')
        const totals: SetTotal[] = [ ]
        const tagGenerator = new UrlSafeString()
        let history = Util.getHistory()
        for (let i = 0; i < watchSets.length;i++) {
            const currentSet = watchSets[i]
            let date = _.find(setData, (s) => s.name === currentSet)?.date
            if (!date) date = ''
            const ultraRareCards = _.map(await searchQuery(Rarity.UltraRare, currentSet, this.accessToken), (id) => ({ id, set: currentSet }))
            const secretRareCards = _.map(await searchQuery(Rarity.SecretRare, currentSet, this.accessToken), (id) => ({ id, set: currentSet }))
            const allCards = ultraRareCards
            _.each(secretRareCards, (id) => allCards.push(id))
            history = await this.saveHistoricalData(allCards, cardType)
            const ultraRareIds = _.map(ultraRareCards, 'id')
            const secretRareIds = _.map(secretRareCards, 'id')
            const { total: ultraRareIndex, average: ultraRareAverage } = await this.getIndex(Rarity.UltraRare, currentSet, ultraRareIds)
            const { total: secretRareIndex, average: secretRareAverage } = await this.getIndex(Rarity.SecretRare, currentSet, secretRareIds)
            const totalIndex =  ultraRareIndex + secretRareIndex
            const cardPriceHistory = Util.displayChanges(_.map(allCards, 'id'))

            totals.push({
                set: currentSet,
                setLink: tagGenerator.generate(currentSet),
                date,
                ultraRares: {
                    count: ultraRareCards.length,
                    totalPrice: ultraRareIndex,
                    averagePrice: ultraRareAverage
                },
                secretRares: {
                    count: secretRareCards.length,
                    totalPrice: secretRareIndex,
                    averagePrice: secretRareAverage
                },
                allCards: {
                    count: ultraRareCards.length + secretRareCards.length,
                    totalPrice: _.round(totalIndex, 2),
                    averagePrice: _.round(totalIndex / (ultraRareCards.length + secretRareCards.length), 2)
                },
                averageMonthlyIncrease: date ? _.round(totalIndex / Util.getMonthsFromToday(date), 2) : 0,
                monthChange: _.round(_.sumBy(cardPriceHistory, (h) => h.monthlyChange ? h.monthlyChange : 0), 2),
                weekChange: _.round(_.sumBy(cardPriceHistory, (h) => h.weeklyChange ? h.weeklyChange : 0), 2),
                dayChange: _.round(_.sumBy(cardPriceHistory, (h) => h.dailyChange ? h.dailyChange : 0), 2)
            })
            if (verbose) {
                console.log(`\n\n\nGetting ${currentSet} indexes released ${date}`)
                console.log(`\n${currentSet} Ultra Rare Cards: ${ultraRareCards.length} cards`)
                console.log(`${currentSet} Secret Rare Cards: ${secretRareCards.length} cards`)
                console.log(`\n\n${currentSet} Ultra Rares: `)
                Util.displayChanges(ultraRareIds, [], 10)
                console.log(`\n\n${currentSet} Secret Rares: `)
                Util.displayChanges(secretRareIds, [], 10)
            }
        }

        jsonfile.writeFileSync('data/history.json', { cards: history })

        return _.reverse(_.orderBy(totals, (t) => {
            switch (sort) {
                case 'total-cost': return t.allCards.totalPrice
                case 'monthly-change': return t.monthChange
                case 'weekly-change': return t.weekChange
                case 'daily-change': return t.dayChange
                case 'monthly-average-change': return t.averageMonthlyIncrease
                case 'all-average': return t.allCards.averagePrice
                case 'ultra-rare-total': return t.ultraRares.totalPrice
                case 'ultra-rare-average': return t.ultraRares.averagePrice
                case 'secret-rare-total': return t.secretRares.totalPrice
                case 'secret-rare-average': return t.secretRares.averagePrice
            }
        }))
    }

    public async getIndex(rarity: Rarity, set: string, cardIds: number[] = [], verbose: boolean = false): Promise<{ total: number, average: number }> {
        const search = cardIds.length !== 0 ? cardIds : await searchQuery(rarity, set, this.accessToken)
        const history = Util.getHistory()
        const todayObj = startOfDayFn(new Date())
        const todayString = Util.getDateString(new Date())
        const yesterdayString = Util.getDateString(subDays(todayObj, 1))
        let todayTotal = 0
        let yesterdayTotal = 0
        for (let i = 0; i < search.length;i++) {
            const historyItem: HistoryCard = history[search[i]]
            if (!historyItem) {
                console.log('Could not find history item - GetIndex')
                continue
            }
            const todaysPrice = _.find(historyItem.history, (h) => h.date === todayString)
            const yesterdaysPrice = _.find(historyItem.history, (h) => h.date === yesterdayString)
            if (todaysPrice) todayTotal += todaysPrice.marketPrice
            if (yesterdaysPrice) yesterdayTotal += yesterdaysPrice.marketPrice
        }
        const dailyChange = _.round(todayTotal - yesterdayTotal, 2)
        if (verbose) {
            console.log(`\nIndex: ${set} (${rarity}) - $${_.round(todayTotal, 2)}`)
            console.log(`Daily: $${_.round(yesterdayTotal, 2)} -> $${_.round(todayTotal, 2)} ($${dailyChange}/${Math.floor((dailyChange / yesterdayTotal) * 100)}%)`)
        }
        return { total: _.round(todayTotal, 2), average: _.round(todayTotal / search.length, 2) }
    }
}