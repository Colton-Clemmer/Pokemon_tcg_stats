import jsonfile from 'jsonfile'
import _ from 'lodash'
import fs from 'fs'
import util from './util'
import { searchQuery } from './api'
import { Rarity, Type } from './enums'

const watchIds = [
    { id: 222990, price: 1.9 }, // Venusaur V - Champion's path
    { id: 219347, price: 5 }, // Salamence VMAX - Darkness Ablaze
    { id: 234179, price: 3.5 }, // Corviknight VMAX - Battle Styles
    { id: 234207, price: 3 }, // Tapu Koko VMAX - Battle Styles
    { id: 117519, price: 1.47 } // Zygarde EX - Fates Collide
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
    _.each(watchIds, (card) => cardIds.push(card.id))
    await utilObj.saveHistoricalData(cardIds, paramCardType)
    console.log('\nTop Cards:')
    util.displayChanges(topCardIds)
    console.log('\n\nLatest Set Ultra Rares: ')
    util.displayChanges(latestSetIds)
    console.log('\n\nWatch List: ')
    util.displayChanges(_.map(watchIds, 'id'), _.map(watchIds, 'price'))
}
fn()