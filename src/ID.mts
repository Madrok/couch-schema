/**
 * A wrapper for a couchdb _id
 */
export class ID {
	__id: string;
	constructor(id: string) {
		this.__id = id;
	}

	get _id(): string {
		return this.__id;
	}

	set _id(v: string) {
		if ((!!this.__id) && this.__id !== "") {
			throw new Error(`Id can not be set once set`);
		}
		this.__id = v;
	}

	toJSON() {
		return (!!this.__id) ? this.__id : null;
	}
}