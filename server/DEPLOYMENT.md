# Deployment Guide

## Quick Start with Docker

### 1. Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Generate secrets
node cli.js generate-secrets

# Edit .env with generated secrets
nano .env
```

### 3. Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f app
```

### 4. Verify Deployment

```bash
# Health check
curl http://localhost:3000/health/detailed

# Metrics
curl http://localhost:3000/metrics

# Grafana dashboard
open http://localhost:3001  # Default: admin/admin
```

---

## Manual Deployment (Production)

### 1. Server Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Disk: 20 GB SSD
- OS: Ubuntu 20.04+ / RHEL 8+

**Recommended:**
- CPU: 4+ cores
- RAM: 8+ GB
- Disk: 50+ GB SSD
- OS: Ubuntu 22.04 LTS

### 2. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB 7.0
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# Install Redis 7
sudo apt install -y redis-server

# Install PM2 for process management
sudo npm install -g pm2
```

### 3. Application Setup

```bash
# Create application user
sudo useradd -m -s /bin/bash multitenant
sudo su - multitenant

# Clone/copy application
cd /opt
git clone <your-repo> multi-tenant-app
cd multi-tenant-app

# Install dependencies
npm ci --only=production

# Setup environment
cp .env.example .env
nano .env  # Configure production settings
```

### 4. Configure Services

#### MongoDB

```bash
# Enable authentication
sudo nano /etc/mongod.conf
```

```yaml
security:
  authorization: enabled

net:
  bindIp: 127.0.0.1
```

```bash
# Create admin user
mongosh
use admin
db.createUser({
  user: "admin",
  pwd: "secure-password",
  roles: ["root"]
})

# Create application user
use multi_tenant
db.createUser({
  user: "app_user",
  pwd: "app-password",
  roles: ["readWrite"]
})

# Restart MongoDB
sudo systemctl restart mongod
sudo systemctl enable mongod
```

#### Redis

```bash
# Configure Redis
sudo nano /etc/redis/redis.conf
```

```conf
# Set password
requirepass your-redis-password

# Enable persistence
appendonly yes
appendfilename "appendonly.aof"

# Bind to localhost
bind 127.0.0.1
```

```bash
# Restart Redis
sudo systemctl restart redis
sudo systemctl enable redis
```

### 5. Start Application

#### Using PM2

```bash
# Start application
pm2 start src/app.js --name multi-tenant-app

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
# Run the command it outputs

# Monitor
pm2 monit
pm2 logs multi-tenant-app
```

#### Using systemd

Create `/etc/systemd/system/multi-tenant.service`:

```ini
[Unit]
Description=Multi-Tenant Application
After=network.target mongodb.service redis.service

[Service]
Type=simple
User=multitenant
WorkingDirectory=/opt/multi-tenant-app
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/app.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable multi-tenant
sudo systemctl start multi-tenant

# Check status
sudo systemctl status multi-tenant
```

### 6. Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create configuration
sudo nano /etc/nginx/sites-available/multi-tenant
```

```nginx
upstream multi_tenant_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy settings
    location / {
        proxy_pass http://multi_tenant_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Metrics endpoint (restrict access)
    location /metrics {
        allow 10.0.0.0/8;  # Internal network
        deny all;
        proxy_pass http://multi_tenant_app;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/multi-tenant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### 8. Setup Monitoring

#### Prometheus

```bash
# Install Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvf prometheus-2.45.0.linux-amd64.tar.gz
sudo mv prometheus-2.45.0.linux-amd64 /opt/prometheus

# Copy configuration
sudo cp prometheus.yml /opt/prometheus/

# Create systemd service
sudo nano /etc/systemd/system/prometheus.service
```

```ini
[Unit]
Description=Prometheus
After=network.target

[Service]
Type=simple
User=prometheus
ExecStart=/opt/prometheus/prometheus --config.file=/opt/prometheus/prometheus.yml --storage.tsdb.path=/var/lib/prometheus
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Start Prometheus
sudo systemctl enable prometheus
sudo systemctl start prometheus
```

#### Grafana

```bash
# Install Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y grafana

