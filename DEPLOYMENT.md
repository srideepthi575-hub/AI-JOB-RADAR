# 🚀 Job Radar Deployment Guide

This guide covers step-by-step instructions to deploy the **Job Radar** platform to **Vercel**, **Render**, **Railway**, **Docker**, and **GitHub Actions**.

---

## 📋 Table of Contents
1. [Option 1: Deploy on Vercel (Recommended for Serverless)](#option-1-deploy-on-vercel)
2. [Option 2: Deploy on Render (Recommended for PaaS Web Services)](#option-2-deploy-on-render)
3. [Option 3: Deploy on Railway](#option-3-deploy-on-railway)
4. [Option 4: Deploy using Docker](#option-4-deploy-using-docker)
5. [Automated Daily Job Refresh (GitHub Actions)](#automated-daily-job-refresh-github-actions)

---

## Option 1: Deploy on Vercel

Vercel hosts both the static frontend (`public/`) and the Flask backend via Serverless Functions (`api/index.py`).

### Steps:
1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Configure deployment"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New Project**.
   - Import your GitHub repository (`job-radar`).

3. **Configure Project**:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: *(Leave default or empty)*
   - **Output Directory**: *(Leave default or empty)*

4. **Environment Variables** (Optional, for API Key access):
   - `GEMINI_API_KEY`: Your Google Gemini API Key (optional for enhanced AI match explanations)
   - `ADZUNA_APP_ID` & `ADZUNA_APP_KEY`: Adzuna Job API credentials
   - `JOOBLE_API_KEY`: Jooble Job API key

5. **Deploy**: Click **Deploy**. Vercel will automatically detect `vercel.json` and deploy your app.

---

## Option 2: Deploy on Render

Render hosts the Flask application using Gunicorn as a 24/7 Web Service.

### Steps:
1. Push your repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
3. Connect your `job-radar` GitHub repository.
4. Fill in the details:
   - **Name**: `job-radar`
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn server:app`
5. Click **Create Web Service**.

---

## Option 3: Deploy on Railway

1. Go to [Railway.app](https://railway.app/).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select `job-radar`. Railway auto-detects `Procfile` and deploys `gunicorn server:app`.

---

## Option 4: Deploy using Docker

### Local / Self-Hosted:
```bash
# Build the Docker image
docker build -t job-radar .

# Run the container on port 5000
docker run -d -p 5000:5000 --name job-radar job-radar
```
Open `http://localhost:5000` in your browser.

---

## Automated Daily Job Refresh (GitHub Actions)

The platform includes an automated GitHub Actions workflow (`.github/workflows/daily-jobs.yml`) that runs daily at midnight UTC to crawl new tech jobs, deduplicate, validate, and commit `data/jobs.json` back to your repo.

### Setup:
1. In your GitHub repository, go to **Settings** -> **Secrets and variables** -> **Actions**.
2. Add the following repository secrets:
   - `GEMINI_API_KEY` (Optional)
   - `ADZUNA_APP_ID` (Optional)
   - `ADZUNA_APP_KEY` (Optional)
   - `JOOBLE_API_KEY` (Optional)
3. Under **Settings** -> **Actions** -> **General** -> **Workflow permissions**, grant **Read and write permissions**.
