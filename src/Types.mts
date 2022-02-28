import { DateOnly } from "./DateOnly.mjs";
import { SchemaFieldInfo } from "./Schema.mjs";

/**
 * @module models/Types
 */

/**
 * A string type. Defaults to ""
 */
export let TString: SchemaFieldInfo<string> = {
	type: "string",
	required: true,
	min: 0,
	default: ""
}

/**
 * An optional string
 */
export let TOptString: SchemaFieldInfo<string> = {
	type: "string",
	required: false
}

/**
 * A boolean field. Defaults to false
 */
export let TBoolean: SchemaFieldInfo<boolean> = {
	type: "boolean",
	required: true,
	default: false
}

/**
 * A optional boolean field. Defaults to false
 */
export let TOptBoolean: SchemaFieldInfo<boolean> = {
	type: "boolean",
	required: false,
	default: false
}

/**
 * A number type. Defaults to 0
 */
export let TNumber: SchemaFieldInfo<number> = {
	type: "number",
	required: true,
	default: 0
}

/** A date type. */
export let TDate: SchemaFieldInfo<Date> = {
	type: "date",
	required: true,
	//default: DateOnly.now()
}

/** A date and time type. */
export let TDateTime: SchemaFieldInfo<Date> = {
	type: "datetime",
	required: true,
	//default: Date.now()
}

/**
 * A timestamp, which is added when the record is created
 */
export let TTimestamp: SchemaFieldInfo<Date> = {
	type: "timestamp",
	required: false
}