import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Portfolio() {
  const [initialInvestment, setInitialInvestment] = useState(1000000);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tradeSymbol, setTradeSymbol] = useState('');
  const [tradeShares, setTradeShares] = useState('');
  const [tradeAction, setTradeAction] = useState('buy');
  const [tradeError, setTradeError] = useState('');

  const fetchPortfolio = async () => {
    setLoading(true);
    setTradeError('');
    try {
      const token = localStorage.getItem('token');
      console.log('Attempting to fetch portfolio...');
      console.log('Using token:', token?.substring(0, 20) + '...');  // Only show first 20 chars for security
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('Making API request...');
      const response = await axios.get('http://localhost:5000/api/portfolio', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Received response:', response);
      console.log('Response data:', response.data);
      
      if (!response.data) {
        throw new Error('No data received from server');
      }
      
      setPortfolio(response.data);
      setTradeError('');
      console.log('Portfolio updated successfully');
    } catch (error) {
      console.error('Portfolio error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      setTradeError(
        error.response?.data?.error || 
        error.message || 
        'Failed to fetch portfolio data'
      );
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleTrade = async (e) => {
    e.preventDefault();
    setTradeError('');
    try {
      if (!tradeSymbol || !tradeShares || tradeShares <= 0) {
        setTradeError('Please enter valid symbol and number of shares');
        return;
      }

      const response = await axios.post(
        'http://localhost:5000/api/trade',
        {
          symbol: tradeSymbol.toUpperCase(),
          shares: parseInt(tradeShares),
          action: tradeAction
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      await fetchPortfolio();
      setTradeSymbol('');
      setTradeShares('');
      alert(`Trade executed successfully!\n${response.data.transaction.action.toUpperCase()}: ${response.data.transaction.shares} shares of ${response.data.transaction.symbol} at $${response.data.transaction.price.toFixed(2)}`);
    } catch (error) {
      console.error('Error executing trade:', error);
      setTradeError(error.response?.data?.error || 'Error executing trade');
    }
  };

  if (loading) return <div className="container mt-5"><div className="alert alert-info">Loading portfolio data...</div></div>;

  if (!portfolio) return <div className="container mt-5"><div className="alert alert-danger">Error loading portfolio data</div></div>;

  return (
    <div className="container mt-5">
      <h2>Portfolio</h2>
      
      <div className="row mb-4">
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title">Account Summary</h2>
              <div className="Account Summary">
                <div>Total Value: ${portfolio.total_value.toFixed(2)}</div>
                <div>Cash Balance: ${portfolio.cash_balance.toFixed(2)}</div>
                <div style={{ color: portfolio.total_value - initialInvestment >= 0 ? 'green' : 'red' }}>
                  Total Gain/Loss: ${(portfolio.total_value - initialInvestment).toFixed(2)} ({((portfolio.total_value - initialInvestment)/initialInvestment * 100).toFixed(4)}%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col">
          <h3>Execute Trade</h3>
          {tradeError && (
            <div className="alert alert-danger">{tradeError}</div>
          )}
          <form onSubmit={handleTrade}>
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Stock Symbol"
                value={tradeSymbol}
                onChange={(e) => setTradeSymbol(e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="mb-3">
              <input
                type="number"
                className="form-control"
                placeholder="Number of Shares"
                value={tradeShares}
                onChange={(e) => setTradeShares(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <select
                className="form-control"
                value={tradeAction}
                onChange={(e) => setTradeAction(e.target.value)}
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">
              Execute Trade
            </button>
          </form>
        </div>
      </div>

      <h3>Holdings</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Shares</th>
            <th>Avg Price</th>
            <th>Current Price</th>
            <th>Value</th>
            <th>Gain/Loss</th>
          </tr>
        </thead>
        <tbody>
          {portfolio?.portfolio?.length > 0 ? (
            portfolio.portfolio.map((position) => (
              <tr key={position.symbol}>
                <td>{position.symbol}</td>
                <td>{position.shares}</td>
                <td>${position.avg_price.toFixed(2)}</td>
                <td>${position.current_price.toFixed(2)}</td>
                <td>${position.value.toFixed(2)}</td>
                <td className={position.gain_loss >= 0 ? 'text-success' : 'text-danger'}>
                  ${position.gain_loss.toFixed(2)}
                  ({((position.gain_loss / (position.avg_price * position.shares)) * 100).toFixed(2)}%)
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="text-center">No holdings yet</td>
            </tr>
          )}
        </tbody>
      </table>

      <button 
        className="btn btn-secondary mt-3" 
        onClick={() => fetchPortfolio()}
      >
        Refresh Portfolio
      </button>
    </div>
  );
}

export default Portfolio; 