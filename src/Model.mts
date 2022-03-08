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

export interface BaseDocument {
	_id?: string;
	_rev?: string;
	doctype__: string;
	schema_version__: number;
}

/**
 * The base model class. All documents in a database
 * have a 'doctype__' field, which is essentially its
 * 'collection' type
 * @param type The field value in each collection record
 * @returns The base model mixin
 */
export class Model<DT extends BaseDocument> {
	private static models: { [key: string]: any };
	protected static _server: nano.DocumentScope<any>;

	/**
	 * Every descendent of Model must have the nano db
	 * object passed to it.
	 * @param db
	 */
	static async init(db: nano.DocumentScope<any>) {
		Model._server = db;
	}

	protected static registerModel(doctype__: string, model: any) {
		Model.models[doctype__] = model;
	}

	/**
	 *
	 * @param id the _id of the record
	 * @returns
	 */
	static async findById(doctype__: string, id: string): Promise<Model<any> | null> {
		try {
			let res = await Model._server.get(id);
			console.log(res);
			if (!!!res)
				return null;
			let rv = new Model.models[doctype__](res);
			// if (res['type'] === BaseModel.doctype__)
			// 	return new BaseModel._class(res);
			// throw new ModelMismatchError(id, BaseModel.doctype__, res['type']);
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

	static async find(doctype__: string, query: nano.MangoQuery): Promise<nano.MangoResponse<Model<any>>> {
		query.selector['doctype__'] = doctype__;
		// find documents where the name = "Brian" and age > 25.
		// const q = {
		// 	selector: {
		// 		name: { "$eq": "Brian" },
		// 		age: { "$gt": 25 }
		// 	},
		// 	fields: ["name", "age", "tags", "url"],
		// 	limit: 50
		// };
		const response = await Model._server.find(query);
		return response;
	}

	static async findOne(doctype__: string, query: nano.MangoQuery) {
		query.limit = 1;
		return await Model.find(doctype__, query);
	}

	////////////////////////////////////////////////////
	////////////// Instance Methods/Members ////////////
	////////////////////////////////////////////////////

	protected _schema: Schema;
	protected _obj: DT;
	readonly doctype__: string;

	/**
	 * Construct a new Model based on a schema
	 * @todo When reading in an object, do conversions from JSON to things like Date fields as in the schema
	 * @param schema A schema object
	 * @param obj an initial object
	 */
	protected constructor(doctype__: string, schema: Schema, obj?: any) {
		this._schema = schema;
		this.doctype__ = doctype__;

		if (obj === undefined) {
			obj = {
				doctype__: this.doctype__,
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
		if (this._obj.doctype__ !== this.doctype__) {
			throw new ModelMismatchError(rid, this.doctype__, this._obj.doctype__);
		}
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
		return (this._obj as any)[v];
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
		(this._obj as any)[f] = v;
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

	toJSON() {
		let rv: any = {
			doctype__: this.doctype__,
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



