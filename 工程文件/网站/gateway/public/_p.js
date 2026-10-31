const fs = require('fs');
let s = fs.readFileSync('95_permissions.sh', 'utf8');
// 在 mkid 定义后插一个 verbose 版本用于诊断
s = s.replace("mkid() {", `mkidv() { # verbose 诊断版
  HID="c2v-$1-$(openssl rand -hex 6)"
  echo "[诊断] approve-handoff 调用:"
  $CURL -w "\\n[approve HTTP %{http_code}]\\n" -H "$AUTH" -H 'Content-Type: application/json' -d "{\\"handoffId\\":\\"$HID\\",\\"displayName\\":\\"$2\\"}" -X POST "$B/api/admin/dev/approve-handoff" | head -c 400
  echo
  echo "[诊断] poll 调用:"
  $CURL -w "\\n[poll HTTP %{http_code}]\\n" "$B/api/workshop/login-handoff?handoffId=$HID&secret=battery-placeholder-2026" | head -c 300
  echo
}
mkid() {`);
fs.writeFileSync('95_permissions.sh', s);
console.log('mkidv 已插入');
