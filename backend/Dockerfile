# Multi-stage Dockerfile for C++14 Hierarchy Explorer backend on Render
# Stage 1: Build and test Linux server executable
FROM gcc:12 AS builder

WORKDIR /app

# Copy backend source code, headers, and Makefile
COPY include/ ./include/
COPY src/ ./src/
COPY Makefile ./

# Build the Linux server binary (hierarchy_server)
RUN make server

# Copy unit tests and verify tree algorithms & REST contracts during build
COPY tests/ ./tests/
RUN make test

# Stage 2: Minimal Debian runtime
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled executable from builder stage
COPY --from=builder /app/hierarchy_server /app/hierarchy_server

# Non-root system user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Render injects PORT dynamically; defaults to 8080
ENV PORT=8080
EXPOSE 8080

# Starts HTTP server listening on 0.0.0.0:${PORT} with health check at /api/status
CMD ["/app/hierarchy_server"]