# Start Grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

### 9. Setup Automated Backups

```bash
# Create backup script
sudo nano /opt/multi-tenant-app/backup-all.sh
```

```bash
#!/bin/bash
cd /opt/multi-tenant-app
node cli.js backup tenant-a --encrypt
node cli.js backup tenant-b --encrypt
# Add more tenants as needed
```

```bash
# Make executable
chmod +x /opt/multi-tenant-app/backup-all.sh

# Add to crontab
crontab -e
```

```cron
# Daily backup at 2 AM
0 2 * * * /opt/multi-tenant-app/backup-all.sh >> /var/log/backups.log 2>&1

# Weekly cleanup of old backups
0 3 * * 0 find /opt/multi-tenant-app/backups -type f -mtime +30 -delete
```

### 10. Security Hardening

```bash
# Setup firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Disable root SSH
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd

# Setup fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Enable automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Kubernetes Deployment

### 1. Create Kubernetes Manifests

See `k8s/` directory for:
- `deployment.yaml` - Application deployment
- `service.yaml` - Service configuration
- `configmap.yaml` - Configuration
- `secrets.yaml` - Secrets management
- `ingress.yaml` - Ingress rules

### 2. Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace multi-tenant

# Apply configurations
kubectl apply -f k8s/ -n multi-tenant

# Check status
kubectl get pods -n multi-tenant
kubectl logs -f deployment/multi-tenant-app -n multi-tenant
```

---

## Post-Deployment Checklist

- [ ] All services running (app, MongoDB, Redis)
- [ ] Health checks passing
- [ ] SSL certificates configured
- [ ] Firewall rules set
- [ ] Monitoring active (Prometheus, Grafana)
- [ ] Automated backups scheduled
- [ ] Log rotation configured
- [ ] Secrets rotated from defaults
- [ ] Rate limits configured
- [ ] Audit logging enabled
- [ ] Metrics collection working
- [ ] Alerts configured
- [ ] Documentation updated
- [ ] Disaster recovery tested

---

## Troubleshooting

### Application won't start

```bash
# Check logs
pm2 logs multi-tenant-app
# or
sudo journalctl -u multi-tenant -f

# Check environment
cat .env

# Test MongoDB connection
mongosh "mongodb://localhost:27017/multi_tenant"

# Test Redis connection
redis-cli ping
```

### High memory usage

```bash
# Check Node.js memory
pm2 monit

# Increase memory limit if needed
pm2 delete multi-tenant-app
pm2 start src/app.js --name multi-tenant-app --max-memory-restart 1G
```

### Rate limiting not working

```bash
# Check Redis
redis-cli ping
redis-cli KEYS "ratelimit:*"

# Check Redis connection in app
curl http://localhost:3000/health/detailed
```

---

## Scaling

### Horizontal Scaling

```bash
# Using PM2 cluster mode
pm2 delete multi-tenant-app
pm2 start src/app.js --name multi-tenant-app -i max

# Using Docker Compose
docker-compose up -d --scale app=3
```

### Database Scaling

- MongoDB: Set up replica set
- Redis: Set up Redis Cluster
- Use connection pooling
- Implement caching strategies

---

## Maintenance

### Regular Tasks

**Daily:**
- Check application logs
- Monitor error rates
- Verify backups completed

**Weekly:**
- Review audit logs
- Check disk space
- Update dependencies (dev environment first)

**Monthly:**
- Rotate secrets
- Review security logs
- Test disaster recovery
- Update documentation

---

## Support

For issues:
1. Check logs: `pm2 logs` or `journalctl`
2. Verify health: `curl http://localhost:3000/health/detailed`
3. Check metrics: `curl http://localhost:3000/metrics`
4. Review audit logs in MongoDB
