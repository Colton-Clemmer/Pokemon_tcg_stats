import jsonfile from 'jsonfile'
import _ from 'lodash'
import fs from 'fs'
import util from './util'
import { searchQuery } from './api'
import { Rarity, Type } from './enums'

const watchIds = [
    { id: 222990, price: 1.9, set: 'Champion\'s Path' }, // Venusaur V - Champion's path
    { id: 219347, price: 5, set: 'SWSH03: Darkness Ablaze' }, // Salamence VMAX - Darkness Ablaze
    { id: 234179, price: 3.5, set: 'SWSH05: Battle Styles' }, // Corviknight VMAX - Battle Styles
    { id: 234207, price: 3, set: 'SWSH05: Battle Styles' }, // Tapu Koko VMAX - Battle Styles
    { id: 117519, price: 1.47, set: 'XY - Fates Collide' } // Zygarde EX - Fates Collide
]

const keys = jsonfile.readFileSync('data/keys.json')
const accessToken = keys.accessToken

const paramRarity = Rarity.UltraRare
const paramCardType = Type.Holofoil
const verbose = false

const cache = fs.existsSync('data/cache.json') ? jsonfile.readFileSync('data/cache.json') : { products: { } }
const sets = jsonfile.readFileSync('data/sets.json').sets
const utilObj = new util({
    accessToken,
    cache, sets, verbose
})

const fn = async () => {
    const topCards = _.map(await utilObj.getBestCardAppreciation(6, 72, Rarity.UltraRare, paramCardType, 500), (c) => ({ id: c.productId, set: c.set }))
    console.log(`Top Ultra rare Cards: ${topCards.length} cards`)
    const topSecretcards = _.map(await utilObj.getBestCardAppreciation(6, 72, Rarity.SecretRare, paramCardType, 500), (c) => ({ id: c.productId, set: c.set }))
    console.log(`Top Secret rare Cards: ${topSecretcards.length} cards`)
    const latestSetUltraRare = _.map(await searchQuery('Ultra Rare', 'SWSH05: Battle Styles', keys.accessToken), (id) => ({ id, set: 'SWSH05: Battle Styles'}))
    console.log(`Latest Set Ultra Rare Cards: ${latestSetUltraRare.length} cards`)
    const latestSetSecretRare = _.map(await searchQuery('Secret Rare', 'SWSH05: Battle Styles', keys.accessToken), (id) => ({ id, set: 'SWSH05: Battle Styles' }))
    console.log(`Latest Set Secret Rare Cards: ${latestSetSecretRare.length} cards`)
    let cards = topCards
    _.each(topSecretcards, (c) => cards.push(c))
    _.each(latestSetUltraRare, (c) => cards.push(c))
    _.each(latestSetSecretRare, (c) => cards.push(c))
    _.each(watchIds, (card) => cards.push({ id: card.id, set: card.set }))
    cards = _.uniq(cards)
    await utilObj.saveHistoricalData(cards, paramCardType)
    console.log('\n\nWatch List: ')
    util.displayChanges(_.map(watchIds, 'id'), _.map(watchIds, 'price'))
    console.log('\nTop Ultra Rare Cards:')
    util.displayChanges(_.map(topCards, 'id'), [], 10)
    console.log('\nTop Secret Rare Cards:')
    util.displayChanges(_.map(topSecretcards, 'id'), [], 10)
    console.log('\n\nLatest Set Ultra Rares: ')
    util.displayChanges(_.map(latestSetUltraRare, 'id'), [], 10)
    console.log('\n\nLatest Set Secret Rares: ')
    util.displayChanges(_.map(latestSetSecretRare, 'id'), [], 10)
}
fn()