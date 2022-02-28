/** 
 * Errors
 * @module errors
 */

 /**
 * This error is thrown when a document does not have the
 * proper type field. 
 */
export class ModelMismatchError extends Error {
	id : string;
	expected: string;
	received: string;
	constructor(id:string, expected: string, received: string, ...params: any) {
		super(...params);

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ModelMismatchError)
		}
		this.id = id;
		this.name = "ModelMismatchError";
		this.expected = expected;
		this.received = received;
		if (!!received)
			this.message = `Document ${id} of type ${received} expected to be of type ${expected}`;
		else
			this.message = `Document ${id} has no type, but expected type ${expected}`;
	}
}
