/**
 * @module Schema
 * @requires lodash
 */
import _ from "lodash";
import debugModule from 'debug';
import { DateOnly } from "./DateOnly.mjs";
const debug = debugModule('couch-schema');

/**
 * The type of a field
 * @type SchemaFieldType
 * @memberof SchemaFieldInfo
 */
type SchemaFieldType = "string" | "boolean" | "number" | "date" | "datetime" | "timestamp" | "buffer" | "array" | "schema" | "subschema" | "calculated";

/**
 * Info about a field
 * @memberof SchemaDefinition
 */
export interface SchemaFieldInfo<T> {
	/** the type of the field */
	type: SchemaFieldType;
	/** default value, if any */
	default?: any;
	/** 
	 * A function to validate input. If it throws an Error, Error.message 
	 * will be used as validation failure text. 
	 * param {T} v the data to validate
	 * param {*} any additional data the validator needs
	 * see {@link validateFailMsg|validateFailMsg}
	 **/
	validate?: (v: T, data?: any) => boolean;
	/** a validation failure message. this is used if the validation function does not throw an error */
	validateFailMsg?: string;

	/** 
	 * A function to format input. If it throws an Error, Error.message 
	 * will be used as validation failure text. 
	 * param {T} v the data to validate
	 * param {*} any additional data the validator needs
	 **/
	formatter?: (v: T, data?: any) => T;

	/** If field is required */
	required?: boolean;
	/** Minimum value. For arrays, indicates minimum array length, strings the minimum length */
	min?: number | Date | DateOnly;
	/** Maximum value. For arrays, max number of elements, for strings max string length */
	max?: number | Date | DateOnly;

	/** a function called for calculated fields */
	calculator?: string;
	/** a typescript style fenced values list */
	values?: string;
}

/**
 * A schema
 * @interface SchemaDefinition
 */
export interface SchemaDefinition {
	/** field to schema definition */
	[index: string]: Schema | Schema[] | SchemaFieldInfo<any> | SchemaFieldInfo<any>[];
}

/**
 * A database record schema
 * @param {SchemaDefinition} v Schema definition
 */
export class Schema {
	private _definition: SchemaDefinition;
	readonly schema_version__;
	readonly schemaUpdater: (obj: any) => { changed: boolean, obj: any };

	constructor(schemaVersion: number, updater: (obj: any) => { changed: boolean, obj: any }, v: SchemaDefinition) {
		this._definition = v;
		this.schema_version__ = schemaVersion;
		this.schemaUpdater = updater;

		for (const name in this._definition) {
			let schInfo = this._definition[name];
			let sfi: SchemaFieldInfo<any> | undefined;

			if (Array.isArray(schInfo)) {
				if (!(schInfo[0] instanceof Schema)) {
					sfi = schInfo[0] as SchemaFieldInfo<any>;
				}
			} else {
				if (!(schInfo instanceof Schema)) {
					sfi = schInfo;
				}
			}
			if (sfi !== undefined) {
				// set required to default true
				if (sfi.required === undefined) {
					sfi.required = true;
				}
			}
		}
	}

	/**
	 * Returns a clone of this schema's info
	 */
	public get info(): SchemaDefinition {
		return _.cloneDeep(this._definition);
	}

	/**
	 * Get the names of all the fields in a schema, returned as an
	 * array of strings.
	 * @returns {string[]} array of field names for this schema
	 */
	public getFields(): string[] {
		return Object.keys(this._definition);
	}

	private mergeResult(curRes: ValidationResult, fieldName: string, newRes: ValidationResult) {
		let cfr = curRes.fields[fieldName];
		if (cfr === undefined)
			cfr = true;
		curRes.fields[fieldName] = cfr && newRes.result;
		curRes.result = curRes.result && newRes.result;
		if (!newRes.result) {
			curRes.errors = curRes.errors.concat(newRes.errors);
		}
		return curRes;
	}

