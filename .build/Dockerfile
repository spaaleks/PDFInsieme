# Dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Runtime env
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Workdir
WORKDIR /app

# Copy and install Python deps first (better layer caching)
COPY ../static /app/static
COPY ../templates /app/templates
COPY ../lib /app/lib
COPY ../routes /app/routes
COPY ../app.py /app/app.py
COPY ../requirements.txt /app/requirements.txt

RUN python -m pip install --upgrade pip \
 && python -m pip install -r requirements.txt

# Expose default port
EXPOSE 14341

# Default envs; override at runtime
ENV APP_HOST=0.0.0.0 \
    PORT=14341

CMD python -u app.py