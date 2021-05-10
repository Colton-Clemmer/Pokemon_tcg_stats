const fetch = require('node-fetch')
const request = require('request')
const { exec } = require('child_process')

const accessToken = 'bhWsy1y1NkZ5gPf5NGBwX2Cm2leOflopa6Vup6QIO11B7-UZsPBUg1w3cEMQk_uQ-DH0fJR-5_qGU2QLydYrfuS52QlSEmWHmUBN9IppbyC2DuWI4XdIxvzE2S6iuilFCV4sgzDVEJhu5elnZdTwFcfhf-oYuCOO0H1czq36aAhV6XT4PcD0nueqqm_4gLQQ4pRElh8kwrPJGTZerqZBdryJZWbyMVIfcuyXBWarX5wihfg0en6gm_ufwhJBa6YP1ZMNVjji0d8GWB2AVPw_UoXV1F_dm-4jp0vac5sF1_SOlOt-A90EFW6m_a9MSYNg--ss7g'

/*
request({ url:'https://api.tcgplayer.com/v1.37.0/catalog/categories/31/search/manifest',  
    headers: {
        accept: 'application/json',
        Authorization: 'bearer ' + accessToken
    }
}, (err, res, body) => {
    console.log(err)
    console.log(res.statusCode)
    var data = JSON.parse(body)
    console.log(data)
    console.log(data.results[0].sorting)
    console.log(data.results[0].filters)
})
*/

// request.post({ url:'https://api.tcgplayer.com/v1.37.0/catalog/categories/31/search',  
//     headers: {
//         accept: 'application/json',
//         Authorization: 'bearer ' + accessToken
//     },
//     body: JSON.stringify({ limit: 20 })
// }, (err, res, body) => {
//     console.log(err)
//     console.log(res.statusCode)
//     var data = JSON.parse(body)
//     console.log(data)
// })


let url = 'https://api.tcgplayer.com/catalog/categories/3/search'
let options = {
  method: 'POST',
  headers: {
      Authorization: 'bearer ' + accessToken, 
      Accept: 'application/json', 
      'Content-Type': 'text/json'
  },
  body: JSON.stringify({
      limit: 20,
      filters: [
          {
              name: 'Rarity',
              values: ['Rare']
          },
          {
              name: 'SetName',
              values: ['SWSH05: Battle Styles']
          }
      ]
    })
}

fetch(url, options)
    .then(res => res.json())
    .then(json => console.log(json))
    .catch(err => console.error('error:' + err))
  

url = 'https://api.tcgplayer.com/catalog/products/234251'
options = {
    method: 'GET',
    headers: {
        Authorization: 'bearer ' + accessToken, 
        Accept: 'application/json', 
        'Content-Type': 'text/json'
    }
}
  
fetch(url, options)
    .then(res => res.json())
    .then(json => console.log(json))
    .catch(err => console.error('error:' + err))

url = 'https://api.tcgplayer.com/pricing/product/234251'
options = {
    method: 'GET',
    headers: {
        Authorization: 'bearer ' + accessToken, 
        Accept: 'application/json', 
        'Content-Type': 'text/json'
    }
}
    
fetch(url, options)
    .then(res => res.json())
    .then(json => console.log(json))
    .catch(err => console.error('error:' + err))

// url = 'https://api.tcgplayer.com/catalog/categories/3/rarities'
// options = {
//     method: 'GET',
//     headers: {
//         Authorization: 'bearer ' + accessToken, 
//         Accept: 'application/json', 
//         'Content-Type': 'text/json'
//     }
// }
    
// fetch(url, options)
//     .then(res => res.json())
//     .then(json => console.log(json))
//     .catch(err => console.error('error:' + err))


// const url = 'https://api.tcgplayer.com/catalog/categories/3/groups?limit=20'
// const options = {
//   method: 'GET',
//   headers: {
//       Authorization: 'bearer ' + accessToken, 
//       Accept: 'application/json', 
//       'Content-Type': 'text/json'
//   }
// }

// fetch(url, options)
//   .then(res => res.json())
//   .then(json => console.log(json))
//   .catch(err => console.error('error:' + err))