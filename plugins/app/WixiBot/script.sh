#!/bin/zsh

source ".zprofile"

echo "$HOME - $PATH"

LOG_DIR="~/WixiBot/logs"
LOG_FILE="$LOG_DIR/local.log"

cd "~/Documents/GitHub/WixiBot-Local/src"

nohup npm run start >> "$LOG_FILE" 2>&1 &