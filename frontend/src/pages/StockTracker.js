import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function StockTracker() {
  const [symbol, setSymbol] = useState('');
  const [stockData, setStockData] = useState(null);
  const [period, setPeriod] = useState('1d');
  const [loading, setLoading] = useState(false);

  const periodMap = {
    '1d': { period: '1d', interval: '5m' },
    '1w': { period: '5d', interval: '15m' },
    '1m': { period: '1mo', interval: '1d' },
    '6m': { period: '6mo', interval: '1d' },
    '1y': { period: '1y', interval: '1d' },
    '5y': { period: '5y', interval: '1wk' },
    '10y': { period: '10y', interval: '1mo' },
    'max': { period: 'max', interval: '1mo' }
  };

  const fetchStockData = async () => {
    if (!symbol) return;
    
    setLoading(true);
    try {
      const { period: p, interval } = periodMap[period];
      const response = await axios.get(
        `http://localhost:5000/api/stock/${symbol}?period=${p}&interval=${interval}`
      );
      setStockData(response.data);
    } catch (error) {
      console.error('Error fetching stock data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (symbol) {
      fetchStockData();
    }
  }, [symbol, period]);

  const chartData = stockData ? {
    labels: stockData.dates,
    datasets: [
      {
        label: symbol,
        data: stockData.prices,
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  } : null;

  return (
    <div className="container mt-5">
      <h2>Stock Tracker</h2>
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Enter stock symbol (e.g., AAPL)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        />
      </div>
      
      <div className="btn-group mb-3">
        {['1d', '1w', '1m', '6m', '1y', '5y', '10y', 'max'].map((p) => (
          <button
            key={p}
            className={`btn btn-outline-primary ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {loading && <div>Loading...</div>}
      
      {stockData && stockData.info && (
        <div>
          <div className="mb-3">
            <h3>{stockData.info.longName || symbol}</h3>
            <p>Current Price: ${stockData.info.currentPrice || stockData.info.regularMarketPrice || stockData.prices[stockData.prices.length - 1]?.toFixed(2) || 'N/A'}</p>
          </div>
          <div style={{ height: '400px' }}>
            {chartData && <Line data={chartData} options={{ maintainAspectRatio: false }} />}
          </div>
        </div>
      )}
    </div>
  );
}

export default StockTracker; 