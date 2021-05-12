import _ from 'lodash'
import fs from 'fs'
import { subMinutes, startOfDay as startOfDayFn } from 'date-fns'
import jsonfile from 'jsonfile'
import { getPriceInfo, getProductInfo, searchQuery } from './api'
import { Rarity, Type, Set, ProductInfo, PriceInfo, MarketInfo } from './enums'
import { StringLiteral } from 'typescript'

const today = new Date()
const getMonthsFromToday = (d: string) => _.round(Math.abs((new Date(d)).getTime() - today.getTime()) / 1000 / 60 / 60 / 24 / 30, 0)

type UtilParams = {
    accessToken: string
    cache: any
    sets: any
    verbose: boolean
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
        cardType: Type
    ): Promise<MarketInfo[]> {
        let search: number[]
        let productInfo: ProductInfo[]
        let priceInfo: PriceInfo[]
        const setData = _.find(this.sets, (s) => s.name === set)
        if (!this.cache[set] || !this.cache[set][rarity] || !this.cache[set][rarity][cardType]) {
            search = await searchQuery(rarity, set, this.accessToken)
            productInfo = await getProductInfo(search, this.accessToken)
            priceInfo = await getPriceInfo(search, this.accessToken)
            if (!this.cache[set]) this.cache[set] = { }
            if (!this.cache[set][rarity]) this.cache[set][rarity] = { }
            this.cache[set][rarity][cardType] = { search, productInfo, priceInfo }
        } else {
            const cacheData = this.cache[set][rarity][cardType]
            search = cacheData.search
            productInfo = cacheData.productInfo
            priceInfo = cacheData.priceInfo
        }
        let marketInfo: MarketInfo[] = [ ]
        for (let i = 0; i < search.length;i++) {
            const result = search[i]
            const price = _.find(priceInfo, (pi) => pi.productId === result && pi.subTypeName === cardType)
            if (price && setData) {
                const monthsFromToday = getMonthsFromToday(setData.date)
                marketInfo.push({
                    marketPrice: price.marketPrice,
                    name: price.subTypeName,
                    set,
                    productId: price.productId,
                    monthsFromToday,
                    increasePerMonth: price.marketPrice / monthsFromToday
                })
            }
        }

        marketInfo = _.orderBy(marketInfo, (p) => p.marketPrice)
        if (this.verbose)
        {
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
        limit: number = 0
    ): Promise<MarketInfo[]> {
        let setData: MarketInfo[] = []
        for (let i = 0; i < this.sets.length;i++) {
            const set = this.sets[i]
            const monthsFromToday = getMonthsFromToday(set.date)
            if (monthsFromToday > maxMonths || monthsFromToday < minMonths) {
                continue
            }
            const marketInfo = await this.aggregatePrices(set.name, rarity, cardType)
            for (let j = 0; j < marketInfo.length;j++) {
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

    public async saveHistoricalData (
        cards: MarketInfo[],
        cardType: string
    ): Promise<void> {
        const history = fs.existsSync('data/history.json') ? jsonfile.readFileSync('data/history.json') : { cards: { } }
        const cardIds = _.map(cards, (c) => c.productId)
        const priceInfo = _.filter(await getPriceInfo(cardIds, this.accessToken), (c) => c.subTypeName === cardType)
        let startOfDay = subMinutes(startOfDayFn(new Date()), (new Date()).getTimezoneOffset()).toISOString()
        startOfDay = startOfDay.slice(0, startOfDay.indexOf('T'))
        for (let i = 0; i < cards.length;i++) {
            const card = cards[i]
            const cardPriceInfo = _.find(priceInfo, (p) => p.productId === card.productId)
            if (!cardPriceInfo) continue
            const productKey = card.productId.toString() + '-' + cardType
            if (!history.cards[productKey]) history.cards[productKey] = {
                name: card.name,
                set: card.set,
                productId: card.productId,
                history: [ ]
            }
            if (_.some(history.cards[productKey].history, (h) => h.date === startOfDay)) continue
            history.cards[productKey].history.push({
                date: startOfDay,
                marketPrice: cardPriceInfo.marketPrice
            })
        }
        jsonfile.writeFileSync('data/history.json', history)
    }
}