
call npm run prestart:copysrc
call npm run prestart:copyassets
rem npx tsc -noEmit
call npx esbuild src\scripts\ui.ts --bundle --outfile=build\src\ui.js



