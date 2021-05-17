import jsonfile from 'jsonfile'
import _ from 'lodash'
import fs from 'fs'
import util from './util'
import { searchQuery } from './api'
import { Rarity, Type } from './enums'
import { subMonths } from 'date-fns'

const watchIds = [
    { id: 222990, price: 1.9, set: 'Champion\'s Path' }, // Venusaur V
    { id: 234179, price: 3.5, set: 'SWSH05: Battle Styles' }, // Corviknight VMAX
    { id: 117519, price: 1.47, set: 'XY - Fates Collide' }, // Zygarde EX
    { id: 234267, price : 2.5, set: 'SWSH05: Battle Styles' } // Rapid Strike Urshifu V
]

const keys = jsonfile.readFileSync('data/keys.json')
const accessToken = keys.accessToken

const maxMonths = 24
const paramCardType = Type.Holofoil
const verbose = false

const sets: { name: string, date: string }[] = jsonfile.readFileSync('data/sets.json').sets
const utilObj = new util({
    accessToken, sets, verbose
})

const fn = async () => {
    const topUltraCards = _.map(await utilObj.getBestCardAppreciation(6, 72, Rarity.UltraRare, paramCardType, 500), (c) => ({ id: c.productId, set: c.set }))
    console.log(`Top Ultra rare Cards: ${topUltraCards.length} cards`)
    const topSecretcards = _.map(await utilObj.getBestCardAppreciation(6, 72, Rarity.SecretRare, paramCardType, 500), (c) => ({ id: c.productId, set: c.set }))
    console.log(`\nTop Secret rare Cards: ${topSecretcards.length} cards`)
    let cards = topUltraCards
    _.each(topSecretcards, (c) => cards.push(c))
    _.each(watchIds, (card) => cards.push({ id: card.id, set: card.set }))
    cards = _.uniq(cards)
    await utilObj.saveHistoricalData(cards, paramCardType)

    console.log('\nWatch List: ')
    util.displayChanges(_.map(watchIds, 'id'), _.map(watchIds, 'price'))

    console.log('\nTop Ultra Rare Cards:')
    util.displayChanges(_.map(topUltraCards, 'id'), [], 10)
    console.log('\nTop Secret Rare Cards:')
    util.displayChanges(_.map(topSecretcards, 'id'), [], 10)

    const maxWatchTime = subMonths(new Date(), maxMonths).getTime()
    const watchSets = _.map(_.filter(sets, (s) =>  (new Date(s.date)).getTime() > maxWatchTime), 'name')
    let totals = [ ]
    for (let i = 0; i < watchSets.length;i++) {
        const currentSet = watchSets[i]
        const date = _.find(sets, (s) => s.name === currentSet)?.date
        console.log(`\n\n\nGetting ${currentSet} indexes released ${date}`)
        const ultraRareCards = _.map(await searchQuery(Rarity.UltraRare, currentSet, accessToken), (id) => ({ id, set: currentSet }))
        const secretRareCards = _.map(await searchQuery(Rarity.SecretRare, currentSet, accessToken), (id) => ({ id, set: currentSet }))
        const allCards = ultraRareCards
        _.each(secretRareCards, (id) => allCards.push(id))
        await utilObj.saveHistoricalData(allCards, paramCardType)
        const ultraRareIds = _.map(ultraRareCards, 'id')
        const secretRareIds = _.map(secretRareCards, 'id')

        console.log(`\n${currentSet} Ultra Rare Cards: ${ultraRareCards.length} cards`)
        const { total: ultraRareIndex, average: ultraRareAverage } = await utilObj.getIndex(Rarity.UltraRare, currentSet, ultraRareIds)
        console.log(`${currentSet} Secret Rare Cards: ${secretRareCards.length} cards`)
        const { total: secretRareIndex, average: secretRareAverage } = await utilObj.getIndex(Rarity.SecretRare, currentSet, secretRareIds)

        console.log(`\n\n${currentSet} Ultra Rares: `)
        util.displayChanges(ultraRareIds, [], 10)
        console.log(`\n\n${currentSet} Secret Rares: `)
        util.displayChanges(secretRareIds, [], 10)
        const totalIndex =  ultraRareIndex + secretRareIndex
        totals.push({
            set: currentSet,
            date,
            ultraRareCount: ultraRareCards.length,
            secretRareCount: secretRareCards.length,
            ultraRareIndex,
            ultraRareAverage,
            secretRareIndex,
            secretRareAverage,
            totalIndex,
            monthlyIncrease: date ? totalIndex / util.getMonthsFromToday(date) : 0
        })
    }

    totals = _.reverse(_.orderBy(totals, (t) => (t.ultraRareAverage + t.secretRareAverage) / 2))
    for (let i = 0; i < totals.length;i++) {
        const total = totals[i]
        console.log(`\nSet: ${total.set} released ${total.date}`)
        console.log(`Monthly increase: $${_.round(total.monthlyIncrease, 2)}`)
        console.log(`Total index: $${_.round(total.totalIndex, 2)} (${total.ultraRareCount + total.secretRareCount} cards | $${_.round((total.ultraRareAverage + total.secretRareAverage) / 2, 2)} average)`)
        console.log(`Ultra Rare index: $${_.round(total.ultraRareIndex, 2)} (${total.ultraRareCount} cards | $${total.ultraRareAverage} average)`)
        console.log(`Secret Rare index: $${_.round(total.secretRareIndex, 2)} (${total.secretRareCount} cards | $${total.secretRareAverage} average)`)
    }
}
fn()