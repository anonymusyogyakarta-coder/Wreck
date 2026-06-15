#!/bin/bash
# ══════════════════════════════
# Wreck Start Script - Termux
# ══════════════════════════════

# Warna
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

clear
echo -e "${MAGENTA}"
echo "  ╔═══════════════════════════════╗"
echo "  ║     🐱 Wreck Installer 🐱   ║"
echo "  ║  by anonymusyogyakarta-coder  ║"
echo "  ╚═══════════════════════════════╝"
echo -e "${NC}"

# Cek Node.js
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}  📦 Node.js belum ada. Install dulu...${NC}"
  pkg install nodejs -y
fi

# Cek git
if ! command -v git &> /dev/null; then
  echo -e "${YELLOW}  📦 Git belum ada. Install dulu...${NC}"
  pkg install git -y
fi

# Setup git config jika belum
git config --global user.email "wreck@termux.com" 2>/dev/null
git config --global user.name "Wreck" 2>/dev/null

# Cek node_modules
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}  📦 Install dependencies...${NC}"
  npm install
  echo -e "${GREEN}  ✅ Dependencies terinstall!${NC}\n"
fi

# Setup .gitignore
cat > .gitignore << 'EOF'
node_modules/
*.log
.env
EOF

# Jalankan bot
echo -e "${GREEN}  🚀 Menjalankan Wreck...${NC}\n"
node index.js
