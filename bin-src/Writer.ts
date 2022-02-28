import { GeneratorError } from "./GeneratorError";
import { JsonSchema } from "./JsonSchema";
import { Fields, JsonSchemaFieldInfo } from "./JsonSchemaFieldInfo";
import { IProgramOptions } from "./schemagenerator";
import fs from 'fs';

export class Writer {
	opts: IProgramOptions
	constructor(opts: IProgramOptions) {
		this.opts = opts;
	}

	createInitializer(keys: string[]) {
		const fd = fs.openSync(outputFileName(this.opts.out, "couchModelsInit"), "w", 0o644);
		fs.writeFileSync(fd, `import nano from "nano";\n`);
		for (let v of keys) {
			fs.writeFileSync(fd, `import { ${v} } from './${v}.js';\n`);
		}
		fs.writeFileSync(fd, "\nexport function initializeModels(db: nano.DocumentScope<any>) {\n");
		for (let v of keys) {
			fs.writeFileSync(fd, `\t${v}.init(db, ${v});\n`);
		}
		fs.writeFileSync(fd, "}\n");
		fs.closeSync(fd);
	}

	generateFile(schemaName: string, schema: JsonSchema) {
		// let schemaFileName = schema.name + ".ts";
		// let outFileName = this.outputDir.endsWith("/") ?
		// 	`${this.outputDir}${schemaFileName}` : `${this.outputDir}/${schemaFileName}`;
		if (fs.existsSync(outputFileName(this.opts.out, schemaName)) && !this.opts.force) {
			throw new GeneratorError(`${schemaFileName(schemaName)} already exists in output directory ${this.opts.out}`);
		}

		const fd = fs.openSync(outputFileName(this.opts.out, schemaName), "w", 0o644);
		let write = (v:string) => fs.writeFileSync(fd, v);
		write(`// This file is automatically generated.\n// Do not modify.\n\n`);
		write(packageImports(this.opts.pkgPath, schema.requiresDateOnly ? ", DateOnly" : ""));
		for (let i = 0; i < schema.imports.length; i++) {
			write(requireLine(schema.imports[i]));
		}
		write(upgraderImport(schemaName));
		if (schema.customImportLines !== undefined) {
			for (let v of schema.customImportLines) {
				write(v + "\n");
			}
		}

		write(doctypeLine(schemaName));
		write(schemaVersionLine(schema.version));
		// fenced types
		for (const [key, value] of Object.entries(schema.fields)) {
			if (value.values !== undefined) {
				write(`\ntype fence${key} = ${value.values};`);
			}
		}

		// interface
		write("\n");
		write(interfaceStartLine(schemaName));
		for (const [key, value] of Object.entries(schema.fields)) {
			if (value.type !== 'calculated') {
				write(`\t${key}`);
				write(interfaceMemberLine(key, value));
			}
		}
		closeStruct(fd);

		// schema
		write(schemaStartLine(schemaName));
		for (const [key, value] of Object.entries(schema.fields)) {
			write(schemaMemberLine(key, value));
		}
		write("});\n");

		// model
		write(modelStartLine(schemaName));
		// for (const [key, value] of Object.entries(schema.fields)) {
		// 	write(modelMemberLine(key, value));
		// }
		write("\n");

		// model constructor
		write(modelConstructorStart(schemaName));
		for (const [key, value] of Object.entries(schema.fields)) {
			//write(modelMemberInitializer(key, value));
			if (value.type === 'subschema') {
				let isArray = value._isArray;
				let obj = `this._obj.${key}`;
				if(value.required) {
					write(`\t\tif(${obj} === undefined)\n`);
					write(`\t\t\t${obj} = ${isArray ? "[]" : "{}"};\n`);
				}
				if (!isArray) {
					write(
						`\t\t${obj} = new ${(value.schema as JsonSchema).name}(${obj});\n`);
				}
				else {
					let sName = (value.schema as JsonSchema).name;
					write(`\t\tif(!Array.isArray(${obj})) {\n`);
					write(`\t\t\tif(${obj} !== undefined)\n`);
					write(`\t\t\t\t${obj} = [${obj}];\n`);
					if(value.required) {
						write(`\t\t\telse\n`);
						write(`\t\t\t\t${obj} = []\n`);
					}
					write(`\t\t}\n`);
					write(`\t\tif(Array.isArray(${obj})) {\n`);
					write(`\t\t\tfor(let i=0; i<${obj}.length; i++)\n`);
					write(`\t\t\t\t${obj}[i] = new ${sName}(${obj}[i]);\n`);
					write(`\t\t}\n`);
				}
			}
		}
		write(modelConstructorEnd());

		// getters/setters
		for (const [key, value] of Object.entries(schema.fields)) {
			write(modelGetSetLines(key, value));
		}

		// toJSON
		write(modelToJson(schema.fields));

		// end of class
		closeStruct(fd);

		write("\n");
		//write(`${schemaName}._class = ${schemaName};\n`);
		fs.closeSync(fd);
	}
}

