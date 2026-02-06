#!/bin/bash

# 取得腳本所在目錄
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE_DIR="$SCRIPT_DIR"
CERTS_DIR="$WORKSPACE_DIR/certs"
CONF_FILE="$CERTS_DIR/localhost.conf"

echo -e "\033[36m產生 SSL 憑證...\033[0m"
echo ""

# 檢查 openssl 是否安裝
if ! command -v openssl &> /dev/null; then
    echo -e "\033[31m錯誤：找不到 openssl，請先安裝：\033[0m"
    echo "  brew install openssl"
    exit 1
fi

# 檢查設定檔是否存在
if [ ! -f "$CONF_FILE" ]; then
    echo -e "\033[31m錯誤：找不到憑證設定檔 $CONF_FILE\033[0m"
    exit 1
fi

# 產生憑證
cd "$CERTS_DIR"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout localhost-key.pem \
    -out localhost.pem \
    -config localhost.conf

if [ $? -eq 0 ]; then
    echo ""
    echo -e "\033[32m✓ 憑證產生成功！\033[0m"
    echo "  - $CERTS_DIR/localhost.pem"
    echo "  - $CERTS_DIR/localhost-key.pem"
else
    echo -e "\033[31m✗ 憑證產生失敗\033[0m"
    exit 1
fi
