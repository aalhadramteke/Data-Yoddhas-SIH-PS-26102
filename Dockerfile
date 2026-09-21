# Use an explicit stable Python version
FROM python:3.11-slim

# Install essential system dependencies
# We only install the absolute minimum required for the binaries to run
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# THE FIX: Use --prefer-binary to avoid the "Preparing Metadata" memory freeze
# This tells pip to download pre-built versions instead of compiling from source
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefer-binary -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose port 8000
EXPOSE 8000

# Run the application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
