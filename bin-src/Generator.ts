import { debug } from "console";
import { readFileSync } from "fs";
import { TOptBoolean, TOptString, TBoolean, TDate, TDateTime, TNumber, TString, TTimestamp } from "../src/Types.mjs";
// glob suffers from a circular dependency when using rollup
// import glob from "glob";
import glob from "fast-glob";
import _ from "lodash";

import { GeneratorError } from "./GeneratorError.js";
import { JsonSchema } from "./JsonSchema.js";
import { JsonSchemaFieldInfo } from "./JsonSchemaFieldInfo.js";
import { IProgramOptions } from "./schemagenerator.js";
import { Writer } from "./Writer.js";

type validtypes = 'number' | 'string' | 'boolean';
type JsonSchemaBasicType = "string" | "optstring" | "boolean" | "optboolean" | "number" | "date" | "datetime" | "timestamp";
const BASIC_TYPES = ["string", "optstring", "boolean", "optboolean", "number", "date", "datetime", "timestamp"];

export default class Generator {
	opts: IProgramOptions;
	dict: { [key: string]: JsonSchema };
	writer: Writer;

	constructor(opts: IProgramOptions) {
		this.opts = opts;
		this.dict = {};
		this.writer = new Writer(opts);
	}

	async run() {
		let files = glob.sync(`${this.opts.src}/*.json`);
		if (files.length === 0) {
			console.error("No input files found");
			process.exit(1);
		}

		for (let f of files) {
			this.readFile(f);
		}

		for (let k of Object.keys(this.dict)) {
			// console.log(k);
			try {
				// moved to loading this.checkStructure(this.dict[k]);
				this.populateSubschemas(k);
				this.checkAdditionalImports(k);
			} catch (e) {
				console.error(`Error in ${k}: ${e.message}`);
				process.exit(1);
			}
		}
		try {
			this.checkCircularDependency();
		} catch (e) {
			if (e instanceof GeneratorError) {
				console.error(`Error: ${e.message}`);
				process.exit(1);
			}
			throw (e);
		}

		for (let k of Object.keys(this.dict)) {
			// console.log(k);
			try {
				// moved to loading this.checkStructure(this.dict[k]);
				this.writer.generateFile(k, this.dict[k]);
			} catch (e) {
				if (e instanceof GeneratorError)
					console.error(`Error generating file for ${k}: ${e.message}`);
				else throw e;
			}
		}

		this.writer.createInitializer(Object.keys(this.dict));
	}

	/**
	 * Read a file and add it to the dictionary
	 * @param {string} filename file path and name
	 */
	async readFile(filename: string) {
		try {
			let buf = readFileSync(filename);
			let obj: any = JSON.parse(buf.toString());
			obj['filename'] = filename;
			//this.dict[name] = obj;
			this.dict[obj['name']] = this.checkStructure(obj)
			// this.versions[name] = obj['version'];
			debug(`loaded file ${filename}`);
		} catch (e) {
			if (e instanceof GeneratorError) {
				console.error(`Error reading ${filename}: ${e.message}`);
				process.exit(1);
			}
			throw e;
		}
	}

