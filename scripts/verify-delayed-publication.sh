#!/usr/bin/env bash
# Reconcile a completed npm write whose original hosted registry check timed out.
set -euo pipefail
[[ "$GITHUB_EVENT_NAME" == workflow_dispatch && "$GITHUB_REF" == refs/heads/main ]]
[[ "$TAG" =~ ^(lyra-(ui|ide|translations|docs|gen|flags|map|3d))@((0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))$ ]]
package=${BASH_REMATCH[1]}
version=${BASH_REMATCH[3]}
[[ "$TAG_OBJECT" =~ ^[a-f0-9]{40}$ && "$SOURCE_SHA" =~ ^[a-f0-9]{40}$ && "$EXPECTED_SHA256" =~ ^[a-f0-9]{64}$ ]]
[[ "$PUBLISH_RUN" =~ ^[1-9][0-9]*$ && "$ATTEMPT" =~ ^[1-9][0-9]*$ ]]
repo=$GITHUB_REPOSITORY
api="repos/$repo/actions/runs/$PUBLISH_RUN"
archive="aceshooting-$package-$version.tgz"
temp=$(mktemp -d "$RUNNER_TEMP/registry-verify.XXXXXXXX")
trap 'rm -rf -- "$temp"' EXIT

bind_tag() {
  gh api "repos/$repo/git/ref/tags/$TAG" | jq -e --arg ref "refs/tags/$TAG" --arg oid "$TAG_OBJECT" \
    '.ref==$ref and .object.type=="tag" and .object.sha==$oid' >/dev/null
  gh api "repos/$repo/git/tags/$TAG_OBJECT" | jq -e --arg tag "$TAG" --arg sha "$SOURCE_SHA" \
    '.tag==$tag and .object.type=="commit" and .object.sha==$sha' >/dev/null
}
bind_tag
gh api "$api" | jq -e --arg repo "$repo" --arg tag "$TAG" --arg sha "$SOURCE_SHA" --arg attempt "$ATTEMPT" \
  '.repository.full_name==$repo and .head_repository.full_name==$repo and .path==".github/workflows/publish.yml" and
   .event=="workflow_dispatch" and .head_branch==$tag and .head_sha==$sha and .status=="completed" and
   .conclusion=="failure" and (.run_attempt|tostring)==$attempt' >/dev/null
gh api --paginate --slurp "$api/attempts/$ATTEMPT/jobs?per_page=100" > "$temp/jobs.json"
jq -e '
  [.[].jobs[]] as $jobs |
  [$jobs[]|select(.name=="verify / verify" and .conclusion=="success")]|length==1' "$temp/jobs.json" >/dev/null
jq -e '
  [.[].jobs[]|select(.name=="publish" and .conclusion=="failure")]|select(length==1)|.[0].steps as $s|
  ([$s[]|select(.conclusion=="failure")|.name]==["Confirm the registry serves the published tarball"]) and
  ([$s[]|select(.conclusion=="success" and (.name=="Publish to npm" or .name=="Publish with protected npm token and provenance"))]|length==1) and
  (["Generate release provenance","Upload provenance to GitHub release","Generate standalone release provenance","Upload standalone release provenance"] -
   [$s[]|select(.conclusion=="success")|.name]|length==0)' "$temp/jobs.json" >/dev/null
gh api "$api/approvals" | jq -e 'any(.[]; .state=="approved" and any(.environments[]; .name=="npm-publish"))' >/dev/null
gh release view "$TAG" --repo "$repo" --json tagName,isDraft,isPrerelease | jq -e --arg tag "$TAG" \
  '.tagName==$tag and .isDraft==false and .isPrerelease==false' >/dev/null

for artifact in verified-release-tarball verified-additional-release-assets; do
  gh run download "$PUBLISH_RUN" --repo "$repo" --name "$artifact" --dir "$temp/$artifact"
