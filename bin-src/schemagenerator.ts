#!/usr/bin/env node
/* #!/usr/bin/env -S node --experimental-modules */

import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import isDirectory from 'is-directory';
import Generator from './Generator.js';

// https://github.com/75lb/command-line-usage


export interface IProgramOptions {
	force: boolean;
	out: string;
	src: string;
	pkgPath: string;
	verbose?: boolean
	help?: boolean
}

const optionDefinitions = [
	{
		name: 'help',
		alias: 'h',
		type: Boolean,
		description: 'Display this usage guide.'
	},
	{ name: 'verbose', alias: 'v', type: Boolean },
	{ name: 'src', type: String, multiple: false, defaultOption: true },
	{ name: 'out', type: String },
	{ name: 'pkgPath', type: String },
	{ name: 'force', alias: 'f', type: Boolean }
]


const options : IProgramOptions = commandLineArgs(optionDefinitions) as IProgramOptions;

const usage = commandLineUsage([
	{
		header: 'CouchDB Schema Generator',
		content: 'Generates schema files for {italic CouchDB}. JSON files in a directory are loaded and turned into typescript schema files, and output in the destination directory'
	},
	{
		header: 'Options',
		optionList: [
			{
				name: 'help',
				description: 'Display this usage guide.',
				alias: 'h',
				type: Boolean
			},
			{
				name: 'src',
				description: 'The source directory. All json files in this directory will be processed',
				type: String,
				multiple: false,
				defaultOption: true,
				//typeLabel: '{underline file} ...'
			},
			{
				name: 'pkgPath',
				description: 'Override for the couch-schema import line',
				type: String,
				defaultValue: 'couch-schema'
			},
			{
				name: 'out',
				type: String,
				description: "The output directory. This directory must exist, it will not be created"
			},
			{
				name: 'force',
				type: Boolean,
				description: "If the output file exists, force overwrite it."
			}
		]
	},
	// {
	// 	content: 'Project home: {underline https://github.com/me/example}'
	// }
	{
		header: 'Usage',
		content: [
			'$ schema-generator [{bold --verbose}] [{bold --force|-f}] {bold --out} {underline directory} [{bold --src}] {underline directory}',
			'$ schema-generator {bold --help}'
		]
	},
])

if (options.help) {
	console.log(usage);
	process.exit(0);
}

let commandError = (msg) => {
	console.error("Error: " + msg);
	console.error("Use --help to get help");
	process.exit(1);
}

let checkDirectory = (dir, msg) => {
	if (!dir || typeof dir !== 'string') {
		commandError(`Missing ${msg} directory`);
	}
	
	if (!isDirectory.sync(dir)) {
		commandError(`Invalid ${msg} directory ${dir}`);
	}
}
// console.log(options)
checkDirectory(options.src, "source");
checkDirectory(options.out, "destination");


async function main() {
	let g = new Generator(options);
	await g.run();
}

main();