	public validate(obj: any, key: string = ""): ValidationResult {
		let rv: ValidationResult = {
			result: true,
			fields: {},
			errors: []
		};
		for (const name in this._definition) {
			let schInfo = this._definition[name];
			rv.fields[`${key}${name}`] = true;
			//schInfo = Schema | Schema[] | SchemaFieldInfo<any> | SchemaFieldInfo<any>[];
			if (Array.isArray(schInfo) && !(schInfo[0] instanceof Schema)) {
				let s = schInfo[0] as SchemaFieldInfo<any>;
				if (s.default !== undefined && obj[name] === undefined) {
					obj[name] = s.default;
				}
				if (s.type === "date") {
					if (typeof obj[name] === 'string')
						obj[name] = DateOnly.ofString(obj[name]);
					else if (obj[name] instanceof Date) {
						obj[name] = DateOnly.ofDate(obj[name]);
					}
				}
				if (s.type === "datetime" && typeof obj[name] === 'string') {
					obj[name] = new Date(obj[name]);
				}
			} else if (!(schInfo instanceof Schema)) {
				let s = schInfo as SchemaFieldInfo<any>;
				if (s.default !== undefined && obj[name] === undefined) {
					obj[name] = s.default;
				}
			}
			rv = this.mergeResult(rv, name, this.validateField(name, obj[name], key));
		}
		return rv;
	}

	public validateField(fieldName: string, value: any, key: string = ""): ValidationResult {
		let keyedName = `${key}${fieldName}`;
		debug(keyedName);

		let rv: ValidationResult = {
			result: true,
			fields: {
				keyedName: true
			},
			errors: []
		};

		let makeResult = (res: string | undefined) => {
			rv.fields[keyedName] = res === undefined;
			rv.result = rv.result && (res === undefined);
			if (res) {
				rv.errors.push({ fieldName: keyedName, error: res });
			}
		}

		let sd = this._definition[fieldName];
		// @todo should we return a ValidationResult here instead of throwing?
		if (sd === undefined)
			throw new Error(`${keyedName} does not exist on this schema`);

		// check if definition and value match for Array types
		if (Array.isArray(sd)) {
			// sd is Schema[] | SchemaFieldInfo<any>[]
			// if (!Array.isArray(value)) {
			// 	rv.result = false;
			// 	rv.fields[keyedName] = false;
			// 	rv.errors.push({ fieldName: keyedName, error: "Expected array value" });
			// 	return rv;
			// }
		}
		else if (Array.isArray(value)) {
			debug(" -- 1");
			rv.result = false;
			rv.fields[keyedName] = false;
			rv.errors.push({ fieldName: keyedName, error: "Not expecting array value" });
			return rv;
		}

		// if our field type is another schema, have that
		// schema validate this field
		if (sd instanceof Schema) {
			debug(" -- 2");
			this.mergeResult(rv, keyedName, sd.validate(value, `${keyedName}.`));
			return rv;
		}

		let singleValueValidate = (keyedName: string, sfi: SchemaFieldInfo<any>, value: any) => {
			// let rv: ValidationResult = {
			// 	result: true,
			// 	fields: {
			// 		keyedName: true
			// 	},
			// 	errors: []
			// };

			debug(` -- singleValueValidate ${keyedName} required: ${sfi.required} value: ${value}`);
			// if we don't require a value and there is none,
			// we're fine. Use === for required, since an undefined
			// value is assumed to mean required
			if (sfi.required === false && (value === undefined || value === null)) {
				debug(' --8');
				return rv;
			}
			if ((sfi.required === undefined || sfi.required) && (value === undefined || value === null)) {
				debug(' -- 9');
				makeResult(`missing field ${keyedName}`);
				return rv;
			}

			try {
				makeResult(this.validateByType(sfi, value));
				makeResult(this.validateMinMax(sfi, value));
			} catch (e) {
				let et = e as Error;
				throw new Error(`Developer Error: Schema for ${this.constructor.name} field ${fieldName}: ${et.message}`);
			}

			let getType = (v: any) => {
				if (Array.isArray(v))
					return "Array<>";
				else if (typeof v === "object" && v.constructor)
					return v.constructor.name;
				return typeof v;
			}
			try {
				if (typeof sfi.validate === "function") {
					let r = sfi.validate(value);
					if (!r) {
						let msg = sfi.validateFailMsg;
						if (msg === undefined || msg.length === 0)
							msg = "Failed validation function";
						msg = msg.replace("%v%", value);
						msg = msg.replace("%t%", getType(value));
						msg = msg.replace("%s%", sfi.type);
						msg = msg.replace("%S%", getType(sd));
						makeResult(msg)
					}
				}
			} catch (e) {
				let et = e as Error;
				throw new Error(`Error in validation function for ${keyedName}: ${et.message}`);
			}

			return rv;
		}

		// check if our schema definition is an array type
		if (Array.isArray(sd)) {
			// sd is Schema[] | SchemaFieldInfo<any>[]
			// grabe the actual value
			sd = sd[0];
			debug(" -- 3");

			// if sd is another Schema, that means that our definition
			// was Schema[], therefore we have to apply sd (of type Schema) to
			// all members of value
			if (sd instanceof Schema) {
				debug(" -- 4");
				for (let i = 0; i < value.length; i++) {
					let key = `${keyedName}[${i}].`;
					this.mergeResult(rv, keyedName, sd.validate(value[i], key));
				}
				return rv;
			}

			debug(" -- 5 " + JSON.stringify(sd));
			// sd is of type SchemaFieldInfo<any>
			if (!Array.isArray(value) && (sd.required || sd.required === undefined)) {
				debug(" -- 6");
				makeResult("expected array value");
				return rv;
			}
			for (let i = 0; i < value.length; i++) {
				let key = `${keyedName}[${i}]`;
				debug(`${key} ${value[i]}`)
				let res = singleValueValidate(key, sd, value[i]);
				this.mergeResult(rv, key, res);
			}
			return rv;
		}

		debug(" -- 7");
		// sd is now of type SchemaFieldInfo
		// and value is a single value
		singleValueValidate(keyedName, sd as SchemaFieldInfo<any>, value);
		return rv;
	}

