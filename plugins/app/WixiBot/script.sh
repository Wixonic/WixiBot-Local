#!/bin/zsh

source ~/.zprofile

cd ~/Documents/GitHub/WixiBot-Local/src

mkdir -p ~/WixiBot/logs/
touch ~/WixiBot/logs/local.log

npm run start >> ~/WixiBot/logs/local.log 2>&1 &