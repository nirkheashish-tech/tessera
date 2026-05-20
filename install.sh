#!/bin/bash
#
# Tessera Installer for macOS
# Downloads the latest release, installs to /Applications, and clears Gatekeeper quarantine.
#

set -e

REPO="nirkheashish-tech/tessera"
INSTALL_DIR="/Applications"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Tessera Installer for macOS      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  ASSET_PATTERN="macOS-AppleSilicon.zip"
  echo "✓ Detected Apple Silicon (M-series)"
elif [ "$ARCH" = "x86_64" ]; then
  ASSET_PATTERN="macOS-Intel.zip"
  echo "✓ Detected Intel Mac"
else
  echo "✗ Unsupported architecture: $ARCH"
  exit 1
fi

# Get latest release download URL
echo "→ Finding latest release..."
DOWNLOAD_URL=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" | \
  grep "browser_download_url" | \
  grep "$ASSET_PATTERN" | \
  head -1 | \
  cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
  echo "✗ Could not find a release matching '$ASSET_PATTERN'."
  echo "  Please download manually from: https://github.com/$REPO/releases"
  exit 1
fi

echo "→ Downloading from: $DOWNLOAD_URL"

# Download to temp
TMPDIR=$(mktemp -d)
ZIP_FILE="$TMPDIR/Tessera.zip"
curl -sL "$DOWNLOAD_URL" -o "$ZIP_FILE"
echo "✓ Download complete"

# Remove old installation if present
if [ -d "$INSTALL_DIR/Tessera.app" ]; then
  echo "→ Removing previous installation..."
  rm -rf "$INSTALL_DIR/Tessera.app"
fi

# Extract
echo "→ Extracting..."
unzip -q "$ZIP_FILE" -d "$TMPDIR"

# Find the .app bundle
APP_PATH=$(find "$TMPDIR" -name "Tessera.app" -maxdepth 2 | head -1)
if [ -z "$APP_PATH" ]; then
  echo "✗ Could not find Tessera.app in the archive."
  exit 1
fi

# Move to Applications
echo "→ Installing to $INSTALL_DIR..."
mv "$APP_PATH" "$INSTALL_DIR/"

# Clear quarantine attribute (the key step!)
echo "→ Clearing macOS Gatekeeper quarantine..."
xattr -cr "$INSTALL_DIR/Tessera.app"

# Cleanup
rm -rf "$TMPDIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     ✓ Tessera installed successfully!    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Open from: /Applications/Tessera.app"
echo "  Or use Spotlight: ⌘ Space → type 'Tessera'"
echo ""
echo "  Global hotkey: ⌥ Space (summon/hide from anywhere)"
echo ""
