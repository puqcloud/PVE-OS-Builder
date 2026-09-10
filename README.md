# Proxmox OS Template Builder (`puqcloud/pve-os-builder`)

[![Docker Image](https://img.shields.io/badge/docker-puqcloud%2Fpve--os--builder-0db7ed.svg?logo=docker&logoColor=white)](https://hub.docker.com/r/puqcloud/pve-os-builder)
[![Architecture](https://img.shields.io/badge/arch-linux%2Famd64-blue.svg)](https://hub.docker.com/r/puqcloud/pve-os-builder)
[![Proxmox VE](https://img.shields.io/badge/Proxmox%20VE-8.x%20%7C%209.x+-E57000.svg?logo=proxmox&logoColor=white)](https://proxmox.com)
[![PUQ WHMCS](https://img.shields.io/badge/PUQ-WHMCS%20Proxmox%20KVM-10B981.svg)](https://doc.puq.info/books/proxmoxkvm-whmcs-module/page/virtual-machine-templates)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A self-contained Docker appliance designed to automate the generation of production-ready **Proxmox VE Virtual Machine Templates** (`.vma.zst`), specifically engineered for the [PUQ Proxmox KVM WHMCS Module](https://doc.puq.info/books/proxmoxkvm-whmcs-module/page/virtual-machine-templates) and automated hosting infrastructure.

Features an integrated **NFS-Ganesha Storage Server** (allowing direct Proxmox VE storage mounting), a modern **Dark Web UI**, an autonomous OS customization engine (`virt-customize`, `vma`, `zstd`, `cloud-init`), and a resilient sequential image downloader with auto-retry logic.

---

## Key Highlights

- 🚀 **Zero Manual Steps in Proxmox**: Mount this container directly as an NFS backup storage in Proxmox VE. Newly generated templates appear immediately in the Proxmox GUI backup browser for instant one-click VM restoration.
- 🛡️ **PUQ WHMCS Module Compliant**:
  - Pre-configures root SSH password authentication (`PermitRootLogin yes`, `PasswordAuthentication yes`).
  - Automatically installs `cloud-init`, `cloud-initramfs-growroot`, and `cloud-utils-growpart` for dynamic disk expansion upon provisioning.
  - Pre-configures `qemu-guest-agent` for full lifecycle status reporting in WHMCS.
  - Cleans `/etc/machine-id`, removes stale SSH host keys, and purges default cloud user accounts (`ubuntu`, `debian`, `centos`, `rocky`, `almalinux`).
- ⚡ **Hardware-Agnostic & VM-Safe**:
  - Supports `/dev/kvm` hardware virtualization acceleration when available.
  - Automatically falls back to QEMU TCG software emulation mode inside virtual machines without crashing when `/dev/kvm` is absent.
- 🔄 **Sequential Resilient Downloader**:
  - Single-worker FIFO queue prevents network saturation and socket exhaustion.
  - Enforced IPv4-first resolution avoids dual-stack IPv6 socket timeouts in container environments.
  - Automatic 10-second retry loop for temporary network glitches, with clean HTTP 3xx redirect socket disposal.
- 🌐 **Multi-Region & Localization Groups**:
  - Build regional template variations (e.g. EU, US, Canada, China Mainland, India, Global UTC) with tailored timezones, system locales, regional APT/DNF package mirrors, and custom post-provisioning bash scripts.
- 📁 **Bi-directional JSON Catalog Sync**:
  - Live configuration catalogs (`images_catalog.json`, `localization_groups.json`) synchronize automatically between the embedded SQLite database and `/data/configs` on disk.

---

## Quick Start (Docker Compose)

The recommended deployment uses `network_mode: host` to allow Proxmox VE nodes to seamlessly mount the built-in NFS storage on port 2049 without complex port mapping.

### 1. Create `docker-compose.yml`

```yaml
services:
  pve-os-builder:
    container_name: pve-os-builder
    image: puqcloud/pve-os-builder:latest
    restart: unless-stopped
    network_mode: host
    privileged: true
    environment:
      - TZ=America/Winnipeg
      - ADMIN_USER=admin
      - ADMIN_PASSWORD=admin-secure-password
      - JWT_SECRET=change-this-to-a-very-long-random-secret-key
      - PORT=8080
      - LIBGUESTFS_BACKEND=direct
    volumes:
      - ./data/db:/data/db
      - ./data/downloads:/data/downloads
      - ./data/configs:/data/configs
      - ./data/repository:/data/repository
      - ./data/scratch:/data/scratch
      # Optional: KVM acceleration if running on bare-metal or nested virtualization
      # - /dev/kvm:/dev/kvm
```

### 2. Start the Service

```bash
docker compose up -d
```

Open your browser at `http://<SERVER_IP>:8080` and log in with your configured `ADMIN_USER` and `ADMIN_PASSWORD`.

---

## Alternative: Docker CLI (`docker run`)

```bash
docker run -d \
  --name pve-os-builder \
  --restart unless-stopped \
  --network host \
  --privileged \
  -e TZ=America/Winnipeg \
  -e ADMIN_USER=admin \
  -e ADMIN_PASSWORD=admin-secure-password \
  -e JWT_SECRET=change-this-to-a-very-long-random-secret-key \
  -e PORT=8080 \
  -e LIBGUESTFS_BACKEND=direct \
  -v $(pwd)/data/db:/data/db \
  -v $(pwd)/data/downloads:/data/downloads \
  -v $(pwd)/data/configs:/data/configs \
  -v $(pwd)/data/repository:/data/repository \
  -v $(pwd)/data/scratch:/data/scratch \
  puqcloud/pve-os-builder:latest
```

> **Note on Ports**: If using standard bridge networking instead of `network_mode: host`, ensure the following ports are exposed:
> - `8080/tcp` (Web Console & API)
> - `2049/tcp` (NFS Server)
> - `111/tcp` and `111/udp` (RPC Portmapper)

---

## Direct Proxmox VE Storage Integration

The builder exports `/data/repository` over NFS at the mount path `/export` using an embedded read-only NFS-Ganesha service.

### Option A: One-Command Mount via Proxmox CLI

Run this command on your Proxmox VE host:

```bash
pvesm add nfs os-builder-storage \
  --server <BUILDER_IP> \
  --export /export \
  --content backup \
  --options ro
```

### Option B: Mount via Proxmox Web GUI

1. Log into your Proxmox VE Web GUI (`https://<PROXMOX_IP>:8006`).
2. Navigate to **Datacenter** -> **Storage** -> **Add** -> **NFS**.
3. Configure the storage parameters:
   - **ID**: `os-builder-storage`
   - **Server**: `<BUILDER_IP>`
   - **Export**: `/export`
   - **Content**: `VZDump backup file`
   - **Options**: `ro`
4. Click **Add**.

### Restoring Templates in Proxmox VE

1. In Proxmox VE, click on any node and expand `os-builder-storage`.
2. Click **Backups** to see all generated OS templates (e.g. `vzdump-qemu-9000-debian-13-eu.vma.zst`).
3. Select a template and click **Restore**.
4. Select your target storage (e.g. `local-lvm` or `ceph`), assign a VM ID, and click **Restore**.
5. Once restored, right-click the VM and choose **Convert to Template**.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ADMIN_USER` | `admin` | Web Console administrator username |
| `ADMIN_PASSWORD` | `admin` | Web Console administrator password (change in production!) |
| `JWT_SECRET` | `puq-pve-builder-...` | Secret key used to sign browser session JWT tokens |
| `PORT` | `8080` | Web Console listening port |
| `TZ` | `America/Winnipeg` | Container timezone |
| `DATA_DIR` | `/data` | Root path for persistent data volumes |
| `DOWNLOADS_DIR` | `/data/downloads` | Storage path for cached upstream base OS images (`.qcow2`) |
| `CONFIGS_DIR` | `/data/configs` | Storage path for JSON configuration catalogs |
| `OUTPUT_DIR` | `/data/repository` | Output path containing `/dump/` (`.vma.zst` templates and NFS export) |
| `SCRATCH_DIR` | `/data/scratch` | Temporary workspace for in-flight image customization |
| `LIBGUESTFS_BACKEND` | `direct` | `direct` mode is required for libguestfs inside Docker |

---

## Persistent Storage Volumes

All container state is persisted in `/data`:

```text
data/
├── db/
│   └── pve-builder.db            # Embedded SQLite database (WAL mode)
├── downloads/                    # Cached upstream cloud images (Debian, Ubuntu, AlmaLinux, etc.)
├── configs/
│   ├── images_catalog.json       # Editable OS base image catalog
│   └── localization_groups.json  # Regional localization definitions
├── repository/
│   └── dump/                     # Standard Proxmox backup storage directory
│       ├── vzdump-qemu-9000.vma.zst
│       └── vzdump-qemu-9000.notes
└── scratch/                      # Transient scratch directory for active build jobs
```

---

## Supported Operating Systems

Pre-configured in the default catalog with direct upstream download mirrors:

| Operating System | Supported Releases & Versions | Default Architecture |
|---|---|---|
| **Ubuntu Linux** (7) | **26.10** (Stonking), **26.04 LTS** (Resolute), **24.10** (Oracular), **24.04 LTS** (Noble), **22.04 LTS** (Jammy), **20.04 LTS** (Focal), **18.04 LTS** (Bionic) | `amd64` |
| **Debian GNU/Linux** (4) | **13** (Trixie), **12** (Bookworm), **11** (Bullseye), **10** (Buster) | `amd64` |
| **AlmaLinux OS** (3) | **10**, **9**, **8** | `amd64` |
| **Rocky Linux** (3) | **10**, **9**, **8** | `amd64` |
| **CentOS Stream** (3) | **10**, **9**, **8** | `amd64` |
| **Alpine Linux** (6) | **3.24**, **3.23**, **3.22**, **3.21**, **3.20**, **3.19** | `amd64` |
| **Fedora Cloud** (3) | **43**, **42**, **41** | `amd64` |
| **openSUSE Leap** (3) | **15.6**, **15.5**, **15.4** | `amd64` |
| **Arch Linux** (3) | Official Monthly Cloud Releases (**2026.09.01**, **2026.08.15**, **2026.08.01**) | `amd64` |
| **Custom OS Images** | Any cloud-init ready `.qcow2` or `.img` via Web UI or JSON catalog | `amd64` |

---

## Built-in Security Controls

- **NFS Client IP Restrictions**: Restrict NFS export access directly from the Web Console (**Proxmox Storage** page) to allow only specific Proxmox VE node IPs (e.g. `192.168.1.50, 192.168.1.51`) or private subnets (e.g. `10.0.0.0/24`).
- **Read-Only NFS Exports**: The NFS server exports the repository with `ro` (read-only) options, preventing accidental deletion or tampering from client nodes.
- **Root Password Protection**: Root passwords and provider SSH keys configured in Profiles are securely injected into templates during build time.
- **JWT Session Protection**: All REST API endpoints require valid signed JWT authentication tokens.

---

## Public Repository Browser

In addition to NFS storage, the builder serves a public HTTP/HTML directory browser at `/` (or `/repository`) allowing remote Proxmox nodes or automated provisioning scripts to download templates directly over HTTP:

```bash
wget -O /var/lib/vz/dump/vzdump-qemu-9000-debian-13-eu.vma.zst \
  http://<BUILDER_IP>:8080/repository/vzdump-qemu-9000-debian-13-eu.vma.zst
```

---

## Documentation & Commercial Support

- **Product Page**: [PUQ Proxmox KVM WHMCS Module](https://puqcloud.com/whmcs-module-proxmox-kvm.php)
- **WHMCS Module Documentation**: [PUQ Proxmox KVM WHMCS Module](https://doc.puq.info/books/proxmoxkvm-whmcs-module/page/virtual-machine-templates)
- **Official Website**: [PUQcloud](https://puqcloud.com)
- **Technical Support**: [support@puqcloud.com](mailto:support@puqcloud.com)

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.  
Free and open-source software for personal, commercial, hosting provider, and datacenter use.

---

# User Manual & Documentation


Welcome to the official documentation for **PUQ PVE OS Builder** (Proxmox Cloud Template Generator • Docker Edition). This guide provides a comprehensive overview of how to configure, use, and automate Proxmox VE OS template builds.

Built by [PUQcloud](https://puqcloud.com) and [PUQsoftware](https://puqsoftware.com). 

---

## 🚀 Introduction

PVE OS Builder is a dedicated, containerized application designed to automate the creation of Proxmox VE `.vma.zst` templates. Perfect for infrastructure automation and WHMCS integration, this tool allows you to:
- Download official cloud base images (Debian, Ubuntu, AlmaLinux, Rocky, CentOS, Alpine).
- Customize OS Profiles (QEMU hardware, Cloud-Init, sysctl tuning, security hardening).
- Automate localization and regional repository mirrors.
- Run concurrent build matrices.
- Mount directly into Proxmox VE via NFS for instant restore.

🔗 **Related Products**: Check out our [PUQ WHMCS Proxmox KVM Module](https://puqcloud.com/whmcs-module-proxmox-kvm.php) for complete billing and provisioning automation.

---

## 🔐 1. Login & Access

Access the PVE OS Builder via your configured Docker port.

![Login Screen](img/01_login.png)

Log in using the credentials defined in your Docker environment variables (`ADMIN_USER` and `ADMIN_PASSWORD`). If you need public template downloads without authentication, you can access the Public Template Repository.

---

## 📊 2. Dashboard

The Dashboard provides a unified view of your system's telemetry and status.

![Dashboard](img/02_dashboard.png)

- **Proxmox VE Native Storage (NFS)**: Monitor the status of the built-in NFS server and the number of ready templates.
- **Resource Allocation**: Track disk space usage for your base images cache and ready templates repository.
- **Packaging Utilities**: Verify that required tools (`qemu-img`, `vma`, `zstd`, `virt-customize`) are packaged and ready.
- **Recent Builds**: Quickly see the status of your latest matrix jobs.

---

## 📥 3. Base OS Images

Before building templates, you need base images. The Base OS Images Catalog connects to official upstream repositories.

![Base Images Catalog](img/03_base_images.png)

- **One-Click Download**: Pull images directly into your volume storage.
- **Real-Time Progress**: View live download progress speeds.
- **Supported Families**: Debian, Ubuntu, AlmaLinux, Rocky, CentOS, Alpine Linux.

---

## ⚙️ 4. OS Customization Profiles

Profiles dictate exactly how your virtual machine templates are configured and hardened.

![OS Profiles Overview](img/04_os_profiles.png)

Create tailored profiles for different operating systems and use cases (e.g., WHMCS standard nodes vs. lightweight Alpine containers).

### Profile Configuration Tabs

1. **PUQ Baseline**: Set the root password, disk size, and enable mandatory WHMCS directives like Root SSH Login, Cloud-Init Growroot, and Machine ID resets.
   ![Profile Baseline](img/05_profile_baseline.png)
2. **QEMU Hardware**: Configure `cpu` type (host vs x86-64-v2), Disk Async I/O (io_uring), Discard/TRIM, SSD Emulation, and Network Firewalls.
   ![QEMU Hardware](img/06_profile_qemu.png)
3. **Cloud-Init & Access**: Define the default username, inject SSH public keys, disable password expiry, and enforce fast Cloud-Init datasources.
   ![Cloud-Init](img/07_profile_cloudinit.png)
4. **Kernel & Sysctl**: Optimize networking with TCP BBR Congestion Control, increase file limits, optimize swappiness, and enable SYN Flood Protection.
   ![Kernel Tuning](img/08_profile_kernel.png)
5. **Hardening**: Automatically install Fail2ban, configure unattended security upgrades, change custom SSH ports, and run arbitrary Bash post-install scripts.
   ![Security Hardening](img/09_profile_hardening.png)

---

## 🌍 5. Regional & Localization Groups

To ensure fast performance globally, templates can be localized for specific regions.

![Localization Groups](img/10_localizations.png)

![Edit Localization Top](img/11_localization_edit_top.png)
![Edit Localization Bottom](img/12_localization_edit_bottom.png)

- **Timezone & Locale**: Define system timezones (e.g., `Europe/Warsaw`, `America/Winnipeg`) and locales.
- **Package Mirrors**: Speed up VM operations by hardcoding regional repository mirrors for `apt`, `dnf`/`yum`, `apk`, `pacman`, and `zypper`.
- **Custom Scripts**: Run specific regional commands during the build phase.

---

## 🏗️ 6. Proxmox Template Build Studio

The Build Studio is where the magic happens. You can launch single builds or massive matrix pipelines.

![Build Studio](img/13_build_studio.png)

### Launching a Build Matrix
Select multiple Base OS Images and multiple Regional Groups. The builder will automatically queue a matrix job (e.g., 5 Images × 6 Groups = 30 Builds) and increment the starting Proxmox VMID automatically.

![Launch Matrix Build](img/14_launch_matrix.png)

*(For manual control, you can also launch a single build)*:
![Launch Single Build](img/15_launch_single.png)

### Live Build Console
Monitor the build process in real-time. The builder uses `virt-customize` and `guestfish` to inject configurations without booting the OS.

![Build Console](img/16_build_console.png)
![Build Progress](img/17_build_progress.png)
![Build Console Scrolled](img/18_build_console_scrolled.png)
![Build Console Output](img/19_build_console_2.png)

---

## 📦 7. Ready Templates & Proxmox Storage

Once builds are complete, they land in the Ready Templates Repository as standard `.vma.zst` Proxmox archives.

![Ready Templates](img/20_ready_templates.png)

### Public Web Mirror
Provide your users or nodes with a read-only HTTP mirror to download templates via `wget`.

![Public Mirror](img/21_public_mirror.png)

### Zero-Download: Proxmox VE Native NFS Storage
For the ultimate workflow, connect your Proxmox VE cluster directly to the container's built-in NFS server.

![Proxmox Storage Configuration](img/22_proxmox_storage.png)

1. In Proxmox GUI, go to **Datacenter** → **Storage** → **Add** → **NFS**.
2. Enter the **IP Address** shown in the dashboard.
3. Use `/export` as the Export path.
4. Select **VZDump backup file** as the Content type.
5. Your new templates will instantly appear in Proxmox ready for 1-click restore via `qmrestore` or the GUI!

**Example: Adding NFS Storage in Proxmox VE**
![Proxmox NFS Add Dialog](img/23_proxmox_nfs_add.png)

**Example: Instant access to Ready Templates inside Proxmox**
![Proxmox Backups List](img/24_proxmox_backups_list.png)

---

## 🌐 Join the Community

Thank you for choosing PUQ! Connect with us and stay updated:
- 🛒 **Software & Modules**:[PUQcloud.com](https://puqcloud.com)
- 🏢 **Corporate Site**: [PUQsoftware.com](https://puqsoftware.com)
- 🐙 **GitHub Community**: [Follow us on GitHub](https://github.com/puqcloud)
- 📘 **Facebook**: [facebook.com/puqcloud](https://www.facebook.com/puqcloud)
- 💼 **LinkedIn**: [linkedin.com/company/puqcloud](https://www.linkedin.com/company/puqcloud)
- 🎥 **YouTube**: [@puqcloud](https://www.youtube.com/@puqcloud)
- 💬 **Telegram / Socials**: Join our discussions for latest Proxmox automation updates.

*Copyright © PUQcloud. Licensed under MIT.*
