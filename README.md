# CodeAI - DeepSeek Coder Integration

A web application that provides access to the DeepSeek Coder 1.3B LLM through a secure chat interface.

## System Requirements

- Python 3.8+
- 16GB RAM
- 100GB Storage
- CPU-only environment (no GPU required)

## Project Structure

```
codeai/
├── backend/         # Flask backend server
├── frontend/        # Web interface
├── model/          # DeepSeek Coder model files
└── requirements.txt # Python dependencies
```

## Setup Instructions

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables:
Create a `.env` file in the project root with:
```
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password
```

3. Start the backend server:
```bash
python backend/app.py
```

4. Access the web interface:
Open `frontend/index.html` in your browser or serve it using a static file server.

## Security Features

- User authentication with email/password
- Email-based MFA verification
- Session management
- Secure password hashing

## Deployment

1. Set up a GCP instance with:
   - 4 CPU cores
   - 16GB RAM
   - 100GB Storage

2. Configure firewall rules to allow HTTP/HTTPS traffic

3. Deploy the application using gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```
