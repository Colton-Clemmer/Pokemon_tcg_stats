import jsonfile from 'jsonfile'
import _ from 'lodash'
import clc from 'cli-color'
import util from './util'
import { Rarity, Type } from './enums'
import { searchQuery, getPriceInfo, getProductInfo } from './api'
import { subMonths } from 'date-fns'

const watchIds = [
    { id: 222990, price: 1.9, set: 'Champion\'s Path' }, // Venusaur V
    { id: 234179, price: 3.5, set: 'SWSH05: Battle Styles' }, // Corviknight VMAX
    { id: 117519, price: 1.47, set: 'XY - Fates Collide' }, // Zygarde EX
    { id: 234267, price : 2.5, set: 'SWSH05: Battle Styles' } // Rapid Strike Urshifu V
]

const maxMonths = 72
const paramCardType = Type.Holofoil
const keys = jsonfile.readFileSync('data/keys.json')
const setData: { name: string, date: string }[] = jsonfile.readFileSync('data/sets.json').sets
const accessToken = keys.accessToken
const verbose = false
const utilObj = new util({ accessToken, sets: setData, verbose })

const fn = async () => {
    const cardIds: number[] = []
    const maxWatchTime = subMonths(new Date(), maxMonths).getTime()
    const watchSets = _.map(_.filter(setData, (s) =>  (new Date(s.date)).getTime() > maxWatchTime), 'name')
    for  (let i = 0; i < watchSets.length;i++) {
        const set = watchSets[i]
        _.each(await searchQuery(Rarity.UltraRare, set, accessToken), (id) => cardIds.push(id))
        _.each(await searchQuery(Rarity.UltraRare, set, accessToken), (id) => cardIds.push(id))
    }

    console.log('Getting info for ' + cardIds.length + ' cards')
    await getProductInfo(cardIds, accessToken)
    await getPriceInfo(cardIds, paramCardType, accessToken)
    return

    const topUltraCards = _.map(await utilObj.getBestCardAppreciation(6, 72, Rarity.UltraRare, paramCardType, 500), (c) => ({ id: c.productId, set: c.set }))
    console.log(clc.white(`Top Ultra rare Cards: ${topUltraCards.length} cards`))
    const topSecretcards = _.map(await utilObj.getBestCardAppreciation(6, 72, Rarity.SecretRare, paramCardType, 500), (c) => ({ id: c.productId, set: c.set }))
    console.log(clc.white(`\nTop Secret rare Cards: ${topSecretcards.length} cards`))
    let cards = topUltraCards
    _.each(topSecretcards, (c) => cards.push(c))
    _.each(watchIds, (card) => cards.push(card))
    cards = _.uniq(cards)
    await utilObj.saveHistoricalData(cards, paramCardType)

    console.log(clc.white('\nWatch List: '))
    util.displayChanges(_.map(watchIds, 'id'), _.map(watchIds, 'price'))

    console.log(clc.white('\nTop Ultra Rare Cards:'))
    util.displayChanges(_.map(topUltraCards, 'id'), [], 10)
    console.log(clc.white('\nTop Secret Rare Cards:'))
    util.displayChanges(_.map(topSecretcards, 'id'), [], 10)

    const totals = await utilObj.getTotals(setData, maxMonths, paramCardType, true)
    for (let i = 0; i < totals.length;i++) {
        const total = totals[i]
        console.log(`\nSet: ${total.set} released ${total.date}`)
        console.log(`Monthly increase: $${_.round(total.averageMonthlyIncrease, 2)}`)
        console.log(`Total index: $${_.round(total.allCards.totalPrice, 2)} (${total.allCards.count} cards | $${total.allCards.averagePrice} average)`)
        console.log(`Ultra Rare index: $${_.round(total.ultraRares.totalPrice, 2)} (${total.ultraRares.count} cards | $${total.ultraRares.averagePrice} average)`)
        console.log(`Secret Rare index: $${total.secretRares.count} (${total.secretRares.count} cards | $${total.secretRares.averagePrice} average)`)
    }
}
fn()