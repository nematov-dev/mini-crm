# Single-container image for PaaS deploys (Render, Railway, ...):
# builds the React app and lets Django + WhiteNoise serve it next to the API.
# Local multi-container setup lives in docker-compose.yml.

FROM node:24-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ .
COPY --from=frontend /app/dist ./frontend_dist
RUN DJANGO_SECRET_KEY=build python manage.py collectstatic --noinput \
    && chmod +x entrypoint.sh \
    && useradd --create-home app && chown -R app /app
USER app

# Demo deploy: create demo users/leads on first start if the DB is empty.
ENV PORT=8000 \n    SEED_DEMO_DATA=true
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["sh", "-c", "gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --access-logfile -"]
