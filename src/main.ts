import jsonfile from 'jsonfile'
import _ from 'lodash'
import clc from 'cli-color'
import util from './util'
import { getPriceInfo, searchQuery } from './api'
import { Rarity, Type, SetData } from './enums'
import { subMonths } from 'date-fns'
import express from 'express'
import fs from 'fs'
import ejs from 'ejs'

/*
    Add sorting for daily, weekly, and monthly change
    filtering for top ultra and secret cards to determine date range and max or min price
    Add sets page with indexes for list
*/

const watchIds = [
    { id: 222990, price: 1.9, set: 'Champion\'s Path' }, // Venusaur V
    { id: 234179, price: 3.5, set: 'SWSH05: Battle Styles' }, // Corviknight VMAX
    { id: 117519, price: 1.47, set: 'XY - Fates Collide' }, // Zygarde EX
    { id: 234267, price : 2.5, set: 'SWSH05: Battle Styles' } // Rapid Strike Urshifu V
]

const keys = jsonfile.readFileSync('data/keys.json')
const setData: { name: string, date: string }[] = jsonfile.readFileSync('data/sets.json').sets
const accessToken = keys.accessToken
const verbose = false
const utilObj = new util({ accessToken, sets: setData, verbose })

const ejsOptions = { views: [ 'html' ] }
const homePage = ejs.compile(fs.readFileSync('html/index.ejs').toString(), ejsOptions)
const setsPage = ejs.compile(fs.readFileSync('html/sets.ejs').toString(), ejsOptions)

const app = express()

app.get('/', (req, res) => {
    res.redirect('/watch')
})

app.get('/bootstrap.css', (req, res) => {
    res.sendFile(__dirname.slice(0, __dirname.indexOf('dist')) + 'css/bootstrap.css')
})

app.get('/watch', async (req, res) => {
    const ids = _.map(watchIds, 'id')
    await getPriceInfo(ids, Type.Holofoil, accessToken)
    const cards = util.displayChanges(ids, _.map(watchIds, 'price'), 0, parseInt(req.query.minprice as string, 10) || 0, req.query.sort as string || 'monthly')
    const todayString = util.getDateString(new Date())
    res.send(homePage({
        title: 'Watch List',
        numCards: cards.length,
        todayString,
        sorting: req.query.sort || 'monthly',
        minprice: req.query.minprice || '0',
        cards
    }))
})

app.get('/top-ultra', async (req, res) => {
    const topUltraCards = _.map(await utilObj.getBestCardAppreciation(6, 72, Rarity.UltraRare, paramCardType, 500), (c) => ({ id: c.productId, set: c.set }))
    const cards = util.displayChanges(_.map(topUltraCards, 'id'), _.map(watchIds, 'price'), 0, parseInt(req.query.minprice as string, 10) || 0, req.query.sort as string || 'monthly')
    const todayString = util.getDateString(new Date())
    res.send(homePage({
        title: 'Top Ultra Cards',
        numCards: cards.length,
        todayString,
        sorting: req.query.sort || 'monthly',
        minprice: req.query.minprice || '0',
        cards
    }))
})

app.get('/top-secret', async (req, res) => {
    const topSecretCards = _.map(await utilObj.getBestCardAppreciation(6, 72, Rarity.SecretRare, paramCardType, 500), (c) => ({ id: c.productId, set: c.set }))
    const cards = util.displayChanges(_.map(topSecretCards, 'id'), _.map(watchIds, 'price'), 0, parseInt(req.query.minprice as string, 10) || 0, req.query.sort as string || 'monthly')
    const todayString = util.getDateString(new Date())
    res.send(homePage({
        title: 'Top Secret Cards',
        numCards: cards.length,
        todayString,
        sorting: req.query.sort || 'monthly',
        minprice: req.query.minprice || '0',
        cards
    }))
})

app.get('/sets', async (req, res) => {
    const totals = await utilObj.getTotals(setData, maxMonths, paramCardType)
    res.send(setsPage({
        sets: totals
    }))
})

app.listen(8000)

const maxMonths = 24
const paramCardType = Type.Holofoil


const fn = async () => {
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
// fn()