done
gh release download "$TAG" --repo "$repo" --pattern '*' --dir "$temp/live"
base="$temp/verified-additional-release-assets"
live="$temp/live"
export TARBALL="$live/$archive"
[[ -f "$base/SHA256SUMS" && ! -L "$base/SHA256SUMS" ]]
[[ -f "$temp/verified-release-tarball/$archive" && ! -L "$temp/verified-release-tarball/$archive" ]]
[[ $(find "$temp/verified-release-tarball" -mindepth 1 -maxdepth 1 | wc -l) -eq 1 ]]
files=("$archive")
while IFS= read -r line; do
  [[ "$line" =~ ^[0-9a-f]{64}'  '([A-Za-z0-9][A-Za-z0-9._-]*)$ ]]
  name=${BASH_REMATCH[1]}
  [[ "$name" != SHA256SUMS && "$name" != "$archive" && -f "$base/$name" && ! -L "$base/$name" ]]
  files+=("$name")
done < "$base/SHA256SUMS"
[[ ${#files[@]} -ge 3 && $(printf '%s\n' "${files[@]}" | sort -u | wc -l) -eq ${#files[@]} ]]
[[ $(find "$base" -mindepth 1 -maxdepth 1 | wc -l) -eq ${#files[@]} ]]
[[ $(find "$live" -mindepth 1 -maxdepth 1 | wc -l) -eq $((3 * ${#files[@]})) ]]
(cd "$base" && sha256sum --strict --check SHA256SUMS)
verify=(gh attestation verify --repo "$repo" --cert-identity "https://github.com/$repo/.github/workflows/publish.yml@refs/tags/$TAG"
        --cert-oidc-issuer https://token.actions.githubusercontent.com --signer-digest "$SOURCE_SHA"
        --source-ref "refs/tags/$TAG" --source-digest "$SOURCE_SHA" --deny-self-hosted-runners)
invocation="https://github.com/$repo/actions/runs/$PUBLISH_RUN/attempts/$ATTEMPT"
verify_original_attestation() {
  "${verify[@]}" "$@" --format json |
    jq -e --arg invocation "$invocation" \
      'any(.[]; .verificationResult.signature.certificate.runInvocationURI==$invocation)' >/dev/null
}
for name in "${files[@]}"; do
  for suffix in '' .sigstore.json .intoto.jsonl; do [[ -f "$live/$name$suffix" && ! -L "$live/$name$suffix" ]]; done
  source="$base/$name"
  if [[ "$name" == "$archive" ]]; then source="$temp/verified-release-tarball/$archive"; fi
  cmp "$source" "$live/$name"
  cmp "$live/$name.sigstore.json" "$live/$name.intoto.jsonl"
  verify_original_attestation "$live/$name" --bundle "$live/$name.sigstore.json"
done
node scripts/verify-npm-publication.mjs
# npm publishes SLSA provenance over the SHA-512 release digest.
url="https://registry.npmjs.org/-/npm/v1/attestations/@aceshooting%2f$package@$version"
curlargs=(--fail --silent --show-error --proto '=https' --tlsv1.2 --connect-timeout 10 --max-time 30 --max-filesize 1048576)
curl "${curlargs[@]}" "https://registry.npmjs.org/%40aceshooting%2F$package/$version" |
  jq -e --arg url "$url" '.dist.attestations.url==$url and .dist.attestations.provenance.predicateType=="https://slsa.dev/provenance/v1"' >/dev/null
curl "${curlargs[@]}" "$url" |
  jq -e '[.attestations[]|select(.predicateType=="https://slsa.dev/provenance/v1")|.bundle]|
          if length==1 then .[0] else error("Expected one npm provenance bundle") end' > "$temp/npm.bundle.json"
verify_original_attestation "$TARBALL" --digest-alg sha512 --bundle "$temp/npm.bundle.json"
bind_tag
printf 'Verified %s at commit %s, tag object %s, SHA-256 %s; original Publish %s attempt %s.\n' \
  "$TAG" "$SOURCE_SHA" "$TAG_OBJECT" "$EXPECTED_SHA256" "$PUBLISH_RUN" "$ATTEMPT" >> "$GITHUB_STEP_SUMMARY"
