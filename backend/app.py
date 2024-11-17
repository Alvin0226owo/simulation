from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import yfinance as yf
from datetime import datetime, timedelta
import bcrypt
from database import db
from models import User, Portfolio, Transaction
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///stocktracker.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your-secret-key' 
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=30)

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    
    new_user = User(
        email=data['email'],
        password=hashed_password,
        virtual_balance=1000000  # Starting balance of $1M
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({'message': 'User created successfully'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    
    if user and bcrypt.checkpw(data['password'].encode('utf-8'), user.password):
        access_token = create_access_token(identity=user.id)
        return jsonify({'token': access_token}), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/stock/<symbol>')
def get_stock_data(symbol):
    period = request.args.get('period', '1d')
    interval = request.args.get('interval', '5m')
    stock = yf.Ticker(symbol)
    
    try:
        # Get historical data with interval
        hist = stock.history(period=period, interval=interval)
        
        if hist.empty:
            return jsonify({'error': 'No data available for this period'}), 404
        
        # Format data for frontend
        data = {
            'prices': hist['Close'].tolist(),
            'dates': hist.index.strftime('%Y-%m-%d %H:%M:%S').tolist(),
            'info': stock.info
        }
        
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/portfolio', methods=['GET'])
@jwt_required()
def get_portfolio():
    user_id = get_jwt_identity()
    print(f"Fetching portfolio for user {user_id}")
    
    try:
        # Check if user exists
        user = User.query.get(user_id)
        if not user:
            print(f"User {user_id} not found")
            return jsonify({'error': 'User not found'}), 404
            
        # Get portfolio items
        portfolio_items = Portfolio.query.filter_by(user_id=user_id).all()
        print(f"Found {len(portfolio_items)} portfolio items")
        
        # Initialize response data
        portfolio_data = []
        total_value = user.virtual_balance
        
        # Process each portfolio item
        for item in portfolio_items:
            try:
                print(f"Processing {item.symbol}")
                stock = yf.Ticker(item.symbol)
                
                # Get current price
                current_price = None
                try:
                    hist = stock.history(period='1d')
                    if not hist.empty:
                        current_price = hist['Close'].iloc[-1]
                        print(f"Got price from history: {current_price}")
                except Exception as e:
                    print(f"Error getting price from history: {e}")
                    
                if current_price is None:
                    try:
                        current_price = stock.info.get('regularMarketPrice')
                        print(f"Got price from info: {current_price}")
                    except Exception as e:
                        print(f"Error getting price from info: {e}")
                
                if current_price is None:
                    print(f"Could not get price for {item.symbol}")
                    continue
                
                # Calculate values
                value = item.shares * current_price
                total_value += value
                gain_loss = value - (item.average_price * item.shares)
                
                # Add to portfolio data
                portfolio_data.append({
                    'symbol': item.symbol,
                    'shares': item.shares,
                    'avg_price': float(item.average_price),
                    'current_price': float(current_price),
                    'value': float(value),
                    'gain_loss': float(gain_loss)
                })
                print(f"Added {item.symbol} to portfolio data")
                
            except Exception as e:
                print(f"Error processing {item.symbol}: {str(e)}")
                continue
        
        # Prepare response
        response_data = {
            'portfolio': portfolio_data,
            'total_value': float(total_value),
            'cash_balance': float(user.virtual_balance)
        }
        
        print("Final response data:", response_data)
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Portfolio error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/trade', methods=['POST'])
@jwt_required()
def trade():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    try:
        user = User.query.get(user_id)
        stock = yf.Ticker(data['symbol'])
        
        # Try different methods to get the current price
        current_price = None
        try:
            current_price = stock.info.get('regularMarketPrice')
            if current_price is None:
                current_price = stock.info.get('currentPrice')
            if current_price is None:
                hist = stock.history(period='1d')
                if not hist.empty:
                    current_price = hist['Close'].iloc[-1]
        except Exception as e:
            print(f"Error fetching price for {data['symbol']}: {str(e)}")
            
        if current_price is None:
            return jsonify({'error': f'Could not fetch current price for {data["symbol"]}'}), 400
            
        shares = int(data['shares'])
        total_cost = current_price * shares
        
        if data['action'] == 'buy':
            if total_cost > user.virtual_balance:
                return jsonify({
                    'error': f'Insufficient funds. Cost: ${total_cost:.2f}, Balance: ${user.virtual_balance:.2f}'
                }), 400
            
            portfolio_item = Portfolio.query.filter_by(
                user_id=user_id, symbol=data['symbol']).first()
            
            if portfolio_item:
                new_shares = portfolio_item.shares + shares
                new_avg_price = ((portfolio_item.average_price * portfolio_item.shares) + 
                               (current_price * shares)) / new_shares
                portfolio_item.shares = new_shares
                portfolio_item.average_price = new_avg_price
            else:
                portfolio_item = Portfolio(
                    user_id=user_id,
                    symbol=data['symbol'],
                    shares=shares,
                    average_price=current_price
                )
                db.session.add(portfolio_item)
            
            user.virtual_balance -= total_cost
            
        elif data['action'] == 'sell':
            portfolio_item = Portfolio.query.filter_by(
                user_id=user_id, symbol=data['symbol']).first()
            
            if not portfolio_item:
                return jsonify({'error': 'You do not own this stock'}), 400
                
            if portfolio_item.shares < shares:
                return jsonify({
                    'error': f'Insufficient shares. You own {portfolio_item.shares} shares'
                }), 400
            
            portfolio_item.shares -= shares
            user.virtual_balance += total_cost
            
            if portfolio_item.shares == 0:
                db.session.delete(portfolio_item)
        
        transaction = Transaction(
            user_id=user_id,
            symbol=data['symbol'],
            shares=shares,
            price=current_price,
            action=data['action']
        )
        
        db.session.add(transaction)
        db.session.commit()
        
        return jsonify({
            'message': 'Trade executed successfully',
            'new_balance': user.virtual_balance,
            'transaction': {
                'symbol': data['symbol'],
                'shares': shares,
                'price': current_price,
                'total': total_cost,
                'action': data['action']
            }
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Trade error: {str(e)}")
        return jsonify({'error': 'Failed to execute trade. Please try again.'}), 500

@app.route('/api/test-auth', methods=['GET'])
@jwt_required()
def test_auth():
    user_id = get_jwt_identity()
    return jsonify({
        'message': 'Authentication successful',
        'user_id': user_id
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True) 