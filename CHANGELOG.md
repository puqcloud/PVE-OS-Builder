# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-10-02

### Added
- **Configurable Primary Disk Format**:
  - Added support for target disk image formats (`raw`, `qcow2`, `vmdk`) in OS Build Profiles under "1. QEMU Hardware".
  - Automated disk conversion via `qemu-img convert` to the selected format prior to Proxmox VMA packaging.
  - Dynamic Proxmox VMA dump map generation (`#qmdump#map:scsi0:drive-scsi0:<storage>:<format>:`) and storage volume definition (`local-lvm` for raw, `local` for qcow2/vmdk).
  - Primary disk format badge displayed in OS Build Profiles cards and embedded in Proxmox `.notes` metadata.
- **Configurable CD-ROM Drive Support**:
  - Added option to attach an empty CD-ROM drive (`media=cdrom`) to template configurations in OS Build Profiles.
  - Supported slot configurations: `Disabled` (default), `IDE 2` (`ide2: none,media=cdrom`), `IDE 0` (`ide0: none,media=cdrom`), `SATA 1` (`sata1: none,media=cdrom`), and `SCSI 1` (`scsi1: none,media=cdrom`).
  - Automatic Cloud-Init slot collision prevention: when `IDE 2` is assigned to CD-ROM, the Cloud-Init drive dynamically shifts to `IDE 0`.
  - CD-ROM drive status indicator badge in OS Build Profiles cards and companion `.notes` metadata.

### Fixed
- **QEMU File Write Lock Collision during QCOW2 Conversion**:
  - Resolved `qemu-img: Failed to get "write" lock` error when converting disks whose source and destination file paths match (`disk.qcow2 -> disk.qcow2`).
  - Implemented safe temporary file staging and atomic replacement during conversion.

## [1.0.0] - 2026-09-09

### Added
- **Core Template Builder Engine**:
  - Autonomous generation of production-ready Proxmox VE virtual machine templates packaged in compressed `.vma.zst` format.
  - Integrated standalone Proxmox `vma` toolchain extracted directly from official Proxmox VE repositories.
  - Comprehensive multi-distribution support for 35 operating system releases across 9 major families (Debian, Ubuntu, AlmaLinux, Rocky Linux, CentOS Stream, Alpine Linux, Fedora, openSUSE, and Arch Linux).
  - Hardware configuration presets and OS profiles tailored for PUQ WHMCS Proxmox KVM module and automated cloud hosting.
  - Batch and matrix build workflows to generate complete regional catalogs in a single operation.
  - In-place retry for individual and batch builds without duplicating queue entries or altering historical records.
- **Integrated NFS Storage Server**:
  - Embedded NFS-Ganesha storage server (`nfs-ganesha`, `nfs-ganesha-vfs`, `rpcbind`) exporting `/data/repository` on port 2049.
  - Direct mounting in Proxmox VE as a native VZDump backup storage target (`os-builder-storage`) for one-click VM restoration.
  - Configurable NFS client IP access control directly manageable from the Web Console.
- **Cloud-Init Automation & Hardening**:
  - Universal Cloud-Init drop-in configuration (`/etc/cloud/cloud.cfg.d/99-pve.cfg`) with `NoCloud` and `ConfigDrive` datasource support.
  - Automated `cidata` disk label detection in `ds-identify.cfg` with search policy to eliminate early boot generator race conditions.
  - Dynamic partition resizing via `cloud-initramfs-growroot` and `cloud-utils-growpart`.
  - Static systemd service enablement for all cloud-init units (`cloud-init-local`, `cloud-init`, `cloud-config`, `cloud-final`).
  - Pre-configuration and enablement of `qemu-guest-agent` for full lifecycle status reporting in hypervisors.
  - Complete template sealing: removal of stale SSH host keys, `/etc/machine-id` truncation and symlinking, and deletion of default vendor accounts (`ubuntu`, `debian`, `centos`, `rocky`, `almalinux`).
- **SELinux & Enterprise Linux Compatibility**:
  - Automatic `SELINUX=permissive` and `touch /.autorelabel` enforcement for RHEL-family guests to ensure clean D-Bus, systemd, and NetworkManager initialization upon first boot.
  - CPU microarchitecture enforcement (`cpu: host` or modern baseline) for RHEL/CentOS/Alma/Rocky 9 and 10 to prevent kernel panics on legacy virtual CPUs.
- **Regional & Localization Standards**:
  - 6 pre-configured regional standards (Central Europe, US Central, Canada Central, China Mainland, India, and Global UTC).
  - Universal per-distribution package mirrors map (`package_mirrors`) supporting APT, DNF/YUM, APK, Zypper, and Pacman.
  - Fail-fast mirror reachability pre-flight validator with millisecond latency measurement.
  - Interactive "Test All Mirrors" connectivity testing tool in the Web Console.
- **MinIO-Style Web Console**:
  - Modern, responsive dark-mode interface built with React and Vite.
  - Real-time build log streaming via Server-Sent Events (SSE) with `X-Accel-Buffering: no` support and instant REST snapshot fallback.
  - Interactive Build Console terminal modal with automatic scrolling and live status indicators.
  - Dashboard overview, image catalog manager, build queue manager, storage browser, and settings pages.
- **Resilient Sequential Downloader**:
  - FIFO single-worker download queue preventing network saturation and socket exhaustion.
  - Enforced IPv4-first DNS resolution to avoid dual-stack socket timeouts in container environments.
  - Automatic 10-second retry mechanism with clean socket disposal on HTTP 3xx redirects.
- **Rich Proxmox VE Backup Notes**:
  - Automated generation of GitHub-Flavored Markdown `.notes` files companion to every `.vma.zst` archive.
  - Line 1 preserved for clean display in Proxmox VE Backups table, with comprehensive hardware and service specifications displayed in Proxmox Web GUI details.
- **Docker Appliance Architecture**:
  - Multi-stage Dockerfile (`node:22-bookworm-slim` for Vite frontend compilation, `debian:bookworm-slim` for production runtime).
  - Hardware KVM acceleration (`/dev/kvm`) with automatic fallback to QEMU TCG software emulation for nested virtual machines.
  - Dynamic `HEALTHCHECK` evaluating runtime `PORT` environment variables.
  - Automatic host network IP detection for seamless Proxmox CLI integration commands.
  - Bi-directional JSON synchronization between SQLite and disk catalogs (`images_catalog.json`, `localization_groups.json`).
