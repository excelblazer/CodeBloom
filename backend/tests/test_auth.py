import unittest
from flask_testing import TestCase
from app import app, db, User
import json

class TestAuth(TestCase):
    def create_app(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['MAIL_SUPPRESS_SEND'] = True
        return app

    def setUp(self):
        db.create_all()
        self.test_user_data = {
            'email': 'test@example.com',
            'password': 'TestPassword123!'
        }

    def tearDown(self):
        db.session.remove()
        db.drop_all()

    def test_register(self):
        response = self.client.post('/api/register',
                                  data=json.dumps(self.test_user_data),
                                  content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertIn('Registration successful', response.json['message'])

    def test_login(self):
        # Register user first
        self.client.post('/api/register',
                        data=json.dumps(self.test_user_data),
                        content_type='application/json')
        
        # Verify user
        user = User.query.filter_by(email=self.test_user_data['email']).first()
        user.is_verified = True
        db.session.commit()
        
        # Try login
        response = self.client.post('/api/login',
                                  data=json.dumps(self.test_user_data),
                                  content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('MFA code sent', response.json['message'])

    def test_mfa_verification(self):
        # Register and verify user
        self.client.post('/api/register',
                        data=json.dumps(self.test_user_data),
                        content_type='application/json')
        user = User.query.filter_by(email=self.test_user_data['email']).first()
        user.is_verified = True
        db.session.commit()
        
        # Login to get MFA code
        self.client.post('/api/login',
                        data=json.dumps(self.test_user_data),
                        content_type='application/json')
        
        # Verify MFA
        mfa_data = {
            'email': self.test_user_data['email'],
            'mfa_code': user.mfa_secret
        }
        response = self.client.post('/api/verify-mfa',
                                  data=json.dumps(mfa_data),
                                  content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('Login successful', response.json['message'])

    def test_rate_limiting(self):
        # Try multiple failed logins
        for _ in range(6):
            response = self.client.post('/api/login',
                                      data=json.dumps({
                                          'email': 'wrong@example.com',
                                          'password': 'WrongPassword123!'
                                      }),
                                      content_type='application/json')
        self.assertEqual(response.status_code, 429)
        self.assertIn('Too many attempts', response.json['error'])