	/**
	 * Validate data type matches record value
	 * @param {SchemaFieldInfo} info The schema field info
	 * @param {*} v the value to check 
	 * @returns {boolean} true if validation passed
	 * @todo some cases not handled
	 */
	private validateByType(info: SchemaFieldInfo<any>, v: any): string | undefined {
		switch (info.type) {
			case "string":
				return typeof v === "string" ? undefined : "Expected string";
			case "number":
				return typeof v === "number" ? undefined : "Expected number";
			case "boolean":
				return typeof v === "boolean" ? undefined : "Expected boolean";
			case "date":
				return (v instanceof DateOnly) ? undefined : "Expected DateOnly class";
			case "datetime":
				// checks if it is a valid date by calling
				// toString on it, as Date objects can be invalid
				// like new Date("randomstring")
				if (!(v instanceof Date))
					return "Expected Date";
				return Object.prototype.toString.call(v) === '[object Date]' ? undefined : "Expected Date";
			default:
				throw new Error(`Unhandled schema type ${info.type}`);
		}
	}

	/**
	 * Validate field data minimum and maximums
	 * @param {SchemaFieldInfo} info The schema field info
	 * @param {*} v the value to check
	 * @returns {string|undefined} string if there's an error
	 * @todo some cases not handled
	 */
	private validateMinMax(info: SchemaFieldInfo<any>, v: any): string | undefined {
		if (info.min === undefined && info.max === undefined)
			return undefined;
		switch (info.type) {
			case "string":
				if (info.min !== undefined && v.length < info.min)
					return `must be at least ${info.min} characters`;
				if (info.max !== undefined && v.length > info.max)
					return `must be no more than ${info.max} characters`;
				return undefined;
			case "number":
				if (info.min !== undefined && v < info.min) {
					if (info.max !== undefined)
						return `must be between ${info.min}-${info.max}`;
					return `must be at least ${info.min}`;
				}
				if (info.max !== undefined && v.length > info.max) {
					if (info.min !== undefined)
						return `must be between ${info.min}-${info.max}`;
					return `must be at most ${info.max}`;
				}
				return undefined;
			default:
				throw new Error(`validateMinMax ${info.type} not handled`);
		}
	}
} // end class Schema

interface ValidationError {
	fieldName: string,
	error: string
}

interface ValidationResult {
	result: boolean;
	fields: {
		[f: string]: boolean | ValidationResult;
	},
	errors: ValidationError[]
}

interface FieldValidationResult {
	name: string,
	result: boolean;
	errors: ValidationError[]
}