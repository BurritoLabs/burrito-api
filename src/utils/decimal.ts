import { Decimal } from "decimal.js"

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30
})

export const decimal = (value: Decimal.Value) => new Decimal(value)

export const decimalMax = (a: string, b: string) =>
  Decimal.max(decimal(a), decimal(b)).toString()

export const decimalMin = (a: string, b: string) =>
  Decimal.min(decimal(a), decimal(b)).toString()

export const decimalAdd = (a: string, b: string) => decimal(a).plus(b).toString()

export const decimalDiv = (a: string, b: string) => decimal(a).div(b).toString()

export const decimalShift = (value: string, decimals: number) =>
  decimal(value).div(decimal(10).pow(decimals)).toString()
