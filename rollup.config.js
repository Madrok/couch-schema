import shebang from 'rollup-plugin-preserve-shebang';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import commonjs from '@rollup/plugin-commonjs';

shebang({
    // Override the entry. By default, uses `input` from config:
    //entry: path.resolve(process.cwd(), 'src/foo.js'),

    // You can also set it manually if you want, which will always prepend it:
    shebang: '#!/usr/bin/env -S node --experimental-modules'
})

export default {
	//input: './bin-src/schemagenerator.ts',
	input: './build/bin-src/schemagenerator.js',
	output: {
		file: './bin/schemagenerator.cjs',
		//dir: 'bin',
		format: 'cjs'
	},
	plugins: [
		shebang(),
		commonjs(),
		//typescript({tsconfig: "tsconfig.generator.json"}),
		nodeResolve(),
		//babel(),
	]
};

