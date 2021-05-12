import jsonfile from 'jsonfile'
import _ from 'lodash'
import fs from 'fs'
import util from './util'
import { searchQuery } from './api'
import { Rarity, Type } from './enums'

const watchIds = [
    222990, // Venusaur V - Champion's path
    219347, // Salamence VMAX - Darkness Ablaze
    234179, // Corviknight VMAX - Battle Styles
    234207, // Tapu Koko VMAX - Battle Styles
    117519 // Zygarde EX - Fates Collide
]

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
    const topCardIds = _.map(await utilObj.getBestCardAppreciation(6, 48, paramRarity, paramCardType, 100), (c) => c.productId)
    const latestSetIds = await searchQuery('Ultra Rare', 'SWSH05: Battle Styles', keys.accessToken)
    const cardIds = topCardIds
    _.each(latestSetIds, (id) => cardIds.push(id))
    _.each(watchIds, (id) => cardIds.push(id))
    await utilObj.saveHistoricalData(cardIds, paramCardType)
    console.log('\nTop Cards:')
    util.displayChanges(topCardIds)
    console.log('\n\nLatest Set Ultra Rares: ')
    util.displayChanges(latestSetIds)
    console.log('\n\nWatch List: ')
    util.displayChanges(watchIds)
}
fn()