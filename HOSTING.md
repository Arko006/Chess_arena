# How to Host ChessArena Online

ChessArena uses a **custom Node.js server (`server.js`) with persistent WebSockets (`socket.io`), live game clocks, in-memory match managers, and Stockfish engine analysis**.

Because it requires long-lived WebSocket connections and background engine processes, **container or persistent Node.js hosts** (like Render, Railway, Fly.io, or a VPS) are recommended over pure serverless platforms (like Vercel hobby functions).

---

## Quick Comparison of Hosting Options

| Platform | Difficulty | Cost | WebSockets | Recommended For |
| :--- | :--- | :--- | :--- | :--- |
| **Railway.app** | 🟢 Very Easy | Free trial / ~$5/mo | Native support | Fastest 1-click deployment with zero config |
| **Render.com** | 🟢 Very Easy | Free tier available | Native support | Free cloud hosting with automated GitHub builds |
| **Fly.io** | 🟡 Easy | Free tier / pay-as-you-go | Native support | Global edge deployment using our `Dockerfile` |
| **VPS (Ubuntu / DigitalOcean / AWS)** | 🟠 Medium | $4 - $6/mo | Full control | Best performance for heavy Stockfish multi-threading |

---

## Option 1: Deploy on Railway (Recommended & Fastest)

Railway handles WebSockets, persistent disks, and Next.js custom servers out of the box with zero configuration.

1. Push your project to a **GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial ChessArena release"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/chessarena.git
   git push -u origin main
   ```
2. Go to [Railway.app](https://railway.app) and click **"New Project"** -> **"Deploy from GitHub repo"**.
3. Select your repository. Railway will detect the `Dockerfile` automatically.
4. In the service **Settings** -> **Variables**, add:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `your_random_super_secret_key_here`
5. *(Optional for SQLite persistence)*: In the service settings, click **"Add Volume"** and set Mount Path to `/app/prisma`.
6. Click **Generate Domain** under Networking to get a public HTTPS URL (e.g. `chessarena-production.up.railway.app`).

---

## Option 2: Deploy on Render (Free Tier Available)

1. Push your code to GitHub.
2. Go to [Render.com](https://dashboard.render.com) and click **"New +"** -> **"Web Service"**.
3. Connect your GitHub repository.
4. Configure the service:
   - **Environment**: `Docker` (or `Node`)
   - **Branch**: `main`
   - **Region**: Choose closest to you
   - If using **Docker**:
     - Render uses the included `Dockerfile` automatically.
   - If using **Node**:
     - **Build Command**: `npm install && npx prisma generate && npm run build`
     - **Start Command**: `npx prisma db push && node prisma/seed.js && npm run start`
5. Add **Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `JWT_SECRET`: `your_secret_key_random_string`
6. Click **"Create Web Service"**. Render will build and deploy your app with a free `onrender.com` SSL certificate!

---

## Option 3: Deploy on Fly.io (CLI / Docker)

Fly.io runs Docker containers near your users with native WebSocket support:

1. Install Flyctl ([instructions](https://fly.io/docs/hands-on/install-flyctl/)).
2. In your project directory, run:
   ```bash
   fly launch
   ```
3. Fly.io will detect `Dockerfile` and configure `fly.toml`.
4. Run:
   ```bash
   fly deploy
   ```
5. Your app will be live at `https://your-app-name.fly.dev`.

---

## Option 4: Deploy on a Linux VPS (Ubuntu / DigitalOcean / AWS / Linode)

If you have a Linux virtual server:

1. **Install Docker & Docker Compose** on your server:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose git
   ```
2. **Clone your repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/chessarena.git
   cd chessarena
   ```
3. **Launch with Docker Compose**:
   ```bash
   docker-compose up -d --build
   ```
   This automatically builds the container, creates the SQLite database volume in `/app/prisma`, seeds the default Arbiter account, and launches ChessArena on port `3000`.

4. **Point a Domain with Nginx & Free SSL (Let's Encrypt)**:
   Sample Nginx reverse proxy configuration (`/etc/nginx/sites-available/chessarena`):
   ```nginx
   server {
       server_name yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   Then enable HTTPS with Certbot:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

---

## Production Checklist & Default Accounts

- **Default Arbiter Login**:
  - Email: `arbiter@chessarena.com`
  - Password: `arbiter1234`
- **Security**: In your hosting environment variables, make sure to change `JWT_SECRET` to a strong, unguessable string.
- **WebSocket Verification**: Verify live moves work in online matches (the WebSocket connection indicator in the arena should say "Connected").
