#!/bin/sh
# Encrypted logical backup of the local stack. Does not print secrets.
set -eu
set -o pipefail
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
out="$root/backup/out"
key="$root/certs/backup.key"
mkdir -p "$out"
umask 077
if [ ! -f "$key" ]; then
  openssl rand -hex 32 > "$key"
  chmod 600 "$key"
fi
stamp=$(date -u +%Y%m%dT%H%M%SZ)
export PATH="$root/../local-k8s-bin:$PATH"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

kubectl exec -n mindy mysql-0 -- sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --no-tablespaces --databases ygy_ai' > "$work/mysql.sql"
gzip -c "$work/mysql.sql" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$key" -out "$out/mysql-$stamp.sql.gz.enc"

kubectl exec -n mindy redis-0 -- redis-cli SAVE >/dev/null
kubectl exec -n mindy redis-0 -- sh -c 'cat /data/dump.rdb' > "$work/dump.rdb" || true
if [ -s "$work/dump.rdb" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$key" -in "$work/dump.rdb" -out "$out/redis-$stamp.rdb.enc"
fi

mkdir -p "$work/audio"
kubectl exec -n mindy seaweedfs-0 -- sh -c 'wget -qO- http://127.0.0.1:8333/mindy-audio/local-listen/en.wav' > "$work/audio/en.wav"
kubectl exec -n mindy seaweedfs-0 -- sh -c 'wget -qO- http://127.0.0.1:8333/mindy-audio/local-listen/zh.wav' > "$work/audio/zh.wav"
tar -C "$work" -czf - audio | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$key" -out "$out/audio-$stamp.tar.gz.enc"

find "$out" -type f -mtime +14 -delete
printf 'backup %s\n' "$stamp"
