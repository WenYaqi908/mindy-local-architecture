#!/bin/sh
# Decrypt the newest backup into a throwaway database, compare it, then drop it.
# The live ygy_ai database is not replaced.
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
out="$root/backup/out"
key="$root/certs/backup.key"
export PATH="$root/../local-k8s-bin:$PATH"
mysql_enc=$(ls -1t "$out"/mysql-*.sql.gz.enc | head -1)
audio_enc=$(ls -1t "$out"/audio-*.tar.gz.enc | head -1)
work=$(mktemp -d)

openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$key" -in "$mysql_enc" | gzip -dc > "$work/mysql.sql"
openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$key" -in "$audio_enc" | tar -xzf - -C "$work"
test -s "$work/audio/en.wav"
test -s "$work/audio/zh.wav"

drop_drill() {
  kubectl exec -n mindy mysql-0 -- sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS ygy_ai_restore_drill"'
}
trap 'status=$?; drop_drill >/dev/null 2>&1 || true; rm -rf "$work"; exit "$status"' EXIT

drop_drill >/dev/null 2>&1 || true
# The dump creates and uses ygy_ai. Load it under another name.
sed 's/`ygy_ai`/`ygy_ai_restore_drill`/g; s/DATABASE `ygy_ai`/DATABASE `ygy_ai_restore_drill`/g; s/USE `ygy_ai`/USE `ygy_ai_restore_drill`/g' "$work/mysql.sql" > "$work/drill.sql"
kubectl exec -i -n mindy mysql-0 -- sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < "$work/drill.sql"
kubectl exec -n mindy mysql-0 -- sh -c 'mysql -N -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
SELECT \"live\", COUNT(*) FROM ygy_ai.feed
UNION ALL SELECT \"drill\", COUNT(*) FROM ygy_ai_restore_drill.feed
UNION ALL SELECT \"live_block\", COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=\"ygy_ai\" AND TABLE_NAME=\"member_block\"
UNION ALL SELECT \"drill_block\", COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=\"ygy_ai_restore_drill\" AND TABLE_NAME=\"member_block\"
UNION ALL SELECT \"live_moderation\", COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=\"ygy_ai\" AND TABLE_NAME=\"moderation_record\"
UNION ALL SELECT \"drill_moderation\", COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=\"ygy_ai_restore_drill\" AND TABLE_NAME=\"moderation_record\"
UNION ALL SELECT \"live_action\", COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=\"ygy_ai\" AND TABLE_NAME=\"management_action\"
UNION ALL SELECT \"drill_action\", COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=\"ygy_ai_restore_drill\" AND TABLE_NAME=\"management_action\";
"' > "$work/counts.txt"
value() {
  awk -v key="$1" '$1 == key { print $2; found = 1 } END { if (!found) exit 1 }' "$work/counts.txt"
}
live=$(value live)
drill=$(value drill)
test "$live" = "$drill"
test "$(value live_block)" = "1"
test "$(value drill_block)" = "1"
test "$(value live_moderation)" = "1"
test "$(value drill_moderation)" = "1"
test "$(value live_action)" = "1"
test "$(value drill_action)" = "1"
printf 'restore drill ok %s articles=%s\n' "$(basename "$mysql_enc")" "$live"
