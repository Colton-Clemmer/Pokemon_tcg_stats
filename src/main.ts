import jsonfile from 'jsonfile'
import _ from 'lodash'
import UrlSafeString from 'url-safe-string'
import util from './util'
import { getPriceInfo, searchQuery } from './api'
import { Rarity, Type } from './enums'
import express from 'express'
import fs from 'fs'
import ejs from 'ejs'

/*
    Add sorting for daily, weekly, and monthly change
    filtering for top ultra and secret cards to determine date range and max or min price
    Add sets page with indexes for list

    Watch booster packs and boxes
    Add chilling reign set
    Add sorting to sets page

    Reduce file writes
    Fix set page
    Optimize history file
    Optimize Update file
    Watch older sets
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
const maxMonths = 24
const paramCardType = Type.Holofoil

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
    const cards = util.displayChanges(_.map(topUltraCards, 'id'), [ ], 0, parseInt(req.query.minprice as string, 10) || 0, req.query.sort as string || 'monthly')
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
    const cards = util.displayChanges(_.map(topSecretCards, 'id'), [ ], 0, parseInt(req.query.minprice as string, 10) || 0, req.query.sort as string || 'monthly')
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
    const totals = await utilObj.getTotals(setData, maxMonths, paramCardType, false, req.query.sort as string || 'monthly-change')
    res.send(setsPage({
        sets: totals,
        sorting: req.query.sort || 'monthly-change',
        sortingOptions: [
            { name: 'Total Cost', id: 'total-cost' },
            { name: 'Monthly Change', id: 'monthly-change' },
            { name: 'Weekly Change', id: 'weekly-change' },
            { name: 'Daily Change', id: 'daily-change' },
            { name: 'Monthly Average Change', id: 'monthly-average-change' },
            { name: 'All Average', id: 'all-average' },
            { name: 'Ultra Rare Total', id: 'ultra-rare-total' },
            { name: 'Ultra Rare Average', id: 'ultra-rare-average' },
            { name: 'Secret Rare Total', id: 'secret-rare-total' },
            { name: 'Secret Rare Average', id: 'secret-rare-average' }
        ],
    }))
})

app.get('/sets/:set', async (req, res) => {
    const tagGenerator = new UrlSafeString()
    const setName = _.find(setData, (s) => tagGenerator.generate(s.name) === req.params.set )?.name
    if (!setName) return
    const cardIds = await searchQuery(Rarity.UltraRare, setName, accessToken)
    const cards = util.displayChanges(cardIds, [ ], 0, parseInt(req.query.minprice as string, 10) || 0, req.query.sort as string || 'monthly')
    const todayString = util.getDateString(new Date())
    res.send(homePage({
        title: setName,
        numCards: cards.length,
        todayString,
        sorting: req.query.sort || 'monthly',
        minprice: req.query.minprice || '0',
        cards
    }))
})

app.listen(8000)