import jsonfile from 'jsonfile'
import fs from 'fs'
import util from './util'
import { Rarity, Type } from './enums'

const keys = jsonfile.readFileSync('data/keys.json')
const accessToken = keys.accessToken

const paramRarity = Rarity.UltraRare
const paramCardType = Type.Holofoil
const verbose = false

const cache = fs.existsSync('data/cache.json') ? jsonfile.readFileSync('data/cache.json') : { }
const sets = jsonfile.readFileSync('data/sets.json').sets
const utilObj = new util({
    accessToken,
    cache, sets, verbose
})

const fn = async () => {
    const topCards = await utilObj.getBestCardAppreciation(6, 48, paramRarity, paramCardType, 100)
    await utilObj.saveHistoricalData(topCards, paramCardType)
    //const latestSetCards = await api.searchQuery('Ultra Rare', 'SWSH05: Battle Styles', keys.accessToken)
}
fn()

// const f = async () => {
//     const ids = await api.searchQuery(paramRarity, 'SWSH05: Battle Styles', accessToken)
//     console.log(await api.getPriceInfo(ids, accessToken))
// }
// f()