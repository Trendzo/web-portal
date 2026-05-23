#!/bin/bash
# Drive the full retailer/admin flow through Vite's API proxy (5173 -> 3099) so the
# exact path the SPA uses is exercised. Run after both backend dev (:3099) and
# dashboard dev (:5173) are up.
set -uo pipefail

BASE="http://127.0.0.1:5173/api/v1"
PASS=0; FAIL=0
say()  { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
pass() { printf "  \033[1;32m✓\033[0m %s\n" "$*"; PASS=$((PASS+1)); }
fail() { printf "  \033[1;31m✗\033[0m %s — %s\n" "$*" "$BODY"; FAIL=$((FAIL+1)); }

hit() {
  local m="$1" p="$2" data="${3:-}" auth="${4:-}"
  local args=(-sS -o /tmp/.dbody -w '%{http_code}' -X "$m")
  [[ -n "$auth" ]] && args+=(-H "Authorization: Bearer $auth")
  [[ -n "$data" ]] && args+=(-H 'Content-Type: application/json' --data "$data")
  args+=("$BASE$p")
  STATUS=$(curl "${args[@]}")
  BODY=$(cat /tmp/.dbody)
}
expect() { [[ "$STATUS" == "$1" ]] && pass "$2 [HTTP $STATUS]" || fail "$2 (expected $1, got $STATUS)"; }

#───────────────────────────────────────────────────────
say '0. Catalog defaults reachable via proxy'
hit GET /catalog/categories;     expect 200 'GET /catalog/categories'
CAT_ID=$(jq -r '.data[0].id' </tmp/.dbody)
hit GET /catalog/brands;         expect 200 'GET /catalog/brands'
BRAND_ID=$(jq -r '.data[0].id' </tmp/.dbody)
echo "  brand=$BRAND_ID  category=$CAT_ID"

say '1. Admin login'
hit POST /auth/admin/login '{"email":"admin@trendzo.local","password":"admin1234"}'
expect 200 'admin login'
ADMIN=$(jq -r '.data.token' </tmp/.dbody)

say '2. Retailer signup (auto-KYC)'
EMAIL="dash$(date +%s)@example.com"
hit POST /auth/retailer/signup "$(jq -nc --arg e "$EMAIL" \
  '{email:$e, password:"secret123", legalName:"Dashboard Tester", phone:"+919876543210", gstin:"27AAAPL1234C1Z5"}')"
expect 200 'retailer signup'
RTOK=$(jq -r '.data.token' </tmp/.dbody)
RID=$(jq -r '.data.retailer.id' </tmp/.dbody)

say '3. Retailer /me'
hit GET /retailer/me '' "$RTOK"; expect 200 'GET /retailer/me'

say '4. Create store (still pending_approval — should fail with 403 retailer_not_approved on /listings later)'
hit POST /retailer/store '{"legalName":"Dash Store","address":"42 Linking Rd","stateCode":"27","lat":19.06,"lng":72.83,"platformFeeBp":500,"payoutCadenceDays":7}' "$RTOK"
expect 200 'POST /retailer/store'
SID=$(jq -r '.data.id' </tmp/.dbody)

say '5. Admin approves retailer'
hit POST "/admin/retailers/$RID/approve" '' "$ADMIN"
expect 200 "approve retailer"

say '6. Admin approves store'
hit POST "/admin/stores/$SID/approve" '' "$ADMIN"
expect 200 "approve store"

say '7. Retailer creates listing (active) and a variant'
LISTING_BODY=$(jq -nc --arg b "$BRAND_ID" --arg c "$CAT_ID" \
  '{name:"Dash Linen Shirt", brandId:$b, categoryId:$c, gender:"him", badge:"new", listingPolicy:"return", status:"active", galleryUrls:[], hsn:"6105"}')
hit POST /retailer/listings "$LISTING_BODY" "$RTOK"
expect 200 'create listing'
LID=$(jq -r '.data.id' </tmp/.dbody)

VAR_BODY='{"attributes":{"size":"M","color":"Black"},"attributesLabel":"M / Black","sku":"DASH-M-BLK","pricePaise":99900,"stock":12}'
hit POST "/retailer/listings/$LID/variants" "$VAR_BODY" "$RTOK"
expect 200 'create variant'
VID=$(jq -r '.data.id' </tmp/.dbody)

say '8. Inventory update via PATCH'
hit PATCH "/retailer/variants/$VID" '{"pricePaise":89900,"stock":24}' "$RTOK"
expect 200 'patch inventory'

say '9. Bad path: variant with bad price → 422'
hit POST "/retailer/listings/$LID/variants" '{"attributes":{"size":"S"},"attributesLabel":"S","pricePaise":-1,"stock":1}' "$RTOK"
expect 422 'reject negative price'

say '10. Bad path: cross-domain token (admin -> retailer) → 403'
hit GET /retailer/me '' "$ADMIN"; expect 403 'admin token rejected on /retailer'

say '11. Collections: admin creates draft collection'
SLUG="dash-edit-$(date +%s)"
COL_BODY=$(jq -nc --arg s "$SLUG" '{slug:$s, name:"Dash Editorial", kind:"edit", gender:"unisex"}')
hit POST /admin/collections "$COL_BODY" "$ADMIN"
expect 200 'create collection'
COL_ID=$(jq -r '.data.id' </tmp/.dbody)

say '12. Collections: list (admin) and confirm presence'
hit GET /admin/collections '' "$ADMIN"; expect 200 'list collections'
jq -e --arg id "$COL_ID" '.data | any(.id == $id)' </tmp/.dbody > /dev/null \
  && pass 'newly-created collection appears in admin list' \
  || fail 'admin list missing the collection'

say '13. Collections: PUT listings (membership replace) + GET detail'
hit PUT "/admin/collections/$COL_ID/listings" "$(jq -nc --arg lid "$LID" '{listingIds:[$lid]}')" "$ADMIN"
expect 200 'put listings'
hit GET "/admin/collections/$COL_ID" '' "$ADMIN"; expect 200 'get detail'
jq -e --arg lid "$LID" '.data.listings | length == 1 and .[0].id == $lid' </tmp/.dbody > /dev/null \
  && pass 'detail returns the listing roster' \
  || fail 'detail roster mismatch'

say '14. Collections: PATCH to active and verify public catalog read by slug'
hit PATCH "/admin/collections/$COL_ID" '{"status":"active"}' "$ADMIN"; expect 200 'activate collection'
hit GET "/catalog/collections/$SLUG"; expect 200 'public read by slug'
jq -e --arg id "$COL_ID" '.data.id == $id' </tmp/.dbody > /dev/null \
  && pass 'public slug lookup matches' \
  || fail 'slug lookup mismatch'

say '15. Collections: draft slug returns 404 publicly'
DRAFT_SLUG="dash-draft-$(date +%s)"
hit POST /admin/collections "$(jq -nc --arg s "$DRAFT_SLUG" '{slug:$s, name:"Dash Draft", kind:"trend", gender:"her"}')" "$ADMIN"
expect 200 'create draft'
hit GET "/catalog/collections/$DRAFT_SLUG"; expect 404 'draft hidden from public'

say '16. Collections: bad path — invalid listing id rejected'
hit PUT "/admin/collections/$COL_ID/listings" '{"listingIds":["lst_notreal"]}' "$ADMIN"
expect 404 'rejects unknown listing id'

say '17. Brands: case-insensitive name uniqueness'
SUFFIX=$(date +%s)
hit POST /admin/brands "$(jq -nc --arg s "puma-$SUFFIX" '{slug:$s, name:"Puma"}')" "$ADMIN"
expect 200 'create brand Puma'
B_ID=$(jq -r '.data.id' </tmp/.dbody)
hit POST /admin/brands "$(jq -nc --arg s "puma2-$SUFFIX" '{slug:$s, name:"PUMA"}')" "$ADMIN"
expect 409 'reject case-insensitive duplicate (PUMA)'
hit POST /admin/brands "$(jq -nc --arg s "puma3-$SUFFIX" '{slug:$s, name:"puma"}')" "$ADMIN"
expect 409 'reject case-insensitive duplicate (puma)'

say '18. Brands: delete cascades brandId to NULL — listings stay visible'
# Create a new listing using this brand, then delete the brand.
LB_BODY=$(jq -nc --arg b "$B_ID" --arg c "$CAT_ID" \
  '{name:"Brand-Drop Test", brandId:$b, categoryId:$c, gender:"unisex", badge:"none", listingPolicy:"return", status:"draft", galleryUrls:[]}')
hit POST /retailer/listings "$LB_BODY" "$RTOK"
expect 200 'create listing on the new brand'
TLID=$(jq -r '.data.id' </tmp/.dbody)
hit DELETE "/admin/brands/$B_ID" '' "$ADMIN"; expect 200 'delete brand'
jq -e '.data.listingsUnbranded == 1' </tmp/.dbody > /dev/null \
  && pass 'response surfaces orphan count' \
  || fail "expected listingsUnbranded=1, got: $(cat /tmp/.dbody)"
hit GET "/retailer/listings" '' "$RTOK"; expect 200 'orphan listing still readable in retailer list'
jq -e --arg id "$TLID" '.data | any(.id == $id and .brandId == null)' </tmp/.dbody > /dev/null \
  && pass 'orphan listing kept, brandId set to null' \
  || fail "expected orphan listing with null brandId in list"

say '19. Categories: tree creation + reparent + cycle guard'
ROOT_BODY=$(jq -nc --arg s "tops-$SUFFIX" '{slug:$s, label:"Tops", gender:"unisex"}')
hit POST /admin/categories "$ROOT_BODY" "$ADMIN"; expect 200 'create root category'
ROOT_ID=$(jq -r '.data.id' </tmp/.dbody)
CHILD_BODY=$(jq -nc --arg s "crop-tops-$SUFFIX" --arg p "$ROOT_ID" '{slug:$s, label:"Crop Tops", gender:"her", parentId:$p}')
hit POST /admin/categories "$CHILD_BODY" "$ADMIN"; expect 200 'create child category'
CHILD_ID=$(jq -r '.data.id' </tmp/.dbody)
# Cycle: try to reparent root under its own child
hit PATCH "/admin/categories/$ROOT_ID" "$(jq -nc --arg p "$CHILD_ID" '{parentId:$p}')" "$ADMIN"
expect 422 'cycle guard blocks reparent'
# Self-parent
hit PATCH "/admin/categories/$ROOT_ID" "$(jq -nc --arg p "$ROOT_ID" '{parentId:$p}')" "$ADMIN"
expect 422 'self-parent rejected'

say '20. Categories: delete blocked while children exist'
hit DELETE "/admin/categories/$ROOT_ID" '' "$ADMIN"; expect 409 'parent-with-children blocked'
hit DELETE "/admin/categories/$CHILD_ID" '' "$ADMIN"; expect 200 'leaf delete ok'
hit DELETE "/admin/categories/$ROOT_ID" '' "$ADMIN"; expect 200 'root delete ok after leaf gone'

printf "\n\033[1;33mResults\033[0m  PASS: \033[1;32m%d\033[0m  FAIL: \033[1;31m%d\033[0m\n" "$PASS" "$FAIL"
[[ "$FAIL" == 0 ]] && exit 0 || exit 1