let escapeDoubleQuotes = (value: string) => value.replace(/[']/g, "\"");

let schemaFileName = (n: string): string => `${n}.ts`;

let outputFileName = (outputDir: string, n: string): string => outputDir.endsWith("/") ?
	`${outputDir}${schemaFileName(n)}` : `${outputDir}/${schemaFileName(n)}`;

let interfaceName = (n: string): string => `I${n}Doc`;

let schemaName = (n: string): string => `${n}Schema`;

let packageImports = (pkgPath:string, additional:string): string => `import { BaseDocument, Model, Schema, Validators ${additional}} from '${pkgPath}';\n`;

/** the line for the schema version update script */
let upgraderImport = (n: string) => `import { upgrade${n} } from './upgraders.js';\n`

/** other schema imports */
let requireLine = (n: string): string => `import { ${n}, ${interfaceName(n)}, ${schemaName(n)} } from './${n}.js'\n`;

/** the const variable for the doc type in the couch record */
let doctypeLine = (n: string): string => `\nconst doctype__ = "${n.toLowerCase()}";\n`

let interfaceStartLine = (n: string) => `\nexport interface ${interfaceName(n)} extends BaseDocument {\n`;

let schemaVersionLine = (n: number) => `\nconst schema_version__ = ${n};\n`;

let schemaStartLine = (n: string) => `\nexport const ${schemaName(n)} = new Schema(schema_version__, upgrade${n}, {\n`;

let modelStartLine = (n: string): string => `\nexport class ${n} extends Model<${interfaceName(n)}>(doctype__) {\n`;

let modelConstructorStart = (n: string): string => `\tconstructor(obj: any = {}) {\n\t\tsuper(${schemaName(n)}, obj);\n`

let modelConstructorEnd = (): string => `\t}\n`;

/** output a closing brace */
let closeStruct = (fd: number) => fs.writeFileSync(fd, '}\n');

let typescriptType = (k: string, v: JsonSchemaFieldInfo): string => {
	let suffix = (v: JsonSchemaFieldInfo) => v._isArray ? "[]" : "";
	if (v.values !== undefined) {
		return `fence${k}${v._isArray ? "[]" : ""}`;
	}
	switch (v.type) {
		case "subschema":
			return (v.schema as JsonSchema).name + suffix(v);
		case "string":
		case "number":
		case "boolean":
			return v.type + suffix(v);
		case "date":
			return "DateOnly" + suffix(v);
		case "datetime":
			return "Date" + suffix(v);
	}
	throw new Error(`Unhandled ${v.type}`);
}

let interfaceMemberLine = (fieldName: string, field: JsonSchemaFieldInfo): string => {
	let rv = "";

	if (field.type === "calculated")
		return rv;

	if (!field.required) rv += "?";
	rv += ": ";
	if (field.values) {
		rv += `fence${fieldName}`;
	} else {
		switch (field.type) {
			case "string":
			case "number":
			case "boolean":
				rv += field.type;
				break;
			case "date":
				rv += "DateOnly";
				break;
			case "datetime":
				rv += "Date";
				break;
			case "subschema":
				rv += interfaceName((field.schema as JsonSchema).name);
				break;
			default:
				throw new Error(`Unhandled field type ${field.type}`);
		}
	}
	if (field._isArray)
		rv += "[]"
	rv += ";\n"
	return rv;
}

let schemaMemberLine = (fieldName: string, field: JsonSchemaFieldInfo): string => {
	let rv = "";
	if (field.type === "subschema") {
		let pf = field._isArray ? "[" : '';
		let sf = field._isArray ? "]" : '';
		rv += `\t${fieldName}: ${pf}${schemaName((field.schema as JsonSchema).name)}${sf},\n`;
	}
	else if (field.type === 'schema') {
		throw new Error(`Unhandled ${field.type} for ${fieldName}`);
	}
	else {
		rv += `\t${fieldName}: ${field._isArray ? "[" : ''}{\n`;
		for (const [key, v] of Object.entries(field)) {
			let value = v;
			let q = "";

			// don't write out fields that are added for the generator
			if (['_isArray', 'calculatedType'].includes(key)) continue;

			// all of these fields the values should be quoted
			q = ['type', 'validateFailMsg', 'calculatedType', 'values'].includes(key) ? "'" : "";
			if (field.type === 'calculated' && key === 'calculator')
				q = "'";

			// if quoted, escape the value
			if (q !== "") {
				// value = (value as string).replace(/[']/g, "\"");
				value = escapeDoubleQuotes(value);
			}
			if (key === "default" && field.type !== "number" && field.type !== "boolean") {
				// value = `'${(value as string).replace(/[']/g, "\"")}'`;
				value = `'${escapeDoubleQuotes(value)}'`;
			}
			rv += `\t\t${key}: ${q}${value}${q},\n`;
		}
		rv += `\t}${field._isArray ? ']' : ''},\n`;
	}

	return rv;
}

// let modelMemberLine = (fieldName: string, field: JsonSchemaFieldInfo): string => {
// 	let rv = `\t${fieldName}: `;
// 	switch(field.type) {
// 		case "string":
// 		case "boolean":
// 		case "number":
// 			rv += field.type;
// 			if(!field.required) {
// 				rv += " | undefined";
// 			}
// 			if(field.default !== undefined) {
// 				rv += ` = `;
// 				if(field.type === 'string') {
// 					rv += `'${escapeDoubleQuotes(field.default)}'`;
// 				} else {
// 					rv += field.default;
// 				}
// 			} 
// 			else if(field.required) {
// 				rv += " | undefined /* but required */";
// 			}
// 			break;
// 		case "date":
// 			rv += "DateOnly";
// 			break;
// 		case "datetime":
// 		case "timestamp":
// 			rv += "Date"
// 			break;
// 		case "subschema":
// 			let sn = (field.schema as JsonSchema).name;
// 			rv += `${sn} = new ${sn}()`;
// 			break;
// 		default:
// 			throw new Error(`incomplete for ${field.type}`);
// 	}
// 	rv += ";\n"
// 	return rv;
// }

let modelGetSetLines = (fieldName: string, field: JsonSchemaFieldInfo): string => {
	let rv = ``;
	if (field.type === 'subschema') {
		rv = `\n\tget ${fieldName}(): ${typescriptType(fieldName, field)} { return this.${fieldName} }\n`;
	}
	else if (field.type === 'calculated') {
		rv = `\n\tget ${fieldName}(): ${field.calculatedType} ${field.calculator}\n`;
	}
	else {
		rv = `\n\tget ${fieldName}(): ${typescriptType(fieldName, field)} | undefined { return this._obj.${fieldName} }\n`;
		// rv += `\tset ${fieldName}(v:${field.type}) {\n\t\tif (v === undefined)\n\t\t\tdelete this._obj.${fieldName};\n\t\telse\n\t\t\tthis._obj.${fieldName} = v;\n\t}\n`;
		rv += `\tset ${fieldName}(v: ${typescriptType(fieldName, field)} | undefined) {
		if (v === undefined)
			delete this._obj.${fieldName};
		else
			this._obj.${fieldName} = v;
	}\n`;

	}


	// switch(field.type) {
	// 	case "string":
	// 	case "boolean":
	// 	case "number":
	// 		rv += field.type;
	// 		if(!field.required) {
	// 			rv += " | undefined";
	// 		}
	// 		if(field.default !== undefined) {
	// 			rv += ` = `;
	// 			if(field.type === 'string') {
	// 				rv += `'${escapeDoubleQuotes(field.default)}'`;
	// 			} else {
	// 				rv += field.default;
	// 			}
	// 		} 
	// 		else if(field.required) {
	// 			rv += " | undefined /* but required */";
	// 		}
	// 		break;
	// 	case "date":
	// 		rv += "DateOnly";
	// 		break;
	// 	case "datetime":
	// 	case "timestamp":
	// 		rv += "Date"
	// 		break;
	// 	case "subschema":
	// 		let sn = (field.schema as JsonSchema).name;
	// 		rv += `${sn} = new ${sn}()`;
	// 		break;
	// 	default:
	// 		throw new Error(`incomplete for ${field.type}`);
	// }
	return rv;
}

let modelToJson = (fields: Fields): string => {
	let rv = "\n\ttoJSON() {\n";
	rv += `\t\tlet rv = super.toJSON();`;
	for (const [key, v] of Object.entries(fields)) {
		if (v.type === 'calculated')
			continue;
		rv += `\n\t\tif(this.${key} !== undefined)`
		rv += `\n\t\t\trv['${key}'] = `;
		if (v.type === 'subschema') {
			if (!v._isArray) {
				rv += `this.${key}.toJSON();`;
			} else {
				rv += `this.${key}.map(x=>x.toJSON());`;
			}
		}
		else if (v.type === 'datetime') {
			rv += `this.${key}.toISOString();`
		}
		else if (v.type === 'date') {
			rv += `this.${key}.toString();`
		}
		else {
			rv += `this.${key};`;
		}
	}
	rv += "\n\t\treturn rv;\n\t}\n";
	/*
	rv += "\t\treturn {"
	var first = true;
	for (const [key, v] of Object.entries(fields)) {
		if(v.type === 'calculated')
			continue;
		if (!first) rv += ",";
		first = false;
		rv += `\n\t\t\t${key}: `;

		if (v.type === 'subschema') {
			if (!v._isArray) {
				rv += `this.${key}.toJSON()`;
			} else {
				rv += `this.${key}.map(x=>x.toJSON())`;
			}
		} else {
			rv += `this.${key}`;
		}
	}
	rv += "\n\t\t}\n\t}\n"
	*/
	return rv;
}