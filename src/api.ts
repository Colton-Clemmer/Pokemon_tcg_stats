import fetch from 'node-fetch'
import _ from 'lodash'
import { ProductInfo, PriceInfo } from './enums'

const timer = (ms: number) => new Promise((res) => setTimeout(res, ms))

export const searchQuery = async (
    rarity: string,
    set: string,
    accessToken: string
): Promise<number[]> => {
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
    ids: number[],
    accessToken: string
): Promise<ProductInfo[]> => {
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

export const getPriceInfo = async (
    ids: number[],
    accessToken: string
): Promise<PriceInfo[]> => {
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