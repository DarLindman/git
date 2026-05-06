// __mocks__/yahoo-finance2.js
const yahooFinance = {
  quote: jest.fn(async (symbol) => ({
    regularMarketPrice: 189.42,
    regularMarketChangePercent: 2.4,
    marketCap: 2900000000000,
    trailingPE: 28.4,
    epsTrailingTwelveMonths: 6.66,
    fiftyTwoWeekHigh: 220.0,
    fiftyTwoWeekLow: 164.0,
    shortName: 'Apple Inc.',
    currency: symbol.endsWith('.TA') ? 'ILS' : 'USD',
    sector: 'Technology'
  })),
  quoteSummary: jest.fn(async (symbol, opts) => ({
    summaryDetail: { trailingPE: 28.4 },
    defaultKeyStatistics: {},
    assetProfile: { sector: 'Technology', industry: 'Consumer Electronics' }
  }))
}

module.exports = yahooFinance
