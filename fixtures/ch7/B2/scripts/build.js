const minify = process.argv.includes('--minify');
console.log(`build: done${minify ? ' (minified)' : ''}`);
