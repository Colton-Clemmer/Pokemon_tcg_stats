export enum Type {
    Holofoil = 'Holofoil',
    ReverseHolofoil = 'Reverse Holofoil',
    Normal = 'Normal'
}

export enum Rarity {
    Common = 'Common',
    Rare = 'Rare',
    HoloRare = 'Holo Rare',
    SecretRare = 'Secret Rare',
    UltraRare = 'Ultra Rare'
}

export type Set = {
    name: string
    date: string
}

export type ProductInfo = {
    productId: number
    name: string
}

export type PriceInfo = {
    productId: number
    marketPrice: number
    subTypeName: Type
}

export type MarketInfo = {
    marketPrice: number
    productId: number
    name: string
    set: string
    monthsFromToday: number
    increasePerMonth: number
}

export type SetData = {
    name: string
    date: string
}

type SetStat = {
    totalPrice: number
    count: number
    averagePrice: number
}

export type SetTotal = {
    set: string
    date: string
    ultraRares: SetStat
    secretRares: SetStat
    allCards: SetStat
    averageMonthlyIncrease: number
    monthChange: number
    weekChange: number
    dayChange: number
}