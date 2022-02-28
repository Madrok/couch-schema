/**
 * @module Model
 */

import nano, { RequestError } from "nano";
import { ModelMismatchError } from "./errors/ModelMismatchError.mjs";
import { Schema } from "./Schema.mjs";
import debugModule from 'debug';
const debug = debugModule('couch-schema');

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


/**
 * The base model class. All documents in a database
 * have a 'doctype__' field, which is essentially its 
 * 'collection' type
 * @param type The field value in each collection record
 * @returns The base model mixin
 */
export function Model<DT>(type: string): any {
	/**
	 * This is the BaseModel documentation
	 * @todo update me
	 */
	class BaseModel {
		private static doctype__: string = type;
		private static _server: nano.DocumentScope<any>;
		protected static _class: any;

		/**
		 * Every descendent of Model must have the nano db
		 * object passed to it. See initModels() function
		 * @param db 
		 */
		static async init(db: nano.DocumentScope<any>, f: any) {
			BaseModel._server = db;
			BaseModel._class = f;
		}

		/**
		 * 
		 * @param id the _id of the record
		 * @returns 
		 */
		static async findById(id: string): Promise<DT | null> {
			try {
				let res = await BaseModel._server.get(id);
				console.log(res);
				if (!!!res)
					return null;
				let rv = new BaseModel._class(res);
				// if (res['type'] === BaseModel.doctype__)
				// 	return new BaseModel._class(res);
				// throw new ModelMismatchError(id, BaseModel.doctype__, res['type']);
				console.log("OK, we good?", rv.doctype__);
				return rv;
			} catch (error) {
				let e = error as RequestError;
				if (e.statusCode === 404) {
					console.log(e.name);
					return null;
				}
				throw e;
			}
		}

		static async find(query: nano.MangoQuery): Promise<nano.MangoResponse<DT>> {
			query.selector['doctype__'] = BaseModel.doctype__;
			// find documents where the name = "Brian" and age > 25.
			// const q = {
			// 	selector: {
			// 		name: { "$eq": "Brian" },
			// 		age: { "$gt": 25 }
			// 	},
			// 	fields: ["name", "age", "tags", "url"],
			// 	limit: 50
			// };
			const response = await BaseModel._server.find(query);
			return response;
		}

		static async findOne(query: nano.MangoQuery) {
			query.limit = 1;
			return await BaseModel.find(query);
		}

		static get type(): string {
			return BaseModel.doctype__;
		}

		////////////////////////////////////////////////////
		////////////// Instance Methods/Members ////////////
		////////////////////////////////////////////////////

		protected _schema: Schema;
		protected _obj: any;

		/**
		 * Construct a new Model based on a schema
		 * @todo When reading in an object, do conversions from JSON to things like Date fields as in the schema
		 * @param schema A schema object
		 * @param obj an initial object
		 */
		constructor(schema: Schema, obj?: any) {
			console.log("CONSTRUCTOR", BaseModel.doctype__);
			this._schema = schema;

			if (obj === undefined) {
				obj = {
					doctype__: BaseModel.doctype__,
					schema_version__: this._schema.schema_version__
				}
			}
			this._obj = obj;
			let rid = obj._id;
			console.log(rid, JSON.stringify(this._obj));

			let oldVer = this._obj.schema_version__;
			if (oldVer === undefined || oldVer !== this._schema.schema_version__) {
				let rv = this._schema.schemaUpdater(this._obj);
				if (rv.changed) {
					console.log(`WARN: record '${rid}' updated from v${oldVer} to v${this._obj.schema_version__}`);
					this._obj = rv.obj;
				}
			}
			if (this._obj.doctype__ !== BaseModel.doctype__) {
				console.log("WTF", this._obj.doctype__, BaseModel.doctype__);
				throw new ModelMismatchError(rid, BaseModel.doctype__, this._obj.doctype__);
			}
		}

		get _doctype(): string {
			return BaseModel.doctype__;
		}

		get _id(): string | undefined { return this._obj._id; }

		/**
		 * The id setter. If _id is set to undefined, the _rev
		 * will be deleted. If id is modified to a new value 
		 * after object is loaded, the _rev will be deleted. 
		 */
		set _id(v: string | undefined) {
			if (v === undefined) {
				delete this._obj._id;
				delete this._obj._rev
				return
			}
			if (v !== this._obj._id && this._obj._rev !== undefined)
				delete this._obj._rev;
			this._obj._id = v;
		}

		get _rev(): string | undefined {
			return this._obj._rev;
		}

		set _rev(v: string | undefined) {
			if (v === undefined) {
				delete this._obj._rev
				return
			}
			this._obj._rev = v;
		}

		/**
		 * 
		 * @param v {string} the field to fetch
		 * @returns The field value, or undefined
		 */
		get(v: string) {
			return this._obj[v];
		}

		/**
		 * Set a field to a value
		 * @param f {string} field name
		 * @param v {*} value
		 * @returns {Model} this model
		 * @todo Complete this
		 */
		set(f: string, v: any) {
			let def = this._schema.info[f];
			if (def === undefined) {
				throw new Error(`field ${f} is not on the schema`);
			}
			// if (def instanceof Schema) {
			//throw new Error(`Developer Error: not complete`);
			// } else {
			// 	let sfi: SchemaFieldInfo<any>;
			// 	if (Array.isArray(def))
			// 		sfi = def[0];
			// 	else sfi = def;
			// 	switch(sfi.type) {
			// 		case "string":

			// 	}
			// }
			this._obj[f] = v;
			return this;
		}

		/**
		 * This validates the current record 
		 * @returns A results object
		 */
		_validate(): ValidationResult {
			// return this.doValidation(this._obj, this._schema);
			return this._schema.validate(this._obj);
		}

		/*
		 * Recursive object validation, called from validate()
		 * @see validate
		 * @param curObj The current object to validate
		 * @returns {ValidationResult} A validation result object
		 * @todo tuples?
		 *
		private doValidation(curObj: any, schema: Schema | SchemaDefinition, curField: string = ""): ValidationResult {
			if (curField.length > 0)
				curField += ".";
			let makeName = (v: string) => curField + v;
			let rv: ValidationResult = {
				result: true,
				fields: {},
				errors: []
			};
			let schDef: SchemaDefinition;
			if (schema instanceof Schema)
				schDef = schema.info;
			else
				schDef = schema;
			let keys = schDef.keys;
			for (const schName in schDef) {
				let schInfo = schDef[schName];
				let v = curObj[schName];
				let fieldName = makeName(schName);

				// array of schema objects
				if (Array.isArray(schInfo)) {
					// there should be only one
					// unless we want to do tuples
					schInfo = schInfo[0];

					// if our current value is an array, we're good
					if (v instanceof Array) {
						for (let i = 0; i < v.length; i++) {
							let val = v[i];
							let key = `[${i}]`;
							let subSchDef: SchemaDefinition = {
								key: schInfo
							}
							let subRes = this.doValidation(v, subSchDef, fieldName);
							rv.fields[fieldName] = rv.fields[fieldName] && subRes.result;
							rv.result = rv.result && subRes.result;
							if (!subRes.result) {
								key = `${fieldName}${key}`;
								rv.errors.push({ fieldName: key, error: subRes.errors[0].error });
							}
						}
					} else {
						// current value was not an array
						rv.result = false;
						rv.fields[fieldName] = false;
						rv.errors.push({ fieldName, error: "Expected array" });
					}
				}
				else if (schInfo instanceof Schema) {
					let subRes = this.doValidation(v, schInfo, fieldName);
					rv.result = rv.result && subRes.result;
					rv.errors = rv.errors.concat(subRes.errors);
					rv.fields[fieldName] = subRes;
				}
				else {
					try {
						let res = this.validateByType(schInfo, v);
						rv.fields[fieldName] = res;
						rv.result = rv.result && res;
						if (!res) {
							rv.errors.push({ fieldName, error: "Wrong data type" });
							continue;
						}

					} catch (e) {
						throw new Error(`Developer Error: Schema for ${this.constructor.name} field ${schName} has unrecognized value ${schInfo}.`);
					}
				}
			}
			return rv;
		}

		/*
		 * Validate data type matches record value
		 * @param {SchemaFieldInfo} info The schema field info
		 * @param {*} v the value to check 
		 * @returns {boolean} true if validation passed
		 * @todo some cases not handled
		 *
		private validateByType(info: SchemaFieldInfo<any>, v: any): boolean {
			switch (info.type) {
				case "string":
					return typeof v === "string";
				case "number":
					return typeof v === "number";
				case "date":
				case "datetime":
					// checks if it is a valid date by calling
					// toString on it, as Date objects can be invalid
					// like new Date("randomstring")
					if (!(v instanceof Date))
						return false;
					return Object.prototype.toString.call(v) === '[object Date]'
				default:
					throw new Error(`Unhandled schema type ${type}`);
			}
		}

		/*
		 * Validate field data minimum and maximums
		 * @param {SchemaFieldInfo} info The schema field info
		 * @param {*} v the value to check
		 * @returns {string|undefined} string if there's an error
		 * @todo some cases not handled
		 *
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
					throw new Error(`Developer Error: validateMinMax ${info.type} not handled`);
			}
		}
		*/

		toJSON() {
			let rv: any = {
				doctype__: BaseModel.doctype__,
				schema_version__: this._schema.schema_version__
			};
			if (!!this._obj._id)
				rv['_id'] = this._obj._id;
			if (!!this._obj._rev)
				rv['_rev'] = this._obj._rev;
			let sFields = this._schema.getFields();
			for (const [key, value] of Object.entries(this._obj)) {
				if (key === '_id' || key === '_rev' || key === 'doctype__' || key === 'schema_version__')
					continue;
				if (sFields.includes(key))
					continue;
				console.log(`WARNING: extra data ${key} found on document '${this._id}'`);
				rv[key] = value;
			}
			return rv;
		}
	}
	return BaseModel;
}

export interface BaseDocument {
	_id?: string;
	_rev?: string;
	doctype__: string;
	schema_version__: number;
}

