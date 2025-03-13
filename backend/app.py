from flask import Flask, jsonify, request, session
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from flask_cors import CORS
import os
from datetime import datetime, timedelta
import bcrypt
import secrets
from dotenv import load_dotenv
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import logging
from functools import wraps

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load configuration from environment variables
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///codeai.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)

# Email configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

db = SQLAlchemy(app)
login_manager = LoginManager(app)
mail = Mail(app)

# Load AI model
MODEL_PATH = os.getenv('MODEL_PATH', './model/deepseek-coder-1.3b')
DEVICE = os.getenv('DEVICE', 'cpu')
MAX_LENGTH = int(os.getenv('MAX_LENGTH', 2048))
TEMPERATURE = float(os.getenv('TEMPERATURE', 0.7))

try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForCausalLM.from_pretrained(MODEL_PATH).to(DEVICE)
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Error loading model: {e}")
    model = None
    tokenizer = None

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    mfa_secret = db.Column(db.String(32))
    is_verified = db.Column(db.Boolean, default=False)
    mfa_attempts = db.Column(db.Integer, default=0)
    last_login_attempt = db.Column(db.DateTime)

    def set_password(self, password):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)

    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash)

def rate_limit(max_attempts=5, window_minutes=15):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if 'login_attempts' not in session:
                session['login_attempts'] = 0
                session['login_reset_time'] = datetime.utcnow()
            
            reset_time = datetime.fromisoformat(session['login_reset_time'].isoformat())
            if datetime.utcnow() - reset_time > timedelta(minutes=window_minutes):
                session['login_attempts'] = 0
                session['login_reset_time'] = datetime.utcnow()
            
            if session['login_attempts'] >= max_attempts:
                return jsonify({'error': 'Too many attempts. Please try again later.'}), 429
            
            session['login_attempts'] += 1
            return f(*args, **kwargs)
        return wrapped
    return decorator

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/api/register', methods=['POST'])
@rate_limit()
def register():
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400

    user = User(email=data['email'])
    user.set_password(data['password'])
    user.mfa_secret = secrets.token_hex(16)
    
    db.session.add(user)
    db.session.commit()
    
    send_verification_email(user)
    
    return jsonify({'message': 'Registration successful. Please check your email for verification.'}), 201

@app.route('/api/login', methods=['POST'])
@rate_limit()
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    
    if user and user.check_password(data['password']):
        if not user.is_verified:
            return jsonify({'error': 'Please verify your email first'}), 401
        
        if user.mfa_attempts >= 3 and user.last_login_attempt:
            cooldown = datetime.utcnow() - user.last_login_attempt
            if cooldown < timedelta(minutes=15):
                return jsonify({'error': 'Account temporarily locked. Please try again later.'}), 429
            user.mfa_attempts = 0
        
        user.mfa_secret = secrets.token_hex(16)
        user.last_login_attempt = datetime.utcnow()
        db.session.commit()
        
        send_mfa_code(user)
        return jsonify({'message': 'MFA code sent to your email'}), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/verify-mfa', methods=['POST'])
@rate_limit()
def verify_mfa():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user.mfa_attempts >= 3:
        return jsonify({'error': 'Too many failed attempts. Please try logging in again.'}), 429
    
    if user and data['mfa_code'] == user.mfa_secret:
        user.mfa_attempts = 0
        db.session.commit()
        login_user(user)
        return jsonify({'message': 'Login successful'}), 200
    
    user.mfa_attempts += 1
    db.session.commit()
    return jsonify({'error': 'Invalid MFA code'}), 401

@app.route('/api/chat', methods=['POST'])
@login_required
def chat():
    if not model or not tokenizer:
        return jsonify({'error': 'AI model not available'}), 503
    
    data = request.get_json()
    user_input = data.get('message', '')
    
    try:
        inputs = tokenizer(user_input, return_tensors="pt").to(DEVICE)
        with torch.no_grad():
            outputs = model.generate(
                inputs["input_ids"],
                max_length=MAX_LENGTH,
                temperature=TEMPERATURE,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return jsonify({'response': response})
    except Exception as e:
        logger.error(f"Error generating response: {e}")
        return jsonify({'error': 'Error generating response'}), 500

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'}), 200

def send_verification_email(user):
    token = secrets.token_hex(16)
    msg = Message('Verify your CodeAI account',
                 recipients=[user.email])
    msg.body = f'Click here to verify your account: {request.host_url}verify/{token}'
    mail.send(msg)

def send_mfa_code(user):
    msg = Message('Your CodeAI MFA Code',
                 recipients=[user.email])
    msg.body = f'Your MFA code is: {user.mfa_secret}'
    mail.send(msg)

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000)
