set -e
npm run prestart
npx tsc -noEmit
npx esbuild src/scripts/ui.ts --bundle --outfile=build/src/ui.js
#cp node_modules/@webgpu/glslang/dist/web-devel/glslang.wasm build/src/

#on first start run "npm install"
#npm outdated
#npm update
# updated also package-lock.json
#npm install
#npm run prestart
