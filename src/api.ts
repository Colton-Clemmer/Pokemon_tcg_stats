import fetch from 'node-fetch'
import _ from 'lodash'
import { ProductInfo, PriceInfo, Rarity } from './enums'

const timer = (ms: number) => new Promise((res) => setTimeout(res, ms))

export const searchQuery = async (
    rarity: Rarity,
    set: string,
    accessToken: string
): Promise<number[]> => {
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

    return (await (await fetch(url, options)).json()).results
}

export const getProductInfo = async (
    cardIds: number[],
    accessToken: string
): Promise<ProductInfo[]> => {
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

    if (cardIds.length < 100) {
        return await getProducts(cardIds)
    }
    const productInfo: ProductInfo[] = [ ]
    for (let i = 1; i < Math.floor(cardIds.length / 100) + 2;i++) {
        const productInfoSlice = await getProducts(cardIds.slice(((i - 1) * 100), i * 100))
        _.each(productInfoSlice, (p) => productInfo.push(p))
    }
    return productInfo
}

export const getPriceInfo = async (
    cardIds: number[],
    accessToken: string
): Promise<PriceInfo[]> => {
    let count = 1
    const getPrices = async (ids: number[]): Promise<PriceInfo[]> => {
        if (ids.length === 0) return []
        console.log(`Getting Price info for ${ids.length * count} of ${cardIds.length} items...`)
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
        return (await (await fetch(url, options)).json()).results
    }

    if (cardIds.length < 100) {
        return await getPrices(cardIds)
    }
    const priceInfo: PriceInfo[] = [ ]
    for (let i = 1; i < Math.floor(cardIds.length / 100) + 2;i++) {
        const productInfoSlice = await getPrices(cardIds.slice(((i - 1) * 100), i * 100))
        _.each(productInfoSlice, (p) => priceInfo.push(p))
    }
    return priceInfo
}