const fetch = require('node-fetch')
const _ = require('lodash')

const timer = ms => new Promise((res) => setTimeout(res, ms))

module.exports = {
    searchQuery: async (rarity, set, accessToken) => {
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
                {
                    name: 'Rarity',
                    values: [rarity]
                },
                {
                    name: 'SetName',
                    values: [set]
                }
            ]
            })
        }
    
        return await (await fetch(url, options)).json()
    },
    
    getProductInfo: async (ids, accessToken) => {
        const idsString = _.reduce(ids, (s, id) => !s ? id : `${s}, ${id}`)
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
    },
    
    getPriceInfo: async (ids, accessToken) => {
        const idsString = _.reduce(ids, (s, id) => !s ? id : `${s},${id}`)
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
        const fetchedData = await fetch(url, options)
        return (await (fetchedData).json()).results
    }
}