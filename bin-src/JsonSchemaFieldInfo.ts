import { JsonSchema } from "./JsonSchema";

/**
 * The type of a field
 * @type JsonSchemaFieldType
 * @memberof JsonSchemaFieldInfo
 */
 type JsonSchemaFieldType = "string" | "boolean" | "number" | "date" | "datetime" | "timestamp" | "buffer" | "array" | "schema" | "subschema" | "calculated";


 export interface JsonSchemaFieldInfo {
     /** flag used in generation to indicate array types */
     _isArray: boolean;
     /** the type of the field */
     type: JsonSchemaFieldType;
     /** default value, if any */
     default?: any;
     /** valid values for typescript fenced typing */
     values?: string;
     /** 
      * A function to validate input. If it throws an Error, Error.message 
      * will be used as validation failure text. 
      * param {T} v the data to validate
      * param {*} any additional data the validator needs
      * see {@link validateFailMsg|validateFailMsg}
      **/
     validate?: string;
     /** a validation failure message. this is used if the validation function does not throw an error */
     validateFailMsg?: string;
 
     schema?: string | JsonSchema,
     /** 
      * A function to format input. If it throws an Error, Error.message 
      * will be used as validation failure text. 
      * param {T} v the data to validate
      * param {*} any additional data the validator needs
      **/
     formatter?: string;
 
     /** If field is required */
     required?: boolean | string;
     /** Minimum value. For arrays, indicates minimum array length, strings the minimum length */
     min?: number | string;
     /** Maximum value. For arrays, max number of elements, for strings max string length */
     max?: number | string;

     /**
      * Function called to calculate this field for type 'calculated.
      * This must be a curly brace-contained function body
      * that returns a value of the type in 'calculatedType'
      */
     calculator?: string;
     /** the type of value returned by the calculator */
     calculatedType?: string;
 }

export interface Fields {
	[key: string]: JsonSchemaFieldInfo
}