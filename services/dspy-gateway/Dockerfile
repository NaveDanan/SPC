FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_CONFIG_FILE=/etc/pip.conf

# Add your local pip.ini (Artifactory config) next to this Dockerfile.
# This is copied into the image and used by pip for dependency installation.
COPY pip.ini /etc/pip.conf

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8001
CMD ["python", "main.py"]
