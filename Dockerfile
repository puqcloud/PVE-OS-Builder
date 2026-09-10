# ==========================================
# Stage 1: Build Frontend (React + Vite)
# ==========================================
FROM node:22-bookworm-slim AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Runtime with Full Toolchain
# ==========================================
FROM debian:bookworm-slim

LABEL maintainer="PUQcloud <support@puqcloud.com>"
LABEL description="Self-contained Proxmox OS Template Builder with MinIO-style Web Console"

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PORT=8080
ENV ADMIN_USER=admin
ENV ADMIN_PASSWORD=admin
ENV JWT_SECRET=puq-pve-builder-jwt-secret-key-2026

# Storage directory paths
ENV DATA_DIR=/data
ENV DB_DIR=/data/db
ENV DB_PATH=/data/db/pve-builder.db
ENV DOWNLOADS_DIR=/data/downloads
ENV CONFIGS_DIR=/data/configs
ENV OUTPUT_DIR=/data/repository
ENV SCRATCH_DIR=/data/scratch

# Direct backend for libguestfs inside Docker
ENV LIBGUESTFS_BACKEND=direct

# 1. Install base utilities, compression, QEMU and kernel for libguestfs appliance
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    ca-certificates \
    gnupg \
    aria2 \
    qemu-utils \
    zstd \
    xz-utils \
    bzip2 \
    gzip \
    tar \
    parted \
    e2fsprogs \
    dosfstools \
    libguestfs-tools \
    linux-image-amd64 \
    cloud-image-utils \
    procps \
    nfs-ganesha \
    nfs-ganesha-vfs \
    rpcbind \
    && rm -rf /var/lib/apt/lists/*

# 2. Add Proxmox VE repository and install standalone Proxmox VMA packaging utility
RUN curl -fsSL http://download.proxmox.com/debian/proxmox-release-bookworm.gpg -o /etc/apt/trusted.gpg.d/proxmox-release-bookworm.gpg && \
    echo "deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription" > /etc/apt/sources.list.d/pve-no-sub.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      libaio1 \
      libiscsi7 \
      liburing2 \
      librados2 \
      librbd1 \
      libglusterfs0 \
      libgfapi0 \
      libproxmox-backup-qemu0 && \
    cd /tmp && \
    apt-get download pve-qemu-kvm && \
    dpkg-deb -x pve-qemu-kvm*.deb /tmp/pve && \
    cp /tmp/pve/usr/bin/vma /usr/bin/vma && \
    chmod +x /usr/bin/vma && \
    rm -rf /tmp/pve /tmp/*.deb /var/lib/apt/lists/*

# 3. Install Node.js 22 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# 4. Setup workspace
WORKDIR /app

# Install backend dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy server application
COPY server/ ./server/

# Copy compiled frontend from client-builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Create storage volume mounts and NFS runtime directories
RUN mkdir -p /data/db /data/downloads /data/configs /data/repository/dump /data/scratch /var/run/ganesha /run/rpcbind

# Copy NFS Ganesha configuration
COPY ganesha.conf /etc/ganesha/ganesha.conf

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose Web Console port and NFS storage ports (NFS 2049, rpcbind 111, mountd 20048, nlm 32803)
EXPOSE 8080 2049 111 20048 32803

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-8080}/health" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
