# couch-schema
couch-schema is a framework for generating typescript schema files for use with [CouchDB](https://couchdb.apache.org/)

## JSON Schema Files
All schemas are created in json files, which are then used to created typescript models.
### schema.json
```json
{
    "name": "Person",
    "version": 1,
    "customImportLines": ["import {Blah} from 'blah';"],
    "fields": {
        "name": "string"
    }
}
```
- name - Required, this is the name of the schema
- version - This number is stored in the couchdb record, and is used for updating records to new schemas
- customImportLines - Optional array of imports to be added to all output files
- fields - required field definitions

### fields
fields can be scpecified in simple or structured format
```json
{
    "fields": {
        "name": "string",
        "address": "optstring"
    }
}
```
This simple format has the basic types 'string', 'number' and 'boolean' as well as 'opt' versions of the same, like 'optstring'. The opt versions means the field is optional, and will pass validation if the field doesn't exist on the object.

The more advanced format is
```json
{
    "name": {
        "type": "string",
        "validate": "(v:string) => (v && v.length > 4)",
        "validateFailMsg": "Name length must be more than 4 characters"
    }    
}

## Command Line Tool
Installed with the package is a binary called 'schema-generator'. This is the tools used to generate typescript models from the json schema files.

### Command Line Options

schema-generator --help
```
CouchDB Schema Generator

  Generates schema files for CouchDB. JSON files in a directory are loaded and  
  turned into typescript schema files, and output in the destination directory  

Options

  -h, --help         Display this usage guide.                                                
  --src string       The source directory. All json files in this directory will be processed 
  --pkgPath string   Override for the couch-schema import line                                
  --out string       The output directory. This directory must exist, it will not be created  
  --force            If the output file exists, force overwrite it.                           

Usage

  $ schema-generator [--verbose] [--force|-f] --out directory [--src] directory 
                                                   
```