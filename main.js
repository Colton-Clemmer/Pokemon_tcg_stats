/*
 * Plan:
 * Take top 100 fastest growing cards
 * Track market price over timer
 * Displays for change this year, month, week, day
 * Determines which cards are on an upward tragectory
 */

const fetch = require('node-fetch')
const jsonfile = require('jsonfile')
const fs = require('fs')
const { util } = require('./util')
const api = require('./api')
const keys = require('./keys.json')

const keys = jsonfile.readFileSync('./keys.json')
const accessToken = keys.accessToken

const paramRarity = 'Ultra Rare'
const paramCardType = 'Holofoil'

const timer = ms => new Promise((res) => setTimeout(res, ms))

let cache = fs.existsSync('./cache.json') ? jsonfile.readFileSync('./cache.json') : { }
let history = fs.existsSync('./history.json') ? jsonfile.readFileSync('./history.json') : { cards: { } }
const sets = jsonfile.readFileSync('./sets.json').sets
const utilObj = util(accessToken, cache, sets, false)

const fn = async () => {
    const topCards = await (await utilObj.getBestCardAppreciation(6, 48, paramRarity, paramCardType)).slice(0, 100)
    await utilObj.saveHistoricalData(topCards, paramCardType)
    const latestSetCards = await api.searchQuery('Ultra Rare', 'SWSH05: Battle Styles', keys.accessToken)
}

fn()