set -e
#npm install
npm run prestart:copysrc
npm run prestart:copyassets
npx tsc -noEmit
npx esbuild src/scripts/ui.ts --sourcemap --bundle --outfile=build/ui.js

#on first start run "npm install"
#npm outdated
#npm update
# updated also package-lock.json
#npm install

