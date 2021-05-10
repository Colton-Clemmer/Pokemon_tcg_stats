const _ = require('lodash')
const fs = require('fs')
const dateFns = require('date-fns')
const jsonfile = require('jsonfile')
const { getPriceInfo, getProductInfo, searchQuery } = require('./api')

const today = new Date()

const getMonthsFromToday = (d) => _.round(Math.abs(new Date(d) - today) / 1000 / 60 / 60 / 24 / 30, 0)

const aggregatePrices = async (accessToken, cache, set, rarity, cardType, median = false, verbose = false) => {
    // console.log('\n\nSET: ' + set)
    const limit = 200
    let productInfo
    let priceInfo
    let search

    if (!cache[set] || !cache[set][rarity] || !cache[set][rarity][cardType])
    {
        search = await searchQuery(rarity, set, accessToken)
        productInfo = await getProductInfo(search.results, accessToken)
        priceInfo = await getPriceInfo(search.results, accessToken)
        if (!cache[set]) cache[set] = { }
        if (!cache[set][rarity]) cache[set][rarity] = { }
        cache[set][rarity][cardType] = { search, productInfo, priceInfo }
    } else {
        const cacheData = cache[set][rarity][cardType]
        search = cacheData.search
        productInfo = cacheData.productInfo
        priceInfo = cacheData.priceInfo
    }
    let marketPrices = []
    for (let i = 0; i < search.results.length;i++)
    {
        var normalPrice = _.find(priceInfo, (pi) => pi.productId === productInfo[i].productId && pi.subTypeName === cardType)
        marketPrices.push({ marketPrice: parseFloat(normalPrice.marketPrice), name: productInfo[i].name, set, productId: productInfo[i].productId })
    }

    marketPrices = _.orderBy(marketPrices, (p) => p)
    // _.each(marketPrices, (p, i) => console.log(`${i + 1}: $${p.marketPrice} - ${p.name}`))
    const averagePrice = _.round(median ? marketPrices[Math.floor(marketPrices.length / 2)].marketPrice : _.meanBy(marketPrices, (p) => p.marketPrice), 2)
    if (verbose)
    {
        console.log(`\n${set}: Fetched ${search.totalItems} items`)
        console.log(`Average Price: $${averagePrice}`)
        console.log(`Total Price: $${_.round(_.sumBy(marketPrices, (p) => p.marketPrice), 2)}`)
    }
    jsonfile.writeFileSync('./cache.json', cache)
    return { averagePrice, marketPrices }
}

const getAverageCardPriceForSets = async (accessToken, cache, sets, paramRarity, paramCardType, paramMedian) => {
    var averagePrices = []
    for (let i = 0; i < sets.length;i++)
    {
        const { averagePrice } = await aggregatePrices(accessToken, cache, sets[i].name, paramRarity, paramCardType, paramMedian, true)
        const monthsFromToday = getMonthsFromToday(sets[i].date)
        averagePrices.push({
            name: sets[i].name,
            price: averagePrice,
            monthsFromToday,
            increasePerMonth: averagePrice / monthsFromToday
        })
    }

    console.log('\n\n')

    const orderedPrices = _.reverse(_.orderBy(averagePrices, (ap) => ap.increasePerMonth))
    _.each(orderedPrices, (op) => console.log(`$${op.price} ($${_.round(op.increasePerMonth, 4)}/month): ${op.name} [released ${op.monthsFromToday > 12 ? `${Math.floor(op.monthsFromToday / 12)} year(s) and ${op.monthsFromToday % 12}` : op.monthsFromToday} months ago]`))
}

const getBestCardAppreciation = async (
    accessToken,
    cache,
    sets,

    minMonths, 
    maxMonths,
    paramRarity,
    paramCardType,
    verbose = false
) => {
    let setData = []
    for (let i = 0; i < sets.length;i++)
    {
        const monthsFromToday = getMonthsFromToday(sets[i].date)
        if (monthsFromToday > maxMonths || monthsFromToday < minMonths)
        {
            continue
        }
        const { marketPrices } = await aggregatePrices(accessToken, cache, sets[i].name, paramRarity, paramCardType, false, false)
        for (let j = 0; j < marketPrices.length;j++)
        {
            marketPrices[j].monthsFromToday = monthsFromToday
            marketPrices[j].setName = sets[i].name
            marketPrices[j].increasePerMonth = marketPrices[j].marketPrice / monthsFromToday
            _.each(marketPrices, (p) => p.marketPrice ? setData.push(p) : false)
        }
    }
    setData = _.uniqBy(_.reverse(_.orderBy(setData, (d) => d.increasePerMonth)), (d) => d.productId)
    setData = _.filter(setData, (d) => d.monthsFromToday > minMonths && d.monthsFromToday < maxMonths)
    if (verbose) {
        console.log(`Compiling for ${setData.length} cards`)
        _.each(setData.splice(0, 100), (d, i) => console.log(`${i + 1}: increase: $${_.round(d.increasePerMonth, 2)}/month - market: $${_.round(d.marketPrice, 2)} ${d.name} (${d.setName}) [released ${d.monthsFromToday > 12 ? `${Math.floor(d.monthsFromToday / 12)} year(s) and ${d.monthsFromToday % 12}` : d.monthsFromToday} months ago]`))
    }
    return setData
}

const saveHistoricalData = async (accessToken, cards, paramCardType) => {
    let history = fs.existsSync('./history.json') ? jsonfile.readFileSync('./history.json') : { cards: { } }
    const cardIds = _.map(cards, (c) => c.productId)
    const priceInfo = _.filter(await getPriceInfo(cardIds, accessToken), (c) => c.subTypeName === paramCardType)
    let startOfDay = dateFns.subMinutes(dateFns.startOfDay(new Date()), (new Date()).getTimezoneOffset()).toISOString()
    startOfDay = startOfDay.slice(0, startOfDay.indexOf('T'))
    for (let i = 0; i < cards.length;i++)
    {
        const card = cards[i]
        const cardPriceInfo = _.find(priceInfo, (p) => p.productId === cards[i].productId)
        if (!cardPriceInfo) continue
        const productKey = card.productId.toString() + '-' + paramCardType
        if (!history.cards[productKey]) history.cards[productKey] = {
            name: card.name,
            set: card.setName,
            productId: card.productId,
            history: [ ]
        }
        history.cards[productKey].history.push({
            date: startOfDay,
            marketPrice: cardPriceInfo.marketPrice
        })
    }
    jsonfile.writeFileSync('./history.json', history)
}

const util = (accessToken, cache, sets, verbose = false) => {
    return {
        aggregatePrices: async (set, rarity, cardType, median) => aggregatePrices(accessToken, cache, set, rarity, cardType, median, verbose),
        getAverageCardPriceForSets: async (paramRarity, paramCardType, paramMedian) => getAverageCardPriceForSets(accessToken, cache, sets, paramRarity, paramCardType, paramMedian),
        getBestCardAppreciation: async (minMonths, maxMonths, paramRarity, paramCardType) => getBestCardAppreciation(accessToken, cache, sets, minMonths, maxMonths, paramRarity, paramCardType, verbose),
        saveHistoricalData: async (cards, paramCardType) => saveHistoricalData(accessToken, cards, paramCardType)
    }
}

module.exports = { util, aggregatePrices, getAverageCardPriceForSets, getBestCardAppreciation, getMonthsFromToday }