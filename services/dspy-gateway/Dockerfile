FROM python:3.12-slim

ARG PIP_INDEX_URL
ARG PIP_EXTRA_INDEX_URL
ARG PIP_TRUSTED_HOST
ARG PIP_CERT

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN set -eux; \
    if [ -n "$PIP_INDEX_URL$PIP_EXTRA_INDEX_URL$PIP_TRUSTED_HOST$PIP_CERT" ]; then \
        { \
            echo "[global]"; \
            if [ -n "$PIP_INDEX_URL" ]; then echo "index-url = $PIP_INDEX_URL"; fi; \
            if [ -n "$PIP_EXTRA_INDEX_URL" ]; then echo "extra-index-url = $PIP_EXTRA_INDEX_URL"; fi; \
            if [ -n "$PIP_CERT" ]; then echo "cert = $PIP_CERT"; fi; \
            if [ -n "$PIP_TRUSTED_HOST" ]; then echo "trusted-host = $PIP_TRUSTED_HOST"; fi; \
        } > /etc/pip.conf; \
    fi; \
    pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8001
CMD ["python", "main.py"]
