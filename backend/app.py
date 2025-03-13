from flask import Flask, jsonify, request
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
import os
from datetime import datetime
import bcrypt
import secrets

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///codeai.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Email configuration (to be set from environment variables)
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')

db = SQLAlchemy(app)
login_manager = LoginManager(app)
mail = Mail(app)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    mfa_secret = db.Column(db.String(32))
    is_verified = db.Column(db.Boolean, default=False)

    def set_password(self, password):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)

    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400

    user = User(email=data['email'])
    user.set_password(data['password'])
    user.mfa_secret = secrets.token_hex(16)
    
    db.session.add(user)
    db.session.commit()
    
    # Send verification email
    send_verification_email(user)
    
    return jsonify({'message': 'Registration successful. Please check your email for verification.'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    
    if user and user.check_password(data['password']):
        if not user.is_verified:
            return jsonify({'error': 'Please verify your email first'}), 401
        
        # Send MFA code
        send_mfa_code(user)
        return jsonify({'message': 'MFA code sent to your email'}), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/verify-mfa', methods=['POST'])
def verify_mfa():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    
    if user and data['mfa_code'] == user.mfa_secret:  # In production, use time-based codes
        login_user(user)
        return jsonify({'message': 'Login successful'}), 200
    
    return jsonify({'error': 'Invalid MFA code'}), 401

@app.route('/api/chat', methods=['POST'])
@login_required
def chat():
    data = request.get_json()
    # TODO: Implement DeepSeek Coder model interaction
    return jsonify({'response': 'AI response placeholder'})

def send_verification_email(user):
    token = secrets.token_hex(16)
    msg = Message('Verify your CodeAI account',
                 sender='noreply@codeai.com',
                 recipients=[user.email])
    msg.body = f'Click here to verify your account: {request.host_url}verify/{token}'
    mail.send(msg)

def send_mfa_code(user):
    # In production, use time-based one-time passwords (TOTP)
    msg = Message('Your CodeAI MFA Code',
                 sender='noreply@codeai.com',
                 recipients=[user.email])
    msg.body = f'Your MFA code is: {user.mfa_secret}'
    mail.send(msg)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000)
