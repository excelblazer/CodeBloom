import unittest
from flask_testing import TestCase
from flask_login import login_user
from app import app, db, User
import json
import torch

class TestChat(TestCase):
    def create_app(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['MAIL_SUPPRESS_SEND'] = True
        return app

    def setUp(self):
        db.create_all()
        # Create and login test user
        self.test_user = User(email='test@example.com')
        self.test_user.set_password('TestPassword123!')
        self.test_user.is_verified = True
        db.session.add(self.test_user)
        db.session.commit()
        with self.client.session_transaction() as session:
            session['user_id'] = self.test_user.id

    def tearDown(self):
        db.session.remove()
        db.drop_all()

    def test_chat_endpoint_authentication(self):
        """Test that chat endpoint requires authentication"""
        response = self.client.post('/api/chat',
                                  data=json.dumps({'message': 'Test message'}),
                                  content_type='application/json')
        self.assertEqual(response.status_code, 401)

    def test_chat_response_format(self):
        """Test chat response format when authenticated"""
        with self.client:
            login_user(self.test_user)
            response = self.client.post('/api/chat',
                                      data=json.dumps({'message': 'Test message'}),
                                      content_type='application/json')
            self.assertEqual(response.status_code, 200)
            self.assertIn('response', response.json)

    def test_model_error_handling(self):
        """Test handling of model errors"""
        with self.client:
            login_user(self.test_user)
            # Simulate model error by sending invalid input
            response = self.client.post('/api/chat',
                                      data=json.dumps({'message': None}),
                                      content_type='application/json')
            self.assertEqual(response.status_code, 500)
            self.assertIn('error', response.json)

    @unittest.skipIf(not torch.cuda.is_available(), "CUDA not available")
    def test_model_gpu_usage(self):
        """Test model GPU usage if available"""
        with self.client:
            login_user(self.test_user)
            response = self.client.post('/api/chat',
                                      data=json.dumps({'message': 'Test GPU'}),
                                      content_type='application/json')
            self.assertEqual(response.status_code, 200)

    def test_long_message_handling(self):
        """Test handling of long messages"""
        with self.client:
            login_user(self.test_user)
            long_message = "Test " * 1000  # Create a very long message
            response = self.client.post('/api/chat',
                                      data=json.dumps({'message': long_message}),
                                      content_type='application/json')
            self.assertEqual(response.status_code, 200)
            self.assertIn('response', response.json)
