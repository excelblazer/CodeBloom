# CodeAI - DeepSeek Coder Integration

A secure web application that provides access to the DeepSeek Coder 1.3B LLM through an authenticated chat interface.

## System Requirements

- Python 3.8+
- 16GB RAM minimum
- 100GB Storage
- CPU-only environment (no GPU required)
- GCP Compute Engine instance (e2-standard-4 or similar)

## Project Structure

```
codeai/
├── backend/           # Flask backend server
│   └── app.py        # Main application file
├── frontend/         # Web interface
│   └── index.html   # Chat interface
├── model/           # DeepSeek Coder model files
│   └── setup_model.py # Model setup script
├── .env.example     # Environment variables template
└── requirements.txt # Python dependencies
```

## Local Development Setup

1. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the following variables:
```env
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password
SECRET_KEY=your-secret-key
```

4. Download and set up the AI model:
```bash
python model/setup_model.py
```

5. Start the backend server:
```bash
python backend/app.py
```

6. Access the web interface:
   - Open `frontend/index.html` in your browser
   - Default URL: http://localhost:5000

## GCP Deployment Guide

1. Create GCP Instance:
   - Go to GCP Console > Compute Engine > VM Instances
   - Click "Create Instance"
   - Select the following specifications:
     - Machine type: e2-standard-4 (4 vCPU, 16GB memory)
     - Boot disk: 100GB Standard persistent disk
     - OS: Ubuntu 20.04 LTS
     - Allow HTTP/HTTPS traffic

2. Set up the Instance:
```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Install Python and dependencies
sudo apt-get install python3-pip python3-venv nginx -y

# Clone your repository (replace with your repo URL)
git clone <your-repo-url>
cd codeai

# Set up Python environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. Configure Nginx:
```bash
sudo nano /etc/nginx/sites-available/codeai
```
Add the following configuration:
```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    location / {
        root /path/to/codeai/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/codeai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

5. Set up SSL with Let's Encrypt:
```bash
sudo apt-get install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your_domain
```

6. Run the application with Gunicorn:
```bash
gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

## Security Features

1. User Authentication:
   - Email/password login
   - Email-based MFA verification
   - Rate limiting on authentication endpoints
   - Account lockout after failed attempts

2. Session Management:
   - Secure session handling
   - 30-minute session timeout
   - CSRF protection

3. Data Security:
   - Bcrypt password hashing
   - HTTPS encryption
   - Environment variable configuration
   - SQL injection protection

## Monitoring and Maintenance

1. Check application logs:
```bash
tail -f /var/log/codeai/app.log
```

2. Monitor system resources:
```bash
htop
```

3. Update the application:
```bash
git pull
pip install -r requirements.txt
sudo systemctl restart codeai
```

## Troubleshooting

1. If the model fails to load:
   - Check available memory: `free -h`
   - Verify model files exist in the model directory
   - Check application logs for specific errors

2. If authentication fails:
   - Verify email server settings in .env
   - Check if the email service allows less secure app access
   - Clear rate limit counters if needed

3. If the server is unresponsive:
   - Check system resources
   - Verify Gunicorn workers are running
   - Check Nginx error logs

## Support

For issues and feature requests, please create an issue in the repository or contact the development team.
