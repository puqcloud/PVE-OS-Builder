#!/bin/bash
set -e

echo "=========================================================="
echo "    Starting Proxmox OS Template Builder (PUQcloud)       "
echo "=========================================================="

# Ensure all volume directories exist
mkdir -p /data/db /data/downloads /data/configs /data/repository/dump /data/scratch /var/run/ganesha /run/rpcbind

echo "Storage directories initialized in /data:"
echo " - Database:    ${DB_PATH:-/data/db/pve-builder.db}"
echo " - Downloads:   ${DOWNLOADS_DIR:-/data/downloads}"
echo " - Configs:     ${CONFIGS_DIR:-/data/configs}"
echo " - Repository:  ${OUTPUT_DIR:-/data/repository} (dump subfolder: /data/repository/dump)"
echo ""
echo "Admin credentials:"
echo " - Username:    ${ADMIN_USER:-admin}"
echo " - Password:    [CONFIGURED VIA ENV]"
echo ""

# Check toolchain availability
echo "Checking CLI toolchain:"
for tool in qemu-img vma zstd virt-customize guestfish aria2c ganesha.nfsd rpcbind; do
    if command -v "$tool" > /dev/null 2>&1; then
        echo " [✓] $tool: available"
    else
        echo " [!] $tool: not found (fallback mode active)"
    fi
done
if [ -e /dev/kvm ]; then
    echo " [✓] kvm: /dev/kvm acceleration active"
else
    echo " [i] kvm: not available (TCG software emulation active - safe for virtual machines)"
fi

# Start NFS storage server for Proxmox VE direct restore
if command -v ganesha.nfsd > /dev/null 2>&1; then
    echo ""
    echo "Starting Proxmox VE NFS storage service (NFS-Ganesha)..."
    if command -v rpcbind > /dev/null 2>&1; then
        rpcbind -w || true
    fi
    ganesha.nfsd -f /etc/ganesha/ganesha.conf -p /var/run/ganesha/ganesha.pid || true
    echo " [✓] NFS Storage Export: Active on port 2049 (export path: /export or /data/repository)"
fi

echo ""
echo "Starting Node.js server on port ${PORT:-8080}..."
cd /app/server
exec node src/index.js
