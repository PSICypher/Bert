'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Calculator, ChevronDown, X } from 'lucide-react';

interface CurrencyWidgetProps {
  homeCurrency?: string;
  tripCurrency?: string;
}

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
];

// Mock exchange rates (relative to USD)
const MOCK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  AUD: 1.53,
  CAD: 1.36,
  CHF: 0.88,
  CNY: 7.24,
  INR: 83.12,
  MXN: 17.15,
  BRL: 4.97,
  ZAR: 18.92,
  NZD: 1.64,
};

const QUICK_AMOUNTS = [10, 20, 50, 100, 500];

export default function CurrencyWidget({
  homeCurrency = 'GBP',
  tripCurrency = 'USD',
}: CurrencyWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fromCurrency, setFromCurrency] = useState(homeCurrency);
  const [toCurrency, setToCurrency] = useState(tripCurrency);
  const [amount, setAmount] = useState<string>('100');
  const [result, setResult] = useState<number>(0);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  const convert = useCallback((value: number, from: string, to: string): number => {
    // Convert to USD first, then to target currency
    const inUSD = value / MOCK_RATES[from];
    return inUSD * MOCK_RATES[to];
  }, []);

  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    setResult(convert(numAmount, fromCurrency, toCurrency));
  }, [amount, fromCurrency, toCurrency, convert]);

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const getCurrencySymbol = (code: string): string => {
    return CURRENCIES.find((c) => c.code === code)?.symbol || code;
  };

  const formatResult = (value: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl transition-shadow"
      >
        <Calculator className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-gray-700">
          {getCurrencySymbol(fromCurrency)} → {getCurrencySymbol(toCurrency)}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 bg-white border border-gray-200 rounded-xl shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Currency Converter</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* From currency */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => {
                  setShowFromDropdown(!showFromDropdown);
                  setShowToDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md text-sm bg-white hover:bg-gray-50"
              >
                <span>
                  {getCurrencySymbol(fromCurrency)} {fromCurrency}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {showFromDropdown && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  {CURRENCIES.map((currency) => (
                    <button
                      key={currency.code}
                      onClick={() => {
                        setFromCurrency(currency.code);
                        setShowFromDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                        fromCurrency === currency.code ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      {currency.symbol} {currency.code} - {currency.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24 px-3 py-2 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Amount"
            />
          </div>
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <button
            onClick={swapCurrencies}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
          >
            <ArrowLeftRight className="w-5 h-5" />
          </button>
        </div>

        {/* To currency */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => {
                  setShowToDropdown(!showToDropdown);
                  setShowFromDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md text-sm bg-white hover:bg-gray-50"
              >
                <span>
                  {getCurrencySymbol(toCurrency)} {toCurrency}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {showToDropdown && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  {CURRENCIES.map((currency) => (
                    <button
                      key={currency.code}
                      onClick={() => {
                        setToCurrency(currency.code);
                        setShowToDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                        toCurrency === currency.code ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      {currency.symbol} {currency.code} - {currency.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-right font-medium text-gray-900">
              {formatResult(result, toCurrency).replace(/[^0-9.,]/g, '')}
            </div>
          </div>
        </div>

        {/* Result display */}
        <div className="text-center py-3 bg-blue-50 rounded-lg">
          <div className="text-lg font-semibold text-blue-700">
            {formatResult(result, toCurrency)}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            1 {fromCurrency} = {convert(1, fromCurrency, toCurrency).toFixed(4)} {toCurrency}
          </div>
        </div>

        {/* Quick amounts */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Quick amounts</label>
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(quickAmount.toString())}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  amount === quickAmount.toString()
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {getCurrencySymbol(fromCurrency)}{quickAmount}
              </button>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-gray-400 text-center">
          Rates are approximate and may vary
        </p>
      </div>
    </div>
  );
}
