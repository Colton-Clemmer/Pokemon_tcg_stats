import fetch from 'node-fetch'
import _ from 'lodash'
import fs from 'fs'
import jsonfile from 'jsonfile'
import { startOfDay } from 'date-fns'
import { ProductInfo, PriceInfo, Rarity, Type } from './enums'

const timer = (ms: number) => new Promise((res) => setTimeout(res, ms))

export const searchQuery = async (
    rarity: Rarity,
    set: string,
    accessToken: string
): Promise<number[]> => {
    const searchCache = fs.existsSync('data/search-cache.json') ? jsonfile.readFileSync('data/search-cache.json') : { }
    const searchKey = `${set}-${rarity}`
    if (searchCache[searchKey]) {
        return searchCache[searchKey]
    }
    console.log(`Searching ${set} for ${rarity}`)
    const limit = 200
    await timer(200)
    const url = 'https://api.tcgplayer.com/catalog/categories/3/search'
    const options = {
        method: 'POST',
        headers: {
            Authorization: 'bearer ' + accessToken,
            Accept: 'application/json',
            'Content-Type': 'text/json'
        },
        body: JSON.stringify({
            limit,
            filters: [
                { name: 'Rarity', values: [rarity] },
                { name: 'SetName', values: [set] }
            ]
        })
    }

    const res = (await (await fetch(url, options)).json()).results
    searchCache[searchKey] = res
    jsonfile.writeFileSync('data/search-cache.json', searchCache)
    return res
}

export const getProductInfo = async (
    cardIds: number[],
    accessToken: string
): Promise<ProductInfo[]> => {
    const productCache = fs.existsSync('data/product-cache.json') ? jsonfile.readFileSync('data/product-cache.json') : { }
    const foundIds = _.filter(_.keys(productCache), (id) => !!productCache[id])
    const productInfo: ProductInfo[] = _.map(foundIds, (id) => productCache[id])
    cardIds = _.reject(cardIds, (id) => _.some(foundIds, (fid) => fid === id.toString()))

    let count = 1
    const getProducts = async (ids: number[]): Promise<ProductInfo[]> => {
        if (ids.length === 0) return [ ]
        console.log(`Getting Product info for ${ids.length * count} of ${cardIds.length} items...`)
        count++
        const idsString =_.reduce(_.map(ids, (id) => id.toString()), (s, id ) => !s ? id.toString() : `${s}, ${id}`)
        await timer(200)
        const url = 'https://api.tcgplayer.com/catalog/products/' + idsString
        const options = {
            method: 'GET',
            headers: {
                Authorization: 'bearer ' + accessToken,
                Accept: 'application/json',
                'Content-Type': 'text/json'
            }
        }
        return (await (await fetch(url, options)).json()).results
    }

    const saveProducts = () => {
        _.each(cardIds, (id) => productCache[id] = _.find(productInfo, (pi) => pi.productId === id))
        jsonfile.writeFileSync('data/product-cache.json', productCache)
    }

    if (cardIds.length < 100) {
        const res = await getProducts(cardIds)
        _.each(res, (pi) => productInfo.push(pi))
        saveProducts()
        return productInfo
    }

    for (let i = 1; i < Math.floor(cardIds.length / 100) + 2;i++) {
        const productInfoSlice = await getProducts(cardIds.slice(((i - 1) * 100), i * 100))
        _.each(productInfoSlice, (p) => productInfo.push(p))
    }

    saveProducts()
    return productInfo
}

export const getPriceInfo = async (
    cardIds: number[],
    cardType: Type,
    accessToken: string
): Promise<PriceInfo[]> => {
    const priceCache = fs.existsSync('data/price-cache.json') ? jsonfile.readFileSync('data/price-cache.json') : { }
    let todayString = startOfDay(new Date()).toISOString()
    todayString = todayString.slice(0, todayString.indexOf('T'))
    if (!priceCache[todayString]) priceCache[todayString] = { }
    const foundIds = _.filter(_.keys(priceCache[todayString]), (id) => !!priceCache[todayString][id])
    const priceInfo: PriceInfo[] = _.filter(_.map(foundIds, (id) => priceCache[todayString][id]), (pi) => pi.subTypeName === cardType)
    cardIds = _.reject(cardIds, (id) => _.some(foundIds, (fid) => fid === id.toString()))

    let count = 1
    const getPrices = async (ids: number[]): Promise<PriceInfo[]> => {
        if (ids.length === 0) return []
        console.log(`Getting Price info for ${ids.length} of ${cardIds.length} items...`)
        count++
        const idsString =_.reduce(_.map(ids, (id) => id.toString()), (s, id ) => !s ? id.toString() : `${s}, ${id}`)
        await timer(200)
        const url = 'https://api.tcgplayer.com/pricing/product/' + idsString
        const options = {
            method: 'GET',
            headers: {
                Authorization: 'bearer ' + accessToken,
                Accept: 'application/json',
                'Content-Type': 'text/json'
            }
        }

        return _.filter((await (await fetch(url, options)).json()).results, (pi) => pi.subTypeName === cardType)
    }

    const savePrices = () => {
        _.each(cardIds, (id) => priceCache[todayString][id] = _.find(priceInfo, (pi) => pi.productId === id))
        const oldDays = _.filter(_.keys(priceCache), (day) => day !== todayString)
        _.each(oldDays, (day) => delete priceCache[day])
        jsonfile.writeFileSync('data/price-cache.json', priceCache)
    }

    if (cardIds.length < 100) {
        const res = await getPrices(cardIds)
        _.each(res, (pi) => priceInfo.push(pi))
        savePrices()
        return priceInfo
    }
    for (let i = 1; i < Math.floor(cardIds.length / 100) + 2;i++) {
        const productInfoSlice = await getPrices(cardIds.slice(((i - 1) * 100), i * 100))
        _.each(productInfoSlice, (p) => priceInfo.push(p))
    }

    savePrices()
    return priceInfo
}