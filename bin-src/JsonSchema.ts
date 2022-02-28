import { Fields } from "./JsonSchemaFieldInfo";

export interface JsonSchema {
	name: string;
	version: number;
	filename: string;
	fields: Fields;
	imports: string[];
	requiresDateOnly: boolean;
	customImportLines: string[];
}