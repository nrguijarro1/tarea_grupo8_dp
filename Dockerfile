FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Separate dependency installation from source copies for build caching.
COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --no-cache-dir -r backend/requirements.txt \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app app

COPY --chown=app:app backend/app/ ./backend/app/
COPY --chown=app:app backend/alembic/ ./backend/alembic/
COPY --chown=app:app backend/alembic.ini ./backend/alembic.ini
COPY --chown=app:app backend/crear_admin.py ./backend/crear_admin.py
COPY --chown=app:app index.html ./index.html
COPY --chown=app:app css/ ./css/
COPY --chown=app:app js/ ./js/

USER app
EXPOSE 8000

CMD ["sh", "-c", "exec python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port \"${PORT:-8000}\" --proxy-headers"]
