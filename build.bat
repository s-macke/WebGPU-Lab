call npm run prestart
rem npx tsc -noEmit
call npx esbuild src\scripts\ui.ts --bundle --outfile=build\src\ui.js



