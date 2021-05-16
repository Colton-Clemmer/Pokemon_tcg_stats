import jsonfile from 'jsonfile'
import _ from 'lodash'
import fs from 'fs'
import util from './util'
import { searchQuery } from './api'
import { Rarity, Type } from './enums'

const watchIds = [
    { id: 222990, price: 1.9, set: 'Champion\'s Path' }, // Venusaur V
    { id: 234179, price: 3.5, set: 'SWSH05: Battle Styles' }, // Corviknight VMAX
    { id: 117519, price: 1.47, set: 'XY - Fates Collide' }, // Zygarde EX
    { id: 234267, price : 2.5, set: 'SWSH05: Battle Styles' } // Rapid Strike Urshifu V
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

const battleStyles = 'SWSH05: Battle Styles'
const vividVoltage = 'SWSH04: Vivid Voltage'

const fn = async () => {
    const topCards = _.map(await utilObj.getBestCardAppreciation(6, 72, Rarity.UltraRare, paramCardType, 500), (c) => ({ id: c.productId, set: c.set }))
    console.log(`Top Ultra rare Cards: ${topCards.length} cards`)
    const topSecretcards = _.map(await utilObj.getBestCardAppreciation(6, 72, Rarity.SecretRare, paramCardType, 500), (c) => ({ id: c.productId, set: c.set }))
    console.log(`\nTop Secret rare Cards: ${topSecretcards.length} cards`)
    const battleStylesUltraRare = _.map(await searchQuery(Rarity.UltraRare, battleStyles, keys.accessToken), (id) => ({ id, set: battleStyles }))
    console.log(`\n${battleStyles} Set Ultra Rare Cards: ${battleStylesUltraRare.length} cards`)
    const battleStylesSecretRare = _.map(await searchQuery(Rarity.SecretRare, battleStyles, keys.accessToken), (id) => ({ id, set: battleStyles }))
    console.log(`\n${battleStyles} Secret Rare Cards: ${battleStylesSecretRare.length} cards`)
    const vividVoltageUltraRare = _.map(await searchQuery(Rarity.UltraRare, vividVoltage, keys.accessToken), (id) => ({ id, set: battleStyles }))
    console.log(`\n${vividVoltage} Set Ultra Rare Cards: ${vividVoltageUltraRare.length} cards`)
    const vividVoltageSecretRare = _.map(await searchQuery(Rarity.SecretRare, vividVoltage, keys.accessToken), (id) => ({ id, set: battleStyles }))
    console.log(`\n${battleStyles} Secret Rare Cards: ${vividVoltageSecretRare.length} cards`)
    let cards = topCards
    _.each(topSecretcards, (c) => cards.push(c))
    _.each(battleStylesUltraRare, (c) => cards.push(c))
    _.each(battleStylesSecretRare, (c) => cards.push(c))
    _.each(vividVoltageUltraRare, (c) => cards.push(c))
    _.each(vividVoltageSecretRare, (c) => cards.push(c))
    _.each(watchIds, (card) => cards.push({ id: card.id, set: card.set }))
    cards = _.uniq(cards)
    await utilObj.saveHistoricalData(cards, paramCardType)

    console.log('\n\nIndexes')
    await utilObj.getIndex(Rarity.UltraRare, battleStyles, _.map(battleStylesUltraRare, 'id'))
    await utilObj.getIndex(Rarity.SecretRare, battleStyles, _.map(battleStylesSecretRare, 'id'))
    await utilObj.getIndex(Rarity.UltraRare, vividVoltage, _.map(vividVoltageUltraRare, 'id'))
    await utilObj.getIndex(Rarity.SecretRare, vividVoltage, _.map(vividVoltageSecretRare, 'id'))

    console.log('\nWatch List: ')
    util.displayChanges(_.map(watchIds, 'id'), _.map(watchIds, 'price'))

    console.log('\nTop Ultra Rare Cards:')
    util.displayChanges(_.map(topCards, 'id'), [], 10)
    console.log('\nTop Secret Rare Cards:')
    util.displayChanges(_.map(topSecretcards, 'id'), [], 10)

    console.log(`\n\n${battleStyles} Ultra Rares: `)
    util.displayChanges(_.map(battleStylesUltraRare, 'id'), [], 10)
    console.log(`\n\n${battleStyles} Set Secret Rares: `)
    util.displayChanges(_.map(battleStylesSecretRare, 'id'), [], 10)

    console.log(`\n\n${vividVoltage} Ultra Rares: `)
    util.displayChanges(_.map(vividVoltageUltraRare, 'id'), [], 10)
    console.log(`\n\n${vividVoltage} Set Secret Rares: `)
    util.displayChanges(_.map(vividVoltageSecretRare, 'id'), [], 10)
}
fn()