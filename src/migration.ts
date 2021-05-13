import jsonfile from 'jsonfile'
import _, { first } from 'lodash'

const oldHistory = jsonfile.readFileSync('data/history-old.json')
const newHistory = jsonfile.readFileSync('data/history.json')
const cardIds = _.keys(newHistory.cards)

for (let i = 0;i < cardIds.length;i++) {
    console.log(cardIds[i])
    const oldCard = oldHistory.cards[cardIds[i] + '-Holofoil']
    const newCard = newHistory.cards[cardIds[i]]
    if (!oldCard) continue
    const firstDay = _.find(oldCard.history, (h) => h.date === '2021-05-10')
    const secondDay = _.find(oldCard.history, (h) => h.date === '2021-05-11')
    if (firstDay) {
        firstDay.cardType = 'Holofoil'
        newCard.history.push(firstDay)
    }
    if (secondDay) {
        secondDay.cardType = 'Holofoil'
        newCard.history = _.reject(newCard.history, (h) => h.date === '2021-05-11')
        newCard.history.push(secondDay)
    }
}

jsonfile.writeFileSync('data/history.json', newHistory)