	/**
	 * Check that the structure is correct, and return an object
	 * updated to the JsonSchema
	 * @param {string} obj The schema name 
	 * @param {*} fields The schema definition 
	 */
	private checkStructure(obj: any): JsonSchema {
		let jso = (obj as JsonSchema);
		let name = jso.name; // obj['name'];
		let fields = obj['fields'];
		if (name === undefined)
			throw new GeneratorError("No 'name' field");
		if (fields === undefined)
			throw new GeneratorError("No 'fields' field");
		if (typeof obj['version'] !== 'number')
			throw new GeneratorError(`'version' field must exist and must be a number`);
		if (this.dict[name] !== undefined) {
			throw new GeneratorError(`'${name}' already exists. Check for duplicates in the source files.`);
		}
		for (let k of Object.keys(fields)) {
			// debug(`Checking ${obj.name}.fields.${k}`);

			switch (k) {
				case "get":
				case "set":
				case "doctype__":
					throw new GeneratorError(`${k} is a reserved keyword.`);
				case "_id":
					throw new GeneratorError(`${k} is not required in a schema.`);
				case "id":
					throw new GeneratorError(`CouchDB already has an _id field, using 'id' as a field name is dangerous.`);
				default:
					break;
			}
			if (k[0] === "_")
				throw new GeneratorError(`${k} : leading underscores not permitted by CouchDB.`)

			let _isArray = false;
			let field = fields[k];
			if (Array.isArray(field)) {
				let ar: unknown[] = field;
				if (ar.length !== 1)
					throw new GeneratorError(`${k} is an array but should have exactly one element.`);
				fields[k] = ar[0];
				_isArray = true;
			}
			// replace any simple type with an object
			// these are clones to avoid any circular dependency detection
			if (typeof field === 'string') {
				switch (field.toLowerCase()) {
					case 'string':
						fields[k] = _.clone(TString);
						break;
					case 'optstring':
						fields[k] = _.clone(TOptString);
						break;
					case 'boolean':
						fields[k] = _.clone(TBoolean);
						break;
					case 'optboolean':
						fields[k] = _.clone(TOptBoolean);
						break;
					case 'number':
						fields[k] = _.clone(TNumber);
						break;
					case 'date':
						fields[k] = _.clone(TDate);
						break;
					case 'datetime':
						fields[k] = _.clone(TDateTime);
						break;
					case 'timestamp':
						fields[k] = _.clone(TTimestamp);
						break;
					default:
						throw new GeneratorError(`unknown field type '${field}' for ${k}`);
				}
				// shortcut since the rest of the data is fine
				fields[k]._isArray = _isArray;
				continue;
			}

			if (typeof field !== 'object')
				throw new GeneratorError(`${k} is not a valid object, array or string`);

			fields[k]._isArray = _isArray;
			let checkIsValid = (subfield: string, types: validtypes[], required: boolean = false) => {
				let v = fields[k][subfield];
				if (required && typeof v === 'undefined') {
					throw new GeneratorError(`${k}.${subfield} is missing`);
				}
				if (typeof v === 'undefined')
					return;

				let tov: string = typeof v;
				//@ts-expect-error
				if (types.includes(tov))
					return;
				throw new GeneratorError(`${k}.${subfield} has to be ${types.length > 1 ? "one of" : ""} ${types.join(",")}`);
			}

			// check other fields
			checkIsValid('type', ['string']);
			checkIsValid('values', ['string']);
			checkIsValid('validate', ['string']);
			checkIsValid('formatter', ['string']);
			checkIsValid('validateFailMsg', ['string']);
			checkIsValid('min', ['number', 'string']);
			checkIsValid('max', ['number', 'string']);
			let calcRequired = fields[k]['type'] === 'calculated';
			checkIsValid('calculator', ['string'], calcRequired);
			checkIsValid('calculatedType', ['string'], calcRequired);

			// check required field
			if (typeof fields[k].required === 'undefined')
				fields[k].required = true;
			else if (typeof fields[k].required === 'string') {
				let rs = (fields[k].required as string).toLowerCase();
				if (!['false', 'true'].includes(rs))
					throw new GeneratorError(`${k}.required invalid value ${fields[k].required}`);
				fields[k].required = rs === "true";
			}
			else if (typeof fields[k].required !== 'boolean')
				throw new GeneratorError(`${k}.required invalid type ${typeof fields[k].required}`);
		}


		if (jso.customImportLines !== undefined) {
			if (!Array.isArray(jso.customImportLines))
				throw new GeneratorError(`customImportLines must be an array`);
		}
		jso.imports = [];
		return (obj as JsonSchema);
	}

	/**
	 * Atttach all the subschema objects to this schema.
	 * This adds the field 'object' to the object at each
	 * key that is a subschema
	 * @param {string} schema The schema name 
	 */
	private populateSubschemas(schemaName: string) {
		let schema = this.dict[schemaName];
		let fields = schema.fields;
		for (let k of Object.keys(fields)) {
			if (fields[k].type === "subschema") {
				let subschemaName = fields[k].schema as string;
				if (subschemaName === undefined) {
					throw new GeneratorError(`${schema.name} missing 'schema' field for field '${k}'`);
				}
				let subschema = this.dict[subschemaName];
				if (subschema === undefined) {
					throw new GeneratorError(`${schema.name} field '${k}' refers to missing subschema named ${subschemaName}`);
				}
				schema.imports.push(subschemaName);
				fields[k].schema = subschema;
			}
		}
	}

	/**
	 * Check for any additional imports like DateOnly
	 * @param schemaName the schema name
	 */
	private checkAdditionalImports(schemaName: string) {
		let schema = this.dict[schemaName];
		let fields = schema.fields;
		for (const [key, value] of Object.entries(fields)) {
			if (value.type === 'date')
				schema.requiresDateOnly = true;
		}

	}

	/**
	 * Check if any of the field definitions in a schema have 
	 * a circular reference back to itself
	 */
	private checkCircularDependency() {
		for (let k of Object.keys(this.dict)) {
			let schema = this.dict[k];
			// debug(`checking ${schema.name} for circular dependencies`);
			let res = this.isCyclic(schema.fields);
			if (res.cyclic) {
				throw new GeneratorError(`${schema.name} is in a circular dependency ${res.msg}`);
			}
		}
	}

	private isCyclic(obj: any): { cyclic: boolean, msg: string } {
		var seenObjects = [];
		function detect(obj): { cyclic: boolean, msg: string } {
			if (obj && typeof obj === 'object') {
				if (seenObjects.indexOf(obj) !== -1) {
					return { cyclic: true, msg: "" };
				}
				seenObjects.push(obj);
				for (var key in obj) {
					if (obj.hasOwnProperty(key) && detect(obj[key]).cyclic) {
						return { cyclic: true, msg: 'cycle at ' + key };
					}
				}
			}
			return { cyclic: false, msg: "" };
		}
		return detect(obj);
	}

	/**
	 * Get an array containing all the names of the subschemas
	 * from the fields of a schema
	 * @param {*} fields a schema definition fields
	 * @returns {string[]} names of all subschemas
	 */
	private getSubschemas(schema: JsonSchema): string[] {
		let fields = schema.fields;
		let rv = [];
		for (let k of Object.keys(fields)) {
			if (fields[k].type === 'subschema') {
				rv.push(fields[k].schema)
			}
		}
		rv = rv.reduce((pv, cv) => {
			if (pv.includes(cv)) {
				return pv;
			}
			return pv.push(cv);
		});
		return rv;
	}

}